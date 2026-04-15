import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Google OAuth JWT ─────────────────────────────────────────────

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

// ─── Helpers ──────────────────────────────────────────────────────

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

function decodeRfc2047(value: string): string {
  if (!value) return value;
  return value.replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (_match, _charset, encoding, text) => {
    try {
      if (encoding.toUpperCase() === "B") {
        const binary = atob(text);
        const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
        return new TextDecoder("utf-8").decode(bytes);
      } else {
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

// ─── Full scan: ONE page per run, resumable via page token ────────

async function fullScanOnePage(
  accessToken: string,
  mailbox: any,
  supabase: any,
): Promise<{ synced: number; nextPageToken: string | null; done: boolean }> {
  let synced = 0;

  const url = new URL("https://gmail.googleapis.com/gmail/v1/users/me/threads");
  url.searchParams.set("maxResults", "20");
  url.searchParams.set("labelIds", "INBOX");
  // Resume from stored page token if available
  if (mailbox.full_scan_page_token) {
    url.searchParams.set("pageToken", mailbox.full_scan_page_token);
  }

  const threadsRes = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!threadsRes.ok) {
    const errText = await threadsRes.text();
    console.error(`Gmail API error for ${mailbox.email}:`, errText);
    throw new Error(`Gmail threads.list failed: ${errText.substring(0, 200)}`);
  }

  const threadsData = await threadsRes.json();
  const threads = threadsData.threads || [];
  const nextPageToken = threadsData.nextPageToken || null;

  for (const thread of threads) {
    // During full scan, skip binary attachment downloads to stay within timeout
    const threadSynced = await syncThread(accessToken, thread.id, mailbox, supabase, /* skipAttachmentBinaries */ true);
    if (threadSynced) synced++;
  }

  const pageNum = mailbox.full_scan_page_token ? "next" : "1";
  console.log(`Full scan ${mailbox.email}: page ${pageNum}, synced ${synced} threads this page`);

  return { synced, nextPageToken, done: !nextPageToken };
}

// ─── Incremental sync: history.list ───────────────────────────────

async function incrementalSync(
  accessToken: string,
  mailbox: any,
  supabase: any,
  startHistoryId: string,
): Promise<{ synced: number; historyId: string | null; needsFullScan: boolean }> {
  let synced = 0;
  let pageToken: string | undefined;
  let latestHistoryId: string | null = null;
  const processedThreadIds = new Set<string>();

  do {
    const url = new URL("https://gmail.googleapis.com/gmail/v1/users/me/history");
    url.searchParams.set("startHistoryId", startHistoryId);
    // FIX: historyTypes must be repeated params, not comma-separated
    url.searchParams.append("historyTypes", "messageAdded");
    url.searchParams.append("historyTypes", "labelAdded");
    url.searchParams.append("historyTypes", "labelRemoved");
    url.searchParams.set("labelId", "INBOX");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const historyRes = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (historyRes.status === 404) {
      console.log(`History expired for ${mailbox.email}, falling back to full scan`);
      return { synced: 0, historyId: null, needsFullScan: true };
    }

    if (!historyRes.ok) {
      const errText = await historyRes.text();
      console.error(`Gmail history API error for ${mailbox.email}:`, errText);
      throw new Error(`Gmail history.list failed: ${errText.substring(0, 200)}`);
    }

    const historyData = await historyRes.json();
    latestHistoryId = historyData.historyId || null;
    const historyRecords = historyData.history || [];
    pageToken = historyData.nextPageToken;

    for (const record of historyRecords) {
      if (record.messagesAdded) {
        for (const added of record.messagesAdded) {
          const threadId = added.message?.threadId;
          if (threadId && !processedThreadIds.has(threadId)) {
            processedThreadIds.add(threadId);
            const threadSynced = await syncThread(accessToken, threadId, mailbox, supabase, false);
            if (threadSynced) synced++;
          }
        }
      }

      if (record.labelsRemoved) {
        for (const removed of record.labelsRemoved) {
          const removedLabels = removed.labelIds || [];
          if (removedLabels.includes("INBOX")) {
            const threadId = removed.message?.threadId;
            if (threadId) {
              await supabase
                .from("conversations")
                .update({ state: "archived" })
                .eq("gmail_thread_id", threadId)
                .eq("mailbox_id", mailbox.id);
            }
          }
        }
      }

      if (record.labelsAdded) {
        for (const added of record.labelsAdded) {
          const addedLabels = added.labelIds || [];
          if (addedLabels.includes("INBOX")) {
            const threadId = added.message?.threadId;
            if (threadId) {
              await supabase
                .from("conversations")
                .update({ state: "inbox" })
                .eq("gmail_thread_id", threadId)
                .eq("mailbox_id", mailbox.id);
            }
          }
        }
      }
    }
  } while (pageToken);

  return { synced, historyId: latestHistoryId, needsFullScan: false };
}

// ─── Sync a single thread ─────────────────────────────────────────

async function syncThread(
  accessToken: string,
  threadId: string,
  mailbox: any,
  supabase: any,
  skipAttachmentBinaries: boolean = false,
): Promise<boolean> {
  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("gmail_thread_id", threadId)
    .eq("mailbox_id", mailbox.id)
    .maybeSingle();

  const threadRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=full`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!threadRes.ok) return false;
  const threadData = await threadRes.json();
  const gmailMessages = threadData.messages || [];
  if (gmailMessages.length === 0) return false;

  const firstMsg = gmailMessages[0];
  const lastMsg = gmailMessages[gmailMessages.length - 1];
  const subject = getHeader(firstMsg.payload?.headers, "Subject") || "(sans objet)";
  const fromHeader = getHeader(firstMsg.payload?.headers, "From") || "";

  const fromMatch = fromHeader.match(/^(.+?)\s*<(.+?)>$/);
  const fromName = fromMatch ? fromMatch[1].replace(/"/g, "").trim() : null;
  const fromEmail = fromMatch ? fromMatch[2] : fromHeader;

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
        state: "inbox" as const,
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
          state: "inbox" as const,
        })
        .eq("id", conversationId);
    } else {
      const { data: newConv, error: convError } = await supabase
        .from("conversations")
        .insert({
          team_id: mailbox.team_id,
          gmail_thread_id: threadId,
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
        return false;
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
            await supabase.from("contact_conversations").insert({
              contact_id: contactId,
              conversation_id: conversationId,
            }).select().maybeSingle();

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

  // Sync messages
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

    // Idempotent: skip already-synced messages
    const { data: existingMsg } = await supabase
      .from("messages")
      .select("id")
      .eq("gmail_message_id", gMsg.id)
      .maybeSingle();

    if (existingMsg) continue;

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
    const messageId = newMsg.id;

    // Attachments: save metadata always, download binary only if not skipping
    const attachmentInfos = extractAttachments(gMsg.payload);
    for (const att of attachmentInfos) {
      try {
        if (skipAttachmentBinaries) {
          // During full scan: record metadata only, no binary download
          const safeFilename = att.filename
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-zA-Z0-9._-]/g, "_");
          const storagePath = `${conversationId}/${messageId}/${safeFilename}`;
          await supabase.from("attachments").insert({
            message_id: messageId,
            filename: att.filename,
            mime_type: att.mimeType,
            size_bytes: att.size,
            storage_path: storagePath, // placeholder — binary not yet uploaded
          });
          continue;
        }

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

        const safeFilename = att.filename
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-zA-Z0-9._-]/g, "_");
        const storagePath = `${conversationId}/${messageId}/${safeFilename}`;
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

  return true;
}

// ─── Logging helper ───────────────────────────────────────────────

async function logSyncRun(
  supabase: any,
  mailboxId: string,
  action: string,
  remoteState: string,
  localState: string,
) {
  try {
    await supabase.from("sync_journal").insert({
      mailbox_id: mailboxId,
      drift_type: "sync_run",
      action_taken: action,
      remote_state: remoteState,
      local_state: localState,
    });
  } catch (e) {
    console.error("Failed to log sync run:", e);
  }
}

// ─── Main handler ─────────────────────────────────────────────────

serve(async (req) => {
  const startTime = Date.now();
  console.log(`gmail-sync invoked: ${req.method} at ${new Date().toISOString()}`);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";

    // Auth: accept service_role key, anon key (for pg_cron), or valid user JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      console.error("gmail-sync: No Authorization header");
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const token = authHeader.replace("Bearer ", "");

    let isCronCall = false;
    try {
      const payloadB64 = token.split(".")[1];
      if (payloadB64) {
        const payload = JSON.parse(atob(payloadB64));
        if (payload.role === "anon" && payload.iss === "supabase") {
          isCronCall = true;
        }
      }
    } catch { /* not a JWT */ }

    if (token === supabaseServiceKey) {
      console.log("gmail-sync: Authenticated with service role key");
    } else if (isCronCall) {
      console.log("gmail-sync: Authenticated via cron (anon key)");
    } else {
      const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
      const { data: authData, error: authErr } = await authClient.auth.getUser(token);
      if (authErr || !authData?.user) {
        console.error("gmail-sync: Auth failed -", authErr?.message || "no user");
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      console.log(`gmail-sync: Authenticated as user ${authData.user.email}`);
    }

    let requestedMailboxId: string | null = null;
    try {
      const body = await req.json();
      requestedMailboxId = body?.mailbox_id || null;
    } catch {
      // No body or invalid JSON
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

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ── Round-robin: pick ONE mailbox (the one with oldest last_run_at) ──
    let mbQuery = supabase
      .from("team_mailboxes")
      .select("*")
      .eq("sync_enabled", true)
      .order("last_run_at", { ascending: true, nullsFirst: true })
      .limit(1);

    if (requestedMailboxId) {
      // If a specific mailbox was requested, override round-robin
      mbQuery = supabase
        .from("team_mailboxes")
        .select("*")
        .eq("sync_enabled", true)
        .eq("id", requestedMailboxId)
        .limit(1);
    }

    const { data: mailboxes, error: mbError } = await mbQuery;

    if (mbError) throw new Error(`Failed to fetch mailboxes: ${mbError.message}`);
    if (!mailboxes || mailboxes.length === 0) {
      return new Response(JSON.stringify({ message: "No mailboxes to sync" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mailbox = mailboxes[0];
    console.log(`Processing mailbox: ${mailbox.email} (sync_mode: ${mailbox.sync_mode})`);

    // Mark last_run_at immediately
    await supabase
      .from("team_mailboxes")
      .update({ last_run_at: new Date().toISOString() })
      .eq("id", mailbox.id);

    try {
      const accessToken = await getAccessToken(serviceAccountKey, mailbox.email);
      let synced = 0;
      let action = "";

      if (mailbox.sync_mode === "incremental" && mailbox.history_id) {
        // ── Incremental sync ──
        console.log(`Incremental sync for ${mailbox.email} from historyId ${mailbox.history_id}`);
        const result = await incrementalSync(accessToken, mailbox, supabase, String(mailbox.history_id));

        if (result.needsFullScan) {
          // History expired — reset to full_scan mode
          console.log(`History expired for ${mailbox.email}, switching to full_scan mode`);
          await supabase
            .from("team_mailboxes")
            .update({
              sync_mode: "full_scan",
              history_id: null,
              full_scan_page_token: null,
            })
            .eq("id", mailbox.id);
          action = "history_expired_reset";
        } else {
          synced = result.synced;
          // Update history_id and mark successful
          const updatePayload: any = {
            last_successful_sync_at: new Date().toISOString(),
            last_error_at: null,
            last_error_message: null,
          };
          if (result.historyId) {
            updatePayload.history_id = parseInt(result.historyId, 10);
          }
          await supabase
            .from("team_mailboxes")
            .update(updatePayload)
            .eq("id", mailbox.id);
          action = "incremental";
        }
      } else {
        // ── Full scan (one page at a time) ──
        console.log(`Full scan for ${mailbox.email} (page_token: ${mailbox.full_scan_page_token || "START"})`);
        const result = await fullScanOnePage(accessToken, mailbox, supabase);
        synced = result.synced;

        if (result.done) {
          // Full scan complete — get historyId and switch to incremental
          let historyId: string | null = null;
          try {
            const profileRes = await fetch(
              "https://gmail.googleapis.com/gmail/v1/users/me/profile",
              { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            if (profileRes.ok) {
              const profile = await profileRes.json();
              historyId = profile.historyId || null;
            }
          } catch (e) {
            console.error("Failed to get Gmail profile historyId:", e);
          }

          const updatePayload: any = {
            sync_mode: "incremental",
            full_scan_page_token: null,
            last_successful_sync_at: new Date().toISOString(),
            last_error_at: null,
            last_error_message: null,
          };
          if (historyId) {
            updatePayload.history_id = parseInt(historyId, 10);
          }
          await supabase
            .from("team_mailboxes")
            .update(updatePayload)
            .eq("id", mailbox.id);

          action = "full_scan_complete";
          console.log(`Full scan complete for ${mailbox.email}, switching to incremental (historyId: ${historyId})`);
        } else {
          // More pages to process — save cursor for next run
          await supabase
            .from("team_mailboxes")
            .update({
              full_scan_page_token: result.nextPageToken,
            })
            .eq("id", mailbox.id);
          action = `full_scan_page`;
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`gmail-sync done: ${mailbox.email} — ${action}, ${synced} threads, ${duration}s`);

      // Log to sync_journal
      await logSyncRun(
        supabase,
        mailbox.id,
        action,
        `${synced} threads`,
        `duration: ${duration}s, success`,
      );

      // Trigger AI analysis if we synced anything
      if (synced > 0) {
        try {
          await fetch(`${supabaseUrl}/functions/v1/ai-analyze-email`, {
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
      }

      return new Response(JSON.stringify({ email: mailbox.email, synced, action }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (err) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      const errorMsg = String(err);
      console.error(`Error syncing ${mailbox.email} (${duration}s):`, err);

      // Record the error on the mailbox
      await supabase
        .from("team_mailboxes")
        .update({
          last_error_at: new Date().toISOString(),
          last_error_message: errorMsg.substring(0, 500),
        })
        .eq("id", mailbox.id);

      // Log error to sync_journal
      await logSyncRun(
        supabase,
        mailbox.id,
        "error",
        errorMsg.substring(0, 200),
        `duration: ${duration}s, error`,
      );

      return new Response(JSON.stringify({ email: mailbox.email, error: errorMsg }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (error) {
    console.error("gmail-sync fatal error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
