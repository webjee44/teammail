

# Plan : Afficher les destinataires (To + CC) dans chaque message

## Problème
Quand on ouvre un mail, on ne voit pas qui sont les destinataires ni les personnes en CC. Le champ `to_email` n'est affiché que pour les messages sortants, et il n'y a aucun champ CC dans la base de données.

## Solution

### 1. Ajouter une colonne `cc` à la table `messages`
Migration SQL pour ajouter `cc text` nullable à la table `messages`.

### 2. Extraire le header CC dans `gmail-sync`
Dans `supabase/functions/gmail-sync/index.ts`, extraire le header `Cc` via `getHeader(gMsg.payload?.headers, "Cc")` et le stocker dans la nouvelle colonne lors de l'insert du message.

### 3. Afficher To et CC dans `MessageList.tsx`
Pour chaque message (inbound et outbound), afficher sous le nom de l'expéditeur :
- **À :** `msg.to_email` (toujours, pas seulement pour les outbound)
- **Cc :** `msg.cc` (si présent)

En texte compact `text-xs text-muted-foreground`, tronqué avec ellipsis si trop long.

### 4. Mettre à jour les types
- Ajouter `cc?: string | null` dans le type `Message` de `src/components/inbox/conversation/types.ts`
- Ajouter `cc` dans le type `Message` local de `src/pages/Index.tsx`

## Fichiers modifiés
- Migration SQL (nouvelle colonne `cc`)
- `supabase/functions/gmail-sync/index.ts` — extraire header CC
- `src/components/inbox/conversation/types.ts` — type Message
- `src/pages/Index.tsx` — type Message local
- `src/components/inbox/conversation/MessageList.tsx` — affichage To/CC

