
# Boîte Mail Collaborative (Front.com Clone)

## Vue d'ensemble
Application de boîte mail collaborative connectée à Gmail via Google OAuth, permettant à une petite équipe (2-5 personnes) de gérer les emails ensemble.

## Pages & Navigation

### 1. Page de connexion
- Bouton "Se connecter avec Google" (Google OAuth avec accès Gmail)
- Design épuré, branding personnalisé

### 2. Inbox principal (vue à 3 colonnes style Front)
- **Colonne gauche (sidebar)** : Navigation avec sections Inbox, Assigned to me, Unassigned, Snoozed, Closed, Tags/Labels
- **Colonne centrale** : Liste des conversations avec aperçu (expéditeur, objet, début du message, date, assigné à, tags)
- **Colonne droite** : Détail de la conversation sélectionnée avec historique complet des messages

### 3. Fonctionnalités de collaboration
- **Assignation** : Assigner une conversation à un membre de l'équipe
- **Commentaires internes** : Ajouter des notes/commentaires visibles uniquement par l'équipe (pas envoyés au client)
- **Tags/Labels** : Créer et appliquer des tags colorés aux conversations
- **Statuts** : Open → Snoozed (avec date de rappel) → Closed

### 4. Composition & Réponse
- Répondre directement depuis le panneau de détail
- Composer un nouvel email
- Éditeur rich text basique (gras, italique, liens)

### 5. Règles d'automatisation (page dédiée)
- Créer des règles simples : "Si l'email contient X → assigner à Y / ajouter tag Z"
- Conditions : expéditeur, objet, contenu
- Actions : assigner, taguer, déplacer

### 6. Analytics basiques (page dédiée)
- Temps de réponse moyen
- Nombre de conversations par statut
- Répartition par membre de l'équipe
- Graphiques simples sur les 7/30 derniers jours

### 7. Settings
- Gestion des membres de l'équipe (inviter par email)
- Gestion des comptes Gmail connectés
- Gestion des tags

## Design
- Interface sombre/claire inspirée de Front.com
- Sidebar compacte avec icônes + texte
- Transitions fluides entre les conversations
- Badges de notification sur les conversations non lues
- Avatars des membres d'équipe

## Backend (Supabase)
- Auth via Google OAuth (avec scopes Gmail)
- Tables : profiles, teams, conversations, messages, comments, tags, rules, assignments
- Row Level Security par équipe
- Edge Functions pour synchroniser Gmail (lecture/envoi via Gmail API)
