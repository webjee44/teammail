

# Moteur de Templates Email

## Résumé

Système complet de templates email réutilisables : créer, organiser et insérer des modèles pré-rédigés lors de la rédaction. Support de variables dynamiques (`{{nom}}`, `{{entreprise}}`, etc.) qui se remplissent automatiquement.

## Base de données

**Nouvelle table `email_templates`** :
- `id` (uuid), `team_id` (uuid)
- `name` (text) — nom du template ("Relance devis", "Bienvenue client")
- `subject` (text) — objet pré-rempli
- `body` (text) — corps avec variables `{{variable}}`
- `category` (text, nullable) — catégorie libre ("Commercial", "Support", "RH"…)
- `created_by` (uuid)
- `is_shared` (boolean, default true) — visible par toute l'équipe ou personnel
- `usage_count` (integer, default 0) — pour trier par popularité
- `created_at`, `updated_at`
- RLS : membres de l'équipe peuvent voir les templates partagés + les leurs ; CRUD pour les créateurs et admins

## Interface

### 1. Gestion des templates — Settings (nouvel onglet "Templates")

- Liste des templates existants avec nom, catégorie, aperçu du corps
- Formulaire de création/édition :
  - Nom, catégorie (select libre), objet, corps (textarea)
  - Aide visuelle : liste des variables disponibles (`{{nom}}`, `{{email}}`, `{{entreprise}}`, `{{date}}`) avec boutons pour les insérer
  - Toggle "Partagé avec l'équipe"
  - Aperçu en temps réel avec remplacement des variables par des exemples
- Suppression avec confirmation

### 2. Insertion dans Compose.tsx

- Nouveau bouton icône `FileText` ("Utiliser un template") à côté de "Envoyer plus tard"
- Clic → Dialog/Popover avec :
  - Barre de recherche pour filtrer par nom/catégorie
  - Templates groupés par catégorie
  - Compteur d'utilisation pour indiquer les plus populaires
  - Aperçu au survol
- Sélection d'un template → remplit le sujet et le corps
- Si le corps contient des variables `{{…}}`, affiche un petit formulaire inline pour renseigner les valeurs avant insertion
- Incrémente `usage_count`

### 3. Variables dynamiques

Variables supportées avec remplacement automatique quand les données sont disponibles :
- `{{nom}}` — nom du destinataire (depuis le champ "À" ou le contact associé)
- `{{email}}` — email du destinataire
- `{{entreprise}}` — entreprise du contact
- `{{date}}` — date du jour formatée
- `{{expediteur}}` — nom de l'expéditeur (profil connecté)
- Variables personnalisées libres → saisie manuelle

## Fichiers impactés

| Fichier | Action |
|---------|--------|
| Migration SQL | Table `email_templates` + RLS |
| `src/pages/Settings.tsx` | Nouvel onglet "Templates" avec CRUD complet |
| `src/pages/Compose.tsx` | Bouton + dialog d'insertion de template |
| `src/components/inbox/TemplatePickerDialog.tsx` | Nouveau — composant de sélection avec recherche, catégories, aperçu et résolution des variables |

## Détails techniques

- Les variables sont parsées avec un regex `/\{\{(\w+)\}\}/g`
- Résolution automatique : on tente de résoudre les variables connues (date, expéditeur, info contact si email du destinataire matche un contact existant)
- Variables non résolues → champ de saisie dans le dialog avant insertion
- `usage_count` incrémenté via un `update` après insertion (pas besoin d'edge function)
- Catégories libres (pas d'enum) — on récupère les catégories existantes pour les proposer en autocomplétion

