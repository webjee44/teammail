

# Inbox Zero : fermer automatiquement après réponse

## Principe
Quand tu réponds à un mail, la conversation passe automatiquement en "closed" et disparaît de la boîte de réception. Si le contact répond, le `gmail-sync` la rouvrira automatiquement (il remet `status = 'open'` quand un nouveau message entrant arrive).

## Changement unique

**Fichier : `src/pages/Index.tsx`** — dans `handleReply`, après l'envoi réussi (ligne ~762), ajouter la mise à jour du status en `closed` :

```typescript
await supabase
  .from("conversations")
  .update({ 
    last_message_at: new Date().toISOString(),
    status: "closed",
    is_read: true 
  })
  .eq("id", id);
```

La conversation disparaît immédiatement de l'inbox (qui ne montre que `status = 'open'`). Quand un nouveau message entrant arrive via `gmail-sync`, celui-ci remet déjà le status à `open` — donc la conversation réapparaîtra automatiquement.

Aucune autre modification nécessaire. Le toggle "Tous les mails" existant permet toujours de retrouver les conversations fermées si besoin.

