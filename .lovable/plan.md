## Objectif

Empêcher les campagnes de rester bloquées en `sending` quand le worker background d'edge function est tué avant la fin.

## Changements

### 1. `supabase/functions/send-campaign/index.ts` — chunking + auto-chaînage

- Nouvelle constante `BATCH_SIZE = 15`
- La boucle d'envoi s'arrête après `BATCH_SIZE` destinataires traités (au lieu de tous)
- Le délai aléatoire 4-8 s entre envois est conservé (protection Gmail) → un chunk dure ~1-2 min max, bien sous la limite edge
- À la fin du chunk :
  - Recompte les `pending` restants
  - S'il en reste **et** que la campagne est toujours `sending` → `fetch()` vers l'URL publique de `send-campaign` avec `{campaign_id}` sans `await` (fire-and-forget), puis `return 200`
  - S'il n'en reste plus → marquer `status = 'sent'` et return
- Suppression de `EdgeRuntime.waitUntil` : la fonction rend la main rapidement, plus besoin de background worker
- Le check `status !== 'sending'` en début de chaque itération est conservé (permet l'arrêt manuel via passage en `draft`)
- L'idempotence existante (skip par email déjà envoyé) protège contre les doublons si un chunk se ré-invoque par erreur

### 2. Migration — cron watchdog

Job `pg_cron` toutes les 5 min :

```sql
SELECT cron.schedule(
  'resume-stuck-campaigns',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://<project>.supabase.co/functions/v1/send-campaign',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer <anon>"}'::jsonb,
    body := jsonb_build_object('campaign_id', c.id)
  )
  FROM campaigns c
  WHERE c.status = 'sending'
    AND c.updated_at < now() - interval '3 minutes'
    AND EXISTS (SELECT 1 FROM campaign_recipients r WHERE r.campaign_id = c.id AND r.status = 'pending');
  $$
);
```

Extensions `pg_cron` et `pg_net` activées si besoin. Cette migration passe par `supabase--insert` (pas `migration`) car elle contient l'URL et la clé du projet — pas de propagation aux remix.

### 3. Note mémoire

Mise à jour de `mem://constraints/campaign-paused` pour refléter que la fonctionnalité est réactivée avec l'architecture chunkée.

## Auth de l'auto-invocation

Le `fetch` self-call inclura `Authorization: Bearer <SERVICE_ROLE_KEY>` (déjà dispo côté edge) — la fonction accepte déjà ce token via son check auth existant. Pas de changement RLS.

## Vérification post-déploiement

1. Relancer manuellement `Easy Drop` seulement si elle n'est pas encore finie (a priori terminée à ce stade)
2. **Ne pas** relancer Outreach Lot 1 ni Dormants GTA (décision utilisateur)
3. Observer les logs `send-campaign` pour confirmer le pattern : boot → 15 envois → self-invoke → shutdown propre

## Zones à risque

- **Boucle infinie** si `status` reste `sending` alors qu'il n'y a plus de `pending` : mitigé par le recompte explicite avant self-invoke
- **Double invocation** (chunk N+1 lancé par la fonction ET par le cron) : mitigé par l'idempotence email + la fenêtre 3 min du cron
- **URL self-call** : construite depuis `SUPABASE_URL` env var (déjà utilisée dans le code actuel pour appeler `gmail-send`)

## Fichiers touchés

- `supabase/functions/send-campaign/index.ts` (edit)
- 1 migration SQL via `supabase--insert` (cron)
- `.lovable/memory/constraints/campaign-paused.md` (edit)
