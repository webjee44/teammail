

# Refonte de la zone de réponse email

## Problèmes identifiés
1. **Trop étroit** — le textarea a une hauteur minimale de 80px, pas de redimensionnement automatique
2. **Pas de CC/BCC** — aucun champ pour ajouter des destinataires en copie
3. **Pas de WYSIWYG** — texte brut uniquement, pas de mise en forme (gras, italique, listes, liens…)

## Solution

### 1. Éditeur WYSIWYG avec TipTap
Installer `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-link`, `@tiptap/extension-placeholder`, `@tiptap/extension-mention` pour remplacer le textarea par un vrai éditeur rich text.

- Barre d'outils compacte : **Gras**, *Italique*, ~~Barré~~, Listes (ordonnée/non-ordonnée), Lien, Code
- Hauteur minimale augmentée (~150px) avec croissance automatique
- Conservation du système de @mentions via l'extension TipTap Mention
- Output HTML pour l'envoi (compatible avec `body_html` des messages)

### 2. Champs CC / BCC
Ajouter une ligne de destinataires au-dessus de l'éditeur :
- Bouton discret "Cc Bcc" à côté du destinataire principal affiché
- Clic → affiche les champs CC et BCC (inputs avec tags/chips pour les adresses)
- Les adresses CC/BCC sont transmises à `onReply` et à l'edge function `gmail-send`

### 3. Layout repensé
```text
┌─────────────────────────────────────────────────┐
│ [Répondre]  [Note interne]                      │
├─────────────────────────────────────────────────┤
│ À: sender@example.com              [Cc] [Bcc]  │
│ Cc: ___________________________________________│  ← si ouvert
│ Bcc: __________________________________________│  ← si ouvert
├─────────────────────────────────────────────────┤
│ [B] [I] [S] [•] [1.] [🔗] [</>]               │
│                                                 │
│  Zone d'écriture riche (min 150px, auto-grow)  │
│                                                 │
│                                                 │
├─────────────────────────────────────────────────┤
│ [Signature]                                     │
│ 📎 Joindre                                      │
│ [Suggérer] [Peaufiner] [Template]   [⏰] [Envoyer]│
└─────────────────────────────────────────────────┘
```

## Fichiers modifiés

| Fichier | Changement |
|---------|-----------|
| `package.json` | Ajout des dépendances TipTap |
| `src/components/inbox/conversation/RichTextEditor.tsx` | **Nouveau** — Composant TipTap avec toolbar de mise en forme et support @mentions |
| `src/components/inbox/conversation/RecipientFields.tsx` | **Nouveau** — Champs À / Cc / Bcc avec input tags |
| `src/components/inbox/conversation/ReplyArea.tsx` | Remplacement du MentionTextarea par RichTextEditor, ajout des RecipientFields, output HTML |
| `src/components/inbox/conversation/types.ts` | Ajout de `cc` et `bcc` optionnels dans les types de reply |
| `supabase/functions/gmail-send/index.ts` | Support des champs `cc` et `bcc` dans l'envoi |
| `supabase/functions/polish-reply/index.ts` | Adaptation pour gérer du HTML en entrée/sortie |

## Détails techniques
- TipTap est le standard pour les éditeurs rich text React (léger, extensible, pas de dépendance lourde comme CKEditor)
- Le `polish-reply` recevra du HTML et retournera du HTML corrigé
- Le draft sauvegarde le HTML brut
- L'extension Mention de TipTap remplace le système custom actuel de MentionTextarea

