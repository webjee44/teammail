import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const CLOUD_VAPOR_URL = "https://irgxsmlpyzfhltawfdod.supabase.co";
const CLOUD_VAPOR_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlyZ3hzbWxweXpmaGx0YXdmZG9kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3ODc1NTIsImV4cCI6MjA4MzM2MzU1Mn0.KhEbrUOG6ERJW9VBViE-qy8TxsPG19C93zuTkQtiYBY";

const TEAM_ID = "60a520df-c0ad-4c2e-9941-f85860f434e2";

interface B2BCustomer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  salesperson_name: string | null;
  city: string | null;
  street: string | null;
  street2: string | null;
  zip: string | null;
  country: string | null;
  is_active: boolean | null;
  odoo_id: number;
  updated_at: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    // Auth check: only service-role key (cron job)
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ") || authHeader.replace("Bearer ", "") !== supabaseServiceKey) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 1. Fetch all active customers with email from Cloud Vapor B2B
    const sourceResp = await fetch(
      `${CLOUD_VAPOR_URL}/rest/v1/b2b_customers?is_active=eq.true&email=not.is.null&select=id,name,email,phone,salesperson_name,city,street,street2,zip,country,odoo_id,updated_at`,
      {
        headers: {
          apikey: CLOUD_VAPOR_ANON_KEY,
          Authorization: `Bearer ${CLOUD_VAPOR_ANON_KEY}`,
        },
      }
    );

    if (!sourceResp.ok) {
      throw new Error(`Source API error: ${sourceResp.status} ${await sourceResp.text()}`);
    }

    const customers: B2BCustomer[] = await sourceResp.json();
    console.log(`Fetched ${customers.length} active customers from Cloud Vapor B2B`);

    // 2. Deduplicate by email
    const seen = new Set<string>();
    const validCustomers = customers.filter((c) => {
      const email = c.email?.trim().toLowerCase();
      if (!email || !email.includes("@") || seen.has(email)) return false;
      seen.add(email);
      return true;
    });
    console.log(`${validCustomers.length} unique valid contacts after dedup`);

    // 3. Map to contacts format
    const contacts = validCustomers.map((c) => ({
      team_id: TEAM_ID,
      email: c.email!.trim().toLowerCase(),
      name: c.name || null,
      company: "CloudVapor",
      phone: c.phone || null,
      street: c.street || null,
      street2: c.street2 || null,
      city: c.city || null,
      zip: c.zip || null,
      country: c.country || null,
      salesperson: c.salesperson_name || null,
      external_id: `cloudvapor_${c.id}`,
      last_synced_at: new Date().toISOString(),
    }));

    // 4. Upsert into local contacts table in batches
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const batchSize = 50;
    let upserted = 0;
    const errors: string[] = [];

    for (let i = 0; i < contacts.length; i += batchSize) {
      const batch = contacts.slice(i, i + batchSize);
      const { error } = await supabase
        .from("contacts")
        .upsert(batch, { onConflict: "team_id,email" });

      if (error) {
        errors.push(`Batch ${i}: ${error.message}`);
        console.error(`Batch ${i} error:`, error.message);
      } else {
        upserted += batch.length;
      }
    }

    // 5. Deactivate contacts no longer active in source
    // (mark contacts that have external_id but whose source customer is no longer active)
    const activeExternalIds = contacts.map((c) => c.external_id);
    // We don't delete, just log for now

    const duration = Date.now() - startTime;
    const result = {
      success: errors.length === 0,
      fetched: customers.length,
      deduplicated: validCustomers.length,
      upserted,
      errors,
      duration_ms: duration,
      synced_at: new Date().toISOString(),
    };

    console.log("Sync complete:", JSON.stringify(result));

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: errors.length === 0 ? 200 : 207,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Sync failed:", message);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
