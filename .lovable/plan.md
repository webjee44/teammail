# Espacer les envois de campagne

## Problème
Aujourd'hui, la fonction `send-campaign` envoie un mail toutes les **1 seconde** seulement. Sur 40+ destinataires, cela ressemble à un envoi de masse "bourrin" qui peut :
- déclencher les filtres anti-spam de Gmail
- faire grimper rapidement le quota d'envoi
- avoir l'air automatisé côté destinataire

## Correctif proposé
Remplacer le délai fixe de 1 seconde par un **délai aléatoire entre 4 et 8 secondes** entre chaque envoi. Le caractère aléatoire imite mieux un envoi humain.

### Impact sur la durée
| Destinataires | Avant (~1s) | Après (~6s en moyenne) |
|---------------|-------------|------------------------|
| 10            | ~10s        | ~1 min                 |
| 40            | ~40s        | ~4 min                 |
| 87            | ~1 min 30s  | ~9 min                 |

L'envoi reste totalement automatique, c'est juste plus étalé dans le temps.

## Détail technique
Dans `supabase/functions/send-campaign/index.ts`, ligne 198-200, remplacer :

```ts
if (i < recipients.length - 1) {
  await delay(1000);
}
```

par un délai randomisé :

```ts
if (i < recipients.length - 1) {
  const ms = 4000 + Math.floor(Math.random() * 4000); // 4-8s
  await delay(ms);
}
```

Aucune autre modification nécessaire — pas de changement de schéma, pas d'impact sur le frontend.
