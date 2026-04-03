

# Repenser la barre de recherche

## Problème
La recherche est un petit bouton ghost quasi invisible dans le header, perdu entre la cloche de notifications et le compteur de conversations. Il faut la rendre proéminente.

## Solution
Remplacer le bouton par un **champ de recherche stylisé** toujours visible dans le header — un faux input cliquable (style Linear/Slack/Front) qui ouvre le CommandMenu au clic.

### Design
- Un élément type `div` stylisé comme un input avec fond `bg-muted/50`, bordure arrondie, placeholder "Rechercher…", icône Search à gauche, badge `⌘K` à droite
- Largeur flexible (`flex-1 max-w-xs`) pour prendre de la place sans écraser le reste
- Hover state avec bordure plus visible
- Centré dans le header ou placé après le titre avec un espacement confortable

### Disposition du header repensée
```text
[☰] [Boîte de réception]     [🔍 Rechercher...  ⌘K]     [🔔] [12 conversations]
```

## Fichier modifié

| Fichier | Changement |
|---------|-----------|
| `src/pages/Index.tsx` | Remplacement du bouton Search par un faux input cliquable stylisé, repositionnement dans le header |

