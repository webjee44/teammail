

# Aperçu mail en slide-over moderne

## Concept
Remplacer le layout actuel à 2 panneaux redimensionnables (ResizablePanelGroup) par un layout où :
- La **liste des conversations** occupe toute la largeur
- Le **détail du mail** apparaît en **slide-over panel** depuis la droite, par-dessus la liste, avec un overlay semi-transparent

Inspiré des UX modernes type Linear, Superhuman, ou les sheets de shadcn/ui.

## Modifications

### 1. `src/pages/Index.tsx`
- Supprimer le `ResizablePanelGroup` / `ResizablePanel` / `ResizableHandle`
- La liste des conversations occupe tout l'espace
- Quand `selectedId` est défini, afficher le `ConversationDetail` dans un **Sheet** (composant shadcn déjà présent dans le projet) ouvert depuis la droite
- Le Sheet utilise une largeur large (~70-75% de l'écran, ou `max-w-3xl`) pour bien afficher le contenu du mail
- Fermer le Sheet remet `selectedId` à `null`

### 2. Animations
- Utiliser le composant `Sheet` existant (`src/components/ui/sheet.tsx`) qui inclut déjà les animations slide-in/out
- Le Sheet sera configuré avec `side="right"` pour glisser depuis la droite

### 3. Avantages
- Plus moderne et aéré
- La liste reste visible en arrière-plan (contexte conservé)
- Fonctionne mieux sur écrans moyens
- Pas de nouveau composant à créer — utilisation du Sheet shadcn existant

## Détails techniques
- Import `Sheet, SheetContent` depuis `@/components/ui/sheet`
- Suppression des imports `ResizablePanelGroup, ResizablePanel, ResizableHandle`
- Le `SheetContent` aura une classe `sm:max-w-3xl w-[75vw]` pour une largeur confortable
- Le padding interne du Sheet sera minimal pour laisser `ConversationDetail` gérer son propre layout

