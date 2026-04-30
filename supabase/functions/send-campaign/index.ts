import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function replaceVariables(text: string, recipient: { name: string | null; email: string; company: string | null }) {
  return text
    .replace(/\{\{nom\}\}/g, recipient.name || "")
    .replace(/\{\{email\}\}/g, recipient.email || "")
    .replace(/\{\{entreprise\}\}/g, recipient.company || "")
    .replace(/\{\{téléphone\}\}/g, "");
}

function injectTracking(html: string, campaignId: string, recipientId: string, trackingBaseUrl: string): string {
  // 1. Inject open tracking pixel before </body> or at end
  const pixelUrl = `${trackingBaseUrl}?t=open&c=${campaignId}&r=${recipientId}`;
  const pixel = `<img src="${pixelUrl}" width="1" height="1" style="display:none;border:0;" alt="" />`;

  let result = html;
  if (result.includes("</body>")) {
    result = result.replace("</body>", `${pixel}</body>`);
  } else {
    result += pixel;
  }

  // 2. Rewrite links for click tracking
  result = result.replace(
    /href=["']([^"']+)["']/gi,
    (_match, rawUrl) => {
      const url = String(rawUrl).trim();
      // Don't track mailto, tel, anchors, or already-tracked links
      if (
        url.startsWith("mailto:") ||
        url.startsWith("tel:") ||
        url.startsWith("#") ||
        url.startsWith("javascript:")
      ) {
        return _match;
      }
      // Normalize: prepend https:// if no protocol
      let normalized = url;
      if (!/^https?:\/\//i.test(normalized)) {
        // Strip leading slashes for protocol-relative or root-relative URLs
        normalized = "https://" + normalized.replace(/^\/+/, "");
      }
      const clickUrl = `${trackingBaseUrl}?t=click&c=${campaignId}&r=${recipientId}&u=${encodeURIComponent(normalized)}`;
      return `href="${clickUrl}"`;
    }
  );

  return result;
}

