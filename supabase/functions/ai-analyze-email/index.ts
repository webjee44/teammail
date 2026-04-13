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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { conversation_id, batch } = body;

    // Get conversations to analyze
    let conversations: any[] = [];

    if (batch) {
      // Fetch all conversations not yet analyzed (no ai_summary)
      const { data, error } = await supabase
        .from("conversations")
        .select("id, subject, snippet, from_email, from_name")
        .is("ai_summary", null)
        .order("last_message_at", { ascending: false })
        .limit(50);

      if (error) throw new Error(`Failed to fetch conversations: ${error.message}`);
      conversations = data || [];
    } else if (conversation_id) {
      const { data, error } = await supabase
        .from("conversations")
        .select("id, subject, snippet, from_email, from_name")
        .eq("id", conversation_id)
        .single();

      if (error) throw new Error(`Failed to fetch conversation: ${error.message}`);
      conversations = [data];
    } else {
      return new Response(JSON.stringify({ error: "conversation_id or batch required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: any[] = [];

    for (const conv of conversations) {
      try {
        // Get the last message body for context
        const { data: msgs } = await supabase
          .from("messages")
          .select("body_text, body_html, from_email, from_name, is_outbound")
          .eq("conversation_id", conv.id)
          .order("sent_at", { ascending: false })
          .limit(3);

        const messageContext = (msgs || [])
          .map((m: any) => {
            const body = m.body_text || (m.body_html ? m.body_html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() : "");
            const direction = m.is_outbound ? "SENT" : "RECEIVED";
            return `[${direction}] ${m.from_name || m.from_email}: ${body.slice(0, 500)}`;
          })
          .join("\n\n");

        const prompt = `Analyse cet email professionnel.

Sujet: ${conv.subject}
De: ${conv.from_name || conv.from_email || "Inconnu"}
Extrait: ${conv.snippet || ""}

Messages récents:
${messageContext}`;

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
                content: `Tu es un assistant d'analyse d'emails professionnels. Tu dois analyser chaque email et extraire des informations structurées. Réponds UNIQUEMENT via l'appel de fonction fourni.

IMPORTANT — Les expéditeurs suivants ne sont JAMAIS du bruit (is_noise = false) :
- grenke France / service.eol@grenke.fr / service.nantes@grenke.fr (contrats de location, résiliations, rachats)
- support@pixartprinting.com — échanges de support, commandes, design service (JAMAIS du bruit)
- Tout email concernant des contrats, factures, résiliations, commandes, offres de rachat d'un fournisseur/partenaire

Seuls les newsletters marketing, alertes automatiques (Google Alerts, Discord, Semrush…), et notifications génériques de plateformes sont du bruit.
Exception : les enquêtes de satisfaction type "Votre avis compte" PEUVENT être du bruit, mais les échanges de support/commande ne le sont JAMAIS.`,
              },
              { role: "user", content: prompt },
            ],
            tools: [
              {
                type: "function",
                function: {
                  name: "analyze_email",
                  description: "Analyse structurée d'un email professionnel",
                  parameters: {
                    type: "object",
                    properties: {
                      priority: {
                        type: "string",
                        enum: ["high", "medium", "low"],
                        description: "Priorité basée sur l'urgence et l'importance du message",
                      },
                      is_noise: {
                        type: "boolean",
                        description: "true si c'est une newsletter, notification automatique, ou email marketing",
                      },
                      summary: {
                        type: "string",
                        description: "Résumé en 1-2 phrases courtes du contenu principal",
                      },
                      category: {
                        type: "string",
                        enum: ["support", "billing", "commercial", "notification", "other"],
                        description: "Catégorie principale de l'email",
                      },
                      entities: {
                        type: "object",
                        properties: {
                          people: {
                            type: "array",
                            items: { type: "string" },
                            description: "Noms de personnes mentionnées",
                          },
                          companies: {
                            type: "array",
                            items: { type: "string" },
                            description: "Noms d'entreprises mentionnées",
                          },
                          amounts: {
                            type: "array",
                            items: { type: "string" },
                            description: "Montants financiers mentionnés (ex: 1500€)",
                          },
                          dates: {
                            type: "array",
                            items: { type: "string" },
                            description: "Dates mentionnées (ex: 15 janvier 2025)",
                          },
                        },
                        required: ["people", "companies", "amounts", "dates"],
                      },
                    },
                    required: ["priority", "is_noise", "summary", "category", "entities"],
                    additionalProperties: false,
                  },
                },
              },
            ],
            tool_choice: { type: "function", function: { name: "analyze_email" } },
          }),
        });

        if (!aiResponse.ok) {
          const errText = await aiResponse.text();
          console.error(`AI error for ${conv.id}:`, aiResponse.status, errText);
          results.push({ id: conv.id, error: `AI ${aiResponse.status}` });
          continue;
        }

        const aiData = await aiResponse.json();
        const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

        if (!toolCall?.function?.arguments) {
          console.error(`No tool call for ${conv.id}:`, JSON.stringify(aiData));
          results.push({ id: conv.id, error: "No tool call response" });
          continue;
        }

        const analysis = JSON.parse(toolCall.function.arguments);

        // Update conversation with analysis
        const { error: updateError } = await supabase
          .from("conversations")
          .update({
            priority: analysis.priority,
            is_noise: analysis.is_noise,
            ai_summary: analysis.summary,
            category: analysis.category,
            entities: analysis.entities,
          })
          .eq("id", conv.id);

        if (updateError) {
          console.error(`DB update error for ${conv.id}:`, updateError);
          results.push({ id: conv.id, error: updateError.message });
        } else {
          results.push({ id: conv.id, status: "ok", priority: analysis.priority, category: analysis.category });
        }
      } catch (err) {
        console.error(`Error analyzing ${conv.id}:`, err);
        results.push({ id: conv.id, error: String(err) });
      }
    }

    return new Response(JSON.stringify({ analyzed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("ai-analyze-email error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
