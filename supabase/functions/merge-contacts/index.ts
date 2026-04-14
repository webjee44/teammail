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

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const token = authHeader.replace("Bearer ", "");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: authData, error: authErr } = await authClient.auth.getUser(token);
    if (authErr || !authData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { primary_id, secondary_id } = await req.json();

    if (!primary_id || !secondary_id || primary_id === secondary_id) {
      return new Response(
        JSON.stringify({ error: "primary_id and secondary_id are required and must differ" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch both contacts
    const { data: primary, error: e1 } = await supabase
      .from("contacts")
      .select("*")
      .eq("id", primary_id)
      .single();
    const { data: secondary, error: e2 } = await supabase
      .from("contacts")
      .select("*")
      .eq("id", secondary_id)
      .single();

    if (e1 || e2 || !primary || !secondary) {
      return new Response(
        JSON.stringify({ error: "One or both contacts not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Ensure same team
    if (primary.team_id !== secondary.team_id) {
      return new Response(
        JSON.stringify({ error: "Contacts must belong to the same team" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Merge fields: fill empty fields on primary with secondary's data
    const updates: Record<string, string | null> = {};
    const mergeableFields = ["name", "company", "phone", "avatar_url"] as const;
    for (const field of mergeableFields) {
      if (!primary[field] && secondary[field]) {
        updates[field] = secondary[field];
      }
    }
    // Merge notes
    if (secondary.notes && secondary.notes.trim()) {
      updates.notes = primary.notes
        ? `${primary.notes}\n\n--- Fusionné depuis ${secondary.email} ---\n${secondary.notes}`
        : secondary.notes;
    }
    // Merge custom_fields
    if (secondary.custom_fields && typeof secondary.custom_fields === "object") {
      const merged = { ...(secondary.custom_fields as Record<string, unknown>), ...(primary.custom_fields as Record<string, unknown> || {}) };
      updates.custom_fields = JSON.stringify(merged) as any;
    }

    if (Object.keys(updates).length > 0) {
      // Handle custom_fields separately since it needs jsonb
      const finalUpdates: Record<string, any> = { ...updates };
      if (updates.custom_fields) {
        finalUpdates.custom_fields = JSON.parse(updates.custom_fields as string);
      }
      await supabase.from("contacts").update(finalUpdates).eq("id", primary_id);
    }

    // Re-assign conversations from secondary to primary
    // Update conversations.contact_id
    await supabase
      .from("conversations")
      .update({ contact_id: primary_id })
      .eq("contact_id", secondary_id);

    // Update conversations.from_email matching secondary email to keep traceability
    // (don't change from_email — it's the actual sender)

    // Move contact_conversations links
    // First get existing links for primary to avoid duplicates
    const { data: existingLinks } = await supabase
      .from("contact_conversations")
      .select("conversation_id")
      .eq("contact_id", primary_id);
    const existingConvIds = new Set((existingLinks || []).map((l) => l.conversation_id));

    const { data: secondaryLinks } = await supabase
      .from("contact_conversations")
      .select("conversation_id")
      .eq("contact_id", secondary_id);

    // Delete all secondary links first
    await supabase
      .from("contact_conversations")
      .delete()
      .eq("contact_id", secondary_id);

    // Insert non-duplicate links for primary
    const newLinks = (secondaryLinks || [])
      .filter((l) => !existingConvIds.has(l.conversation_id))
      .map((l) => ({ contact_id: primary_id, conversation_id: l.conversation_id }));

    if (newLinks.length > 0) {
      await supabase.from("contact_conversations").insert(newLinks);
    }

    // Delete secondary contact
    await supabase.from("contacts").delete().eq("id", secondary_id);

    return new Response(
      JSON.stringify({ success: true, merged_fields: Object.keys(updates), secondary_email: secondary.email }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("merge-contacts error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
