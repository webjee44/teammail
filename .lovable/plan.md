
# Envoyer plus tard — Emails programmés

## Résumé
Permettre de rédiger un email et programmer son envoi à une date/heure future. Un bouton "Envoyer plus tard" avec sélecteur de date/heure s'ajoute à côté du bouton "Envoyer".

## Base de données

**Nouvelle table `scheduled_emails`** :
- `id` (uuid), `team_id` (uuid), `created_by` (uuid — user_id)
- `to_email` (text), `subject` (text), `body` (text), `from_email` (text)
- `attachments` (jsonb, nullable — stocke les pièces jointes en base64)
- `scheduled_at` (timestamptz — quand envoyer)
- `status` (text — `pending`, `sent`, `failed`, `cancelled`)
- `error_message` (text, nullable)
- `sent_at` (timestamptz, nullable)
- `created_at`, `updated_at`
- RLS : les membres de l'équipe peuvent CRUD leurs emails programmés

## Interface — Compose.tsx

- Ajout d'un bouton "Envoyer plus tard" (icône horloge) à côté de "Envoyer"
- Clic → Popover avec un date picker + time picker
- Validation : la date doit être dans le futur
- Confirmation → sauvegarde dans `scheduled_emails` avec status `pending`
- Toast de confirmation avec l'heure programmée
- Redirection vers l'inbox

## Edge Function — `process-scheduled-emails`

- Fonction invoquée par pg_cron toutes les minutes
- Requête les emails avec `status = 'pending'` ET `scheduled_at <= now()`
- Pour chaque email, appelle la fonction `gmail-send` existante
- Met à jour le status en `sent` ou `failed`

## Fichiers impactés

| Fichier | Action |
|---------|--------|
| Migration SQL | Table `scheduled_emails` + RLS |
| `src/pages/Compose.tsx` | Bouton "Envoyer plus tard" + date/time picker |
| `supabase/functions/process-scheduled-emails/index.ts` | Nouveau — traitement cron |
| pg_cron job | Planifier l'exécution toutes les minutes |
