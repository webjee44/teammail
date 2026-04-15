

# Plan : Ajouter un filtre "Tous" dans la boîte de réception

## Problème
Il n'existe pas de filtre pour voir toutes les conversations ouvertes. L'utilisateur doit basculer entre "À traiter", "Non lus", "Déjà répondus" et "Ignorés" pour avoir une vue complète.

## Solution

Ajouter un filtre "Tous" (`all`) comme premier choix dans les chips de filtre. Il affichera toutes les conversations ouvertes (actionable + replied + noise).

### Fichiers modifiés

**1. `src/components/inbox/ConversationList.tsx`**
- Ajouter `"all"` au type `InboxFilter`
- Ajouter `all: number` dans `FilterCounts`
- Ajouter le chip `{ key: "all", label: "Tous" }` en premier dans `filterConfig`

**2. `src/lib/inbox-metrics.ts`**
- Ajouter `all` dans `InboxCounts` (= actionable + replied + noise)
- Calculer `all` dans `computeInboxCounts`

**3. `src/pages/Index.tsx`**
- Changer le filtre par défaut de `"actionable"` à `"all"`
- Ajouter le cas `"all"` dans le switch du filtre : `return c.status === "open"`
- Ajouter `all` dans `filterCounts`

