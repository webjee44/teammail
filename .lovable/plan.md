

# Améliorer l'affichage des mails envoyés — destinataire visible

## Problème

Dans la vue "Envoyés" et dans le détail des messages sortants :
1. **Liste des conversations** : affiche `from_email` (= votre propre adresse) au lieu du destinataire — toutes les lignes montrent "commercial@cloudvapor.com" sans distinction
2. **Détail du message** : les messages outbound n'affichent pas le `to_email` (à qui on a envoyé)
3. **Header de conversation** : pas d'info sur le destinataire pour les conversations initiées par nous

## Plan

### 1. ConversationList — Afficher le destinataire pour les mails envoyés

**Fichier** : `src/components/inbox/ConversationList.tsx`

- Ajouter un champ optionnel `to_email` au type `Conversation`
- Quand on est en filtre "sent" ou quand la conversation est outbound : afficher "→ destinataire@email.com" au lieu de `from_email` comme nom principal
- Utiliser le premier message outbound `to_email` comme source d'info destinataire

### 2. Index.tsx — Passer l'info destinataire dans la liste "Envoyés"

**Fichier** : `src/pages/Index.tsx`

- Pour le filtre `sent`, fetch le `to_email` du premier message de chaque conversation (via une requête messages groupée)
- Mapper le `to_email` dans les données de conversation pour l'affichage

### 3. MessageList — Afficher le destinataire sur les messages outbound

**Fichier** : `src/components/inbox/conversation/MessageList.tsx`

- Pour les messages `is_outbound`, afficher une ligne "→ destinataire@email.com" sous le nom de l'expéditeur
- Style discret avec une flèche et texte muted

### 4. ConversationHeader — Montrer le destinataire

**Fichier** : `src/components/inbox/conversation/ConversationHeader.tsx`

- Afficher un badge ou une ligne avec le destinataire (`to_email` du premier message outbound) dans le header
- Le bouton "Contact" doit aussi fonctionner avec le `to_email` quand `from_email` est notre propre adresse

### 5. Types — Ajouter `to_email` au type Conversation

**Fichier** : `src/components/inbox/ConversationList.tsx` (type) + `src/components/inbox/conversation/types.ts`

- Ajouter `to_email?: string | null` aux types pertinents

## Résultat attendu

- Liste "Envoyés" : chaque ligne affiche le **destinataire** (pas l'expéditeur)
- Détail message outbound : ligne "À: destinataire@email.com" visible
- Header : badge destinataire visible

