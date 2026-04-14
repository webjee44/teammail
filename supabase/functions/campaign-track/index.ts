import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// 1x1 transparent GIF pixel
const PIXEL = Uint8Array.from(atob("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"), (c) => c.charCodeAt(0));

serve(async (req) => {
  const url = new URL(req.url);
  const type = url.searchParams.get("t"); // "open" or "click"
  const campaignId = url.searchParams.get("c");
  const recipientId = url.searchParams.get("r");
  const redirectUrl = url.searchParams.get("u"); // for clicks

  if (!campaignId || !type) {
    return new Response("Missing params", { status: 400 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("cf-connecting-ip") || "";
  const userAgent = req.headers.get("user-agent") || "";

  // Insert event
  await supabase.from("campaign_events").insert({
    campaign_id: campaignId,
    recipient_id: recipientId || null,
    event_type: type,
    link_url: redirectUrl || null,
    ip_address: ip,
    user_agent: userAgent,
  });

  // Update recipient tracking timestamps (first open/click only)
  if (recipientId) {
    if (type === "open") {
      await supabase
        .from("campaign_recipients")
        .update({ opened_at: new Date().toISOString() })
        .eq("id", recipientId)
        .is("opened_at", null);
    } else if (type === "click") {
      await supabase
        .from("campaign_recipients")
        .update({ clicked_at: new Date().toISOString() })
        .eq("id", recipientId)
        .is("clicked_at", null);
    }
  }

  // Update campaign aggregate counts
  if (type === "open") {
    // Count unique opens (distinct recipients)
    const { count } = await supabase
      .from("campaign_recipients")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", campaignId)
      .not("opened_at", "is", null);
    await supabase.from("campaigns").update({ open_count: count || 0 }).eq("id", campaignId);
  } else if (type === "click") {
    const { count } = await supabase
      .from("campaign_recipients")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", campaignId)
      .not("clicked_at", "is", null);
    await supabase.from("campaigns").update({ click_count: count || 0 }).eq("id", campaignId);
  }

  // Return appropriate response
  if (type === "click" && redirectUrl) {
    // Validate redirect URL to prevent open redirect attacks
    try {
      const parsed = new URL(redirectUrl);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        return new Response("Invalid redirect URL", { status: 400 });
      }
    } catch {
      return new Response("Invalid redirect URL", { status: 400 });
    }
    return new Response(null, {
      status: 302,
      headers: { Location: redirectUrl },
    });
  }

  // Return tracking pixel for opens
  return new Response(PIXEL, {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
    },
  });
});
