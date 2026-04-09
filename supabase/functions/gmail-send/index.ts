import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getAccessToken(serviceAccountKey: any, senderEmail: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: serviceAccountKey.client_email,
    sub: senderEmail,
    scope: "https://www.googleapis.com/auth/gmail.send",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const encode = (obj: any) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const unsignedToken = `${encode(header)}.${encode(payload)}`;

  const pemContents = serviceAccountKey.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\n/g, "");
  const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  const sig = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const jwt = `${unsignedToken}.${sig}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    throw new Error(`Failed to get access token for ${senderEmail}: ${err}`);
  }

  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}

type Attachment = {
  filename: string;
  mime_type: string;
  data: string;
};

function buildRawEmail(
  from: string,
  to: string,
  subject: string,
  bodyHtml: string,
  bodyText: string,
  attachments?: Attachment[],
  cc?: string,
  bcc?: string,
): string {
  const boundary = `boundary_${crypto.randomUUID()}`;
  const hasAttachments = attachments && attachments.length > 0;

  const lines: string[] = [
    `From: ${from}`,
    `To: ${to}`,
    ...(cc ? [`Cc: ${cc}`] : []),
    ...(bcc ? [`Bcc: ${bcc}`] : []),
    `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
    `MIME-Version: 1.0`,
  ];

  if (hasAttachments) {
    lines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
    lines.push(``);
    lines.push(`--${boundary}`);

    const altBoundary = `alt_${crypto.randomUUID()}`;
    lines.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`);
    lines.push(``);

    lines.push(`--${altBoundary}`);
    lines.push(`Content-Type: text/plain; charset="UTF-8"`);
    lines.push(`Content-Transfer-Encoding: base64`);
    lines.push(``);
    lines.push(btoa(unescape(encodeURIComponent(bodyText))));
    lines.push(``);

    lines.push(`--${altBoundary}`);
    lines.push(`Content-Type: text/html; charset="UTF-8"`);
    lines.push(`Content-Transfer-Encoding: base64`);
    lines.push(``);
    lines.push(btoa(unescape(encodeURIComponent(bodyHtml))));
    lines.push(``);
    lines.push(`--${altBoundary}--`);

    for (const att of attachments!) {
      lines.push(``);
      lines.push(`--${boundary}`);
      lines.push(`Content-Type: ${att.mime_type}; name="${att.filename}"`);
      lines.push(`Content-Disposition: attachment; filename="${att.filename}"`);
      lines.push(`Content-Transfer-Encoding: base64`);
      lines.push(``);
      const b64 = att.data;
      for (let i = 0; i < b64.length; i += 76) {
        lines.push(b64.substring(i, i + 76));
      }
    }
    lines.push(``);
    lines.push(`--${boundary}--`);
  } else {
    lines.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
    lines.push(``);
    lines.push(`--${boundary}`);
    lines.push(`Content-Type: text/plain; charset="UTF-8"`);
    lines.push(`Content-Transfer-Encoding: base64`);
    lines.push(``);
    lines.push(btoa(unescape(encodeURIComponent(bodyText))));
    lines.push(``);
    lines.push(`--${boundary}`);
    lines.push(`Content-Type: text/html; charset="UTF-8"`);
    lines.push(`Content-Transfer-Encoding: base64`);
    lines.push(``);
    lines.push(btoa(unescape(encodeURIComponent(bodyHtml))));
    lines.push(``);
    lines.push(`--${boundary}--`);
  }

  return lines.join("\r\n");
}

async function getSignatureHtml(supabase: any, mailboxId: string): Promise<string> {
  // Try mailbox-specific signature
  const { data: ms } = await supabase
    .from("mailbox_signatures")
    .select("signature_id")
    .eq("mailbox_id", mailboxId)
    .maybeSingle();

  if (ms?.signature_id) {
    const { data: sig } = await supabase
      .from("signatures")
      .select("body_html")
      .eq("id", ms.signature_id)
      .maybeSingle();
    if (sig?.body_html) return sig.body_html;
  }

  // Fallback: team default signature (get team_id from mailbox)
  const { data: mb } = await supabase
    .from("team_mailboxes")
    .select("team_id")
    .eq("id", mailboxId)
    .maybeSingle();

  if (mb?.team_id) {
    const { data: defaultSig } = await supabase
      .from("signatures")
      .select("body_html")
      .eq("team_id", mb.team_id)
      .eq("is_default", true)
      .maybeSingle();
    if (defaultSig?.body_html) return defaultSig.body_html;
  }

  return "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { to, subject, body, from_email, from_name, attachments, cc, bcc, skip_signature } = await req.json();

    if (!to || !subject || !body || !from_email) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, subject, body, from_email" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: mailbox } = await supabase
      .from("team_mailboxes")
      .select("id, email")
      .eq("email", from_email.toLowerCase())
      .eq("sync_enabled", true)
      .maybeSingle();

    if (!mailbox) {
      return new Response(
        JSON.stringify({ error: `Mailbox ${from_email} not found or not enabled` }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get signature for this mailbox (skip for campaign emails)
    const signatureHtml = skip_signature ? "" : await getSignatureHtml(supabase, mailbox.id);

    let serviceAccountKeyStr = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
    if (!serviceAccountKeyStr) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY not configured");

    serviceAccountKeyStr = serviceAccountKeyStr.trim();
    let serviceAccountKey: any;
    try {
      serviceAccountKey = JSON.parse(serviceAccountKeyStr);
    } catch {
      try {
        serviceAccountKey = JSON.parse(atob(serviceAccountKeyStr));
      } catch (e2) {
        throw new Error(`Invalid GOOGLE_SERVICE_ACCOUNT_KEY format: ${e2}`);
      }
    }

    const accessToken = await getAccessToken(serviceAccountKey, from_email.toLowerCase());

    // Build body with signature
    // Detect if body is already HTML (from rich text editor)
    const isHtml = /<[a-z][\s\S]*>/i.test(body);
    const plainBody = isHtml ? body.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">") : body;
    const htmlBody = isHtml ? body : body.replace(/\n/g, "<br>");

    const bodyText = signatureHtml
      ? `${plainBody}\n\n--\n${signatureHtml.replace(/<[^>]*>/g, "")}`
      : plainBody;
    const bodyHtmlContent = signatureHtml
      ? `${htmlBody}<br><br>--<br>${signatureHtml}`
      : htmlBody;

    const fromHeader = from_name ? `"${from_name}" <${from_email}>` : from_email;
    const rawEmail = buildRawEmail(fromHeader, to, subject, bodyHtmlContent, bodyText, attachments, cc, bcc);
    const encodedMessage = btoa(unescape(encodeURIComponent(rawEmail)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const sendRes = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ raw: encodedMessage }),
      }
    );

    if (!sendRes.ok) {
      const errText = await sendRes.text();
      console.error("Gmail send error:", errText);
      return new Response(
        JSON.stringify({ error: `Gmail API error: ${errText}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sendData = await sendRes.json();

    return new Response(
      JSON.stringify({ success: true, messageId: sendData.id, threadId: sendData.threadId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("gmail-send error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
