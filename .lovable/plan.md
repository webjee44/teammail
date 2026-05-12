## Objectif

Remplacer la palette ⌘K « globale » par une recherche **suggestive style Gmail**, **limitée à la boîte mail actuellement sélectionnée** dans le menu de gauche.

## UI cible

```text
┌──────────────────────────────────────────────────────┐
│ 🔍  Rechercher dans Romane…              plp     ✕   │
├──────────────────────────────────────────────────────┤
│ [Pièce jointe] [7 derniers jours] [De moi] [Non lus] │ ← chips toggle
├──────────────────────────────────────────────────────┤
│ ✉  Fwd: Suivi de notre échange         📎 26/08/25  │
│    wf@mypartner-ec.fr                                │
│ ✉  Suivi — intro **PLP** & docs financiers   11/08  │
│    Safaa Akhamal, Maxence M., …                      │
│ ✉  **PLP**-Pacte d'associés              📎 23/05   │
│    Safaa Akhamal                                     │
├──────────────────────────────────────────────────────┤
│ 🔍 Tous les résultats pour "plp"          Press ↵    │
└──────────────────────────────────────────────────────┘
```

Comportement clé :
- **Scope = boîte sélectionnée uniquement.** Le placeholder rappelle la boîte (« Rechercher dans Romane… »). Si aucune boîte n'est sélectionnée (vue Archivés / Corbeille / etc.), on rétablit le scope à toutes les boîtes de l'équipe.
- Une ligne = un thread (sujet en titre, expéditeurs ou snippet en sous-titre, date à droite, icône `Paperclip` si attachement).
- Les occurrences du terme tapé sont en **gras**.
- Chips cumulables, debounce 120 ms.
- ENTER → page complète des résultats (toujours scopée à la même boîte).

## Plan technique

### 1. RPC `search_inbox` enrichie + scope mailbox

Étendre la fonction Postgres :
- Nouveaux paramètres : `p_mailbox_id uuid`, `p_has_attachment bool`, `p_since timestamptz`, `p_from_me bool`, `p_unread_only bool`.
- Filtrage : `(p_mailbox_id IS NULL OR c.mailbox_id = p_mailbox_id)` — c'est ce filtre qui assure que la recherche est scopée à la boîte courante.
- Renvoie par conversation : `mailbox_email`, `from_name`, `from_email`, `subject`, `snippet`, `last_message_at`, `has_attachment`, `is_unread`.
- Recherche aussi dans `messages.body_text` via `EXISTS`, dédupliquée par conversation.
- Tri `last_message_at DESC`, `LIMIT` paramétrable (8 dans la palette / 100 dans la page).

### 2. Refonte `CommandMenu.tsx`

- Reçoit en prop le `mailboxId` courant (lu depuis l'URL `?mailbox=…` dans `Index.tsx`) **et** le label de la boîte (pour le placeholder).
- Passe `p_mailbox_id` au RPC à chaque requête.
- Composant `SearchFilters` : barre de chips toggle alimentant les paramètres du RPC.
- Helper `highlightMatch(text, query)` : split insensible à la casse, JSX avec `<mark>` (sécurise les regex).
- Rendu enrichi (icône, date relative `JJ/MM` / `HH:MM` aujourd'hui, `Paperclip` conditionnel).
- Footer « Tous les résultats pour `q` » → `navigate('/search?q=…&mailbox=…&filters=…')`.
- Sections WhatsApp / Contacts retirées de la palette (la recherche reste *email-only* pour rester focalisée sur la boîte sélectionnée).

### 3. Nouvelle page `/search`

- `src/pages/SearchResults.tsx` ajoutée à `App.tsx`.
- Lit `q`, `mailbox`, `filters` depuis l'URL, appelle la même RPC (limite 100, pagination « Charger plus »).
- Réutilise `ConversationList` pour le rendu (cohérence visuelle).
- En-tête : « Résultats pour `xxx` dans **Romane** » + même barre de chips éditable.

### 4. Filtres rapides

| Chip                 | Effet sur le RPC                                              |
|----------------------|----------------------------------------------------------------|
| Pièce jointe         | `EXISTS (attachments WHERE message_id IN messages.id)`         |
| 7 derniers jours     | `last_message_at >= now() - interval '7 days'`                 |
| De moi               | dernier message `is_outbound = true` ET `from_email = mailbox.email` |
| Non lus              | `is_read = false`                                              |

### 5. Tests

- Unit test `highlightMatch` (insensible à la casse, échappement regex, multi-occurrences).
- Vérifications SQL via `read_query` : la RPC retourne 0 résultat hors-scope quand `p_mailbox_id` est passé.
- Vérification visuelle navigateur : ⌘K depuis la boîte Romane → seuls les threads de Romane apparaissent ; switch vers Commercial → résultats différents.

## Hors-scope (proposé, à confirmer plus tard)

- Opérateurs Gmail (`from:`, `subject:`, `has:attachment`, `before:` …).
- Recherche full-text Postgres `tsvector` (l'index trigram `pg_trgm` déjà présent suffit pour l'instant).
- Recherche WhatsApp / Contacts (resterait accessible depuis leurs pages dédiées).