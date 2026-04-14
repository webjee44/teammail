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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { conversation_id } = await req.json();
    if (!conversation_id) {
      return new Response(JSON.stringify({ error: "conversation_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get conversation info
    const { data: conv, error: convError } = await supabase
      .from("conversations")
      .select("subject, from_name, from_email, ai_summary, category")
      .eq("id", conversation_id)
      .single();

    if (convError) throw new Error(`Conversation not found: ${convError.message}`);

    // Get message history
    const { data: messages } = await supabase
      .from("messages")
      .select("body_text, body_html, from_name, from_email, is_outbound, sent_at")
      .eq("conversation_id", conversation_id)
      .order("sent_at", { ascending: true })
      .limit(10);

    const history = (messages || [])
      .map((m: any) => {
        const body = m.body_text || (m.body_html ? m.body_html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() : "");
        const direction = m.is_outbound ? "NOUS" : "CLIENT";
        return `[${direction} - ${m.from_name || m.from_email}]: ${body.slice(0, 800)}`;
      })
      .join("\n\n");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `Tu es un assistant de support client professionnel francophone. Génère exactement 3 suggestions de réponses courtes et professionnelles. Chaque réponse doit être prête à envoyer, entre 2-4 phrases. Adapte le ton selon le contexte (formel pour facturation, empathique pour support, etc.). IMPORTANT : détecte si le client utilise le tutoiement ou le vouvoiement dans ses messages et utilise le même registre dans tes suggestions. Ne force jamais le vouvoiement si le client tutoie. Structure chaque réponse avec des sauts de ligne (\\n\\n) entre les paragraphes : salutation, corps du message, et formule de fin doivent être sur des lignes séparées.

RÈGLE TRANSFERT : Si le sujet commence par "Fwd:", "Fw:" ou "Tr:", c'est un email transféré par un collègue. Dans ce cas :
- Les suggestions doivent être des réponses INTERNES courtes au collègue : "Je m'en occupe", "C'est noté, je prends le relais", "Merci, je traite ça"
- Cherche dans le corps du message l'adresse email du client final (destinataire original)
- Si tu trouves un email client, ajoute UNE suggestion supplémentaire (4ème) avec action="compose_to" et action_email=l'email du client, label="Écrire à [email]", et body="" (vide)

Réponds via l'appel de fonction fourni.`,
          },
          {
            role: "user",
            content: `Sujet: ${conv.subject}
Client: ${conv.from_name || conv.from_email}
Catégorie: ${conv.category || "inconnue"}
Résumé IA: ${conv.ai_summary || "non disponible"}

Historique:
${history}

Génère 3 suggestions de réponses différentes.`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "suggest_replies",
              description: "Génère des suggestions de réponses professionnelles",
              parameters: {
                type: "object",
                properties: {
                  suggestions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        label: {
                          type: "string",
                          description: "Titre court de la suggestion (3-5 mots)",
                        },
                        body: {
                          type: "string",
                          description: "Texte complet de la réponse suggérée (vide si action compose_to)",
                        },
                        action: {
                          type: "string",
                          enum: ["compose_to"],
                          description: "Action optionnelle : compose_to pour ouvrir un nouveau mail vers le client",
                        },
                        action_email: {
                          type: "string",
                          description: "Email du destinataire pour l'action compose_to",
                        },
                      },
                      required: ["label", "body"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["suggestions"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "suggest_replies" } },
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      const errText = await aiResponse.text();
      console.error("AI suggest error:", status, errText);

      if (status === 429) {
        return new Response(JSON.stringify({ error: "Trop de requêtes, réessayez dans un instant." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Crédits IA épuisés. Rechargez dans Paramètres > Espace de travail > Usage." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "Erreur IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ error: "No suggestions generated" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { suggestions } = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ suggestions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("ai-suggest-reply error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
