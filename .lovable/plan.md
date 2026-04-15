

# Plan: Gmail Sync Pipeline -- Fix complet

## Bugs immédiats identifiés

**Bug 1 (bloquant) -- `historyTypes` mal formaté (ligne 242)**
L'URL envoie `historyTypes=messageAdded,labelAdded,labelRemoved` comme une seule valeur. L'API Gmail attend des paramètres répétés. C'est pourquoi la sync incrémentale échoue à chaque run avec `INVALID_ARGUMENT` pour les deux mailboxes.

**Bug 2 (bloquant) -- Full scan timeout sans checkpoint**
Le full scan traite 3 pages (60 threads) + attachments, timeout avant de sauvegarder `history_id` et `last_sync_at`. La mailbox marketing@ n'a jamais de `history_id` sauvegardé, donc elle recommence le full scan à chaque run.

---

## Changements

### 1. Migration SQL -- Ajouter colonnes de pilotage sur `team_mailboxes`

```sql
ALTER TABLE team_mailboxes
  ADD COLUMN IF NOT EXISTS sync_mode text NOT NULL DEFAULT 'full_scan',
  ADD COLUMN IF NOT EXISTS full_scan_page_token text,
  ADD COLUMN IF NOT EXISTS last_run_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_successful_sync_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_error_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_error_message text;
```

Pour les mailboxes qui ont déjà un `history_id`, mettre `sync_mode = 'incremental'` :
```sql
UPDATE team_mailboxes SET sync_mode = 'incremental' WHERE history_id IS NOT NULL;
```

### 2. `supabase/functions/gmail-sync/index.ts` -- Réécriture du pipeline

**A. Fix `historyTypes` (incrementalSync, ligne ~242)**
Remplacer `url.searchParams.set("historyTypes", "messageAdded,labelAdded,labelRemoved")` par trois appels `url.searchParams.append("historyTypes", ...)` séparés.

**B. Full scan reprenable avec cursor**
- Lire `full_scan_page_token` depuis la mailbox
- Traiter 1 seule page (20 threads) par run
- Skip le téléchargement binaire des pièces jointes (enregistrer les métadonnées seulement)
- Après chaque page : sauvegarder `full_scan_page_token`, `last_run_at`
- Quand il n'y a plus de `nextPageToken` : récupérer `historyId` via `/users/me/profile`, sauvegarder, passer `sync_mode = 'incremental'`, mettre `last_successful_sync_at`, effacer `full_scan_page_token`

**C. Incremental -- runs courts**
- Mettre à jour `history_id` et `last_successful_sync_at` en fin de run réussi
- En cas d'erreur : écrire `last_error_at` + `last_error_message`, ne pas toucher `history_id`
- Si history expired (404) : repasser `sync_mode = 'full_scan'`, effacer `history_id`

**D. Une mailbox par run (round-robin)**
- Trier les mailboxes par `last_run_at ASC NULLS FIRST`
- Ne traiter que la première (la plus en retard)
- Garantit un traitement équitable entre commercial@ et marketing@

**E. Logs structurés dans `sync_journal`**
Après chaque run, insérer via service role :
```
{ mailbox_id, drift_type: 'sync_run', action_taken: 'full_scan_page_2' | 'incremental',
  remote_state: '20 threads', local_state: 'duration: 8s, success' }
```

### 3. `src/components/inbox/InboxSidebar.tsx` -- Indicateur de fraîcheur sync

- Requêter `team_mailboxes.last_successful_sync_at` et `last_error_at` dans le `fetchData` existant
- Afficher un point coloré à côté du sélecteur de boîte mail :
  - Vert : `last_successful_sync_at` < 5 min
  - Orange : entre 5 et 15 min ou `sync_mode = 'full_scan'`
  - Rouge : > 15 min ou `last_error_at > last_successful_sync_at`
- Tooltip au hover avec le timestamp exact

### 4. Fix cron `historyTypes` existant

Le cron actuel fonctionne (appelle la fonction toutes les minutes). Pas de changement nécessaire.

---

## Fichiers modifiés

| Fichier | Changement |
|---------|-----------|
| Migration SQL | Colonnes `sync_mode`, `full_scan_page_token`, `last_run_at`, `last_successful_sync_at`, `last_error_at`, `last_error_message` |
| `supabase/functions/gmail-sync/index.ts` | Fix historyTypes, full scan paginé reprenable, skip attachments binaires, round-robin, logs sync_journal |
| `src/components/inbox/InboxSidebar.tsx` | Indicateur visuel sync vert/orange/rouge |

## Aucune nouvelle dépendance

