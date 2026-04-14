

# Plan : Correction de l'encodage des accents dans les emails

## Problème identifié

Le fichier `supabase/functions/gmail-send/index.ts` a un **double encodage** qui corrompt les caractères accentués. Voici les points précis :

1. **Encodage final du message MIME (ligne 264)** : `btoa(unescape(encodeURIComponent(rawEmail)))` — le message MIME contient déjà des parties body encodées en base64 via `btoa(unescape(encodeURIComponent(...)))` dans `buildRawEmail`. Quand le message complet est ré-encodé en base64 pour l'API Gmail, le `unescape(encodeURIComponent(...))` traite les caractères UTF-8 des headers comme des séquences d'octets Latin-1, ce qui peut causer des corruptions.

2. **Header `From` (ligne 260)** : `"${from_name}" <${from_email}>` — si le nom contient des accents (ex: "François"), il n'est PAS encodé en RFC 2047 (`=?UTF-8?B?...?=`) comme l'est le sujet. C'est invalide en RFC 2822.

3. **Noms de fichiers attachés (lignes 125-126)** : les noms de fichiers avec accents (ex: "Capture d'écran") ne sont pas encodés — c'est d'ailleurs la cause des erreurs `InvalidKey` visibles dans les logs de `gmail-sync`.

## Solution

### 1. Créer une fonction utilitaire d'encodage RFC 2047

```text
function encodeRFC2047(text: string): string
  → Si ASCII pur, retourner tel quel
  → Sinon, encoder en =?UTF-8?B?base64?=
```

### 2. Appliquer l'encodage aux headers dans `buildRawEmail`

- **From** : encoder la partie display-name
- **To, Cc, Bcc** : encoder les éventuels display-names
- **Noms de fichiers** : encoder avec RFC 2047 dans `Content-Type` et `Content-Disposition`

### 3. Corriger l'encodage final (ligne 264)

Remplacer `btoa(unescape(encodeURIComponent(rawEmail)))` par un encodage qui utilise `TextEncoder` pour convertir proprement la chaîne en bytes UTF-8, puis en base64url. Cela évite le passage par le hack `unescape(encodeURIComponent(...))`.

### 4. Redéployer la fonction

Déployer `gmail-send` après les modifications.

## Fichier modifié
- `supabase/functions/gmail-send/index.ts`

## Impact
- Toutes les réponses, nouveaux mails, campagnes et mails programmés passent par `gmail-send` → ce fix corrige tout d'un coup.

