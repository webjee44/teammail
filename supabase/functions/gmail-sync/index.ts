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
    scope: "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.modify",
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

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    throw new Error(`Failed to get access token for ${userEmail}: ${err}`);
  }

  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}

function decodeBody(data: string | undefined): string {
  if (!data) return "";
  try {
    const b64 = data.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64.padEnd(Math.ceil(b64.length / 4) * 4, "=");
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    return "";
  }
}

/** Decode RFC 2047 encoded-words (=?charset?encoding?text?=) in email headers */
function decodeRfc2047(value: string): string {
  if (!value) return value;
  return value.replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (_match, _charset, encoding, text) => {
    try {
      if (encoding.toUpperCase() === "B") {
        // Base64
        const binary = atob(text);
        const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
        return new TextDecoder("utf-8").decode(bytes);
      } else {
        // Quoted-Printable
        const decoded = text
          .replace(/_/g, " ")
          .replace(/=([0-9A-Fa-f]{2})/g, (_: string, hex: string) =>
            String.fromCharCode(parseInt(hex, 16))
          );
        const bytes = Uint8Array.from(decoded, (c) => c.charCodeAt(0));
        return new TextDecoder("utf-8").decode(bytes);
      }
    } catch {
      return text;
    }
  });
}

function getHeader(headers: any[], name: string): string | null {
  const h = headers?.find((h: any) => h.name.toLowerCase() === name.toLowerCase());
  return h?.value ? decodeRfc2047(h.value) : null;
}

