# Découpage des tranches

Ce fichier fait autorité sur les étapes et leurs dépendances ;
`feuille-de-route.md` porte seul l’ordre des tâches actives, et `etat.md`
l’état livré. Chaque lot comportemental suit Red-Green-Refactor et se termine
par `pnpm check`. Les changements documentaires passent les validateurs utiles.

## Étapes produit

| Étape | Lots | Dépendances et sortie |
| --- | --- | --- |
| Core desktop v1 | V0–V9 | Clôturé et validé par l’auteur le 3 octobre 2026. |
| Compléments desktop | C0–C10, C7a–C7d | Code C0–C9/identité livré ; C7d et recette C10 restent. |
| Téléphone et tablette v2 | M0–M4 | Après C10 : gestes/maquettes acceptés, portrait/paysage, recette réelle. |
| Forge et Grist v3 | F0–F3 | Après M4 : destination/hébergement, contrat Q8, soumission et modération. |
| Réserve v4 | Objectifs nouveaux | Décision, schéma et migrations séparés ; aucun code anticipé. |

## Frontières et validation

- Un lot apporte tests et implémentation du même comportement, dans les couches
  définies par `architecture.md`, sans refactoring annexe.
- Les changements de contrat partagé peuvent former un lot intégré couvrant
  leurs appelants ; une étape partielle n’est pas déclarée livrée.
- Les migrations de documents persistés et les données non fiables suivent
  les ADR et schémas exécutables, jamais un ancien exemple de bootstrap.
- Pour les règles de délégation et de captures, suivre `AGENTS.md` et la
  feuille de route active.

Les anciennes tranches T1–T6 et leurs journaux sont livrées. Leur historique
reste dans Git ; il ne définit plus de travail actif.
