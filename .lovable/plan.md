

# Plan : Barre de recherche globale ⌘K façon Boldy

## Concept

Ajouter une barre de recherche globale (Command Menu) accessible via un bouton dans le header de la liste de conversations et via le raccourci ⌘K. Elle cherche dans les conversations (sujet, expéditeur) et les messages (contenu) puis affiche les résultats groupés. Cliquer sur un résultat ouvre la conversation correspondante.

## Architecture

```text
Header conversation list
┌──────────────────────────────────┐
│ ☰  Boîte de réception  [🔍 ⌘K] │  ← bouton qui ouvre le CommandDialog
└──────────────────────────────────┘

CommandDialog (overlay modal)
┌──────────────────────────────────┐
│ 🔍  Rechercher dans les mails…   │
│──────────────────────────────────│
│ Conversations                    │
│   📧 Candidature spontanée …    │
│   📧 Facture décembre …         │
│ Messages                         │
│   💬 "…texte trouvé…"           │
└──────────────────────────────────┘
```

## Etapes

### 1. Migration DB — fonction de recherche full-text

Créer une fonction RPC `search_inbox` qui :
- Prend `p_query text` et `p_limit int`
- Cherche dans `conversations.subject`, `conversations.from_email`, `conversations.from_name` via `ILIKE`
- Cherche dans `messages.body_text` via `ILIKE`
- Retourne `type` (conversation/message), `id`, `conversation_id`, `label`, `subtitle`
- Respecte le `team_id` de l'utilisateur via `SECURITY DEFINER` + `get_user_team_id(auth.uid())`

### 2. Composant `CommandMenu.tsx`

Nouveau fichier `src/components/inbox/CommandMenu.tsx` inspiré du pattern Boldy :
- Utilise `CommandDialog`, `CommandInput`, `CommandList`, `CommandGroup`, `CommandItem` (shadcn déjà installé)
- State: `query`, `results`, `searching`
- Debounce 200ms, appel RPC `search_inbox`
- Résultats groupés : "Conversations" et "Messages"
- `onSelect` → appelle un callback pour sélectionner la conversation

### 3. Raccourci ⌘K global

Dans `Index.tsx` ou `AppLayout.tsx` :
- `useEffect` pour écouter `Cmd+K` / `Ctrl+K`
- Toggle l'état `commandOpen`

### 4. Bouton search dans le header

Dans `Index.tsx`, dans le header de la liste de conversations (le div `h-12` existant) :
- Ajouter un bouton stylisé comme Boldy : icône Search + badge `⌘K`
- Click → ouvre le CommandDialog

### 5. Navigation vers le résultat

Quand l'utilisateur clique sur un résultat :
- Extraire le `conversation_id`
- Appeler `setSelectedId(conversation_id)` pour ouvrir la conversation dans le panneau de droite

## Fichiers concernés

| Fichier | Action |
|---------|--------|
| `supabase/migrations/` | Fonction RPC `search_inbox` |
| `src/components/inbox/CommandMenu.tsx` | Nouveau composant |
| `src/pages/Index.tsx` | Bouton search + raccourci ⌘K + state `commandOpen` |

