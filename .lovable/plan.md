

# Correctif : sécurisation complète du cycle de vie brouillon → envoi

## Ce qui est déjà en place

- `useLocalDraft.ts` : snapshot localStorage immédiat à chaque frappe
- `useDraft.ts` : debounce 500ms, `flushDraft()`, `setDraftStatus()`, `beforeunload` handler
- `FloatingCompose.tsx` : flush → `send_pending` → UndoSendDialog → `sent`/`send_failed`
- `inbox_list` DB : filtre `has_draft` sur `status = 'draft'` uniquement
- DB : colonnes `status` et `error_message` sur `drafts`, index `idx_drafts_status`

## Ce qui manque (3 correctifs)

### 1. Flush du brouillon à la fermeture de la fenêtre compose

Aujourd'hui, cliquer X appelle `closeCompose()` sans flush. Si le debounce n'a pas encore tiré, le dernier contenu est perdu côté serveur (il reste en localStorage, mais pas en DB).

**Fichier** : `src/components/inbox/FloatingCompose.tsx`
- Intercepter le bouton X (et le X minimisé) pour appeler `flushDraft()` avant `closeCompose()`
- Ajouter un `useEffect` cleanup qui flush quand `state.isOpen` passe à `false`

### 2. Envoi via `outbox_commands` au lieu d'appel direct à `gmail-send`

Aujourd'hui `handleUndoExpire` appelle `gmail-send` directement depuis le front. Si le tab se ferme pendant l'appel, le message est perdu. La table `outbox_commands` existe déjà avec `idempotency_key`, `status`, `retry_count` — il faut l'utiliser.

**Fichier** : `src/components/inbox/FloatingCompose.tsx`
- `handleUndoExpire` : au lieu d'invoquer `gmail-send`, insérer une ligne dans `outbox_commands` avec `command_type = 'send_email'`, `status = 'pending'`, le payload complet, et un `idempotency_key` basé sur le `savedDraftId`
- Marquer le draft comme `sent` immédiatement (l'outbox prend le relai)
- Toast "Message en file d'envoi"

**Fichier** : `supabase/functions/process-outbox/index.ts`
- Vérifier qu'il traite déjà `send_email` commands — sinon ajouter le handler qui appelle `gmail-send` avec le payload

### 3. Récupération des brouillons `send_failed`

Un brouillon en `send_failed` doit être réouvrable depuis la sidebar.

**Fichier** : `src/hooks/useInboxList.ts` ou sidebar
- Dans la vue "Brouillons", inclure aussi `status = 'send_failed'` (en plus de `'draft'`)
- Afficher un badge "Échec" sur ces brouillons
- Au clic, rouvrir le compose avec `openCompose({ draftId })` et remettre `status = 'draft'`

## Fichiers modifiés

| Fichier | Changement |
|---------|-----------|
| `src/components/inbox/FloatingCompose.tsx` | Flush on close, envoi via outbox_commands |
| `supabase/functions/process-outbox/index.ts` | Vérifier/ajouter handler `send_email` |
| `src/hooks/useInboxList.ts` / sidebar | Inclure `send_failed` dans la vue Brouillons |
| `src/components/inbox/ConversationList.tsx` | Badge "Échec" sur les brouillons send_failed |

## Aucune migration DB nécessaire

Toutes les tables et colonnes existent déjà (`drafts.status`, `outbox_commands`).

