

# Ajouter "Envoyer plus tard" et "Template" à la zone de réponse

## Constat
La zone de réponse dans `ConversationDetail` ne propose actuellement que "Suggérer (IA)" et "Envoyer". Les fonctionnalités "Envoyer plus tard" (programmation) et "Template" (insertion de modèle), déjà disponibles sur la page Compose, manquent dans la réponse à un mail.

## Modifications

### `src/components/inbox/ConversationDetail.tsx`

1. **Ajouter le bouton Template** :
   - Importer `FileText` de lucide-react
   - Importer `TemplatePickerDialog` depuis `./TemplatePickerDialog`
   - Ajouter un state `templateOpen`
   - Placer un bouton "Template" à côté du bouton "Suggérer"
   - Le `TemplatePickerDialog` insère le body du template dans `replyText` (le sujet n'est pas modifiable en réponse, donc on l'ignore)

2. **Ajouter le bouton "Envoyer plus tard"** :
   - Importer `Clock`, `CalendarIcon` de lucide-react, `Popover/PopoverContent/PopoverTrigger`, `Calendar`, `Input`, `Label`
   - Ajouter les states : `scheduleOpen`, `scheduleDate`, `scheduleTime`, `scheduling`
   - Placer un bouton "Envoyer plus tard" entre "Template" et "Envoyer"
   - Au clic sur "Programmer l'envoi" :
     - Récupérer le `from_email` depuis la conversation (dernier message outbound, ou le `from_email` de la conversation)
     - Récupérer le `to` (premier message inbound `from_email`)
     - Insérer dans la table `scheduled_emails` avec le sujet de la conversation
   - Même UX que la page Compose (popover avec calendrier + heure)

3. **Layout des boutons** : La barre du bas aura : `Suggérer | Template | Envoyer plus tard | Envoyer` — les deux premiers à gauche, les deux derniers à droite.

## Détails techniques
- Le `recipientEmail` pour le TemplatePickerDialog sera extrait du premier message entrant (`from_email`)
- Le `from_email` pour la programmation sera déterminé depuis le dernier message sortant de la conversation, ou depuis la mailbox associée
- La programmation utilise la même logique que `Compose.tsx` : insertion dans `scheduled_emails` avec `team_id` et `created_by`
- Le subject de la conversation est réutilisé automatiquement (préfixé "Re: " si pas déjà présent)

