

# Gestion des brouillons (Drafts)

## Comment font Front et Missive ?

**Front** : chaque brouillon est sauvegardé automatiquement en temps réel (auto-save). Les brouillons apparaissent dans un dossier "Drafts" dans la sidebar. Un brouillon peut être lié à une conversation (réponse en cours) ou être un nouveau message. Plusieurs coéquipiers voient qu'un brouillon est en cours sur une conversation (indicateur "X is typing...").

**Missive** : même approche — auto-save permanent, brouillons visibles par l'équipe, indicateur de rédaction en cours. Les brouillons sont rattachés à la conversation si c'est une réponse.

## Approche proposée pour TeamMail

### 1. Table `drafts` en base

```text
drafts
├── id (uuid, PK)
├── team_id (uuid, FK teams)
├── created_by (uuid, FK auth.users)
├── conversation_id (uuid, FK conversations, nullable) -- null = nouveau mail
├── to_email (text, nullable)
├── from_email (text, nullable)
├── subject (text, nullable)
├── body (text, nullable)
├── attachments (jsonb, nullable)
├── created_at (timestamptz)
└── updated_at (timestamptz)
```

RLS : même pattern team-scoped que les autres tables.

### 2. Auto-save avec debounce

- Dans **Compose.tsx** et **ReplyArea.tsx**, un `useEffect` avec debounce (1.5s) sauvegarde automatiquement le contenu en base via `upsert` sur la table `drafts`.
- Au montage, si un brouillon existe pour la conversation (ou pour un nouveau mail), on le restaure.
- À l'envoi réussi, le brouillon est supprimé.

### 3. Liste des brouillons dans la sidebar

- Ajouter une entrée "Brouillons" dans `InboxSidebar.tsx` avec un compteur.
- Les brouillons sans `conversation_id` (nouveaux mails) apparaissent dans cette liste.
- Les brouillons liés à une conversation apparaissent comme indicateur dans la `ConversationList` (petite icône ou badge "brouillon").

### 4. Hook `useDraft`

Un hook réutilisable qui encapsule :
- Chargement du brouillon existant (par `conversation_id` ou par `draft_id`)
- Auto-save debounced
- Suppression à l'envoi

### Fichiers à créer / modifier

| Fichier | Action |
|---------|--------|
| Migration SQL | Créer table `drafts` + RLS policies |
| `src/hooks/useDraft.ts` | Nouveau hook auto-save/load/delete |
| `src/pages/Compose.tsx` | Intégrer `useDraft` (nouveau mail) |
| `src/components/inbox/conversation/ReplyArea.tsx` | Intégrer `useDraft` (réponse) |
| `src/components/inbox/InboxSidebar.tsx` | Ajouter entrée "Brouillons" + compteur |
| `src/components/inbox/ConversationList.tsx` | Badge brouillon sur les conversations concernées |
| `src/pages/Index.tsx` | Gérer la navigation vers un brouillon (charger Compose avec draft_id en query param) |

### Détails techniques

- **Debounce** : 1500ms après la dernière frappe, `upsert` dans `drafts` avec `conversation_id` + `created_by` comme clé de conflit.
- **Chargement** : au mount de Compose (`?draft=<id>`) ou de ReplyArea (lookup par `conversation_id` + `created_by`).
- **Suppression** : après `handleSend` / `onReply` réussi, `DELETE FROM drafts WHERE id = ...`.
- **Sidebar** : query `SELECT count(*) FROM drafts WHERE conversation_id IS NULL` pour le badge.

