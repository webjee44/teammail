

# Signatures d'équipe centralisées

## Résumé

Ajouter un onglet "Signatures" dans Paramètres permettant de créer des signatures HTML partagées par l'équipe, assignables par boîte mail. Les signatures sont automatiquement ajoutées aux emails envoyés.

## Base de données

**Nouvelle table `signatures`** :
- `id` (uuid), `team_id` (uuid), `name` (text), `body_html` (text — le contenu HTML de la signature), `is_default` (boolean, default false), `created_at`, `updated_at`
- RLS : CRUD pour les admins de l'équipe, SELECT pour tous les membres

**Nouvelle table `mailbox_signatures`** (liaison mailbox ↔ signature) :
- `mailbox_id` (uuid), `signature_id` (uuid), primary key composite
- RLS : même logique que team_mailboxes (admins gèrent, membres lisent)

## Interface — Onglet Signatures dans Settings

Nouvel onglet dans `Settings.tsx` :
- Liste des signatures existantes avec aperçu
- Formulaire de création/édition : nom + éditeur HTML rich-text (textarea avec preview)
- Possibilité de marquer une signature comme "par défaut"
- Association signature ↔ boîte mail (dropdown)
- Bouton supprimer

## Envoi d'email — Injection automatique

Modification de `gmail-send/index.ts` :
1. Après avoir vérifié le mailbox, récupérer la signature associée via `mailbox_signatures` → `signatures`
2. Si pas de signature spécifique, utiliser la signature par défaut de l'équipe
3. Ajouter le HTML de la signature en bas du body avant l'encodage (séparateur `--` + signature)

## Compose — Prévisualisation

Modification de `Compose.tsx` :
- Quand l'utilisateur sélectionne une boîte d'envoi, charger et afficher la signature correspondante sous le champ de texte (non éditable, juste preview)

## Fichiers impactés

| Fichier | Action |
|---------|--------|
| Migration SQL | Tables `signatures` et `mailbox_signatures` + RLS |
| `src/pages/Settings.tsx` | Nouvel onglet "Signatures" avec CRUD |
| `supabase/functions/gmail-send/index.ts` | Injecter signature dans l'email |
| `src/pages/Compose.tsx` | Aperçu de la signature sous le corps du mail |

