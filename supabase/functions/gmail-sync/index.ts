import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Google Auth via Service Account with Domain-Wide Delegation
async function getAccessToken(serviceAccountKey: any, userEmail: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: serviceAccountKey.client_email,
    sub: userEmail, // impersonate this user
    scope: "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.modify",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const encode = (obj: any) => btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const unsignedToken = `${encode(header)}.${encode(payload)}`;

  // Import the private key
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

  // Exchange JWT for access token
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

// Decode base64url email body
function decodeBody(data: string | undefined): string {
  if (!data) return "";
  try {
    const decoded = atob(data.replace(/-/g, "+").replace(/_/g, "/"));
    return decoded;
  } catch {
    return "";
  }
}

// Extract header value from Gmail message headers
function getHeader(headers: any[], name: string): string | null {
  const h = headers?.find((h: any) => h.name.toLowerCase() === name.toLowerCase());
  return h?.value ?? null;
}

// Parse email body from Gmail message payload
function parseBody(payload: any): { html: string | null; text: string | null } {
  if (!payload) return { html: null, text: null };

  // Simple message (no parts)
  if (payload.body?.data && !payload.parts) {
    const mimeType = payload.mimeType || "";
    const decoded = decodeBody(payload.body.data);
    if (mimeType.includes("html")) return { html: decoded, text: null };
    return { html: null, text: decoded };
  }

  // Multipart message
  let html: string | null = null;
  let text: string | null = null;

  function walkParts(parts: any[]) {
    if (!parts) return;
    for (const part of parts) {
      if (part.mimeType === "text/html" && part.body?.data) {
        html = decodeBody(part.body.data);
      } else if (part.mimeType === "text/plain" && part.body?.data) {
        text = decodeBody(part.body.data);
      }
      if (part.parts) walkParts(part.parts);
    }
  }

  walkParts(payload.parts);
  return { html, text };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    let serviceAccountKeyStr = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
    if (!serviceAccountKeyStr) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY not configured");

    // Try to handle base64-encoded secrets
    serviceAccountKeyStr = serviceAccountKeyStr.trim();
    let serviceAccountKey: any;
    try {
      serviceAccountKey = JSON.parse(serviceAccountKeyStr);
    } catch {
      // Maybe it's base64 encoded
      try {
        serviceAccountKey = JSON.parse(atob(serviceAccountKeyStr));
      } catch (e2) {
        console.error("Failed to parse service account key. First 20 chars:", serviceAccountKeyStr.substring(0, 20));
        throw new Error(`Invalid GOOGLE_SERVICE_ACCOUNT_KEY format: ${e2}`);
      }
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const serviceAccountKey = JSON.parse(serviceAccountKeyStr);

    // Get all enabled mailboxes
    const { data: mailboxes, error: mbError } = await supabase
      .from("team_mailboxes")
      .select("*")
      .eq("sync_enabled", true);

    if (mbError) throw new Error(`Failed to fetch mailboxes: ${mbError.message}`);
    if (!mailboxes || mailboxes.length === 0) {
      return new Response(JSON.stringify({ message: "No mailboxes to sync" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: any[] = [];

    for (const mailbox of mailboxes) {
      try {
        const accessToken = await getAccessToken(serviceAccountKey, mailbox.email);

        // Fetch recent threads (last 50)
        const threadsRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/threads?maxResults=50&labelIds=INBOX`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        if (!threadsRes.ok) {
          const errText = await threadsRes.text();
          console.error(`Gmail API error for ${mailbox.email}:`, errText);
          results.push({ email: mailbox.email, error: errText });
          continue;
        }

        const threadsData = await threadsRes.json();
        const threads = threadsData.threads || [];
        let synced = 0;

        for (const thread of threads) {
          // Check if conversation already exists
          const { data: existing } = await supabase
            .from("conversations")
            .select("id")
            .eq("gmail_thread_id", thread.id)
            .eq("team_id", mailbox.team_id)
            .maybeSingle();

          // Fetch full thread
          const threadRes = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/threads/${thread.id}?format=full`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );

          if (!threadRes.ok) continue;
          const threadData = await threadRes.json();
          const gmailMessages = threadData.messages || [];
          if (gmailMessages.length === 0) continue;

          const firstMsg = gmailMessages[0];
          const lastMsg = gmailMessages[gmailMessages.length - 1];
          const subject = getHeader(firstMsg.payload?.headers, "Subject") || "(sans objet)";
          const fromHeader = getHeader(firstMsg.payload?.headers, "From") || "";
          
          // Parse "Name <email>" format
          const fromMatch = fromHeader.match(/^(.+?)\s*<(.+?)>$/);
          const fromName = fromMatch ? fromMatch[1].replace(/"/g, "").trim() : null;
          const fromEmail = fromMatch ? fromMatch[2] : fromHeader;

          const lastBody = parseBody(lastMsg.payload);
          const snippet = threadData.snippet || null;
          const isRead = !lastMsg.labelIds?.includes("UNREAD");
          const lastMessageAt = new Date(parseInt(lastMsg.internalDate)).toISOString();

          let conversationId: string;

          if (existing) {
            conversationId = existing.id;
            // Update conversation
            await supabase
              .from("conversations")
              .update({
                snippet,
                is_read: isRead,
                last_message_at: lastMessageAt,
              })
              .eq("id", conversationId);
          } else {
            // Create conversation
            const { data: newConv, error: convError } = await supabase
              .from("conversations")
              .insert({
                team_id: mailbox.team_id,
                gmail_thread_id: thread.id,
                subject,
                snippet,
                from_email: fromEmail,
                from_name: fromName,
                is_read: isRead,
                last_message_at: lastMessageAt,
                status: "open",
              })
              .select("id")
              .single();

            if (convError) {
              console.error("Failed to create conversation:", convError);
              continue;
            }
            conversationId = newConv.id;
          }

          // Sync messages
          for (const gMsg of gmailMessages) {
            const { data: existingMsg } = await supabase
              .from("messages")
              .select("id")
              .eq("gmail_message_id", gMsg.id)
              .maybeSingle();

            if (existingMsg) continue;

            const msgFromHeader = getHeader(gMsg.payload?.headers, "From") || "";
            const msgToHeader = getHeader(gMsg.payload?.headers, "To") || "";
            const msgFromMatch = msgFromHeader.match(/^(.+?)\s*<(.+?)>$/);
            const msgFromName = msgFromMatch ? msgFromMatch[1].replace(/"/g, "").trim() : null;
            const msgFromEmail = msgFromMatch ? msgFromMatch[2] : msgFromHeader;
            const body = parseBody(gMsg.payload);
            const sentAt = new Date(parseInt(gMsg.internalDate)).toISOString();
            const isOutbound = msgFromEmail.toLowerCase() === mailbox.email.toLowerCase();

            await supabase.from("messages").insert({
              conversation_id: conversationId,
              gmail_message_id: gMsg.id,
              from_email: msgFromEmail,
              from_name: msgFromName,
              to_email: msgToHeader,
              body_html: body.html,
              body_text: body.text,
              sent_at: sentAt,
              is_outbound: isOutbound,
            });
          }

          synced++;
        }

        // Update last sync time
        await supabase
          .from("team_mailboxes")
          .update({ last_sync_at: new Date().toISOString() })
          .eq("id", mailbox.id);

        results.push({ email: mailbox.email, synced });
      } catch (err) {
        console.error(`Error syncing ${mailbox.email}:`, err);
        results.push({ email: mailbox.email, error: String(err) });
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("gmail-sync error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
