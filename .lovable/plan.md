

# Bouton "Peaufiner" pour les réponses email

## Objectif
Ajouter un bouton **"Peaufiner"** dans la zone de réponse qui corrige l'orthographe, améliore la mise en forme et professionnalise le texte — sans donner l'impression que c'est de l'IA (pas d'icône Sparkles, pas de mention IA).

## Approche

### 1. Edge Function `polish-reply`
Nouvelle edge function qui prend le texte brut et retourne une version corrigée/améliorée :
- Prompt orienté "correcteur/rédacteur" : corriger fautes, ponctuation, formulations maladroites, mise en forme pro
- Modèle rapide (`gemini-2.5-flash-lite`) pour une réponse quasi instantanée
- Pas de changement de fond/sens, juste du polissage

### 2. Bouton dans ReplyArea
- Icône `Wand2` (baguette) de Lucide — neutre, évoque la retouche sans évoquer l'IA
- Label : **"Peaufiner"**
- Placé à côté de "Suggérer" et "Template" dans la barre d'actions
- Désactivé si le texte est vide
- Loader pendant le traitement, puis remplacement du texte par la version polie

### 3. UX
- Le texte est remplacé directement (l'utilisateur peut Ctrl+Z ou réécrire)
- Toast discret "Texte peaufiné" en cas de succès
- Toast erreur si échec

## Fichiers modifiés

| Fichier | Changement |
|---------|-----------|
| `supabase/functions/polish-reply/index.ts` | Nouvelle edge function — prompt correcteur/rédacteur |
| `src/components/inbox/conversation/ReplyArea.tsx` | Ajout bouton Peaufiner + état loading + appel edge function |

## Prompt de l'edge function (résumé)
> "Tu es un correcteur et rédacteur professionnel francophone. Corrige l'orthographe, la grammaire, la ponctuation. Améliore les formulations maladroites. Garde le même sens, le même ton, la même longueur. Ne rajoute rien. Retourne uniquement le texte corrigé."

