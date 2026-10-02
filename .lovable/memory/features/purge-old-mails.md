---
name: Purge des mails > 24 mois
description: Suppression des conversations de plus de 24 mois (oct 2026) — 8669 conversations purgées en lots + cron auto-supprimant 'purge-old-conversations'
type: feature
---
## Purge mails > 24 mois (demande du 02/10/2026)
- Règle métier : les conversations dont `last_message_at` > 24 mois sont supprimées (messages, commentaires, tags, pièces jointes en cascade).
- 8 669 conversations concernées sur 36 796. ~5 400 supprimées en lots manuels de 300 (lots de 600 = timeout).
- Le reste est purgé par le job pg_cron `purge-old-conversations` (toutes les 5 min, 500/lot, s'auto-désinstalle quand il ne reste rien).
- Les fichiers du bucket storage `attachments` ne sont PAS supprimés (schéma storage non touché) — objets orphelins possibles.
