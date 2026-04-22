
# Corriger le mélange de boîtes mail dans TeamMail

## Problème identifié
La vue principale de la boîte de réception peut afficher des conversations d’une autre boîte quand on change de scope de mailbox. Le filtrage backend par `mailbox_id` existe bien dans `inbox_list`, mais le hook `useInboxList` n’a aucun mécanisme pour ignorer les réponses obsolètes. Si une ancienne requête finit après la nouvelle, elle réécrit `conversations` avec les mauvais résultats. C’est cohérent avec le symptôme “je dois vider le cache / rafraîchir”.

## Ce que je vais corriger

### 1) Sécuriser le chargement de liste contre les réponses obsolètes
Dans `src/hooks/useInboxList.ts` :
- ajouter un identifiant de requête courant (`requestIdRef`) ou un flag `cancelled`
- n’appeler `setConversations` / `setLoading` que si la réponse appartient encore au scope actif (`filter`, `mailboxId`, `userId`, `activeState`)
- appliquer cette protection à tous les cas :
  - inbox standard via RPC `inbox_list`
  - sent
  - drafts
- vider immédiatement la liste au changement de mailbox / filtre pour éviter d’afficher l’ancien contenu pendant la transition

Effet attendu :
- quand on passe de Marketing à Commercial, une réponse retardée de Marketing ne pourra plus écraser la vue Commerciale

### 2) Durcir le realtime pour qu’il reste scoped à la bonne mailbox
Dans `src/hooks/useConversationRealtime.ts` :
- garder le filtrage actuel par `mailboxId`
- rendre le nom du channel dépendant du scope courant (ex. mailbox + filter + state) pour éviter toute ambiguïté de réabonnement quand le contexte change vite
- conserver la suppression des conversations qui ne matchent plus la vue

Effet attendu :
- plus d’injection tardive d’événements venant d’un ancien scope de boîte

### 3) Éviter les états visuels trompeurs pendant le switch
Toujours dans `useInboxList.ts` :
- remettre `loading` proprement au début du changement de scope
- réinitialiser `selectedId` côté page si la conversation ouverte n’appartient plus à la mailbox courante

Effet attendu :
- l’UI ne garde pas une ancienne conversation / ancienne liste quand la boîte change

## Fichiers à modifier
- `src/hooks/useInboxList.ts`
- `src/hooks/useConversationRealtime.ts`
- possiblement `src/pages/Index.tsx` pour nettoyer la sélection active au changement de mailbox

## Tests à ajouter
Conformément aux règles du projet :
- ajouter un test unitaire pour le comportement “ancienne requête ignorée si mailbox changée”
- ajouter un test sur le hook ou sur une petite utilité extraite pour valider :
  - requête A démarre pour Marketing
  - requête B démarre pour Commercial
  - A termine après B
  - seule la réponse B est appliquée

## Vérification après implémentation
1. Reproduire le bug dans le navigateur :
   - ouvrir Marketing
   - basculer sur Commercial
   - vérifier qu’aucun mail Marketing n’apparaît
2. Tester plusieurs changements rapides de mailbox
3. Vérifier que la recherche et l’ouverture d’une conversation ne réinjectent pas un mauvais scope
4. Lancer les tests existants + les nouveaux tests
5. Vérifier visuellement dans le navigateur que la liste reste stable sans hard refresh

## Détail technique
Le backend semble correct :
- `team_mailboxes` contient bien deux boîtes distinctes
- `conversations.mailbox_id` est bien renseigné
- la fonction SQL `inbox_list` filtre déjà avec :
```text
AND (p_mailbox_id IS NULL OR c.mailbox_id = p_mailbox_id)
```

Le correctif est donc principalement côté front : empêcher qu’une requête ou un abonnement obsolète remplace l’état courant.
