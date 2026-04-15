

## Plan : Barre de recherche universelle style Algolia

Remplacer la barre de recherche inline limitée par une expérience de recherche globale multicritère, utilisant le CommandMenu (⌘K) comme point d'entrée unique. La recherche couvre emails, contacts, WhatsApp, et navigue vers la bonne page selon le type de résultat.

### Architecture

```text
Clic sur barre de recherche (ou ⌘K)
  → Ouvre le CommandDialog (plein écran, overlay)
  → Debounce 200ms → requêtes parallèles :
      1. search_inbox RPC (conversations + messages)
      2. contacts (name, email, company ILIKE)
      3. whatsapp_conversations (contact_name, phone, last_message ILIKE)
  → Résultats groupés par catégorie avec icônes
  → Sélection → navigation contextuelle
```

### Fichiers modifiés

**1. `src/components/inbox/CommandMenu.tsx`** — Enrichir la recherche
- Ajouter une requête parallèle sur la table `contacts` (name, email, company ILIKE)
- Ajouter un groupe "Contacts" avec icône User, qui navigue vers `/contacts?search=...` ou ouvre le contact
- Améliorer le placeholder : "Rechercher partout…"
- Ajouter des raccourcis clavier affichés (flèches, Entrée, Échap)

**2. `src/pages/Index.tsx`** — Remplacer la barre inline par un déclencheur du CommandMenu
- Supprimer l'input de recherche inline (le `<input>` avec `searchQuery`, `handleSearch`, etc.)
- Remplacer par un bouton/zone cliquable qui ouvre `setCommandOpen(true)` au clic
- Style : même zone visuelle (icône Search + "Rechercher partout…" + badge ⌘K), mais au clic → ouvre le CommandDialog
- Supprimer `useInboxSearch` du composant (plus besoin de `searchQuery`, `searchResults`, `searchLoading`, `handleSearch`, `clearSearch`)
- `displayedConversations` redevient simplement `filteredConversations` (plus de mode "search results")
- Supprimer les indicateurs "Recherche : « query »" dans le header

**3. `src/hooks/useInboxSearch.ts`** — Supprimer le fichier
- Plus utilisé nulle part.

**4. `src/components/inbox/CommandMenu.tsx`** — Navigation contextuelle au select
- Conversation email → `onSelect(conversationId)` (ouvre le Sheet, comme aujourd'hui)
- Message email → idem, ouvre la conversation parente
- Contact → `navigate('/contacts')` avec highlight du contact
- WhatsApp → `navigate('/whatsapp?id=...')` (déjà en place)

### Ce qui change pour l'utilisateur
- Un seul point d'entrée : clic sur la barre ou ⌘K
- Recherche instantanée (debounce 200ms) sur tout : emails, messages, contacts, WhatsApp
- Résultats groupés par type avec icônes distinctes
- Navigation directe vers le bon endroit selon le résultat
- Plus de mode "recherche" qui remplace la liste de conversations

### Ce qui ne change pas
- Les filtres inbox (actionable, unread, etc.) restent intacts
- Le CommandDialog ⌘K existe déjà, on le réutilise et l'enrichit
- Les raccourcis clavier existants sont préservés

