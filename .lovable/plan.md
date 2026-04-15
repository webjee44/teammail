

# Plan : Corriger les pièces jointes dupliquées

## Problème
Chaque synchronisation Gmail re-télécharge et ré-insère les pièces jointes même pour les messages déjà existants. Résultat : 66-72 doublons par fichier dans cette conversation.

## Solution

### 1. Corriger `gmail-sync` — ne pas re-traiter les attachments des messages existants
Dans `supabase/functions/gmail-sync/index.ts`, ligne 439 : ajouter un `if (!existingMsg)` autour du bloc d'attachments (lignes 439-481), ou à minima vérifier si l'attachment existe déjà avant d'insérer.

Approche retenue : déplacer le bloc attachments à l'intérieur du `else` (nouveau message uniquement), car les pièces jointes d'un message Gmail ne changent jamais.

### 2. Nettoyer les doublons existants en base
Migration SQL pour supprimer les lignes dupliquées dans `attachments`, en ne gardant qu'une seule ligne par combinaison `(message_id, storage_path)`.

### 3. Ajouter une contrainte UNIQUE
Ajouter un index unique `(message_id, storage_path)` pour empêcher les doublons futurs.

## Fichiers modifiés
- `supabase/functions/gmail-sync/index.ts` — conditionner l'insertion des attachments aux nouveaux messages
- Migration SQL — nettoyage des doublons + contrainte UNIQUE

