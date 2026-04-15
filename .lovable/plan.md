

# Plan : Corrections P1.1–P1.3 + nettoyage UI

3 corrections ciblées issues du retour CTO, plus le fix du libellé "delete" trompeur.

---

## P1.1 — gmail-archive : empêcher le drift silencieux

**Fichier** : `supabase/functions/gmail-archive/index.ts`

**Problème** : Si l'appel Gmail échoue (lignes 158-163), la fonction continue et met quand même `state = 'archived'` en base. Drift silencieux.

**Correction** :
- Si l'archive Gmail échoue (`!archiveRes.ok` ou exception), ne PAS modifier le state local
- À la place, journaliser dans `sync_journal` avec `drift_type = 'archive_failed'`
- Retourner une erreur 502 au client pour que l'UI puisse notifier l'utilisateur
- Seul cas où on archive localement sans Gmail : quand il n'y a pas de `gmail_thread_id` (conversation purement locale)

---

## P1.2 — Realtime cohérent avec toutes les vues

**Fichier** : `src/hooks/useConversationRealtime.ts`

**Problème** : Le handler INSERT/UPDATE ne filtre que sur `state`, pas sur `mailboxId`, `filter` (mine/unassigned/closed), ni `status`.

**Correction** :
- Ajouter `mailboxId` aux params du hook
- Sur INSERT : vérifier `state` ET `mailboxId` ET les règles du filtre actif (mine → `assigned_to === userId`, unassigned → `assigned_to === null`, closed → `status === 'closed'`)
- Sur UPDATE : même logique — si la conversation ne correspond plus à la vue, la retirer ; si elle y entre (ex: `state` revient à `inbox`), ne pas l'insérer automatiquement (laisser le prochain refetch s'en charger, car on n'a pas toutes les données enrichies en realtime)
- Mettre à jour les deps du `useEffect` pour inclure `mailboxId`

---

## P1.3 — syncThread : forcer `state = 'inbox'` lors du full scan

**Fichier** : `supabase/functions/gmail-sync/index.ts`

**Problème** : Lignes 356-364 — quand une conversation existante est revue dans un scan INBOX, le `UPDATE` ne touche pas `state`. Une conversation anciennement archivée reste `archived` même si Gmail la montre dans INBOX.

**Correction** :
- Ajouter `state: 'inbox'` dans les deux blocs d'update existants (lignes 358 et 377) lors d'un full scan INBOX
- Cela garantit qu'un full scan réconcilie l'état local avec Gmail

---

## P1.4 — Renommer "delete" → "archive" dans l'UI

**Fichier** : `src/pages/Index.tsx`

**Problème** : `ConversationDetail` reçoit `onDelete={handleArchive}`. Le libellé est trompeur.

**Correction** :
- Vérifier la prop dans `ConversationDetail` et la renommer en `onArchive` si elle existe
- Vérifier le texte/icône visible dans l'UI du bouton pour qu'il affiche "Archiver" et non "Supprimer"

---

## Fichiers modifiés

| Fichier | Changement |
|---------|-----------|
| `supabase/functions/gmail-archive/index.ts` | Fail si Gmail échoue, journaliser dans sync_journal |
| `src/hooks/useConversationRealtime.ts` | Filtrage complet (mailboxId, filter, status, assigned_to) |
| `supabase/functions/gmail-sync/index.ts` | `state: 'inbox'` dans syncThread pour les conversations existantes |
| `src/pages/Index.tsx` | Renommer onDelete → onArchive |
| `src/components/inbox/ConversationDetail.tsx` | Adapter la prop et le libellé du bouton |

## Ordre d'exécution

1. gmail-archive (drift prevention)
2. gmail-sync (state reconciliation in full scan)
3. useConversationRealtime (view-aware filtering)
4. UI rename delete → archive

