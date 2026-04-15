import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const parsePrimaryRecipient = (value?: string | null) => {
    if (!value) return null;
    const first = value.split(",")[0]?.trim();
    if (!first) return null;

    const match = first.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/);
    if (match) {
      const [, name, email] = match;
      return {
        name: name.trim() || null,
        email: email.trim().toLowerCase(),
      };
    }

    return {
      name: null,
      email: first.replace(/^"|"$/g, "").trim().toLowerCase(),
    };
  };

  const toPlainSnippet = (body?: string | null) => {
    if (!body) return null;
    const plain = body
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/\s+/g, " ")
      .trim();

    return plain.slice(0, 180) || null;
  };

  const ensureOutgoingConversation = async (
    supabase: any,
    cmd: any,
    payload: any,
    gmailThreadId: string | null,
  ): Promise<string> => {
    if (payload.conversation_id) return payload.conversation_id;

    const mailboxEmail = payload.from_email?.toLowerCase?.();
    if (!mailboxEmail) throw new Error("Missing from_email for outgoing conversation");

    const { data: mailbox, error: mailboxError } = await supabase
      .from("team_mailboxes")
      .select("id, team_id")
      .eq("team_id", cmd.team_id)
      .ilike("email", mailboxEmail)
      .maybeSingle();

    if (mailboxError) throw mailboxError;
    if (!mailbox) throw new Error(`Mailbox not found for ${mailboxEmail}`);

    if (gmailThreadId) {
      const { data: existingConvByThread } = await supabase
        .from("conversations")
        .select("id")
        .eq("gmail_thread_id", gmailThreadId)
        .eq("mailbox_id", mailbox.id)
        .maybeSingle();

      if (existingConvByThread?.id) return existingConvByThread.id;
    }

    const recipient = parsePrimaryRecipient(payload.to);
    const { data: conversation, error: conversationError } = await supabase
      .from("conversations")
      .insert({
        team_id: cmd.team_id,
        mailbox_id: mailbox.id,
        gmail_thread_id: gmailThreadId,
        subject: payload.subject || "(sans objet)",
        snippet: toPlainSnippet(payload.body),
        from_email: recipient?.email || payload.to || payload.from_email,
        from_name: recipient?.name,
        status: "closed",
        is_read: true,
        last_message_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (conversationError) throw conversationError;
    return conversation.id;
  };

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: commands, error: fetchErr } = await supabase
      .from("outbox_commands")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(20);

    if (fetchErr) throw fetchErr;
    if (!commands || commands.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let processed = 0;
    let failed = 0;

    for (const cmd of commands) {
      await supabase
        .from("outbox_commands")
        .update({ status: "processing" })
        .eq("id", cmd.id)
        .eq("status", "pending");

      try {
        if (cmd.command_type === "send_reply" || cmd.command_type === "send_new") {
          const payload = cmd.payload as any;

          const sendRes = await fetch(`${supabaseUrl}/functions/v1/gmail-send`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              to: payload.to,
              subject: payload.subject,
              body: payload.body,
              from_email: payload.from_email,
              from_name: payload.from_name,
              attachments: payload.attachments,
              cc: payload.cc,
              bcc: payload.bcc,
              thread_id: payload.thread_id,
              in_reply_to: payload.in_reply_to,
              references: payload.in_reply_to,
            }),
          });

          const sendData = await sendRes.json();

          if (!sendRes.ok || sendData.error) {
            throw new Error(sendData.error || `HTTP ${sendRes.status}`);
          }

          const gmailMessageId = sendData.messageId || null;
          const gmailThreadId = sendData.threadId || payload.thread_id || null;
          let conversationId = payload.conversation_id || cmd.conversation_id || null;

          if (gmailMessageId) {
            const { data: existingMsg } = await supabase
              .from("messages")
              .select("id, conversation_id")
              .eq("gmail_message_id", gmailMessageId)
              .maybeSingle();

            if (existingMsg) {
              await supabase
                .from("outbox_commands")
                .update({
                  status: "sent",
                  processed_at: new Date().toISOString(),
                  conversation_id: conversationId || existingMsg.conversation_id,
                })
                .eq("id", cmd.id);
              processed++;
              continue;
            }
          }

          if (!conversationId) {
            conversationId = await ensureOutgoingConversation(supabase, cmd, payload, gmailThreadId);
          }

          if (conversationId) {
            try {
              const { data: newMsg } = await supabase
                .from("messages")
                .insert({
                  conversation_id: conversationId,
                  from_email: payload.from_email,
                  from_name: payload.from_name || payload.from_email,
                  to_email: payload.to,
                  cc: payload.cc || null,
                  body_text: payload.body,
                  body_html: payload.body?.replace(/\n/g, "<br>"),
                  is_outbound: true,
                  gmail_message_id: gmailMessageId,
                })
                .select("id")
                .single();

              if (newMsg && payload.attached_files?.length) {
                for (const f of payload.attached_files) {
                  const storagePath = `${conversationId}/${newMsg.id}/${f.name}`;
                  const binaryData = Uint8Array.from(atob(f.base64), c => c.charCodeAt(0));
                  await supabase.storage
                    .from("attachments")
                    .upload(storagePath, binaryData, {
                      contentType: f.type || "application/octet-stream",
                      upsert: true,
                    });
                  await supabase.from("attachments").insert({
                    message_id: newMsg.id,
                    filename: f.name,
                    mime_type: f.type || "application/octet-stream",
                    size_bytes: f.size || 0,
                    storage_path: storagePath,
                  });
                }
              }

              await supabase
                .from("conversations")
                .update({
                  last_message_at: new Date().toISOString(),
                  status: "closed",
                  is_read: true,
                  ...(gmailThreadId ? { gmail_thread_id: gmailThreadId } : {}),
                })
                .eq("id", conversationId);
            } catch (postSendErr: any) {
              console.error("Post-send insert failed:", postSendErr);
              await supabase.from("sync_journal").insert({
                drift_type: "outbox_partial_send",
                action_taken: "email_sent_but_local_insert_failed",
                conversation_id: conversationId || null,
                local_state: `outbox_cmd=${cmd.id}`,
                remote_state: `gmail_msg_id=${gmailMessageId}`,
              });
              const retryCount = (cmd.retry_count || 0) + 1;
              await supabase
                .from("outbox_commands")
                .update({
                  status: retryCount >= 5 ? "failed" : "pending",
                  error_message: `Post-send: ${postSendErr.message}`,
                  retry_count: retryCount,
                  conversation_id: conversationId || null,
                })
                .eq("id", cmd.id);
              failed++;
              continue;
            }
          }

          await supabase
            .from("outbox_commands")
            .update({ status: "sent", processed_at: new Date().toISOString(), conversation_id: conversationId })
            .eq("id", cmd.id);

          if (cmd.idempotency_key?.startsWith("draft-")) {
            const draftId = cmd.idempotency_key.replace("draft-", "");
            await supabase
              .from("drafts")
              .update({ status: "sent" })
              .eq("id", draftId);
          }

          processed++;
        } else if (cmd.command_type === "archive") {
          const payload = cmd.payload as any;
          await fetch(`${supabaseUrl}/functions/v1/gmail-archive`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({ conversation_id: payload.conversation_id }),
          });

          await supabase
            .from("outbox_commands")
            .update({ status: "sent", processed_at: new Date().toISOString() })
            .eq("id", cmd.id);

          processed++;
        } else {
          await supabase
            .from("outbox_commands")
            .update({
              status: "failed",
              error_message: `Unknown command_type: ${cmd.command_type}`,
              processed_at: new Date().toISOString(),
            })
            .eq("id", cmd.id);
          failed++;
        }
      } catch (err: any) {
        const retryCount = (cmd.retry_count || 0) + 1;
        const maxRetries = 3;

        await supabase
          .from("outbox_commands")
          .update({
            status: retryCount >= maxRetries ? "failed" : "pending",
            error_message: err.message || String(err),
            retry_count: retryCount,
            processed_at: retryCount >= maxRetries ? new Date().toISOString() : null,
          })
          .eq("id", cmd.id);

        if (retryCount >= maxRetries && cmd.idempotency_key?.startsWith("draft-")) {
          const draftId = cmd.idempotency_key.replace("draft-", "");
          await supabase
            .from("drafts")
            .update({ status: "send_failed", error_message: err.message || String(err) })
            .eq("id", draftId);
        }

        failed++;
      }
    }

    return new Response(
      JSON.stringify({ processed, failed, total: commands.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("process-outbox error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
