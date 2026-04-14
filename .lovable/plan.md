

## Diagnostic

La conversation **CLOUD VAPOR // CMD69DDEC5C114FE** (id `622efd20...`) existe en base mais a **0 messages**. Le thread Gmail `19d8ae537f09ec84` a été créé, la conversation a été insérée, mais les messages n'ont jamais été persistés.

**Cause racine** : dans `gmail-sync`, l'upsert des messages utilise `ignoreDuplicates: true` combiné avec `.select("id").single()`. Quand un message existe déjà (dedup), PostgreSQL ne retourne aucune ligne → `.single()` retourne une erreur → `msgErr` est truthy → le message est sauté silencieusement. Cela signifie aussi que les pièces jointes associées ne sont jamais créées.

C'est un bug introduit par le fix de déduplication précédent : `ignoreDuplicates` supprime le retour des lignes existantes.

## Plan de correction

### 1. Corriger l'upsert des messages dans `gmail-sync/index.ts`

Remplacer l'upsert avec `ignoreDuplicates` + `.single()` par une logique en deux temps :
- D'abord, vérifier si le message existe déjà via `gmail_message_id`
- Si oui, récupérer son `id` existant (pour les pièces jointes)
- Si non, faire un `insert` normal

```typescript
// Pseudo-code du fix
const { data: existingMsg } = await supabase
  .from("messages")
  .select("id")
  .eq("gmail_message_id", gMsg.id)
  .maybeSingle();

let messageId: string;
if (existingMsg) {
  messageId = existingMsg.id;
} else {
  const { data: newMsg, error: msgErr } = await supabase
    .from("messages")
    .insert({ ... })
    .select("id")
    .single();
  if (msgErr || !newMsg) continue;
  messageId = newMsg.id;
}
// Continue with attachments using messageId
```

### 2. Re-synchro de la conversation bloquée

Après le déploiement, relancer la synchro pour la boîte `commercial@cloudvapor.com` (mailbox `674f3650-de84-4bd2-9551-9ed5f97da83f`). Les messages du thread seront correctement insérés cette fois.

### Fichiers modifiés
- `supabase/functions/gmail-sync/index.ts` — fix de la logique upsert (lignes ~393-408)

