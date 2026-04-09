

# Améliorer le switch de boîtes mail — Approche UX

## Comment font Missive et Front ?

**Missive** : La sidebar a une section "Inbox" (vue agrégée) puis chaque compte email est listé en dessous comme un **dossier de premier niveau**. Quand on clique sur un compte, toute la vue (liste + filtres) se scope automatiquement à ce compte. Les sous-filtres (Assigné, Non assigné, Fermé, etc.) sont **contextuels** — ils s'appliquent au scope sélectionné. Un indicateur visuel clair montre quel scope est actif.

**Front** : Même logique. La sidebar affiche les "inboxes" (partagées ou personnelles) comme des entrées de premier niveau. Cliquer sur une inbox filtre tout. Les filtres secondaires (Open, Assigned, Unassigned) sont **imbriqués** sous l'inbox sélectionnée ou affichés dans la toolbar de la liste.

## Le problème actuel dans TeamMail

- Les boîtes mail et les filtres de conversation sont **deux sections séparées et indépendantes** dans la sidebar
- Quand on clique sur `commercial@cloudvapor.com`, les filtres "Boîte de réception", "Assigné à moi", etc. ne changent pas visuellement → l'utilisateur ne comprend pas qu'ils sont scopés
- Pas d'indicateur visuel du scope actif (quelle boîte est sélectionnée)
- Le paramètre `mailbox` est passé via query string de façon peu visible

## Approche proposée : Mailbox comme scope contextuel (style Missive)

### Principe

Transformer les boîtes mail en **sélecteur de scope** en haut de la section Conversations. Quand une boîte est sélectionnée, tous les filtres en dessous s'y appliquent automatiquement, avec un feedback visuel clair.

### Changements UI

1. **Remplacer la section "Boîtes mail"** par un **dropdown/sélecteur compact** placé juste au-dessus des filtres Conversations :

```text
┌─────────────────────────┐
│ 📬 Toutes les boîtes  ▾ │  ← dropdown
├─────────────────────────┤
│  Boîte de réception  12 │  ← filtres scopés
│  Assigné à moi        3 │
│  Non assigné           5 │
│  Fermé                 8 │
│  Envoyés             101 │
│  Brouillons            2 │
│  Programmés            1 │
└─────────────────────────┘
```

2. **Quand une boîte est sélectionnée** :
   - Le label du dropdown affiche le nom de la boîte (ex: `commercial@...`)
   - Les compteurs se mettent à jour pour ne refléter que cette boîte
   - Un badge ou style distinct indique le scope actif
   - Un bouton × permet de revenir à "Toutes"

3. **Les compteurs sont recalculés** selon le scope (boîte sélectionnée ou toutes)

### Changements techniques

- **`InboxSidebar.tsx`** : Remplacer la liste de mailboxes par un `<Select>` ou `<DropdownMenu>`. Stocker le `mailboxId` sélectionné dans le state. Recalculer les compteurs filtrés par mailbox.
- **`Index.tsx`** : Conserver la logique `mailbox` en query param pour que l'URL reste partageable, mais piloter la sélection depuis le dropdown.
- **Compteurs contextuels** : Filtrer `counts` par `mailbox_id` quand un scope est actif, au lieu de toujours afficher les totaux.

### Avantages

- **Clarté** : l'utilisateur voit immédiatement que les filtres sont scopés
- **Moins de clics** : un seul dropdown au lieu de naviguer entre sections
- **Cohérence** : même pattern que Missive/Front, familier pour les utilisateurs
- **URL stable** : le query param `mailbox=` reste pour le partage de liens

