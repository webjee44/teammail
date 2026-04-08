

# Plan : Campagnes Email groupées (type Lemlist)

## Résumé

Créer une fonctionnalité complète de campagnes email avec un wizard multi-étapes accessible via un CTA "Campagne" dans la sidebar. Les emails seront envoyés via l'infrastructure Gmail existante (gmail-send edge function), avec personnalisation par variables dynamiques ({{nom}}, {{email}}, etc.).

## Architecture

```text
┌─────────────────────────────────────────────┐
│  /campaigns (page liste)                    │
│  ┌─────────────────────────────────────────┐│
│  │ Liste des campagnes + bouton "Nouvelle" ││
│  └─────────────────────────────────────────┘│
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  /campaigns/new (wizard 4 étapes)           │
│  ┌──────┬──────┬──────┬──────┐             │
│  │ 1.   │ 2.   │ 3.   │ 4.   │             │
│  │Config│Desti-│Rédac-│Aperçu│             │
│  │      │natai-│tion  │& Envoi│             │
│  │      │res   │      │      │             │
│  └──────┴──────┴──────┴──────┘             │
└─────────────────────────────────────────────┘
```

## Étapes du wizard

1. **Configuration** — Nom de la campagne, choix de la mailbox d'envoi, objet
2. **Destinataires** — Sélection depuis les contacts existants (recherche, filtres, sélection multiple, import CSV optionnel)
3. **Rédaction** — Éditeur riche avec variables dynamiques ({{nom}}, {{email}}, {{entreprise}}), templates disponibles, polish IA
4. **Aperçu & Envoi** — Preview personnalisée pour un destinataire, compteur total, confirmation, envoi immédiat ou programmé

## Base de données (2 nouvelles tables)

**campaigns** — Stocke la campagne
- id, team_id, name, subject, body_html, from_email, status (draft/sending/sent/failed), total_recipients, sent_count, failed_count, created_by, scheduled_at, created_at, updated_at

**campaign_recipients** — Liens campagne ↔ contacts
- id, campaign_id, contact_id, email, name, company, status (pending/sent/failed), error_message, sent_at

RLS team-scoped sur les deux tables.

## Edge function : send-campaign

Nouvelle edge function qui :
1. Charge la campagne + ses destinataires pending
2. Pour chaque destinataire, remplace les variables ({{nom}}, {{email}}, {{entreprise}}) dans le body/subject
3. Appelle gmail-send pour chaque email (avec un délai entre chaque envoi pour éviter le rate-limiting)
4. Met à jour le statut de chaque recipient (sent/failed)
5. Met à jour les compteurs de la campagne

## Modifications UI

1. **Sidebar** — Ajout d'un lien "Campagnes" avec icône Megaphone dans la section Outils
2. **Page /campaigns** — Liste des campagnes avec statut, compteurs, date
3. **Page /campaigns/new** — Wizard 4 étapes avec stepper visuel, animations de transition
4. **App.tsx** — Nouvelles routes /campaigns et /campaigns/new

## Détails techniques

- Les variables supportées : `{{nom}}`, `{{email}}`, `{{entreprise}}`, `{{téléphone}}`
- Envoi par batch de 10, avec 1s de délai entre chaque envoi pour respecter les limites Gmail
- La campagne peut être sauvegardée en brouillon à chaque étape
- Preview en temps réel du rendu avec les variables remplacées pour le premier destinataire
- Le stepper du wizard reprend le style indigo du projet avec animations fluides

