

# Plan : Accès automatique pour tous les utilisateurs CloudVapor

## Problème
Le trigger `on_auth_user_created` n'existe pas en base. La fonction `handle_new_user()` est bien définie mais jamais appelée. Résultat : les nouveaux utilisateurs n'ont pas de profil avec `team_id`, donc RLS bloque tout.

## Solution

**Une seule migration SQL** qui :

1. Crée le trigger sur `auth.users` pour appeler `handle_new_user()` à chaque inscription
2. Rattrape les utilisateurs existants sans `team_id` (sécurité)

```sql
-- Créer le trigger manquant
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Rattraper les profils existants sans team_id
UPDATE public.profiles
SET team_id = '60a520df-c0ad-4c2e-9941-f85860f434e2'
WHERE team_id IS NULL;
```

Aucun changement côté code React. Le trigger + la fonction existante gèrent tout : profil, team_id, rôle `member`.

## Fichiers concernés

| Fichier | Action |
|---|---|
| Migration SQL | Créer trigger + rattrapage |

