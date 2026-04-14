import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getAccessToken(serviceAccountKey: any, userEmail: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: serviceAccountKey.client_email,
    sub: userEmail,
    scope: "https://www.googleapis.com/auth/gmail.modify",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const encode = (obj: any) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const unsignedToken = `${encode(header)}.${encode(payload)}`;

  const pemContents = serviceAccountKey.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\n/g, "");
  const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  const sig = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const jwt = `${unsignedToken}.${sig}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    throw new Error(`Failed to get access token for ${userEmail}: ${err}`);
  }

  const tokenData = await tokenRes.json();
  return tokenData.access_token;
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
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

    // Already deleted or doesn't exist — treat as success
    if (!conv) {
      return new Response(
        JSON.stringify({ success: true, already_gone: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Archive on Gmail if we have a thread ID
    if (conv.gmail_thread_id && conv.mailbox_id) {
      const { data: mailbox } = await supabase
        .from("team_mailboxes")
        .select("email")
        .eq("id", conv.mailbox_id)
        .single();

      if (mailbox) {
        let serviceAccountKeyStr = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
        if (serviceAccountKeyStr) {
          serviceAccountKeyStr = serviceAccountKeyStr.trim();
          let serviceAccountKey: any;
          try {
            serviceAccountKey = JSON.parse(serviceAccountKeyStr);
          } catch {
            try {
              serviceAccountKey = JSON.parse(atob(serviceAccountKeyStr));
            } catch { /* skip Gmail archive if key is invalid */ }
          }

          if (serviceAccountKey) {
            try {
              const accessToken = await getAccessToken(serviceAccountKey, mailbox.email);

              // Archive = remove INBOX label
              const archiveRes = await fetch(
                `https://gmail.googleapis.com/gmail/v1/users/me/threads/${conv.gmail_thread_id}/modify`,
                {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({ removeLabelIds: ["INBOX"] }),
                }
              );

              if (!archiveRes.ok) {
                console.error("Gmail archive error:", await archiveRes.text());
              }
            } catch (gmailErr) {
              console.error("Gmail archive failed:", gmailErr);
            }
          }
        }
      }
    }

    // Delete conversation from DB (cascades to messages via FK)
    const { error: delErr } = await supabase
      .from("conversations")
      .delete()
      .eq("id", conversation_id);

    if (delErr) {
      return new Response(
        JSON.stringify({ error: delErr.message }),
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
