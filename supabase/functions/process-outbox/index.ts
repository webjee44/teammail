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
              thread_id: payload.thread_id,
              in_reply_to: payload.in_reply_to,
              references: payload.in_reply_to,
            }),
          });

          const sendData = await sendRes.json();

          if (!sendRes.ok || sendData.error) {
            throw new Error(sendData.error || `HTTP ${sendRes.status}`);
          }

          // Insert message record
          if (payload.conversation_id) {
            const { data: newMsg } = await supabase
              .from("messages")
              .insert({
                conversation_id: payload.conversation_id,
                from_email: payload.from_email,
                from_name: payload.from_name || payload.from_email,
                to_email: payload.to,
                body_text: payload.body,
                body_html: payload.body?.replace(/\n/g, "<br>"),
                is_outbound: true,
                gmail_message_id: sendData.messageId || null,
              })
              .select("id")
              .single();

            // Update conversation
            await supabase
              .from("conversations")
              .update({
                last_message_at: new Date().toISOString(),
                status: "closed",
                is_read: true,
              })
              .eq("id", payload.conversation_id);
          }

          // Mark as sent
          await supabase
            .from("outbox_commands")
            .update({ status: "sent", processed_at: new Date().toISOString() })
            .eq("id", cmd.id);

          processed++;
        } else if (cmd.command_type === "archive") {
          const payload = cmd.payload as any;
          // Call gmail-archive
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
