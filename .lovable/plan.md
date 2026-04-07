

## Gamification des temps de réponse

Ajouter des indicateurs visuels gamifiés sur les temps de réponse à travers l'application : badges colorés, icônes, et feedback motivant.

### Endroits concernés

1. **Liste des conversations** (`ConversationList.tsx`) — Afficher un badge de temps de réponse sur chaque conversation (calculé entre le dernier message entrant et la première réponse sortante)
2. **Détail de conversation** (`MessageList.tsx`) — Afficher le temps de réponse entre chaque message entrant et sa réponse sortante, avec un badge coloré
3. **Header de conversation** (`ConversationHeader.tsx`) — Afficher le temps de réponse moyen de la conversation
4. **Page Analytics** (`Analytics.tsx`) — Ajouter des badges/objectifs gamifiés sur la KPI "temps de réponse moyen" et le graphique

### Système de gamification

Création d'un utilitaire partagé `src/lib/response-time.ts` :

- **< 5 min** → 🟢 "Éclair" (vert, icône Zap)
- **5–15 min** → 🔵 "Rapide" (bleu, icône Timer)
- **15–60 min** → 🟡 "Correct" (jaune, icône Clock)
- **1h–4h** → 🟠 "Lent" (orange, icône AlertTriangle)
- **> 4h** → 🔴 "À améliorer" (rouge, icône TrendingDown)

Chaque palier a un label, une couleur, et une icône. Fonction utilitaire `getResponseTimeTier(minutes: number)` retournant ces infos.

### Détail des modifications

**Fichier 1 : `src/lib/response-time.ts`** (nouveau)
- Fonction `getResponseTimeTier(minutes)` → `{ label, color, icon, emoji }`
- Fonction `formatResponseTime(minutes)` → chaîne lisible ("3 min", "1h 20min")

**Fichier 2 : `ConversationList.tsx`**
- Accepter une nouvelle prop optionnelle `responseTimes?: Map<string, number>` (conversation_id → minutes)
- Afficher un petit badge gamifié à côté du timestamp si un temps de réponse est disponible

**Fichier 3 : `src/pages/Index.tsx`**
- Au chargement des conversations, calculer le temps de réponse pour chaque conversation (dernier message inbound → premier outbound reply)
- Passer la Map au `ConversationList`

**Fichier 4 : `MessageList.tsx`**
- Entre chaque message entrant suivi d'une réponse sortante, afficher un petit indicateur "Répondu en X min" avec le badge gamifié correspondant

**Fichier 5 : `ConversationHeader.tsx`**
- Afficher le temps de réponse moyen de la conversation courante avec le badge gamifié

**Fichier 6 : `Analytics.tsx`**
- Remplacer le KPI brut "temps de réponse moyen" par un affichage gamifié avec badge, couleur et label
- Ajouter des objectifs/seuils visuels sur le graphique de temps de réponse (lignes horizontales colorées pour chaque palier)

### Composant réutilisable

**Fichier 7 : `src/components/inbox/ResponseTimeBadge.tsx`** (nouveau)
- Composant `<ResponseTimeBadge minutes={number} />` qui affiche le badge avec icône, couleur et label
- Variantes : `compact` (juste icône + temps) et `full` (icône + temps + label)

