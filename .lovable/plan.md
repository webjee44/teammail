

# Refonte UX/Design de la Sidebar

## Inspirations concurrentes

**Front** : sidebar très épurée, pas de labels de section visibles, items compacts avec icônes monochromes, compteurs alignés à droite en texte gris discret (pas de badges), séparateurs subtils, bouton Compose proéminent en haut.

**Missive** : sidebar sombre, hiérarchie visuelle forte, icônes colorées pour les mailboxes, hover states très doux, scroll fluide, footer minimaliste.

**Linear** : référence UX moderne — transitions douces, items très compacts (h-7), texte 13px, couleurs désaturées, hover ultra-subtil, raccourcis clavier affichés.

## Améliorations proposées

### 1. Densité et espacement (style Linear/Front)
- Réduire la hauteur des items (py-1 au lieu de py-1.5)
- Texte en `text-[13px]` au lieu de `text-sm` pour un look plus pro
- Icônes en `h-3.5 w-3.5` (plus fines)
- Réduire le padding du header et footer

### 2. Compteurs redessinés (style Front)
- Remplacer les `Badge` par du texte simple en `text-muted-foreground text-xs tabular-nums` aligné à droite
- Plus discret, plus élégant, moins de bruit visuel

### 3. Bouton Compose amélioré
- Style outline/ghost avec bordure dashed au lieu de filled, ou bien un style plus subtil avec icône
- Visible aussi en mode collapsed (icône seule)

### 4. Hover & active states raffinés
- Hover : `bg-sidebar-accent/40` avec transition douce (`transition-colors duration-150`)
- Active : indicateur vertical à gauche (barre de 2px en `bg-primary`) au lieu d'un fond coloré complet
- Texte actif en `text-sidebar-foreground font-medium` (pas de fond)

### 5. Labels de section
- Uppercase, `text-[11px]`, `tracking-wider`, `text-muted-foreground/60` — plus discrets
- Ajouter un petit espacement supplémentaire au-dessus de chaque section (mt-4 sur le premier groupe, mt-2 sur les suivants)

### 6. Tags redessinés
- Pastille de couleur plus petite (w-2 h-2)
- Les tags deviennent des liens filtrables (NavLink vers `/?tag=id`)

### 7. Footer utilisateur
- Dropdown menu au clic sur l'avatar/nom (au lieu du bouton logout isolé)
- Options : Profil, Raccourcis clavier, Déconnexion
- Plus compact

### 8. Séparateurs
- Remplacer les `SidebarGroupLabel` visuellement lourds par des `Separator` fins entre les sections, ou des labels ultra-discrets

### 9. Raccourcis clavier
- Afficher les raccourcis en `text-[10px] text-muted-foreground` à droite des items principaux (ex: `G I` pour inbox, `C` pour compose) — style Linear

## Fichiers modifiés

| Fichier | Changements |
|---------|------------|
| `src/components/inbox/InboxSidebar.tsx` | Refonte complète du rendu : items compacts, compteurs texte, active indicator, compose en collapsed, footer dropdown, raccourcis |
| `src/index.css` | Ajout style `.sidebar-active-indicator` (barre verticale 2px) |
| `src/components/layout/AppLayout.tsx` | Aucun changement structurel attendu |

