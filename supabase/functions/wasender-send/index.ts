import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const WASENDER_BASE = "https://www.wasenderapi.com/api";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const wasenderApiKey = Deno.env.get("WASENDER_API_KEY");
    if (!wasenderApiKey) throw new Error("WASENDER_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) throw new Error("Unauthorized");

    const body = await req.json();
    const { to, text, conversation_id, media } = body;

    if (!to || (!text && !media)) {
      return new Response(JSON.stringify({ error: "Missing 'to' and either 'text' or 'media'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine which Wasender endpoint to use
    let wasenderEndpoint: string;
    let wasenderBody: Record<string, unknown>;
    let sentMediaType: string | null = null;

    if (media) {
      // media: { data: base64, mimetype: string, filename: string, mediatype: "image"|"video"|"audio"|"document" }
      sentMediaType = media.mediatype || "document";

      if (sentMediaType === "image") {
        wasenderEndpoint = `${WASENDER_BASE}/send-image`;
        wasenderBody = {
          to,
          imageUrl: `data:${media.mimetype};base64,${media.data}`,
          caption: text || "",
        };
      } else if (sentMediaType === "video") {
        wasenderEndpoint = `${WASENDER_BASE}/send-video`;
        wasenderBody = {
          to,
          videoUrl: `data:${media.mimetype};base64,${media.data}`,
          caption: text || "",
        };
      } else if (sentMediaType === "audio") {
        wasenderEndpoint = `${WASENDER_BASE}/send-audio`;
        wasenderBody = {
          to,
          audioUrl: `data:${media.mimetype};base64,${media.data}`,
        };
      } else {
        wasenderEndpoint = `${WASENDER_BASE}/send-document`;
        wasenderBody = {
          to,
          documentUrl: `data:${media.mimetype};base64,${media.data}`,
          fileName: media.filename || "file",
          caption: text || "",
        };
      }
    } else {
      wasenderEndpoint = `${WASENDER_BASE}/send-message`;
      wasenderBody = { to, text };
    }

    // Send via Wasender API
    const wasenderRes = await fetch(wasenderEndpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${wasenderApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(wasenderBody),
    });

    const wasenderData = await wasenderRes.json();

    if (!wasenderRes.ok) {
      console.error("Wasender API error:", wasenderData);
      return new Response(JSON.stringify({ error: "Failed to send message", details: wasenderData }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user team
    const { data: profile } = await supabase
      .from("profiles")
      .select("team_id")
      .eq("user_id", user.id)
      .single();

    if (!profile?.team_id) throw new Error("No team found for user");

    // Find or create conversation
    let convId = conversation_id;

    if (!convId) {
      const { data: existing } = await supabase
        .from("whatsapp_conversations")
        .select("id")
        .eq("phone_number", to)
        .eq("team_id", profile.team_id)
        .maybeSingle();

      if (existing) {
        convId = existing.id;
      } else {
        const { data: contact } = await supabase
          .from("contacts")
          .select("id, name")
          .eq("team_id", profile.team_id)
          .eq("phone", to)
          .maybeSingle();

        const { data: newConv } = await supabase
          .from("whatsapp_conversations")
          .insert({
            team_id: profile.team_id,
            phone_number: to,
            contact_name: contact?.name || to,
            contact_id: contact?.id || null,
            last_message: text || (sentMediaType ? `[${sentMediaType}]` : ""),
            last_message_at: new Date().toISOString(),
            is_read: true,
            status: "open",
          })
          .select("id")
          .single();

        convId = newConv?.id;
      }
    }

    if (convId) {
      const lastMsg = text || (sentMediaType ? `📎 ${sentMediaType}` : "");

      // Save outbound message
      await supabase.from("whatsapp_messages").insert({
        conversation_id: convId,
        wasender_message_id: wasenderData.data?.msgId?.toString() || null,
        to_phone: to,
        body: text || null,
        media_type: sentMediaType,
        media_url: null, // base64 not stored as URL
        is_outbound: true,
        status: "sent",
        sent_at: new Date().toISOString(),
      });

      // Update conversation
      await supabase
        .from("whatsapp_conversations")
        .update({
          last_message: lastMsg,
          last_message_at: new Date().toISOString(),
          is_read: true,
        })
        .eq("id", convId);
    }

    return new Response(JSON.stringify({ success: true, data: wasenderData.data, conversation_id: convId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("wasender-send error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
