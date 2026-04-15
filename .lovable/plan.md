

# Plan : P1 + P2 — Architecture et robustesse

Plan en 2 phases séquentielles. P1 stabilise la sync et l'architecture front. P2 ajoute les projections backend et l'outbox pattern.

---

## Bugfix immédiat — gmail-sync cassé

`gmail-sync` a une erreur de boot : `Identifier 'supabaseUrl' has already been declared` (lignes 178 et 219 déclarent `const supabaseUrl` deux fois). A corriger en premier.

---

## P1 — Phase 1 : Sync incrémentale + Architecture hooks

### P1-1 : Gmail Sync incrémental/paginé/idempotent

**Fichier** : `supabase/functions/gmail-sync/index.ts`

**Migration SQL** : ajouter `history_id bigint` sur `team_mailboxes` pour stocker le watermark Gmail.

**Changements** :
1. Corriger le bug duplicate `supabaseUrl` (supprimer lignes 219-220, réutiliser les variables existantes)
2. Ajouter la logique incrémentale :
   - Premier appel (pas de `history_id`) : full scan paginé avec `pageToken` (au lieu de `maxResults=50` sans pagination)
   - Appels suivants : utiliser `users.history.list(startHistoryId)` pour ne récupérer que les changements
   - Stocker le `historyId` retourné par Gmail dans `team_mailboxes.history_id`
3. Pagination complète : boucler sur `nextPageToken` pour les threads/history
4. Idempotence : vérification `gmail_message_id` existante déjà en place, la conserver
5. Reprise sur erreur : si `history.list` retourne 404 (historyId expiré), fallback sur full scan et reset du watermark
6. Gestion des labels : si un thread perd le label INBOX dans l'historique, mettre `state = 'archived'`

```text
Flux sync incrémental :
┌─────────────────────────────────────────┐
│ mailbox.history_id existe ?             │
│   NON → full scan paginé (threads.list) │
│         sauver history_id               │
│   OUI → history.list(startHistoryId)    │
│         404? → reset, full scan         │
│         OK → traiter messagesAdded,     │
│              labelsAdded/Removed        │
│              sauver nouveau history_id  │
└─────────────────────────────────────────┘
```

### P1-2 : Découper Index.tsx — hooks dédiés

**Objectif** : passer de 953 lignes monolithiques à une couche de présentation + hooks spécialisés.

**Nouveaux fichiers** :

| Hook | Responsabilité |
|------|---------------|
| `src/hooks/useInboxList.ts` | Chargement des conversations (query, filtres, drafts, sent), state `conversations`, `loading` |
| `src/hooks/useConversationDetail.ts` | `fetchDetail`, `messages`, `comments`, `loadingDetail`, gestion CRUD comments |
| `src/hooks/useConversationRealtime.ts` | Subscriptions realtime (conversations, messages, drafts), alimentation du cache |
| `src/hooks/useBulkActions.ts` | `bulkSelected`, toggle/selectAll/deselectAll, bulk archive/status/markRead |
| `src/hooks/useInboxSearch.ts` | `searchQuery`, `searchResults`, `handleSearch`, `clearSearch` |

**`useInboxMutations.ts`** reste tel quel (déjà centralisé).

**`Index.tsx` réduit** (~150-200 lignes) : uniquement la composition des hooks + le JSX. Plus de logique métier directe.

### P1-3 : State model enrichi

Le `conversation_state` enum est déjà en place (`inbox | archived | trash | spam`). Pour P1 :
- Ajouter les transitions `trash` et `spam` dans `useInboxMutations` (fonctions `handleTrash`, `handleSpam`)
- Ajouter les vues correspondantes dans `InboxSidebar` (Corbeille, Spam)
- Modifier `search_inbox` RPC pour exclure `trash` et `spam` des résultats

### P1-4 : Realtime → cache normalisé

Actuellement le realtime écrit directement dans `setConversations`. Le refactoring :

1. **`useConversationRealtime`** reçoit une référence au cache (le state `conversations` géré par `useInboxList`)
2. Chaque événement passe par une fonction de normalisation :
   - Vérifie si le `state` correspond à la vue active
   - Vérifie si le `team_id` / `mailbox_id` correspond aux filtres
   - Ne modifie le cache que si pertinent
3. Les événements UPDATE alimentent `applyConversationPatch` (centralisé)
4. Les événements INSERT vérifient les doublons et la pertinence avant insertion

---