function parseBody(payload: any): { html: string | null; text: string | null } {
  if (!payload) return { html: null, text: null };

  if (payload.body?.data && !payload.parts) {
    const mimeType = payload.mimeType || "";
    const decoded = decodeBody(payload.body.data);
    if (mimeType.includes("html")) return { html: decoded, text: null };
    return { html: null, text: decoded };
  }

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

// Extract attachment metadata from Gmail message parts
type AttachmentInfo = {
  partId: string;
  filename: string;
  mimeType: string;
  size: number;
  attachmentId: string;
};

function extractAttachments(payload: any): AttachmentInfo[] {
  const attachments: AttachmentInfo[] = [];

  function walkParts(parts: any[]) {
    if (!parts) return;
    for (const part of parts) {
      if (part.filename && part.filename.length > 0 && part.body?.attachmentId) {
        attachments.push({
          partId: part.partId || "",
          filename: part.filename,
          mimeType: part.mimeType || "application/octet-stream",
          size: part.body.size || 0,
          attachmentId: part.body.attachmentId,
        });
      }
      if (part.parts) walkParts(part.parts);
    }
  }

  if (payload.parts) walkParts(payload.parts);
  return attachments;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth check: accept user JWT or service-role key
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const token = authHeader.replace("Bearer ", "");
    if (token !== supabaseServiceKey) {
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
      const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
      const { data: authData, error: authErr } = await authClient.auth.getUser(token);
      if (authErr || !authData?.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Parse optional mailbox_id from request body
    let requestedMailboxId: string | null = null;
    try {
      const body = await req.json();
      requestedMailboxId = body?.mailbox_id || null;
    } catch {
      // No body or invalid JSON — sync all
    }

    let serviceAccountKeyStr = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
    if (!serviceAccountKeyStr) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY not configured");

    serviceAccountKeyStr = serviceAccountKeyStr.trim();
    let serviceAccountKey: any;
    try {
      serviceAccountKey = JSON.parse(serviceAccountKeyStr);
    } catch {
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

    let mbQuery = supabase
      .from("team_mailboxes")
      .select("*")
      .eq("sync_enabled", true);

    if (requestedMailboxId) {
      mbQuery = mbQuery.eq("id", requestedMailboxId);
    }

    const { data: mailboxes, error: mbError } = await mbQuery;

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
          const { data: existing } = await supabase
            .from("conversations")
            .select("id")
            .eq("gmail_thread_id", thread.id)
            .eq("mailbox_id", mailbox.id)
            .maybeSingle();

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
            await supabase
              .from("conversations")
              .update({
                snippet,
                is_read: isRead,
                last_message_at: lastMessageAt,
                mailbox_id: mailbox.id,
              })
              .eq("id", conversationId);
          } else {
            const msgIds = gmailMessages.map((m: any) => m.id);
            const { data: existingMsgs } = await supabase
              .from("messages")
              .select("conversation_id, gmail_message_id")
              .in("gmail_message_id", msgIds)
              .limit(1);

            if (existingMsgs && existingMsgs.length > 0) {
              conversationId = existingMsgs[0].conversation_id;
              await supabase
                .from("conversations")
                .update({
                  snippet,
                  is_read: isRead,
                  last_message_at: lastMessageAt,
                  mailbox_id: mailbox.id,
                })
                .eq("id", conversationId);
            } else {
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
                  mailbox_id: mailbox.id,
                })
                .select("id")
                .single();

              if (convError) {
                console.error("Failed to create conversation:", convError);
                continue;
              }
              conversationId = newConv.id;

              // Auto-create or link contact
              if (fromEmail) {
                try {
                  const { data: existingContact } = await supabase
                    .from("contacts")
                    .select("id")
                    .eq("team_id", mailbox.team_id)
                    .eq("email", fromEmail)
                    .maybeSingle();

                  let contactId: string;
                  if (existingContact) {
                    contactId = existingContact.id;
                  } else {
                    const domain = fromEmail.split("@")[1] || null;
                    const { data: newContact } = await supabase
                      .from("contacts")
                      .insert({
                        team_id: mailbox.team_id,
                        email: fromEmail,
                        name: fromName,
                        company: domain,
                      })
                      .select("id")
                      .single();
                    contactId = newContact?.id;
                  }

                  if (contactId) {
                    // Link contact to conversation
                    await supabase.from("contact_conversations").insert({
                      contact_id: contactId,
                      conversation_id: conversationId,
                    }).select().maybeSingle();

                    // Set contact_id on conversation
                    await supabase
                      .from("conversations")
                      .update({ contact_id: contactId })
                      .eq("id", conversationId);
                  }
                } catch (contactErr) {
                  console.error("Auto-contact creation error:", contactErr);
                }
              }
            }
          }

          // Sync messages + attachments
          for (const gMsg of gmailMessages) {
            const msgFromHeader = getHeader(gMsg.payload?.headers, "From") || "";
            const msgToHeader = getHeader(gMsg.payload?.headers, "To") || "";
            const msgCcHeader = getHeader(gMsg.payload?.headers, "Cc") || null;
            const msgFromMatch = msgFromHeader.match(/^(.+?)\s*<(.+?)>$/);
            const msgFromName = msgFromMatch ? msgFromMatch[1].replace(/"/g, "").trim() : null;
            const msgFromEmail = msgFromMatch ? msgFromMatch[2] : msgFromHeader;
            const body = parseBody(gMsg.payload);
            const sentAt = new Date(parseInt(gMsg.internalDate)).toISOString();
            const isOutbound = msgFromEmail.toLowerCase() === mailbox.email.toLowerCase();

            // Check if message already exists to avoid silent skip from ignoreDuplicates
            const { data: existingMsg } = await supabase
              .from("messages")
              .select("id")
              .eq("gmail_message_id", gMsg.id)
              .maybeSingle();

            let messageId: string;
            if (existingMsg) {
              messageId = existingMsg.id;
            } else {
              const { data: newMsg, error: msgErr } = await supabase.from("messages").insert({
                conversation_id: conversationId,
                gmail_message_id: gMsg.id,
                from_email: msgFromEmail,
                from_name: msgFromName,
                to_email: msgToHeader,
                cc: msgCcHeader,
                body_html: body.html,
                body_text: body.text,
                sent_at: sentAt,
                is_outbound: isOutbound,
              }).select("id").single();

              if (msgErr || !newMsg) continue;
              messageId = newMsg.id;
            }

            // Download and store attachments
            const attachmentInfos = extractAttachments(gMsg.payload);
            for (const att of attachmentInfos) {
              try {
                const attRes = await fetch(
                  `https://gmail.googleapis.com/gmail/v1/users/me/messages/${gMsg.id}/attachments/${att.attachmentId}`,
                  { headers: { Authorization: `Bearer ${accessToken}` } }
                );
                if (!attRes.ok) {
                  console.error(`Failed to download attachment ${att.filename}:`, await attRes.text());
                  continue;
                }
                const attData = await attRes.json();
                const b64 = (attData.data || "").replace(/-/g, "+").replace(/_/g, "/");
                const padded = b64.padEnd(Math.ceil(b64.length / 4) * 4, "=");
                const binary = atob(padded);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

                const storagePath = `${conversationId}/${messageId}/${att.filename}`;
                const { error: uploadErr } = await supabase.storage
                  .from("attachments")
                  .upload(storagePath, bytes, {
                    contentType: att.mimeType,
                    upsert: true,
                  });

                if (uploadErr) {
                  console.error(`Failed to upload attachment ${att.filename}:`, uploadErr);
                  continue;
                }

                await supabase.from("attachments").insert({
                  message_id: messageId,
                  filename: att.filename,
                  mime_type: att.mimeType,
                  size_bytes: att.size,
                  storage_path: storagePath,
                });
              } catch (attErr) {
                console.error(`Error processing attachment ${att.filename}:`, attErr);
              }
            }
          }

          synced++;
        }

        await supabase
          .from("team_mailboxes")
          .update({ last_sync_at: new Date().toISOString() })
          .eq("id", mailbox.id);

        results.push({ email: mailbox.email, synced });

        try {
          const analyzeUrl = `${supabaseUrl}/functions/v1/ai-analyze-email`;
          await fetch(analyzeUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({ batch: true }),
          });
        } catch (aiErr) {
          console.error("AI analysis trigger failed:", aiErr);
        }
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
