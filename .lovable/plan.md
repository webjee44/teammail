

# Plan : Tags de contacts + filtre par tag dans les campagnes

## Résumé

Réutiliser la table `tags` existante (déjà utilisée pour les conversations) et créer une table de liaison `contact_tags` pour associer des tags aux contacts. Dans `/contacts`, on pourra sélectionner plusieurs contacts et leur attribuer un tag (existant ou nouveau). Dans le wizard campagne (étape Destinataires), on pourra filtrer/sélectionner par tag pour charger un groupe entier.

## Base de données

**Nouvelle table `contact_tags`** (junction) :
- `contact_id` uuid (ref contacts.id ON DELETE CASCADE)
- `tag_id` uuid (ref tags.id ON DELETE CASCADE)
- PRIMARY KEY (contact_id, tag_id)
- RLS team-scoped (via join sur contacts)

Pas besoin de modifier la table `tags` existante — elle a déjà `id`, `name`, `color`, `team_id`.

## Modifications UI

### 1. Page `/contacts` — Sélection multiple + attribution de tags

- Ajouter un mode sélection avec checkboxes sur chaque contact
- Barre d'actions en haut quand des contacts sont sélectionnés : "Ajouter un tag" (ouvre un popover avec les tags existants + création rapide)
- Afficher les tags de chaque contact dans la liste (petits badges colorés)
- Filtre par tag dans la barre de recherche (dropdown ou badges cliquables)
- Dans le panneau de détail du contact, section "Tags" avec possibilité d'ajouter/retirer

### 2. Wizard campagne — Étape Destinataires

- Ajouter un filtre par tag au-dessus de la liste des contacts (badges cliquables des tags disponibles)
- Cliquer sur un tag filtre la liste ET pré-sélectionne tous les contacts de ce tag
- Bouton "Sélectionner par tag" pour charger un groupe entier d'un coup

## Fichiers impactés

| Fichier | Changement |
|---------|-----------|
| Migration SQL | Créer `contact_tags` + RLS |
| `src/pages/Contacts.tsx` | Mode sélection, attribution de tags, affichage tags, filtre par tag |
| `src/components/campaigns/CampaignStepRecipients.tsx` | Filtre et sélection par tag |

## Détails techniques

- Les tags sont partagés entre conversations et contacts (même table `tags`)
- La sélection multiple dans `/contacts` utilise un `Set<string>` d'IDs sélectionnés
- Le popover d'attribution de tag permet de créer un nouveau tag à la volée
- Dans le wizard campagne, les tags sont chargés avec un count de contacts associés pour guider l'utilisateur

