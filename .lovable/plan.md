

# Intercepter les liens mailto: dans les emails affichés

## Problème
Quand un email contient un lien `mailto:`, cliquer dessus ouvre le client mail par défaut (Gmail, Outlook, etc.) au lieu de rester dans TeamMail.

## Solution
Intercepter les clics sur les liens `mailto:` dans le contenu HTML des messages et rediriger vers la page Compose (`/compose`) avec les paramètres pré-remplis (destinataire, sujet, corps).

## Approche

### 1. Composant wrapper pour le HTML des messages
Créer un composant `SafeHtmlContent` qui :
- Rend le HTML via `dangerouslySetInnerHTML`
- Attache un handler `onClick` sur le conteneur
- Détecte les clics sur des liens `<a href="mailto:...">`, fait `e.preventDefault()`, parse l'URL mailto (to, subject, body, cc, bcc) et navigue vers `/compose?to=...&subject=...`

### 2. Mise à jour de la page Compose
La page Compose lit déjà `useSearchParams` — il suffit d'ajouter la lecture des paramètres `to`, `subject`, `body`, `cc`, `bcc` depuis l'URL pour pré-remplir les champs.

## Fichiers modifiés

| Fichier | Changement |
|---------|-----------|
| `src/components/inbox/conversation/MessageList.tsx` | Remplacer le `div dangerouslySetInnerHTML` par un wrapper qui intercepte les clics `mailto:` et navigue vers `/compose?to=...` |
| `src/pages/Compose.tsx` | Lire les query params `to`, `subject`, `body` pour pré-remplir les champs |

