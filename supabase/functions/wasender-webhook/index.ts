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
      const messageBody = messages.messageBody || "";
      const fromPhone = key.cleanedSenderPn || key.remoteJid?.replace("@s.whatsapp.net", "").replace("@lid", "") || "";
      const fromMe = key.fromMe || false;
      const remoteJid = key.remoteJid || "";
      const messageId = key.id || "";

      // Detect media
      const rawMsg = messages.message || {};
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

      // Insert message
      await supabase.from("whatsapp_messages").insert({
        conversation_id: conversationId,
        wasender_message_id: messageId,
        from_phone: fromPhone,
        from_name: messages.pushName || null,
        body: messageBody || null,
        media_type: mediaType,
        media_url: mediaUrl,
        is_outbound: fromMe,
        sent_at: new Date(body.timestamp ? body.timestamp * 1000 : Date.now()).toISOString(),
      });

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