function inlineStyles(html: string): string {
  let result = html
    .replace(/<p>/g, '<p style="margin:0 0 16px 0;line-height:1.5;">')
    .replace(/<ul>/g, '<ul style="margin:0 0 16px 0;padding-left:24px;">')
    .replace(/<ol>/g, '<ol style="margin:0 0 16px 0;padding-left:24px;">')
    .replace(/<li>/g, '<li style="margin:0 0 4px 0;">')
    .replace(/<a /g, '<a style="color:#6366f1;text-decoration:underline;" ');

  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1a1a1a;line-height:1.5;">${result}</div>`;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

    const { campaign_id } = await req.json();
    if (!campaign_id) {
      return new Response(JSON.stringify({ error: "campaign_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Tracking base URL
    const trackingBaseUrl = `${supabaseUrl}/functions/v1/campaign-track`;

    // Load campaign
    const { data: campaign, error: campErr } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", campaign_id)
      .single();

    if (campErr || !campaign) {
      return new Response(JSON.stringify({ error: "Campaign not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (campaign.status !== "draft") {
      return new Response(JSON.stringify({ error: "Campaign already sent or sending" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark as sending
    await supabase.from("campaigns").update({ status: "sending" }).eq("id", campaign_id);

    // Load pending recipients
    const { data: recipients } = await supabase
      .from("campaign_recipients")
      .select("*")
      .eq("campaign_id", campaign_id)
      .eq("status", "pending");

    if (!recipients || recipients.length === 0) {
      await supabase.from("campaigns").update({ status: "sent" }).eq("id", campaign_id);
      return new Response(JSON.stringify({ success: true, sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build set of emails already sent for this campaign — strict idempotence
    const { data: alreadySent } = await supabase
      .from("campaign_recipients")
      .select("email")
      .eq("campaign_id", campaign_id)
      .eq("status", "sent");
    const sentEmails = new Set((alreadySent || []).map((r) => r.email.toLowerCase()));

    // Background worker — runs after we return the response, so no 150s timeout
    const work = async () => {
      let sentCount = 0;
      let failedCount = 0;

      for (let i = 0; i < recipients.length; i++) {
        const r = recipients[i];

        // Re-check campaign status every iteration — allow remote stop
        const { data: cur } = await supabase
          .from("campaigns")
          .select("status")
          .eq("id", campaign_id)
          .single();
        if (cur?.status !== "sending") {
          console.log(`Campaign ${campaign_id} no longer sending (${cur?.status}) — stopping`);
          break;
        }

        // Skip if this email was already sent in a previous run
        if (sentEmails.has(r.email.toLowerCase())) {
          await supabase
            .from("campaign_recipients")
            .update({ status: "skipped_duplicate" })
            .eq("id", r.id);
          continue;
        }
        sentEmails.add(r.email.toLowerCase());

      const personalizedSubject = replaceVariables(campaign.subject, r);
      let personalizedBody = replaceVariables(campaign.body_html, r);

      // Convert plain text to HTML if body is not already HTML
      const isAlreadyHtml = /<[a-z][\s\S]*>/i.test(personalizedBody);
      if (!isAlreadyHtml) {
        personalizedBody = personalizedBody.replace(/\n/g, "<br>");
      }

      // Inline styles for Gmail compatibility
      personalizedBody = inlineStyles(personalizedBody);

      // Inject tracking pixel + rewrite links
      personalizedBody = injectTracking(personalizedBody, campaign_id, r.id, trackingBaseUrl);

      try {
        const sendRes = await fetch(`${supabaseUrl}/functions/v1/gmail-send`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            to: r.email,
            subject: personalizedSubject,
            body: personalizedBody,
            from_email: campaign.from_email,
            skip_signature: true,
          }),
        });

        if (sendRes.ok) {
          sentCount++;
          await supabase
            .from("campaign_recipients")
            .update({ status: "sent", sent_at: new Date().toISOString() })
            .eq("id", r.id);
        } else {
          const errText = await sendRes.text();
          failedCount++;
          await supabase
            .from("campaign_recipients")
            .update({ status: "failed", error_message: errText.slice(0, 500) })
            .eq("id", r.id);
        }
      } catch (e: any) {
        failedCount++;
        await supabase
          .from("campaign_recipients")
          .update({ status: "failed", error_message: String(e).slice(0, 500) })
          .eq("id", r.id);
      }

        // Update campaign counts periodically (cumulative across runs)
        if ((i + 1) % 5 === 0 || i === recipients.length - 1) {
          const { count: totalSent } = await supabase
            .from("campaign_recipients")
            .select("*", { count: "exact", head: true })
            .eq("campaign_id", campaign_id)
            .eq("status", "sent");
          const { count: totalFailed } = await supabase
            .from("campaign_recipients")
            .select("*", { count: "exact", head: true })
            .eq("campaign_id", campaign_id)
            .eq("status", "failed");
          await supabase.from("campaigns").update({
            sent_count: totalSent || 0,
            failed_count: totalFailed || 0,
          }).eq("id", campaign_id);
        }

        // Delay between sends — randomized 4-8s
        if (i < recipients.length - 1) {
          const ms = 4000 + Math.floor(Math.random() * 4000);
          await delay(ms);
        }
      }

      // Final update — mark as sent if no more pending
      const { count: stillPending } = await supabase
        .from("campaign_recipients")
        .select("*", { count: "exact", head: true })
        .eq("campaign_id", campaign_id)
        .eq("status", "pending");
      const { count: totalSent } = await supabase
        .from("campaign_recipients")
        .select("*", { count: "exact", head: true })
        .eq("campaign_id", campaign_id)
        .eq("status", "sent");
      const { count: totalFailed } = await supabase
        .from("campaign_recipients")
        .select("*", { count: "exact", head: true })
        .eq("campaign_id", campaign_id)
        .eq("status", "failed");

      await supabase.from("campaigns").update({
        status: (stillPending || 0) === 0 ? "sent" : "draft",
        sent_count: totalSent || 0,
        failed_count: totalFailed || 0,
      }).eq("id", campaign_id);

      console.log(`Campaign ${campaign_id} done — sent=${sentCount}, failed=${failedCount}`);
    };

    // Run in background — response returns immediately
    // @ts-ignore — EdgeRuntime is available in Supabase Edge Functions
    EdgeRuntime.waitUntil(work());

    return new Response(
      JSON.stringify({ success: true, queued: recipients.length, message: "Envoi en cours en arrière-plan" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("send-campaign error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
