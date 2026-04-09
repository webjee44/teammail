

# Recommandations pour désencombrer la boîte de réception

## Diagnostic

Ta boîte de réception affiche **313 conversations ouvertes**, dont seulement **9 sont de vraies conversations**. Le reste :
- **189** sont des emails de campagne envoyés depuis `commercial@cloudvapor.com` / `marketing@cloudvapor.com` — le filtre côté client les masque mais elles restent "open" en base
- **146** sont du bruit (notifications Pixartprinting, Google Alerts, Discord, Semrush, etc.) — masquées par le toggle "Bruit" mais toujours ouvertes

Sur les 9 vraies conversations, 2 ont déjà été répondues (Michael Bellity / SMOKWAY, YouVape) : le dernier message est sortant. Pourtant elles restent affichées comme si tu devais agir dessus. C'est pour ça que tu as l'impression de devoir répondre à Mickael alors que c'est fait.

## Plan d'action (4 changements)

### 1. Masquer automatiquement les conversations déjà répondues
Dans la boîte de réception, ne montrer par défaut que les conversations dont le dernier message est **entrant** (= quelqu'un attend ta réponse). Les conversations où le dernier message est sortant passent dans un état "En attente de réponse" visible via un filtre dédié.

**Fichier** : `src/pages/Index.tsx`
- Après le calcul de `needs_reply`, filtrer la liste affichée pour ne garder que `needs_reply === true` dans la vue inbox par défaut
- Ajouter un toggle "Voir aussi les conversations répondues" (off par défaut)

### 2. Fermer automatiquement les conversations purement sortantes (campagnes)
Les 189 conversations de campagne (1 seul message, sortant, depuis une boîte d'équipe) n'ont rien à faire en "open". Migration SQL pour les passer en "closed".

**Migration SQL** :
```sql
UPDATE conversations 
SET status = 'closed' 
WHERE from_email IN (SELECT email FROM team_mailboxes)
  AND status = 'open'
  AND id NOT IN (
    SELECT DISTINCT conversation_id FROM messages WHERE is_outbound = false
  );
```

### 3. Fermer automatiquement les notifications/bruit
Les 146 conversations marquées `is_noise = true` et sans réponse sortante n'ont pas besoin d'être "open".

**Migration SQL** :
```sql
UPDATE conversations 
SET status = 'closed' 
WHERE is_noise = true AND status = 'open';
```

### 4. Améliorer le filtre `needs_reply` dans le code
Actuellement le flag `needs_reply` est calculé côté client après le fetch. Il faut l'utiliser comme filtre principal de l'inbox : la boîte de réception ne montre que les conversations qui nécessitent une action.

**Fichier** : `src/pages/Index.tsx`
- Vue "Boîte de réception" (pas de filtre) → afficher uniquement les conversations avec dernier message entrant
- Vue "Moi" → idem mais filtré par `assigned_to`
- Nouveau compteur dans la sidebar pour les conversations "en attente de réponse client" (dernière réponse sortante)

### Résultat attendu
Au lieu de 313 conversations ouvertes, tu verras ~5-7 conversations qui nécessitent réellement ton attention. Les campagnes et notifications seront fermées. Les conversations déjà répondues seront masquées jusqu'à ce que le client réponde.

## Détails techniques
- Les migrations SQL nettoient l'état actuel en base
- Le filtre côté client `needs_reply` devient le critère principal d'affichage en inbox
- Le toggle existant "Tous les mails" permettra toujours de voir l'ensemble
- Pas de nouvelle dépendance nécessaire

