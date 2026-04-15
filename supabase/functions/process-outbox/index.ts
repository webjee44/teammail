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

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch pending commands (oldest first, max 20 per batch)
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
      // Mark as processing
      await supabase
        .from("outbox_commands")
        .update({ status: "processing" })
        .eq("id", cmd.id)
        .eq("status", "pending"); // CAS: only if still pending

      try {
        if (cmd.command_type === "send_reply" || cmd.command_type === "send_new") {
          const payload = cmd.payload as any;

          // Call gmail-send
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

          // Idempotency check: if this gmail_message_id already exists, skip insert
          if (payload.conversation_id && gmailMessageId) {
            const { data: existingMsg } = await supabase
              .from("messages")
              .select("id")
              .eq("gmail_message_id", gmailMessageId)
              .maybeSingle();

            if (existingMsg) {
              // Already recorded — mark as sent and move on
              await supabase
                .from("outbox_commands")
                .update({ status: "sent", processed_at: new Date().toISOString() })
                .eq("id", cmd.id);
              processed++;
              continue;
            }
          }

          // Insert message record
          if (payload.conversation_id) {
            try {
              const { data: newMsg } = await supabase
                .from("messages")
                .insert({
                  conversation_id: payload.conversation_id,
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

              // Upload attachments if present
              if (newMsg && payload.attached_files?.length) {
                for (const f of payload.attached_files) {
                  const storagePath = `${payload.conversation_id}/${newMsg.id}/${f.name}`;
                  // Decode base64 and upload
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

              // Update conversation
              await supabase
                .from("conversations")
                .update({
                  last_message_at: new Date().toISOString(),
                  status: "closed",
                  is_read: true,
                })
                .eq("id", payload.conversation_id);
            } catch (postSendErr: any) {
              // Email was sent but local record failed — log drift, DON'T mark as sent
              console.error("Post-send insert failed:", postSendErr);
              await supabase.from("sync_journal").insert({
                drift_type: "outbox_partial_send",
                action_taken: "email_sent_but_local_insert_failed",
                conversation_id: payload.conversation_id || null,
                local_state: `outbox_cmd=${cmd.id}`,
                remote_state: `gmail_msg_id=${gmailMessageId}`,
              });
              // Leave command as processing so next run retries the insert
              // (idempotency check above will skip the re-send)
              const retryCount = (cmd.retry_count || 0) + 1;
              await supabase
                .from("outbox_commands")
                .update({
                  status: retryCount >= 5 ? "failed" : "pending",
                  error_message: `Post-send: ${postSendErr.message}`,
                  retry_count: retryCount,
                })
                .eq("id", cmd.id);
              failed++;
              continue;
            }
          }

          // Mark as sent
          await supabase
            .from("outbox_commands")
            .update({ status: "sent", processed_at: new Date().toISOString() })
            .eq("id", cmd.id);

          // Mark associated draft as sent
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
          // Unknown command type — mark failed
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

        // If send failed and linked to a draft, mark draft as send_failed
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
