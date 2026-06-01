import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Lovable Gmail connector gateway
const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";

function gmailHeaders(extra: Record<string, string> = {}) {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const connKey = Deno.env.get("GOOGLE_MAIL_API_KEY");
  if (!lovableKey) throw new Error("LOVABLE_API_KEY missing");
  if (!connKey) throw new Error("GOOGLE_MAIL_API_KEY missing (Gmail connector not linked)");
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": connKey,
    ...extra,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const token = authHeader.replace("Bearer ", "");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: authData, error: authErr } = await authClient.auth.getUser(token);
    if (authErr || !authData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { conversation_id } = await req.json();
    if (!conversation_id) {
      return new Response(
        JSON.stringify({ error: "Missing conversation_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get conversation with gmail_thread_id and mailbox
    const { data: conv, error: convErr } = await supabase
      .from("conversations")
      .select("gmail_thread_id, mailbox_id")
      .eq("id", conversation_id)
      .single();

    if (convErr || !conv) {
      return new Response(
        JSON.stringify({ error: "Conversation not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If no Gmail thread linked, just mark as read in DB and return success
    if (!conv.gmail_thread_id) {
      await supabase.from("conversations").update({ is_read: true }).eq("id", conversation_id);
      return new Response(
        JSON.stringify({ success: true, marked: 0, note: "No Gmail thread linked" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get mailbox email — if no mailbox, still mark as read in DB
    let mailboxEmail: string | null = null;
    if (conv.mailbox_id) {
      const { data: mailbox } = await supabase
        .from("team_mailboxes")
        .select("email")
        .eq("id", conv.mailbox_id)
        .single();
      mailboxEmail = mailbox?.email || null;
    }

    if (!mailboxEmail) {
      await supabase.from("conversations").update({ is_read: true }).eq("id", conversation_id);
      return new Response(
        JSON.stringify({ success: true, marked: 0, note: "No mailbox configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all message IDs in the thread
    const threadRes = await fetch(
      `${GATEWAY_URL}/users/me/threads/${conv.gmail_thread_id}?format=minimal`,
      { headers: gmailHeaders() }
    );

    if (!threadRes.ok) {
      const errText = await threadRes.text();
      // Thread not found in Gmail — mark as read in DB and move on
      if (threadRes.status === 404) {
        await supabase.from("conversations").update({ is_read: true }).eq("id", conversation_id);
        return new Response(
          JSON.stringify({ success: true, marked: 0, note: "Gmail thread not found, marked read in DB" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ error: `Gmail API error: ${errText}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const threadData = await threadRes.json();
    const messages = threadData.messages || [];

    // Mark each unread message as read by removing UNREAD label
    let marked = 0;
    for (const msg of messages) {
      if (msg.labelIds?.includes("UNREAD")) {
        const modRes = await fetch(
          `${GATEWAY_URL}/users/me/messages/${msg.id}/modify`,
          {
            method: "POST",
            headers: gmailHeaders({ "Content-Type": "application/json" }),
            body: JSON.stringify({ removeLabelIds: ["UNREAD"] }),
          }
        );
        if (modRes.ok) marked++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, marked }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("gmail-mark-read error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
