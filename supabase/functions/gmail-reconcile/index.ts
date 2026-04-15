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
    scope: "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.modify",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const encode = (obj: any) => btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
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

  if (!tokenRes.ok) throw new Error(`Failed to get access token: ${await tokenRes.text()}`);
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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let serviceAccountKeyStr = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
    if (!serviceAccountKeyStr) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY not configured");
    serviceAccountKeyStr = serviceAccountKeyStr.trim();
    let serviceAccountKey: any;
    try {
      serviceAccountKey = JSON.parse(serviceAccountKeyStr);
    } catch {
      serviceAccountKey = JSON.parse(atob(serviceAccountKeyStr));
    }

    // Parse optional mailbox_id filter
    let requestedMailboxId: string | null = null;
    try {
      const body = await req.json();
      requestedMailboxId = body?.mailbox_id || null;
    } catch { /* no body */ }

    let mbQuery = supabase
      .from("team_mailboxes")
      .select("*")
      .eq("sync_enabled", true);
    if (requestedMailboxId) mbQuery = mbQuery.eq("id", requestedMailboxId);

    const { data: mailboxes, error: mbError } = await mbQuery;
    if (mbError) throw mbError;
    if (!mailboxes || mailboxes.length === 0) {
      return new Response(JSON.stringify({ message: "No mailboxes", corrections: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalCorrections = 0;

    for (const mailbox of mailboxes) {
      try {
        const accessToken = await getAccessToken(serviceAccountKey, mailbox.email);

        // Get all local inbox conversations for this mailbox
        const { data: localConvs } = await supabase
          .from("conversations")
          .select("id, gmail_thread_id, state, is_read")
          .eq("mailbox_id", mailbox.id)
          .in("state", ["inbox", "archived"])
          .not("gmail_thread_id", "is", null);

        if (!localConvs || localConvs.length === 0) continue;

        // Check each conversation against Gmail
        for (const conv of localConvs) {
          try {
            const threadRes = await fetch(
              `https://gmail.googleapis.com/gmail/v1/users/me/threads/${conv.gmail_thread_id}?format=minimal`,
              { headers: { Authorization: `Bearer ${accessToken}` } }
            );

            if (threadRes.status === 404) {
              // Thread deleted on Gmail — move to trash locally
              if (conv.state !== "trash") {
                await supabase
                  .from("conversations")
                  .update({ state: "trash" })
                  .eq("id", conv.id);
                await supabase.from("sync_journal").insert({
                  conversation_id: conv.id,
                  mailbox_id: mailbox.id,
                  drift_type: "thread_deleted",
                  local_state: conv.state,
                  remote_state: "deleted",
                  action_taken: "moved_to_trash",
                });
                totalCorrections++;
              }
              continue;
            }

            if (!threadRes.ok) continue;

            const threadData = await threadRes.json();
            const lastMsg = threadData.messages?.[threadData.messages.length - 1];
            if (!lastMsg) continue;

            const labels = lastMsg.labelIds || [];
            const gmailHasInbox = labels.includes("INBOX");
            const gmailIsRead = !labels.includes("UNREAD");

            // State drift: Gmail says INBOX but local says archived
            if (gmailHasInbox && conv.state === "archived") {
              await supabase
                .from("conversations")
                .update({ state: "inbox" })
                .eq("id", conv.id);
              await supabase.from("sync_journal").insert({
                conversation_id: conv.id,
                mailbox_id: mailbox.id,
                drift_type: "state_mismatch",
                local_state: "archived",
                remote_state: "inbox",
                action_taken: "restored_to_inbox",
              });
              totalCorrections++;
            }

            // State drift: Gmail says NOT INBOX but local says inbox
            if (!gmailHasInbox && conv.state === "inbox") {
              await supabase
                .from("conversations")
                .update({ state: "archived" })
                .eq("id", conv.id);
              await supabase.from("sync_journal").insert({
                conversation_id: conv.id,
                mailbox_id: mailbox.id,
                drift_type: "state_mismatch",
                local_state: "inbox",
                remote_state: "archived",
                action_taken: "moved_to_archived",
              });
              totalCorrections++;
            }

            // Read state drift
            if (gmailIsRead !== conv.is_read) {
              await supabase
                .from("conversations")
                .update({ is_read: gmailIsRead })
                .eq("id", conv.id);
              await supabase.from("sync_journal").insert({
                conversation_id: conv.id,
                mailbox_id: mailbox.id,
                drift_type: "read_state_mismatch",
                local_state: conv.is_read ? "read" : "unread",
                remote_state: gmailIsRead ? "read" : "unread",
                action_taken: gmailIsRead ? "marked_read" : "marked_unread",
              });
              totalCorrections++;
            }
          } catch (convErr) {
            console.error(`Error reconciling conversation ${conv.id}:`, convErr);
          }
        }
      } catch (mbErr) {
        console.error(`Error reconciling mailbox ${mailbox.email}:`, mbErr);
      }
    }

    return new Response(
      JSON.stringify({ corrections: totalCorrections }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("gmail-reconcile error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
