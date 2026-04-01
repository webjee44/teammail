

# Plan : IA pour l'analyse des emails (priorité, bruit, réponses, entités)

## Fonctionnalités retenues

| # | Fonctionnalité | Description |
|---|---------------|-------------|
| 4 | **Score de priorité + filtrage du bruit** | Chaque conversation reçoit un score (haute/moyenne/basse) et un flag `is_noise` (newsletters, notifications auto). Toggle "Masquer le bruit" dans l'inbox. |
| 5 | **Suggestions de réponses IA** | En lisant une conversation, 2-3 brouillons de réponse sont générés et cliquables pour pré-remplir le champ de réponse. |
| 6 | **Extraction d'entités** | Noms, entreprises, montants, dates extraits automatiquement et affichés dans un panneau latéral de la conversation. |

## Architecture technique

```text
┌─────────────┐     ┌──────────────────────┐     ┌────────────────┐
│ gmail-sync  │────▶│ ai-analyze-email     │────▶│ conversations  │
│ (existant)  │     │ (nouvelle edge fn)   │     │ + messages DB  │
└─────────────┘     │  Lovable AI Gateway  │     │ nouveaux champs│
                    │  gemini-3-flash      │     └────────────────┘
                    └──────────────────────┘
                              ▲
┌─────────────┐               │
│ ai-suggest  │───────────────┘  (appel à la demande)
│ -reply      │
│ (edge fn)   │
└─────────────┘
```

**Modele IA** : `google/gemini-3-flash-preview` via Lovable AI Gateway (LOVABLE_API_KEY deja configuree).

## Etapes d'implementation

### 1. Migration DB — nouveaux champs sur `conversations`

Ajouter a la table `conversations` :
- `priority` (text, nullable) — `high` / `medium` / `low`
- `is_noise` (boolean, default false) — newsletters, notifs auto
- `ai_summary` (text, nullable) — resume court
- `entities` (jsonb, nullable) — `{people:[], companies:[], amounts:[], dates:[]}`
- `category` (text, nullable) — `support`, `billing`, `commercial`, `notification`, `other`

### 2. Edge Function `ai-analyze-email`

- Recoit `{conversation_id}` ou `{batch: true}` pour traiter toutes les conversations non analysees
- Recupere le sujet + snippet + body_text du dernier message
- Appelle Lovable AI avec tool calling pour extraire en une seule requete :
  - `priority`, `is_noise`, `summary`, `category`, `entities`
- Met a jour la conversation en DB
- Appelee automatiquement depuis `gmail-sync` apres chaque sync

### 3. Edge Function `ai-suggest-reply`

- Recoit `{conversation_id}`
- Recupere l'historique des messages
- Appelle Lovable AI pour generer 2-3 brouillons de reponse courts
- Retourne les suggestions au frontend (pas de persistence)

### 4. UI — Filtrage du bruit dans l'inbox

- Ajouter un toggle "Masquer le bruit" en haut de `ConversationList`
- Badge de priorite (rouge/orange/gris) sur chaque conversation
- Badge de categorie a cote du sujet
- Filtre cote client : `conversations.filter(c => !showNoise ? !c.is_noise : true)`

### 5. UI — Suggestions de reponse dans ConversationDetail

- Bouton "Suggerer des reponses" sous le panneau de reponse
- Appel a `ai-suggest-reply` au clic
- Affichage de 2-3 chips cliquables qui pre-remplissent le `replyText`
- Indicateur de chargement pendant la generation

### 6. UI — Panneau d'entites dans ConversationDetail

- Section pliable "Informations extraites" dans le header de conversation
- Affiche : priorite, categorie, resume IA, entites (personnes, entreprises, montants, dates)
- Badges colores pour chaque type d'entite

### 7. Integration dans gmail-sync

- Apres la boucle de sync, appeler `ai-analyze-email` avec `{batch: true}` pour analyser les nouvelles conversations
- Ou appeler conversation par conversation dans la boucle existante

## Fichiers concernes

| Fichier | Action |
|---------|--------|
| `supabase/migrations/` | Migration pour les 5 nouveaux champs |
| `supabase/functions/ai-analyze-email/index.ts` | Nouvelle edge function |
| `supabase/functions/ai-suggest-reply/index.ts` | Nouvelle edge function |
| `supabase/functions/gmail-sync/index.ts` | Appel post-sync a l'analyse |
| `src/pages/Index.tsx` | Fetch des nouveaux champs, toggle bruit, passer aux composants |
| `src/components/inbox/ConversationList.tsx` | Toggle bruit, badges priorite/categorie |
| `src/components/inbox/ConversationDetail.tsx` | Panneau entites, bouton suggestions reponse |

