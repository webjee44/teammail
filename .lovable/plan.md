

## Plan : Supprimer l'Undo Send, passer à un envoi immédiat fiable

L'analyse est claire : le mécanisme UndoSend avec toast + chrono est une source de bugs et de défiance. On le remplace par un flux simple et honnête.

### Nouveau flux d'envoi

```text
Clic "Envoyer"
  → flush brouillon
  → insert outbox_commands (durable)
  → toast "Envoi en cours…"
  → fermer compose / vider reply
  → process-outbox (pg_cron) traite la commande
  → succès = "Envoyé" / échec = "Échec — brouillon restauré"
```

### Fichiers modifiés

**1. Supprimer `src/components/inbox/UndoSendDialog.tsx`**
- Fichier entier supprimé.

**2. `src/components/inbox/FloatingCompose.tsx`**
- Supprimer l'import et le rendu de `UndoSendDialog`
- Supprimer les refs `cancelledRef`, `pendingSendRef`, l'état `undoSendOpen`
- Supprimer `handleUndoCancel` et `handleUndoExpire`
- Réécrire `handleSend` : flush draft → set `send_pending` → insert `outbox_commands` → set `sent` → `toast.success("Envoi en cours…")` → `closeCompose()`. En cas d'erreur : set `send_failed` → toast erreur → ne pas fermer.

**3. `src/hooks/useInboxMutations.ts`**
- Supprimer les refs `replyTimerRef`, `replyCancelledRef`, `pendingSendRef`
- Supprimer l'état `undoSendOpen`
- Supprimer `handleUndoCancel` et `handleUndoExpire`
- Réécrire `handleReply` : directement insert `outbox_commands` (type `send_reply`) → `toast.success("Réponse en file d'envoi")` → refresh. Plus de staging dans un ref.
- Retirer `undoSendOpen`, `handleUndoCancel`, `handleUndoExpire` du return.

**4. `src/pages/Index.tsx`**
- Supprimer l'import de `UndoSendDialog`
- Supprimer le rendu `<UndoSendDialog>`
- Retirer `handleUndoCancel`, `handleUndoExpire`, `undoSendOpen` de la destructuration de `useInboxMutations`

**5. Mettre à jour la mémoire**
- `mem://features/draft-lifecycle.md` : retirer les points 4-6 sur UndoSend et simplifier le flux.

### Ce qui ne change pas
- L'envoi programmé ("Plus tard") reste intact — c'est un mécanisme honnête.
- Le brouillon auto-sauvé reste intact.
- `process-outbox` + `pg_cron` continuent de traiter les commandes.

### Résultat pour l'utilisateur
- **Envoyer** = envoi immédiat fiable, toast "Envoi en cours…"
- **Brouillon** = sauvegarde auto permanente
- **Programmer** = envoi différé annulable (existant)
- Plus d'entre-deux, plus de chrono, plus de "j'ai cliqué annuler mais ça part quand même".

