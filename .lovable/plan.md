
## But du correctif

Rendre la boîte de réception compréhensible et cohérente, pour que le chiffre affiché corresponde vraiment à ce que vous considérez comme “pas traité”.

## Constat confirmé dans le code

Aujourd’hui, il y a plusieurs logiques différentes :

- `src/components/inbox/InboxSidebar.tsx`
  - le `42` de “Boîte de réception” compte simplement toutes les conversations `status = "open"`.
- `src/pages/Index.tsx`
  - la liste affichée applique en plus plusieurs filtres locaux :
    - bruit masqué par défaut
    - non lus activé par défaut
    - répondu masqué par défaut
    - conversations purement sortantes retirées de la vue inbox
- le compteur `Répondus` est lui-même calculé avec les filtres `non lus` / `bruit`, donc ce n’est pas un vrai total de catégorie.

Résultat : les chiffres ne sont ni alignés, ni additionnables, donc visuellement ça donne l’impression que “42” ne veut rien dire.

## Plan de correction

### 1. Définir une seule logique “Inbox”
Je vais définir une métrique unique pour “à traiter” :

- conversation ouverte
- pas du bruit
- dernier message entrant (donc réponse attendue)
- pas une conversation purement sortante

C’est cette logique qui doit représenter votre vrai backlog.

### 2. Aligner le badge sidebar avec cette logique
Dans `src/components/inbox/InboxSidebar.tsx`, le compteur “Boîte de réception” ne comptera plus “toutes les open”, mais seulement les conversations réellement à traiter selon la règle ci-dessus.

Ainsi, si vous voyez `42`, cela voudra bien dire : `42 conversations à traiter`.

### 3. Corriger les compteurs de la page Inbox
Dans `src/pages/Index.tsx`, je vais séparer clairement :

- total à traiter
- non lus
- lus mais encore à traiter
- répondus
- bruit

Important : ces compteurs seront calculés depuis la même base, avant application des toggles visuels, pour éviter les incohérences actuelles.

### 4. Rendre l’écran explicite
Je vais ajuster l’affichage en haut de la liste pour éviter toute ambiguïté, avec une formulation du type :

```text
42 à traiter • 1 affichée avec le filtre "Non lus"
```

Comme ça :
- le gros chiffre garde son sens métier
- la vue filtrée explique pourquoi vous n’en voyez qu’une partie

### 5. Garder votre comportement actuel
Je ne change pas le principe Inbox Zero déjà validé :
- si vous répondez, la conversation se ferme
- si le contact répond, elle revient

Je corrige seulement la lisibilité et la cohérence des chiffres.

## Détails techniques

### Fichiers concernés
- `src/pages/Index.tsx`
- `src/components/inbox/InboxSidebar.tsx`

### Petite brique partagée recommandée
Pour éviter que la sidebar et la page recalculent différemment, je prévois une petite utilitaire partagée, par exemple :

- `src/lib/inbox-metrics.ts`

Elle centralisera :
- `isActionable`
- `isReplied`
- `isNoise`
- `isReadActionable`
- les compteurs dérivés

C’est le moyen le plus sûr pour empêcher un nouveau décalage entre sidebar et inbox.

### Tests
Comme demandé dans le projet, j’ajouterai des tests unitaires pour cette utilitaire, couvrant au minimum :
- mail non lu à traiter
- mail lu mais encore à traiter
- mail répondu
- bruit
- conversation sortante
- cohérence des totaux

## Vérification prévue après implémentation

1. Vérifier visuellement la sidebar et la page inbox
2. Confirmer que le badge sidebar et le total principal racontent la même histoire
3. Vérifier que le filtre “Non lus” ne change plus le sens des autres compteurs
4. Tester un cas réel de réponse :
   - réponse envoyée
   - conversation retirée du backlog
   - retour automatique si nouveau message entrant
