

# Importer les contacts depuis Cloud Vapor B2B

## Objectif
Extraire tous les clients actifs de la table `b2b_customers` du projet [Cloud Vapor B2B](/projects/10141070-ffbd-4ef7-9530-942194191c06) et les insérer dans la table `contacts` de TeamMail.

## Mapping des champs

```text
b2b_customers (source)     →  contacts (destination)
─────────────────────────────────────────────────────
name                       →  name
email                      →  email
phone                      →  phone
salesperson_name           →  company ("CloudVapor")
city, street, zip, country →  custom_fields (JSON)
```

## Étapes

1. **Script d'extraction** : Requêter la base Cloud Vapor B2B via `psql` pour exporter les clients actifs (`is_active = true`) avec email non-null depuis `b2b_customers`
2. **Script d'insertion** : Insérer dans la table `contacts` de TeamMail avec le `team_id` de l'équipe CloudVapor, en utilisant `ON CONFLICT` sur email pour éviter les doublons
3. **Vérification** : Compter les contacts importés pour confirmer le succès

## Détails techniques

- Les deux bases sont accessibles via `psql` (même Supabase). Le projet source est sur une base différente, donc on passera par une extraction cross-project via l'API ou un export CSV intermédiaire.
- On stockera `company` = "CloudVapor" pour tous les contacts importés.
- Les champs d'adresse (street, city, zip, country) seront stockés dans `custom_fields` en JSON.
- Seuls les clients avec un email valide seront importés.

