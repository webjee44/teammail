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

    // Auth check: require valid user JWT
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

    // Get conversation with its gmail_thread_id and mailbox
    const { data: conv, error: convErr } = await supabase
      .from("conversations")
      .select("id, gmail_thread_id, mailbox_id")
      .eq("id", conversation_id)
      .maybeSingle();

    if (convErr) {
      return new Response(
        JSON.stringify({ error: convErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Already gone — treat as success
    if (!conv) {
      return new Response(
        JSON.stringify({ success: true, already_gone: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If we have a Gmail thread, archive on Gmail FIRST — fail hard if it doesn't work
    if (conv.gmail_thread_id && conv.mailbox_id) {
      const { data: mailbox } = await supabase
        .from("team_mailboxes")
        .select("email, id")
        .eq("id", conv.mailbox_id)
        .single();

      if (mailbox) {
        try {
          const archiveRes = await fetch(
            `${GATEWAY_URL}/users/me/threads/${conv.gmail_thread_id}/modify`,
            {
              method: "POST",
              headers: gmailHeaders({ "Content-Type": "application/json" }),
              body: JSON.stringify({ removeLabelIds: ["INBOX"] }),
            }
          );

          if (!archiveRes.ok) {
                const errText = await archiveRes.text();
                console.error("Gmail archive error:", errText);

                // Log drift in sync_journal
                await supabase.from("sync_journal").insert({
                  conversation_id: conv.id,
                  mailbox_id: mailbox.id,
                  drift_type: "archive_failed",
                  local_state: "inbox",
                  remote_state: "inbox",
                  action_taken: `Gmail API error: ${archiveRes.status} — ${errText.slice(0, 200)}`,
                });

                // DO NOT update local state — return error to client
                return new Response(
                  JSON.stringify({ error: "Gmail archive failed", detail: errText.slice(0, 200) }),
                  { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
          }
        } catch (gmailErr) {
              console.error("Gmail archive failed:", gmailErr);

              // Log drift in sync_journal
              await supabase.from("sync_journal").insert({
                conversation_id: conv.id,
                mailbox_id: mailbox.id,
                drift_type: "archive_failed",
                local_state: "inbox",
                remote_state: "inbox",
                action_taken: `Exception: ${String(gmailErr).slice(0, 200)}`,
              });

              // DO NOT update local state — return error to client
              return new Response(
                JSON.stringify({ error: "Gmail archive failed", detail: String(gmailErr).slice(0, 200) }),
                { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
        }
      }
    }

    // Gmail archive succeeded (or no gmail_thread_id — local-only conversation)
    // Now safe to update local state
    const { error: updateErr } = await supabase
      .from("conversations")
      .update({ state: "archived" })
      .eq("id", conversation_id);

    if (updateErr) {
      return new Response(
        JSON.stringify({ error: updateErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("gmail-archive error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
