

# Cohérence de mise en forme : Rédaction = Aperçu = Gmail

## Problème identifié

Trois rendus différents du même HTML :

1. **Éditeur (TipTap)** : utilise `prose prose-sm` + `[&>p+p]:mt-4` pour l'espacement entre paragraphes
2. **Aperçu (CampaignStepPreview)** : utilise `prose prose-sm leading-relaxed` — espacement différent, pas de `[&>p+p]:mt-4`
3. **Gmail** : reçoit le HTML brut des `<p>` sans aucun style inline — Gmail applique ses propres marges (souvent `margin: 0` sur les `<p>`)

Le HTML produit par TipTap est une suite de `<p>...</p>` sans styles inline. L'apparence dépend entièrement du CSS appliqué côté affichage — d'où les différences.

## Solution

### 1. Aperçu identique à l'éditeur (`CampaignStepPreview.tsx`)

Appliquer exactement les mêmes classes CSS que l'éditeur TipTap sur le conteneur de rendu :

```
prose prose-sm max-w-none text-sm [&>p+p]:mt-4
```

Au lieu de l'actuel `prose prose-sm max-w-none text-sm leading-relaxed`.

### 2. HTML envoyé à Gmail avec styles inline (`send-campaign/index.ts`)

Avant d'envoyer le HTML à `gmail-send`, injecter des styles inline sur chaque balise HTML pour que Gmail les respecte :

- `<p>` → `<p style="margin:0 0 16px 0; line-height:1.5;">` (dernier `<p>` sans margin-bottom)
- `<strong>` / `<em>` / `<s>` → inchangés (Gmail les respecte nativement)
- `<a>` → ajouter `style="color:#6366f1; text-decoration:underline;"` si absent
- `<ul>` / `<ol>` → `style="margin:0 0 16px 0; padding-left:24px;"`
- `<li>` → `style="margin:0 0 4px 0;"`

Wrapper le tout dans un conteneur :
```html
<div style="font-family:Arial,Helvetica,sans-serif; font-size:14px; color:#1a1a1a; line-height:1.5;">
  ...contenu...
</div>
```

### 3. Fichiers modifiés

| Fichier | Changement |
|---------|-----------|
| `src/components/campaigns/CampaignStepPreview.tsx` | Aligner les classes CSS du rendu HTML sur celles de l'éditeur |
| `supabase/functions/send-campaign/index.ts` | Ajouter une fonction `inlineStyles(html)` qui injecte des styles inline sur les balises avant envoi |

### Détail technique — fonction `inlineStyles`

```typescript
function inlineStyles(html: string): string {
  let result = html
    .replace(/<p>/g, '<p style="margin:0 0 16px 0;line-height:1.5;">')
    .replace(/<ul>/g, '<ul style="margin:0 0 16px 0;padding-left:24px;">')
    .replace(/<ol>/g, '<ol style="margin:0 0 16px 0;padding-left:24px;">')
    .replace(/<li>/g, '<li style="margin:0 0 4px 0;">');
  
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1a1a1a;line-height:1.5;">${result}</div>`;
}
```

Appelée juste avant `injectTracking` dans la boucle d'envoi.

