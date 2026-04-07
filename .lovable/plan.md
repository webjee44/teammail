

## Plan : Mise à jour instantanée de l'app via Realtime

### Problème
Après envoi d'un email depuis la fenêtre de composition, la liste des conversations ne se met pas à jour. Il faut rafraîchir manuellement la page.

### Solution
Utiliser les subscriptions Realtime de la base de données sur les tables clés (`conversations`, `messages`, `drafts`) pour que tout changement soit reflété instantanément dans l'interface.

### Étapes

1. **Migration : activer Realtime sur les tables**
   - `ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;`
   - `ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;`
   - `ALTER PUBLICATION supabase_realtime ADD TABLE public.drafts;`

2. **`src/pages/Index.tsx` — abonnement Realtime sur `conversations`**
   - Ajouter un `useEffect` avec `supabase.channel('conversations')` qui écoute les événements `INSERT`, `UPDATE`, `DELETE` sur `public.conversations`.
   - Sur `INSERT` : ajouter la conversation à la liste locale.
   - Sur `UPDATE` : mettre à jour la conversation dans la liste (statut, is_read, snippet, last_message_at, etc.).
   - Sur `DELETE` : retirer la conversation de la liste.
   - Cleanup du channel au démontage.

3. **`src/pages/Index.tsx` — abonnement Realtime sur `drafts`** (pour le filtre brouillons)
   - Quand `filter === "drafts"`, écouter les changements sur `drafts` pour rafraîchir automatiquement.

4. **`src/pages/Index.tsx` — abonnement Realtime sur `messages`**
   - Quand une conversation est sélectionnée, écouter les nouveaux messages pour mettre à jour le détail sans rechargement.

5. **`src/components/inbox/FloatingCompose.tsx` — aucun changement nécessaire**
   - L'envoi crée déjà un message et met à jour `last_message_at` en DB. Le realtime propagera le changement automatiquement.

### Détails techniques
- Les channels Supabase seront souscrits avec un filtre sur `schema: 'public'` et la table correspondante.
- Le state local sera mis à jour via les callbacks `postgres_changes`, ce qui assure la réactivité sans refetch complet.
- Les subscriptions seront nettoyées (`removeChannel`) au démontage des composants.

