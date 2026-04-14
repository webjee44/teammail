

# Plan : Threading Gmail — miroir des conversations

## Problème
Quand TeamMail envoie une réponse, Gmail crée une **nouvelle conversation** au lieu de l'ajouter au thread existant. Raison : le `gmail-send` ne passe ni le `threadId` Gmail, ni les headers `In-Reply-To` / `References` qui sont indispensables au threading Gmail.

## Solution

### 1. Modifier `gmail-send` (Edge Function) pour accepter le threading

**Fichier** : `supabase/functions/gmail-send/index.ts`

- Accepter de nouveaux paramètres optionnels : `thread_id`, `in_reply_to`, `references`
- Dans `buildRawEmail`, ajouter les headers `In-Reply-To` et `References` quand fournis
- Passer `threadId` dans le body de l'appel Gmail API :
  ```json
  { "raw": "...", "threadId": "19d8ae537f09ec84" }
  ```

### 2. Passer les infos de threading depuis le frontend (reply inline)

**Fichier** : `src/pages/Index.tsx`

- Dans `handleReply`, récupérer le `gmail_thread_id` de la conversation et le `gmail_message_id` du dernier message
- Les passer dans le payload envoyé à `gmail-send` :
  ```typescript
  thread_id: conv.gmail_thread_id,
  in_reply_to: lastMessage.gmail_message_id,
  references: lastMessage.gmail_message_id,
  ```

### 3. Passer les infos de threading depuis FloatingCompose (reply via compose)

**Fichier** : `src/hooks/useComposeWindow.tsx` + `src/components/inbox/FloatingCompose.tsx`

- Ajouter `threadId`, `inReplyTo` optionnels au state du compose window
- Les transmettre à `gmail-send` lors de l'envoi

### 4. Stocker le Message-ID Gmail sur les messages synchronisés

Les `gmail_message_id` stockés en base sont les IDs internes Gmail (ex: `19d8ae...`), pas les RFC Message-ID headers. Pour le threading, il faut que `In-Reply-To` contienne le header `Message-ID` RFC du dernier message.

**Option pragmatique** : Utiliser le format `<gmail_message_id@mail.gmail.com>` comme référence — Gmail accepte aussi le threading via `threadId` seul, ce qui est suffisant. On passera principalement le `threadId`.

## Fichiers modifiés
1. `supabase/functions/gmail-send/index.ts` — headers threading + threadId dans l'appel API
2. `src/pages/Index.tsx` — passer thread_id et in_reply_to dans handleReply
3. `src/hooks/useComposeWindow.tsx` — ajouter threadId/inReplyTo au state
4. `src/components/inbox/FloatingCompose.tsx` — transmettre les infos de threading

