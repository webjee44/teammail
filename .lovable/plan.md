

# Plan : Refactoring P0 — Corrections critiques (version ajustée)

Intègre les 8 corrections demandées par le CTO : enum resserré, realtime sur UPDATE, fallback reply strict, helpers centralisés, index SQL, bulk actions corrigées, vue Archivées, et 3 tests.

---

## Étape 1 — Migration SQL

```sql
CREATE TYPE conversation_state AS ENUM ('inbox', 'archived', 'trash', 'spam');

ALTER TABLE conversations 
  ADD COLUMN state conversation_state NOT NULL DEFAULT 'inbox';

-- Backfill (toutes les conversations existantes → inbox)
UPDATE conversations SET state = 'inbox' WHERE state = 'inbox';

-- Index pour perf inbox
CREATE INDEX idx_conversations_state ON conversations (state);
CREATE INDEX idx_conversations_mailbox_state_last_msg 
  ON conversations (mailbox_id, state, last_message_at DESC);
```

**Règle métier** :
- `state` = emplacement système (`inbox`, `archived`, `trash`, `spam`)
- `status` = workflow équipe (`open`, `closed`, `snoozed`)
- Les deux sont indépendants : `archived + open` et `archived + closed` sont valides
- `sent` et `draft` restent hors de `conversation_state` (gérés séparément)

---

## Étape 2 — `gmail-archive/index.ts`

Remplacer le `DELETE` (ligne ~135) par un `UPDATE` :

```typescript
// AVANT: DELETE FROM conversations WHERE id = conversation_id
// APRÈS:
const { error } = await supabase
  .from("conversations")
  .update({ state: "archived" })
  .eq("id", conversation_id);
```

Supprimer le bloc de suppression. Le reste (retrait du label INBOX côté Gmail) ne change pas.

---

## Étape 3 — Supprimer le mailbox hardcodé + fallback dynamique

Dans `Index.tsx` (lignes 66-73), remplacer le `useEffect` qui force `674f3650-...` par :

```typescript
useEffect(() => {
  if (!searchParams.has("mailbox") && !filter) {
    supabase.from("team_mailboxes").select("id")
      .eq("sync_enabled", true).order("created_at").limit(1)
      .then(({ data }) => {
        if (data?.[0]) {
          const params = new URLSearchParams(searchParams);
          params.set("mailbox", data[0].id);
          setSearchParams(params, { replace: true });
        }
      });
  }
}, []);
```

---

## Étape 4 — Reply depuis la mailbox de la conversation

Dans `handleReply` (ligne 690+), remplacer le `limit(1)` arbitraire :

```typescript
// 1. Mailbox de la conversation
const { data: convMailbox } = await supabase
  .from("conversations").select("mailbox_id").eq("id", id).maybeSingle();

let fromEmail: string | undefined;
if (convMailbox?.mailbox_id) {
  const { data: mb } = await supabase
    .from("team_mailboxes").select("email")
    .eq("id", convMailbox.mailbox_id).single();
  fromEmail = mb?.email;
}

// 2. Fallback : mailbox courante (URL)
if (!fromEmail && mailboxId) {
  const { data: mb } = await supabase
    .from("team_mailboxes").select("email")
    .eq("id", mailboxId).single();
  fromEmail = mb?.email;
}

// 3. Pas de fallback automatique → bloquer
if (!fromEmail) {
  toast.error("Impossible de déterminer l'expéditeur. Sélectionnez une boîte mail.");
  return;
}
```

---

## Étape 5 — Créer `useInboxMutations.ts`

Nouveau hook centralisé avec 2 helpers internes :

```typescript
// Helpers internes — SEULS points de mutation de l'état local
function applyConversationPatch(id: string, patch: Partial<Conversation>) { ... }
function removeFromActiveView(id: string) { ... }
```

Fonctions extraites depuis `Index.tsx` :
- `handleArchive` (ex `handleDelete`) — `UPDATE state='archived'` + `removeFromActiveView`
- `handleStatusChange` — `applyConversationPatch`
- `handleBulkArchive` — boucle `UPDATE state='archived'` + `removeFromActiveView` pour chaque
- `handleBulkStatusChange` — `applyConversationPatch` en lot
- `handleBulkMarkRead` — `applyConversationPatch` en lot

Le hook reçoit `conversations`, un seul `setConversations`, `selectedId`, `setSelectedId`.

---

## Étape 6 — Filtrer sur `state` dans les vues

Dans `Index.tsx`, ajouter `.eq("state", "inbox")` à la requête principale (ligne 287) pour les vues inbox.

Ajouter un lien **"Archivées"** dans `InboxSidebar.tsx` (`filter=archived`) qui charge `.eq("state", "archived")`.

La recherche (`search_inbox`) reste globale : elle cherche dans tous les `state` sauf `trash`.

---

## Étape 7 — Realtime corrigé

Modifier le handler realtime dans `Index.tsx` :

- **UPDATE** : si `state` passe à `archived`/`trash`/`spam` et que la vue courante est `inbox` → retirer de la liste. Si la vue est `archived` et `state` passe à `inbox` → retirer aussi.
- **DELETE** : retirer de l'UI (réservé aux suppressions réelles).
- **INSERT** : insérer seulement si `state` correspond à la vue active.

```typescript
// UPDATE handler
.on('postgres_changes', { event: 'UPDATE', ... }, (payload) => {
  const c = payload.new as any;
  const currentView = filter === "archived" ? "archived" : "inbox";
  if (c.state !== currentView) {
    // Retirer de la vue
    setConversations(prev => prev.filter(x => x.id !== c.id));
    if (selectedId === c.id) setSelectedId(null);
    return;
  }
  // Sinon, mettre à jour normalement
  setConversations(prev => prev.map(x => x.id === c.id ? { ...x, ...patch } : x));
})
```

---

## Étape 8 — Tests

3 tests dans `src/lib/__tests__/inbox-mutations.test.ts` :

1. **Archive ne supprime pas** : vérifier que `handleArchive` appelle `update({ state: 'archived' })` et non `delete`
2. **Reply utilise la mailbox de la conversation** : mock `conversation.mailbox_id`, vérifier que c'est l'email correspondant qui est utilisé
3. **Pas d'envoi si mailbox ambiguë** : si `mailbox_id` est null et pas de mailbox dans l'URL, vérifier que la fonction retourne sans envoyer et affiche une erreur

---

## Fichiers modifiés

| Fichier | Action |
|---------|--------|
| Migration SQL | Enum, colonne `state`, backfill, 2 index |
| `supabase/functions/gmail-archive/index.ts` | `UPDATE` au lieu de `DELETE` |
| `src/pages/Index.tsx` | Retirer hardcode, filtrer sur `state`, corriger reply, utiliser `useInboxMutations`, realtime sur UPDATE |
| `src/hooks/useInboxMutations.ts` | **Nouveau** — mutations centralisées avec `applyConversationPatch` / `removeFromActiveView` |
| `src/components/inbox/InboxSidebar.tsx` | Ajouter lien "Archivées" |
| `src/lib/__tests__/inbox-mutations.test.ts` | **Nouveau** — 3 tests |

## Ordre d'exécution

1. Migration SQL
2. `gmail-archive` → UPDATE
3. `useInboxMutations` (nouveau hook)
4. `Index.tsx` — retirer hardcode, filtrer `state`, reply strict, utiliser hook, realtime
5. `InboxSidebar` — vue Archivées
6. Tests

