

# Gestion des contacts — style Missive

## Résumé

Créer un système complet de gestion de contacts partagés par équipe : table `contacts` en base, fiche contact dans le panneau droit de la conversation, page dédiée `/contacts`, et enrichissement automatique à la réception d'emails.

## Base de données

**Nouvelle table `contacts`** :
- `id`, `team_id`, `email` (unique par team), `name`, `company`, `phone`, `avatar_url`, `notes` (texte libre partagé), `custom_fields` (jsonb), `created_at`, `updated_at`
- RLS : CRUD pour les membres de l'équipe (`team_id = get_user_team_id(auth.uid())`)

**Nouvelle table `contact_conversations`** (lien many-to-many) :
- `contact_id`, `conversation_id` — pour retrouver l'historique des conversations d'un contact
- RLS : SELECT via join sur conversations.team_id

**Ajout colonne `contact_id` sur `conversations`** (optionnel, pour lien rapide au contact principal).

## Enrichissement automatique

Dans la edge function `gmail-sync`, après création d'une conversation :
1. Chercher si un contact existe déjà pour `from_email` dans l'équipe
2. Si non → créer automatiquement avec `name` = `from_name`, `company` = domaine de l'email (partie après @)
3. Lier la conversation au contact via `contact_conversations`

## Fiche contact dans le panneau conversation

Dans `ConversationDetail.tsx`, ajouter un panneau latéral droit (ou section dépliable) affichant :
- Avatar, nom, email, entreprise, téléphone
- Notes partagées (éditables inline)
- Champs personnalisés
- Liste des conversations passées avec ce contact (cliquable pour naviguer)
- Bouton "Voir la fiche complète" → lien vers `/contacts/:id`

## Page `/contacts`

Nouvelle page avec :
- Liste searchable/filtrable de tous les contacts de l'équipe
- Colonnes : nom, email, entreprise, dernière interaction, nb conversations
- Clic sur un contact → vue détaillée (drawer ou page)
- Actions : créer, éditer, supprimer un contact
- Import possible plus tard

## Navigation

- Ajouter "Contacts" dans `InboxSidebar.tsx` (section Outils, icône `Users`)
- Route `/contacts` dans `App.tsx`

## Fichiers impactés

| Fichier | Action |
|---------|--------|
| Migration SQL | Créer tables `contacts` et `contact_conversations` + RLS |
| `supabase/functions/gmail-sync/index.ts` | Auto-création contacts |
| `src/pages/Contacts.tsx` | Nouvelle page |
| `src/components/inbox/ContactPanel.tsx` | Nouveau panneau fiche contact |
| `src/components/inbox/ConversationDetail.tsx` | Intégrer ContactPanel |
| `src/pages/Index.tsx` | Charger le contact lié à la conversation |
| `src/components/inbox/InboxSidebar.tsx` | Ajouter lien Contacts |
| `src/App.tsx` | Route `/contacts` |

