import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.49.1");
    const token = authHeader.replace("Bearer ", "");
    const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: authData, error: authErr } = await authClient.auth.getUser(token);
    if (authErr || !authData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { text, format: inputFormat } = await req.json();

  try {
    const { text, format: inputFormat } = await req.json();
    if (!text || typeof text !== "string" || !text.trim()) {
      return new Response(JSON.stringify({ error: "Texte vide" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const isHtml = inputFormat === "html";

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `Tu es un correcteur et rédacteur professionnel francophone spécialisé dans les emails professionnels.

Règles strictes :
- Corrige toutes les fautes d'orthographe, de grammaire et de ponctuation.
- Améliore les formulations maladroites pour les rendre plus fluides et professionnelles.
- Garde exactement le même sens, le même ton et approximativement la même longueur.
- IMPORTANT : conserve le registre de tutoiement ou vouvoiement utilisé par l'auteur. Ne remplace jamais "tu" par "vous" ni l'inverse.
- Ne rajoute aucune information, aucune formule de politesse supplémentaire.
- TRÈS IMPORTANT — LIENS HYPERTEXTES : conserve TOUS les liens hypertextes (<a href="...">) tels quels. Ne supprime jamais un lien. Si le texte du lien doit être corrigé, corrige le texte affiché mais garde la balise <a> avec son href intact.
- TRÈS IMPORTANT — AÉRATION DU TEXTE :
  - Chaque idée distincte doit être dans son propre paragraphe.
  - La salutation d'ouverture (ex: "Bonjour,") doit être seule sur sa propre ligne, suivie d'une ligne vide.
  - La formule de clôture (ex: "À ta disposition.", "Cordialement,") doit être séparée du corps par une ligne vide.
  - Sépare les différentes idées/questions par des lignes vides entre les paragraphes.
  - Le texte final doit être aéré et agréable à lire, jamais un bloc compact.
${isHtml ? "- Le texte est en HTML. Retourne du HTML bien structuré. Utilise <p> pour chaque paragraphe distinct. NE PAS mettre tout le texte dans un seul <p>. Chaque paragraphe logique = un <p> séparé. Conserve toutes les balises <a href=\"...\"> existantes. Exemple :\n<p>Bonjour,</p>\n<p>Premier paragraphe avec <a href=\"https://example.com\">un lien</a>.</p>\n<p>Deuxième paragraphe.</p>\n<p>À ta disposition.</p>" : "- Retourne le texte avec des sauts de ligne (\\n\\n) entre les paragraphes."}
- Retourne UNIQUEMENT le texte corrigé, sans explication ni commentaire.`,
          },
          { role: "user", content: text },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Trop de requêtes, réessayez dans un instant." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Crédits épuisés." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erreur du service de correction" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const polished = data.choices?.[0]?.message?.content?.trim();

    return new Response(JSON.stringify({ polished: polished || text }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("polish-reply error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
