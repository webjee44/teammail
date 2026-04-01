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

function buildRawEmail(from: string, to: string, subject: string, body: string): string {
  const boundary = `boundary_${crypto.randomUUID()}`;
  const lines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    `Content-Transfer-Encoding: base64`,
    ``,
    btoa(unescape(encodeURIComponent(body))),
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset="UTF-8"`,
    `Content-Transfer-Encoding: base64`,
    ``,
    btoa(unescape(encodeURIComponent(body.replace(/\n/g, "<br>")))),
    ``,
    `--${boundary}--`,
  ];

  return lines.join("\r\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { to, subject, body, from_email, from_name } = await req.json();

    if (!to || !subject || !body || !from_email) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, subject, body, from_email" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate that from_email is a configured mailbox
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

    // Parse service account key
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

    // Get access token impersonating the sender
    const accessToken = await getAccessToken(serviceAccountKey, from_email.toLowerCase());

    // Build and send the email
    const fromHeader = from_name ? `"${from_name}" <${from_email}>` : from_email;
    const rawEmail = buildRawEmail(fromHeader, to, subject, body);
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
