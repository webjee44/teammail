

# Plan : Sécurisation complète des brouillons

## Contexte

Aujourd'hui `useDraft` sauvegarde en DB avec un debounce de 1500ms, sans couche locale. Un crash, un démontage ou une coupure réseau = perte. Le clic "Envoyer" supprime le brouillon avant confirmation Gmail. Aucune machine d'état formelle.

## Architecture cible

```text
Frappe clavier
  ├─► setState React (instantané)
  ├─► localStorage snapshot (instantané, clé = "draft:<id>")
  └─► debounce 500ms ─► upsert DB (drafts table)

Clic Envoyer
  ├─► flush immédiat DB (annule debounce, force upsert)
  ├─► UPDATE drafts SET status = 'send_pending'
  ├─► ferme compose, ouvre UndoSendDialog
  │
  ├── Annuler pendant countdown ──► UPDATE status = 'draft', rouvre compose
  │
  └── Countdown expire ──► gmail-send
        ├─ succès ──► UPDATE status = 'sent', supprime localStorage
        └─ échec  ──► UPDATE status = 'send_failed' + error_message
```

## Étapes d'implémentation

### 1. Migration DB : ajouter `status` et `error_message` aux drafts

La table `drafts` a déjà `status` (default `'draft'`) et `error_message` depuis une migration précédente. Vérifier que c'est bien en place, sinon ajouter :
- `status text NOT NULL DEFAULT 'draft'` — valeurs : `draft`, `send_pending`, `sent`, `send_failed`
- `error_message text` — message d'erreur si `send_failed`
- Index sur `(created_by, status)` pour les requêtes de listing

### 2. Nouveau hook `useLocalDraft` (localStorage)

Fichier : `src/hooks/useLocalDraft.ts`

- `saveLocal(draftKey, data)` — écrit dans `localStorage` sous clé `draft:<draftId|"new">`
- `loadLocal(draftKey)` — lit le snapshot local
- `clearLocal(draftKey)` — supprime l'entrée
- `listOrphanDrafts()` — liste les drafts locaux sans équivalent serveur (pour recovery au démarrage)
- Sérialisation JSON, taille limitée à ~500KB par draft

### 3. Refactor `useDraft` 

Fichier : `src/hooks/useDraft.ts`

- Réduire le debounce de 1500ms à 500ms
- Appeler `saveLocal()` à chaque `updateDraft()` (synchrone, avant le debounce)
- Ajouter `flushDraft()` : annule le timer, exécute immédiatement le save serveur, retourne une Promise
- Ajouter `setDraftStatus(status, errorMessage?)` : UPDATE en base
- Au chargement, vérifier d'abord localStorage pour récupérer un snapshot plus récent que la DB
- Ne plus appeler `deleteDraft()` nulle part — remplacer par `setDraftStatus('sent')`

### 4. Refactor `FloatingCompose` — flux d'envoi

Fichier : `src/components/inbox/FloatingCompose.tsx`

**handleSend :**
1. `await flushDraft()` — garantit que le brouillon est sauvé en DB
2. `await setDraftStatus('send_pending')` — transition d'état
3. `closeCompose()` + ouvrir `UndoSendDialog`

**handleUndoCancel :**
1. `await setDraftStatus('draft')` — retour en brouillon
2. Rouvrir le compose avec `openCompose({ draftId })` pour restaurer le contenu

**handleUndoExpire :**
1. Appel `gmail-send`
2. Succès → `setDraftStatus('sent')` + `clearLocal()`
3. Échec → `setDraftStatus('send_failed', error.message)` + toast d'erreur

**Flush sur fermeture :**
- `closeCompose` déclenche `flushDraft()` (via `useEffect` cleanup ou interception du bouton X)
- `beforeunload` event → `flushDraft()` via `navigator.sendBeacon` ou sync localStorage

### 5. Filtrage des brouillons dans la sidebar

La vue "Brouillons" de `inbox_list` (fonction DB) utilise `EXISTS(SELECT 1 FROM drafts d WHERE d.conversation_id = c.id)`. Pour la liste dédiée des brouillons standalone, filtrer sur `status = 'draft'` uniquement (exclure `sent`, `send_pending`).

### 6. Tests

- Test unitaire `useDraft` : vérifier que `flushDraft` force un save immédiat
- Test unitaire `useDraft` : vérifier que `setDraftStatus` fait l'UPDATE correct
- Test unitaire `useLocalDraft` : vérifier write/read/clear localStorage
- Test existant à adapter : le test "supprime un draft recréé" doit vérifier `status = 'sent'` au lieu de `delete`

## Fichiers modifiés

| Fichier | Changement |
|---------|-----------|
| Migration SQL | Vérifier/ajouter `status` + `error_message` + index |
| `src/hooks/useLocalDraft.ts` | Nouveau — couche localStorage |
| `src/hooks/useDraft.ts` | Debounce 500ms, `flushDraft()`, `setDraftStatus()`, intégration localStorage |
| `src/components/inbox/FloatingCompose.tsx` | Flux send_pending, flush avant envoi, recovery sur annulation |
| `src/hooks/__tests__/useDraft.test.tsx` | Adapter les tests existants + nouveaux tests |
| `src/hooks/__tests__/useLocalDraft.test.ts` | Nouveau — tests localStorage |

## Pas de nouvelle dépendance

Tout repose sur `localStorage` natif (pas d'IndexedDB pour simplifier). Suffisant pour les tailles de draft email.

