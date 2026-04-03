

# Mentions @utilisateur dans les zones de texte

## Résumé

Ajouter un système de mentions `@` dans les notes internes et les réponses. Quand l'utilisateur tape `@`, un dropdown apparaît avec les membres de l'équipe, filtré en temps réel. La sélection insère le nom dans le texte avec un style distinctif.

## Approche

### 1. Composant `MentionTextarea`

Nouveau composant réutilisable qui remplace le `Textarea` standard :
- Surveille la saisie pour détecter le caractère `@`
- Affiche un popover/dropdown positionné sous le curseur avec la liste des membres de l'équipe (query `profiles` filtrée par `team_id`)
- Filtre la liste en temps réel selon ce qui est tapé après le `@`
- À la sélection, insère `@NomPrénom` dans le texte et ferme le dropdown
- Les mentions sont affichées en surbrillance (couleur primary) dans le texte envoyé

### 2. Chargement des membres d'équipe

- Query `profiles` via `get_user_team_id(auth.uid())` pour récupérer `full_name`, `email`, `avatar_url`
- Cache des résultats dans le composant (pas besoin de re-fetch à chaque `@`)

### 3. Intégration

- **ReplyArea.tsx** : Remplacer les deux `Textarea` (réponse + note interne) par `MentionTextarea`
- **MessageList.tsx** : Parser les `@Mentions` dans le rendu des notes internes pour les afficher avec un style distinctif (badge ou texte coloré)

### 4. Fichiers à créer / modifier

| Fichier | Action |
|---------|--------|
| `src/components/inbox/MentionTextarea.tsx` | Nouveau — composant textarea avec dropdown de mentions |
| `src/components/inbox/conversation/ReplyArea.tsx` | Remplacer `Textarea` par `MentionTextarea` |
| `src/components/inbox/conversation/MessageList.tsx` | Parser et styliser les `@mentions` dans les notes |

### Détails techniques

- Le dropdown utilise les composants `Popover` existants ou un `div` positionné en absolu
- Détection du `@` : on surveille la position du curseur et le texte entre le dernier `@` et la position courante
- Format d'insertion : `@NomComplet` (texte brut, pas de markup complexe)
- Pas de nouvelle table nécessaire — on réutilise `profiles`
- Pas de nouvelle dépendance requise

