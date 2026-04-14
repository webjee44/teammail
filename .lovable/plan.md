

# Plan : Ajout de la fonctionnalité "Transférer un mail"

## Résumé
Ajouter un bouton "Transférer" dans la zone de réponse des conversations, comme dans Gmail. Cliquer dessus ouvre la fenêtre de composition flottante pré-remplie avec l'objet `Fwd: ...` et le corps du message original (historique cité). L'utilisateur saisit le destinataire et peut modifier le texte avant d'envoyer.

## Modifications

### 1. Ajouter un bouton "Transférer" dans le header de conversation
**Fichier** : `src/components/inbox/conversation/ConversationHeader.tsx`
- Ajouter une icône "Forward" (lucide `Forward`) à côté des actions existantes (Traité, Contact, Assign...)
- Au clic, appeler un nouveau callback `onForward`

### 2. Ajouter le callback `onForward` dans les types et le wiring
**Fichier** : `src/components/inbox/conversation/types.ts`
- Pas de changement de type nécessaire, on passera par `useComposeWindow`

**Fichier** : `src/components/inbox/ConversationDetail.tsx`
- Ajouter un bouton "Transférer" dans les tabs ou passer le callback au header

### 3. Construire le corps du forward dans ConversationDetail / Index
**Fichier** : `src/components/inbox/ConversationDetail.tsx`
- Importer `useComposeWindow`
- Créer une fonction `handleForward` qui :
  - Construit le sujet : `Fwd: ${conversation.subject}` (sans doubler le préfixe)
  - Construit le corps HTML avec le message original cité (dernier message ou message sélectionné), incluant :
    - Ligne "---------- Forwarded message ----------"
    - De: / Date: / Objet: / À:
    - Le body_html du message
  - Inclut les pièces jointes du message original (les télécharge depuis le storage et les passe en base64)
  - Appelle `openCompose({ subject, body })` — le champ "to" reste vide pour que l'utilisateur le remplisse

### 4. Ajouter le bouton dans la ReplyArea
**Fichier** : `src/components/inbox/conversation/ReplyArea.tsx`
- Ajouter un troisième tab ou un bouton icône "Transférer" (Forward) dans la barre d'actions, à côté de "Répondre" et "Note interne"
- Au clic, déclencher le forward via `useComposeWindow`

### 5. Gérer les pièces jointes du message forwardé
**Fichier** : `src/components/inbox/ConversationDetail.tsx`
- Lors du forward, récupérer les pièces jointes du dernier message depuis le bucket `attachments`
- Les convertir en base64 et les passer à la fenêtre de composition
- Cela nécessite d'étendre `useComposeWindow` pour accepter des pièces jointes initiales

**Fichier** : `src/hooks/useComposeWindow.tsx`
- Ajouter `initialAttachments?: { name: string; file: File; base64: string }[]` au state et à `openCompose`

**Fichier** : `src/components/inbox/FloatingCompose.tsx`
- Initialiser les pièces jointes attachées à partir de `state.initialAttachments`

## Détails techniques
- Le forward utilise la fenêtre de composition flottante existante (`FloatingCompose`), pas la zone de réponse inline
- Le sujet est préfixé `Fwd:` (ou `Tr:` en français — on utilisera `Fwd:` comme Gmail)
- L'envoi passe par le même flux `gmail-send` existant, pas de changement backend nécessaire
- Les pièces jointes sont optionnelles — si le message original en a, elles sont incluses

## Fichiers modifiés
1. `src/hooks/useComposeWindow.tsx` — support des pièces jointes initiales
2. `src/components/inbox/FloatingCompose.tsx` — initialiser les PJ
3. `src/components/inbox/ConversationDetail.tsx` — logique forward + bouton
4. `src/components/inbox/conversation/ConversationHeader.tsx` — bouton Forward dans le header
5. `src/components/inbox/conversation/ReplyArea.tsx` — bouton Forward dans la barre d'actions

