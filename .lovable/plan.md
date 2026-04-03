

# Gestion intelligente des emails transférés (Fwd:) dans les suggestions

## Problème
Quand un collègue transfère un email (ex: "Fwd: commande S06833"), le bouton "Suggérer" génère des réponses comme si on répondait au client final. Or, on répond au collègue — il faut des réponses du type "Je m'en occupe", "Je prends le relais". Et idéalement, un bouton rapide pour écrire directement au client mentionné dans le mail transféré.

## Solution

### 1. Adapter le prompt IA pour détecter les forwards
**Fichier : `supabase/functions/ai-suggest-reply/index.ts`**

Ajouter dans le prompt système une instruction explicite :
- Si le sujet commence par "Fwd:" ou "Tr:", c'est un email transféré par un collègue
- Les suggestions doivent être des réponses internes courtes : "Je m'en occupe", "C'est noté, je prends le relais", "Merci, je traite ça"
- Ajouter un champ optionnel `action` dans le schema de la fonction tool avec valeur possible `compose_to` et un champ `action_email` pour l'email du client final extrait du corps du message

Le schema `suggest_replies` sera enrichi :
```
suggestions[].action?: "compose_to"
suggestions[].action_email?: string
```

### 2. Afficher le bouton "Écrire à [client]" dans le frontend
**Fichier : `src/components/inbox/conversation/ReplyArea.tsx`**

- Mettre à jour le type `Suggestion` dans `types.ts` pour inclure `action?` et `action_email?`
- Quand l'IA retourne une suggestion avec `action: "compose_to"`, afficher un bouton supplémentaire (icône Mail + "Écrire à youvape34@gmail.com") qui navigue vers `/compose?to=...&subject=...`
- Les suggestions classiques (réponses internes) fonctionnent comme avant

### 3. Mise à jour du type Suggestion
**Fichier : `src/components/inbox/conversation/types.ts`**

```
export type Suggestion = {
  label: string;
  body: string;
  action?: "compose_to";
  action_email?: string;
};
```

## Fichiers modifiés

| Fichier | Changement |
|---------|-----------|
| `supabase/functions/ai-suggest-reply/index.ts` | Prompt enrichi pour détecter Fwd:/Tr: + extraction email client + champ action dans le tool schema |
| `src/components/inbox/conversation/types.ts` | Ajout `action?` et `action_email?` au type `Suggestion` |
| `src/components/inbox/conversation/ReplyArea.tsx` | Bouton "Écrire à X" quand suggestion contient `action: "compose_to"`, navigue vers `/compose?to=...` |