## P2 — Phase 2 : Backend projections + Outbox + Réconciliation

### P2-1 : Projections backend (RPC/Views)

**Nouvelles fonctions SQL** :

- `inbox_list(p_mailbox_id, p_state, p_status, p_limit, p_offset)` : retourne les conversations avec tags, assignee_name, has_draft, needs_reply, to_email (pour sent) — en un seul appel au lieu de 5-6 queries séquentielles
- `conversation_detail(p_conversation_id)` : retourne la conversation + messages + attachments + comments + contact en un seul RPC
- Modifier `search_inbox` pour exclure `state IN ('trash', 'spam')` et retourner plus de colonnes utiles

Cela élimine les N+1 queries côté front (drafts, contacts, mailboxes, messages séparés).

### P2-2 : Outbox pattern pour l'envoi

**Migration SQL** : table `outbox_commands`

```sql
CREATE TABLE outbox_commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL,
  conversation_id uuid,
  command_type text NOT NULL, -- 'send_reply', 'send_new', 'archive', 'mark_read'
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- pending, processing, sent, failed
  idempotency_key text UNIQUE,
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  processed_at timestamptz,
  error_message text,
  retry_count int DEFAULT 0
);
```

**Nouvelle edge function** : `process-outbox/index.ts`
- Worker qui traite les commandes `pending`
- Exécute l'appel Gmail, met à jour le statut
- Idempotency key pour éviter les double-envois
- Compensation : si l'envoi Gmail réussit mais l'insertion message échoue, le retry ne renvoie pas le mail

**Côté front** : `handleReply` insère une commande dans `outbox_commands` au lieu d'appeler directement `gmail-send`. L'UI montre un état `pending` → `sent`.

### P2-3 : Réconciliation provider/local

**Nouvelle edge function** : `gmail-reconcile/index.ts`
- Comparaison périodique entre l'état local (conversations.state, is_read) et l'état Gmail (labels)
- Correction des drifts : si Gmail dit INBOX mais local dit `archived`, remettre en `inbox`
- Journal des corrections dans une table `sync_journal`
- Déclenchée par cron ou manuellement

### P2-4 : Tests end-to-end

**Nouveaux tests** :

| Test | Fichier | Vérifie |
|------|---------|---------|
| Sync incrémentale | `supabase/functions/gmail-sync/__tests__` | historyId sauvé, pagination complète, idempotence sur retry |
| Archive persistante | `src/lib/__tests__/inbox-mutations.test.ts` | conversation reste en base avec `state=archived` |
| Outbox double-send | `src/lib/__tests__/outbox.test.ts` | idempotency_key bloque le 2e envoi |
| Réconciliation | tests edge function | drift corrigé, journal créé |
| Realtime filtrage | `src/hooks/__tests__/useConversationRealtime.test.ts` | UPDATE hors-vue ne pollue pas le cache |

---

## Fichiers modifiés/créés

| Fichier | Action |
|---------|--------|
| `supabase/functions/gmail-sync/index.ts` | Fix bug + sync incrémentale + pagination |
| Migration SQL | `history_id` sur `team_mailboxes`, table `outbox_commands`, table `sync_journal`, RPC `inbox_list`, RPC `conversation_detail` |
| `src/hooks/useInboxList.ts` | **Nouveau** |
| `src/hooks/useConversationDetail.ts` | **Nouveau** |
| `src/hooks/useConversationRealtime.ts` | **Nouveau** |
| `src/hooks/useBulkActions.ts` | **Nouveau** |
| `src/hooks/useInboxSearch.ts` | **Nouveau** |
| `src/pages/Index.tsx` | Réduit à ~200 lignes (composition uniquement) |
| `src/components/inbox/InboxSidebar.tsx` | Vues Corbeille, Spam |
| `supabase/functions/process-outbox/index.ts` | **Nouveau** |
| `supabase/functions/gmail-reconcile/index.ts` | **Nouveau** |
| Tests (5 fichiers) | **Nouveaux** |

## Ordre d'exécution

**P1** (prioritaire) :
1. Fix gmail-sync (bug duplicate var) — immédiat
2. Migration `history_id` + sync incrémentale
3. Découper Index.tsx en hooks
4. Realtime normalisé
5. Vues Corbeille/Spam

**P2** (dans la foulée) :
6. RPC `inbox_list` + `conversation_detail`
7. Table `outbox_commands` + edge function `process-outbox`
8. Edge function `gmail-reconcile`
9. Tests

