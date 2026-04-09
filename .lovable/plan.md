

# Créer la campagne de correction (erratum Félix)

## Ce qui va être fait

Créer une nouvelle campagne **en brouillon** dans la base de données avec :
- **Nom** : `Erratum — Félix Nicolon`
- **Objet** : `Erratum — Félix Nicolon n'a pas quitté CloudVapor (promis)`
- **From** : `commercial@cloudvapor.com`
- **Corps HTML** : le texte correctif validé précédemment (ton pro + légèrement humoristique)
- **139 destinataires** : copiés depuis la campagne d'origine `18503520-6dcf-41bc-90d9-75b860a3b2be`

## Étapes techniques

1. **Insérer la campagne** dans la table `campaigns` avec `status = 'draft'`, le `team_id` et `created_by` de la campagne d'origine
2. **Copier les 139 recipients** depuis `campaign_recipients` vers la nouvelle campagne
3. **Mettre à jour `total_recipients`** à 139

## Corps de l'email

```html
<p>Bonjour,</p>

<p>Suite à notre précédent email, nous tenons à apporter une <strong>correction importante</strong> :</p>

<p><strong>Félix Nicolon n'a pas quitté CloudVapor.</strong> Il est toujours bien présent parmi nous et continue d'assurer ses fonctions avec la même énergie (et ses multiples casquettes 🎩).</p>

<p>Un bug dans notre outil d'automatisation a malencontreusement inversé les noms. C'est en réalité <strong>Johanny</strong> qui est concerné par ce changement.</p>

<p>Nous vous prions de nous excuser pour cette confusion et vous remercions de votre compréhension.</p>

<p>Cordialement,<br>L'équipe CloudVapor</p>
```

## Résultat

La campagne apparaîtra en **brouillon** dans la page Campagnes. Tu pourras la relire, modifier le texte si besoin, puis lancer l'envoi quand tu es prêt.

