# Migration Gmail : Service Account → Connecteur Lovable

## Objectif
Remplacer le mécanisme actuel (Service Account Google Workspace + JWT + délégation domain-wide) par le **connecteur Lovable `google_mail`**, qui gère l'OAuth, le refresh des tokens et le proxy API automatiquement.

**Hypothèse validée :** une seule mailbox conservée — `commercial@cloudvapor.com`. La mailbox `marketing@cloudvapor.com` sera désactivée dans la table `team_mailboxes`.

## Pré-requis (action utilisateur)
1. Te connecter à `commercial@cloudvapor.com` dans ton navigateur avant la migration
2. Au moment du plan, je déclencherai le picker `connect` → tu autorises l'app Lovable à accéder à cette boîte
3. Scopes nécessaires : `gmail.readonly`, `gmail.send`, `gmail.modify` (pour archive/mark-read)

## Étapes techniques

### 1. Lier le connecteur `google_mail`
Appel à `standard_connectors--connect(connector_id="google_mail")` — tu choisis la boîte dans le picker. Cela expose 2 variables dans les edge functions :
- `LOVABLE_API_KEY`
- `GOOGLE_MAIL_API_KEY`

### 2. Refactor des 5 edge functions Gmail
Pour chacune, remplacer :
- ❌ La fonction `getAccessToken()` (~50 lignes de JWT manuel + Web Crypto)
- ❌ Les appels directs à `https://gmail.googleapis.com/...`
- ❌ La lecture de `GOOGLE_SERVICE_ACCOUNT_KEY`
- ❌ Le paramètre `senderEmail` / l'impersonation

Par :
- ✅ Helper unique `gmailFetch(path, init)` qui appelle `https://connector-gateway.lovable.dev/google_mail/gmail/v1/...`
- ✅ Headers `Authorization: Bearer ${LOVABLE_API_KEY}` + `X-Connection-Api-Key: ${GOOGLE_MAIL_API_KEY}`

Fichiers concernés :
- `supabase/functions/gmail-send/index.ts`
- `supabase/functions/gmail-sync/index.ts`
- `supabase/functions/gmail-archive/index.ts`
- `supabase/functions/gmail-mark-read/index.ts`
- `supabase/functions/gmail-reconcile/index.ts`

### 3. Adapter la logique multi-mailbox
La table `team_mailboxes` reste, mais la boucle "pour chaque mailbox active, impersonifier" devient "**filtrer sur l'unique mailbox connectée**". Concrètement :
- Désactiver `marketing@cloudvapor.com` (`is_active = false`) via migration
- Ajouter un garde-fou : si une edge function reçoit une `mailbox_id` qui ne correspond pas à l'email du connecteur, elle refuse l'appel
- Stocker l'email connecté dans une variable d'env ou via un appel `gmail/v1/users/me/profile` au démarrage

### 4. Vérification & nettoyage
- Tester `gmail-sync` manuellement → 1 thread doit remonter
- Tester `gmail-send` via la Compose UI
- Tester `gmail-archive` + `gmail-mark-read` depuis la Inbox
- **Une fois la migration validée**, supprimer le secret `GOOGLE_SERVICE_ACCOUNT_KEY`

### 5. Mettre à jour la mémoire projet
Documenter dans `mem://features/gmail-integration` que l'app utilise désormais le connecteur Lovable (mono-mailbox) et non plus un Service Account.

## Détails techniques

### Pattern gateway commun (helper partagé inline dans chaque function)
```ts
const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const GOOGLE_MAIL_API_KEY = Deno.env.get("GOOGLE_MAIL_API_KEY");

if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");
if (!GOOGLE_MAIL_API_KEY) throw new Error("GOOGLE_MAIL_API_KEY missing");

async function gmailFetch(path: string, init: RequestInit = {}) {
  const res = await fetch(`${GATEWAY_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": GOOGLE_MAIL_API_KEY,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gmail gateway ${res.status}: ${body}`);
  }
  return res.json();
}
```

### Endpoints utilisés
| Function | Endpoint actuel | Endpoint gateway |
|---|---|---|
| gmail-send | `gmail.googleapis.com/.../messages/send` | `/users/me/messages/send` |
| gmail-sync | `.../history`, `.../messages/{id}` | `/users/me/history`, `/users/me/messages/{id}` |
| gmail-archive | `.../messages/{id}/modify` | `/users/me/messages/{id}/modify` |
| gmail-mark-read | `.../messages/{id}/modify` | `/users/me/messages/{id}/modify` |
| gmail-reconcile | `.../messages?q=...` | `/users/me/messages?q=...` |

### Migration SQL
```sql
UPDATE public.team_mailboxes
SET is_active = false
WHERE email = 'marketing@cloudvapor.com';
```

## Zones à risque
- **Quotas** : le connecteur partage les quotas Gmail standards (250 quota units/sec pour `commercial@`). À surveiller pendant les gros syncs initiaux.
- **`historyId`** : la première sync post-migration risque d'avoir un `historyId` obsolète → prévoir un fallback "full sync" si le history est invalide.
- **Pas de rollback simple** : une fois le `GOOGLE_SERVICE_ACCOUNT_KEY` supprimé, retour arrière = recréer une clé GCP. Je le garderai jusqu'à validation complète.
- **Erreur 403 insufficient scope** possible si tu ne coches pas `gmail.modify` au moment du connect → je détecte et déclenche `reconnect` automatiquement.

## Hors-scope
- Pas de changement UI
- Pas de changement aux tables `conversations`, `messages`, `comments`
- Pas de modification de l'auth utilisateurs (Google Sign-In de l'app reste tel quel)
