import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const WASENDER_API_URL = "https://www.wasenderapi.com/api/send-message";

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
    const { to, text, conversation_id } = body;

    if (!to || !text) {
      return new Response(JSON.stringify({ error: "Missing 'to' or 'text'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send via Wasender API
    const wasenderRes = await fetch(WASENDER_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${wasenderApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ to, text }),
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
      // Check existing conversation
      const { data: existing } = await supabase
        .from("whatsapp_conversations")
        .select("id")
        .eq("phone_number", to)
        .eq("team_id", profile.team_id)
        .maybeSingle();

      if (existing) {
        convId = existing.id;
      } else {
        // Check contacts for name
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
            last_message: text,
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
      // Save outbound message
      await supabase.from("whatsapp_messages").insert({
        conversation_id: convId,
        wasender_message_id: wasenderData.data?.msgId?.toString() || null,
        to_phone: to,
        body: text,
        is_outbound: true,
        status: "sent",
        sent_at: new Date().toISOString(),
      });

      // Update conversation
      await supabase
        .from("whatsapp_conversations")
        .update({
          last_message: text,
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
