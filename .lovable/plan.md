

## Problème actuel

Les 4 toggles actuels sont confus :
- **Bruit (10)** — terme technique, pas clair pour l'utilisateur
- **Tous les mails** — ne veut rien dire, c'est juste "désactiver les autres filtres"
- **Non lus (0)** — ok mais mal positionné
- **Répondus (8)** — ok mais l'ensemble manque de hiérarchie

## Proposition de refonte

Remplacer les 4 toggles par un système de **filtres par onglets/chips** cliquables, plus intuitif :

```text
[À traiter (12)]  [Non lus (3)]  [Déjà répondus (8)]  [Ignorés (10)]
```

### Logique :
| Chip | Comportement | Correspondance actuelle |
|------|-------------|------------------------|
| **À traiter** | Vue par défaut. Open + pas bruit + needs_reply. C'est le backlog. | État par défaut actuel |
| **Non lus** | Sous-filtre de "À traiter" : seulement les non lus | Toggle "Non lus" |
| **Déjà répondus** | Open + dernier message sortant. Conversations en attente de réponse du contact. | Toggle "Répondus" |
| **Ignorés** | Conversations marquées comme non pertinentes (ex: newsletters, notifications) | Toggle "Bruit" |

### Changements UX :
- **Suppression de "Tous les mails"** — remplacé par la possibilité de cliquer sur plusieurs chips
- **"Bruit" → "Ignorés"** — terme plus compréhensible
- **"Répondus" → "Déjà répondus"** — plus explicite (on a répondu, on attend le contact)
- Les chips sont mutuellement exclusifs (un seul actif à la fois), sauf "Non lus" qui est un sous-filtre de "À traiter"

### Organisation visuelle :
- Chips compacts avec compteurs, style `Badge` cliquable
- Le chip actif est mis en surbrillance (bg-primary)
- Plus de switches/toggles — les chips sont plus scannable

## Fichiers modifiés
- `src/components/inbox/ConversationList.tsx` — Remplacer les toggles par des chips de filtre
- `src/pages/Index.tsx` — Simplifier la logique de filtrage, adapter les props

## Détails techniques
- Remplacement des 4 props boolean (`hideNoise`, `showAllMails`, `showUnreadOnly`, `showReplied`) par un seul `activeFilter: "actionable" | "unread" | "replied" | "noise"`
- Le filtrage se fait dans `Index.tsx` avant de passer les conversations à `ConversationList`
- Les compteurs sont calculés depuis la source non filtrée (via `computeInboxCounts`)

