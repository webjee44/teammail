import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-signature",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    console.log("Wasender webhook received:", JSON.stringify(body).substring(0, 500));

    const event = body.event;

    if (event === "messages.received") {
      const messages = body.data?.messages;
      if (!messages) {
        return new Response(JSON.stringify({ ok: true, skipped: "no messages" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const key = messages.key;
      const rawMsg = messages.message || {};
      const messageBody = messages.messageBody || rawMsg.conversation || rawMsg.extendedTextMessage?.text || "";
      const fromPhone = key.cleanedSenderPn || key.remoteJid?.replace("@s.whatsapp.net", "").replace("@lid", "") || "";
      const fromMe = key.fromMe || false;
      const remoteJid = key.remoteJid || "";
      const messageId = key.id || "";

      // Detect media
      let mediaType: string | null = null;
      let mediaUrl: string | null = null;
      if (rawMsg.imageMessage) {
        mediaType = "image";
        mediaUrl = rawMsg.imageMessage.url || null;
      } else if (rawMsg.videoMessage) {
        mediaType = "video";
        mediaUrl = rawMsg.videoMessage.url || null;
      } else if (rawMsg.audioMessage) {
        mediaType = "audio";
        mediaUrl = rawMsg.audioMessage.url || null;
      } else if (rawMsg.documentMessage) {
        mediaType = "document";
        mediaUrl = rawMsg.documentMessage.url || null;
      }

      // Get the first team (single-team app)
      const { data: team } = await supabase.from("teams").select("id").limit(1).single();
      if (!team) {
        console.error("No team found");
        return new Response(JSON.stringify({ ok: false, error: "no team" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Find or create WhatsApp conversation
      const { data: existingConv } = await supabase
        .from("whatsapp_conversations")
        .select("id")
        .eq("phone_number", fromPhone)
        .eq("team_id", team.id)
        .maybeSingle();

      let conversationId: string;

      if (existingConv) {
        conversationId = existingConv.id;
        await supabase
          .from("whatsapp_conversations")
          .update({
            last_message: messageBody || (mediaType ? `[${mediaType}]` : ""),
            last_message_at: new Date().toISOString(),
            is_read: false,
            status: "open",
          })
          .eq("id", conversationId);
      } else {
        // Try to find existing contact by phone
        const { data: existingContact } = await supabase
          .from("contacts")
          .select("id, name")
          .eq("team_id", team.id)
          .eq("phone", fromPhone)
          .maybeSingle();

        const { data: newConv, error: convErr } = await supabase
          .from("whatsapp_conversations")
          .insert({
            team_id: team.id,
            phone_number: fromPhone,
            contact_name: existingContact?.name || messages.pushName || fromPhone,
            contact_id: existingContact?.id || null,
            wasender_chat_id: remoteJid,
            last_message: messageBody || (mediaType ? `[${mediaType}]` : ""),
            last_message_at: new Date().toISOString(),
            is_read: false,
            status: "open",
          })
          .select("id")
          .single();

        if (convErr || !newConv) {
          console.error("Failed to create WA conversation:", convErr);
          return new Response(JSON.stringify({ ok: false, error: String(convErr) }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        conversationId = newConv.id;
      }

      // Deduplicate: check if same body+phone within 30s already exists
      const sentAtDate = new Date(messages.messageTimestamp ? messages.messageTimestamp * 1000 : Date.now());
      const windowStart = new Date(sentAtDate.getTime() - 30000).toISOString();
      const windowEnd = new Date(sentAtDate.getTime() + 30000).toISOString();

      const { data: existingMsg } = await supabase
        .from("whatsapp_messages")
        .select("id")
        .eq("conversation_id", conversationId)
        .eq("body", messageBody || "")
        .eq("from_phone", fromPhone)
        .eq("is_outbound", fromMe)
        .gte("sent_at", windowStart)
        .lte("sent_at", windowEnd)
        .limit(1)
        .maybeSingle();

      if (existingMsg) {
        console.log("Duplicate WA message detected, skipping:", messageId);
        return new Response(JSON.stringify({ ok: true, skipped: "duplicate" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Insert message
      const msgPayload = {
        conversation_id: conversationId,
        wasender_message_id: messageId,
        from_phone: fromPhone,
        from_name: messages.pushName || null,
        body: messageBody || null,
        media_type: mediaType,
        media_url: mediaUrl,
        is_outbound: fromMe,
        sent_at: sentAtDate.toISOString(),
      };
      console.log("Inserting WA message:", JSON.stringify(msgPayload));
      const { error: msgErr } = messageId
        ? await supabase.from("whatsapp_messages").upsert(msgPayload, { onConflict: "wasender_message_id", ignoreDuplicates: true })
        : await supabase.from("whatsapp_messages").insert(msgPayload);
      if (msgErr) {
        console.error("Failed to insert WA message:", msgErr);
      }

      return new Response(JSON.stringify({ ok: true, conversationId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // For other events (message.sent, message.status, etc.)
    return new Response(JSON.stringify({ ok: true, event, skipped: "unhandled event" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("wasender-webhook error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
