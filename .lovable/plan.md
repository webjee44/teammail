

# Plan : Barre de recherche inline dans la boîte de réception

## Problème
La recherche actuelle ouvre un dialogue modal (⌘K). L'utilisateur veut taper directement dans la barre de recherche, appuyer sur Entrée, et voir la liste des conversations filtrée par les résultats.

## Solution

Transformer la fausse barre de recherche (actuellement un `<button>` qui ouvre le CommandMenu) en un vrai `<input>` dans le header de l'inbox. Quand l'utilisateur tape un terme et appuie sur Entrée :

1. Appeler le RPC `search_inbox` existant avec le terme de recherche
2. Remplacer la liste des conversations par les résultats de la recherche
3. Afficher un état "recherche active" avec possibilité de l'effacer (bouton X)
4. Quand la recherche est effacée, revenir à la liste normale

### Fichier modifié : `src/pages/Index.tsx`

**Nouveaux states :**
- `searchQuery: string` — texte saisi dans la barre
- `searchResults: Conversation[] | null` — `null` = pas de recherche active, `[]` = aucun résultat
- `searchLoading: boolean`

**Logique de recherche :**
- Sur `onKeyDown Enter` (si query ≥ 2 chars) : appeler `supabase.rpc("search_inbox", { p_query, p_limit: 50 })`, puis récupérer les conversations correspondantes via leurs `conversation_id`
- Passer `searchResults ?? filteredConversations` au composant `ConversationList`
- Masquer les chips de filtre quand une recherche est active
- Afficher "X résultat(s) pour « terme »" dans le header + bouton X pour effacer

**Remplacement du bouton par un input :**
- Remplacer le `<button onClick={() => setCommandOpen(true)}>` par un `<input>` avec le même style
- Conserver le raccourci ⌘K pour ouvrir le CommandMenu séparément (via `onKeyDown`)

### Fichier modifié : `src/components/inbox/ConversationList.tsx`

- Aucune modification structurelle nécessaire — le composant reçoit déjà `conversations` en prop

## Comportement attendu
1. L'utilisateur tape "facture" dans la barre → appuie Entrée
2. La liste affiche toutes les conversations dont le sujet, l'expéditeur, le destinataire ou le contenu contient "facture"
3. Un indicateur "Recherche : facture ×" apparaît
4. Clic sur × → retour à la vue normale

