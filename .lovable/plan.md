

# Plan : Filtre par boîte mail dans la sidebar

## Contexte

Actuellement les conversations n'ont pas de lien vers la boîte mail qui les a reçues. La table `team_mailboxes` existe déjà avec `email` et `label`. Il faut relier les conversations aux mailboxes, puis ajouter une section dans la sidebar pour filtrer.

## Architecture

```text
Sidebar                          Index.tsx
┌──────────────────┐             ┌─────────────────┐
│ Boîtes mail      │             │ ?filter=mine     │
│  📧 Toutes       │  ──────▶   │ &mailbox=<id>    │
│  📧 Finance      │             │                  │
│  📧 Support      │             │ WHERE mailbox_id │
│ ─────────────────│             │ = <id>           │
│ Conversations    │             └─────────────────┘
│  Boîte de récep. │
│  Assigné à moi   │
│  ...             │
└──────────────────┘
```

## Etapes

### 1. Migration DB — lier conversations aux mailboxes

- Ajouter `mailbox_id` (uuid, nullable, references team_mailboxes.id) sur `conversations`
- Remplir les mailbox_id existants en matchant `from_email` / domaine avec les mailboxes configurées (ou laisser null pour les anciennes)

### 2. Mise à jour de `gmail-sync`

- Lors de la création d'une conversation, renseigner `mailbox_id` à partir de la mailbox qui a déclenché la sync

### 3. Sidebar — section "Boîtes mail" en haut

- Nouvelle section `SidebarGroup` "Boîtes mail" placée **au-dessus** de "Conversations"
- Fetch les `team_mailboxes` et afficher chaque boîte avec une icône Mail et le label (ou l'email tronqué)
- Chaque entrée est un lien `/?mailbox=<id>` qui s'ajoute au filtre existant
- Entrée "Toutes les boîtes" pour retirer le filtre
- Badge avec le nombre de conversations ouvertes par boîte
- Le filtre `mailbox` se **combine** avec le filtre `filter` (ex: `/?filter=mine&mailbox=abc`)

### 4. Index.tsx — filtrer par mailbox

- Lire le paramètre `mailbox` depuis `searchParams`
- Si présent, ajouter `.eq("mailbox_id", mailboxId)` à la requête Supabase
- Mettre à jour le titre du header pour inclure le nom de la boîte

### 5. Sidebar — highlight actif

- Le lien de la boîte active prend le style `activeClassName`
- Quand on clique sur un filtre de statut, le paramètre `mailbox` est conservé dans l'URL

## Fichiers concernés

| Fichier | Action |
|---------|--------|
| `supabase/migrations/` | Ajouter `mailbox_id` sur `conversations` |
| `supabase/functions/gmail-sync/index.ts` | Renseigner `mailbox_id` à la création |
| `src/components/inbox/InboxSidebar.tsx` | Ajouter section "Boîtes mail", fetch mailboxes, liens combinés |
| `src/pages/Index.tsx` | Lire `mailbox` param, filtrer la requête, adapter le titre |

