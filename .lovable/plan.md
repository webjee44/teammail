

# Plan V4 — Fiabilisation complète du flux d'envoi

L'analyse du CTO identifie 5 priorités. Voici le plan correctif fichier par fichier.

---

## P1. Unifier reply sur le pipeline outbox (priorité critique)

Aujourd'hui `ReplyArea` → `onReply` → `useInboxMutations.handleReply()` → appel direct `gmail-send`. C'est le défaut majeur.

### Changements

**`src/hooks/useInboxMutations.ts`** — Refactorer `handleReply` et `handleUndoExpire` :
- `handleReply` : ne fait plus d'appel direct. Stocke le payload dans `pendingSendRef`, ouvre `UndoSendDialog`.
- `handleUndoExpire` : au lieu d'appeler `gmail-send` + insert `messages` + update `conversations`, insère une ligne dans `outbox_commands` avec `command_type = 'send_reply'`, le `conversation_id`, et un `idempotency_key` basé sur `conversation_id + timestamp`. Puis `toast("Message en file d'envoi")`.
- Suppression de tout le code direct `gmail-send`, `messages.insert`, `conversations.update` de ce hook.

**`supabase/functions/process-outbox/index.ts`** — Le handler `send_reply` existe déjà et gère : appel `gmail-send`, insert `messages`, update `conversations`. Aucun changement nécessaire.

**`src/components/inbox/conversation/ReplyArea.tsx`** — Le bouton "Envoyer" appelle déjà `onReply`. Ajouter : avant l'appel, faire `flushDraft()` et `setDraftStatus('send_pending')` via le hook `useDraft` déjà présent. Après envoi, `resetState` marque le draft `sent` au lieu de `deleteDraft`.

---

## P2. Automatiser process-outbox via pg_cron

Aujourd'hui le worker n'est jamais déclenché automatiquement.

### Changements

**Insertion SQL (via `supabase--read_query` ou insert tool)** — Créer un cron job :
```sql
SELECT cron.schedule(
  'process-outbox-every-30s',
  '*/1 * * * *',  -- toutes les minutes (pg_cron minimum)
  $$ SELECT net.http_post(
    url := 'https://yrofditplxilqdtcwovq.supabase.co/functions/v1/process-outbox',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer <service_role_key>"}'::jsonb,
    body := '{}'::jsonb
  ) $$
);
```

Nécessite d'activer les extensions `pg_cron` et `pg_net` via migration.

---

## P3. Renforcer la garantie brouillon serveur

### Changements

**`src/hooks/useDraft.ts`** :
- Ajouter flush sur `visibilitychange` (quand le document passe en `hidden`) — c'est plus fiable que `beforeunload` et fonctionne sur mobile.
- Le `beforeunload` existant fait déjà un save localStorage. Ajouter un `navigator.sendBeacon` vers un endpoint léger si le draft est dirty (optionnel, peut être ajouté en P5).

**`src/components/inbox/conversation/ReplyArea.tsx`** :
- Ajouter un `useEffect` cleanup qui appelle `flushDraft()` quand la conversation change ou le composant se démonte.

---

## P4. Réconciliation post-envoi

### Changements

**`supabase/functions/process-outbox/index.ts`** :
- Après un `gmail-send` réussi mais un échec sur l'insert `messages` ou l'update `conversations` : ne pas marquer la commande comme `sent`, la laisser en `processing` pour retry.
- Ajouter un check : si `gmail-send` retourne un `messageId`, vérifier si un message avec ce `gmail_message_id` existe déjà avant d'insérer (idempotence).
- En cas d'échec partiel, logger dans `sync_journal` avec `drift_type = 'outbox_partial_send'`.

---

## P5. Nettoyer la surface d'audit

### Changements

**Aucun changement de code** — c'est un correctif du script d'export uniquement.
- Le prochain export d'audit doit requêter `information_schema.columns` en live (pas un cache) pour inclure `drafts.status` et `drafts.error_message`.
- Ajouter dans le MANIFEST les colonnes ajoutées par les migrations récentes.

---

## Résumé des fichiers modifiés

| Fichier | Changement |
|---------|-----------|
| `src/hooks/useInboxMutations.ts` | Reply via outbox au lieu de gmail-send direct |
| `src/components/inbox/conversation/ReplyArea.tsx` | Flush draft + status send_pending avant reply |
| `src/hooks/useDraft.ts` | Flush sur visibilitychange |
| `supabase/functions/process-outbox/index.ts` | Idempotence post-send + journal de drift |
| Migration SQL | Activer pg_cron + pg_net, créer le job cron |
| Tests | Adapter `useInboxMutations` tests, ajouter test idempotence outbox |

## Aucune nouvelle dépendance

Tout repose sur les tables et fonctions existantes.

