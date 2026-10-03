---
name: orchestrate
description: Conduire une tranche TinkerBolt avec des lots bornés, une délégation séquentielle adaptée à la difficulté et une validation finale. Utiliser pour orchestrer une tâche de la feuille de route ou sur demande explicite ; un changement local peut être réalisé directement.
metadata:
  short-description: Livrer des lots bornés avec un seul agent à la fois
---

# Orchestration TinkerBolt

Réduire le coût de coordination en conservant les contrats, le TDD et la
validation du dépôt. Les instructions de l’auteur priment sur ce skill.

## Cadrer et lire

- Commencer par `docs/index.md`, puis le point de reprise, les règles actives et
  la tâche concernée dans `docs/feuille-de-route.md`, ainsi que `AGENTS.md`.
  La feuille fait autorité sur l’ordre ; le plan préparatoire est un contexte.
- Utiliser `rg` et lire les sections utiles avant d’élargir. Ne pas charger les
  historiques, les ADR entières ou tous les fichiers d’une couche par défaut.
  Réutiliser les lectures déjà faites si leur contenu n’a pas changé.
- Consulter `git status --short`. Préserver les modifications de l’auteur et
  travailler autour d’elles ; clarifier seulement un chevauchement réel.
  Ne pas imposer un dépôt propre ni une gate initiale systématique.
- Définir un lot par résultat vérifiable, avec ses dépendances et ses fichiers.
  Un lot peut traverser plusieurs couches. Découper une tâche trop large en
  étapes livrables, sans déclarer la tâche entière terminée après une étape.

## Réaliser et déléguer

- **Un seul sous-agent actif à la fois ; un seul propriétaire d’écriture.**
  Les sous-agents ne délèguent pas. L’orchestrateur peut lire pendant leur
  travail, mais attend leur arrêt avant d’écrire dans le même arbre.
- Confier tests rouges, implémentation verte et refactoring au **même agent**.
  Conserver la preuve que le test échoue pour la bonne raison. Une modification
  documentaire n’exige pas de test artificiel.
- Déléguer un lot complet lorsque cela apporte un modèle adapté ou un contexte
  borné. Réutiliser l’agent pour ses corrections et les étapes liées. Ne pas
  créer un agent pour chaque lecture, test, correction de gate ou compte rendu.
- L’orchestrateur peut réaliser directement un changement local, une correction
  d’intégration ou une tâche documentaire. Il reste responsable du résultat.
- Donner un brief court : résultat, périmètre, lectures ciblées, contraintes
  particulières et commandes de validation. Ne pas transmettre tout l’historique.
  Le canal natif suffit ; aucun fichier de brief ou worktree n’est obligatoire.
  Isoler le travail seulement si nécessaire.
- Choisir selon [routing.md](references/routing.md) si une délégation est utile.
  Sol 6.1 pour l’UI ; Astra est toujours exclu.
- Relire le diff ciblé et les preuves. Une seconde revue indépendante est utile
  si un risque important reste mal couvert (migration, atomicité, physique) ;
  elle n’est pas une étape automatique de chaque lot.

## Valider et livrer

- Pendant le travail, lancer les tests concernés et les contrôles pertinents ;
  utiliser `pnpm check:fast` pour une vérification intermédiaire plus large.
- Avant clôture, lancer **`pnpm check` sur l’ensemble intégré**. Ne pas répéter
  les vérifications déjà vertes sans changement ou doute nouveau. En cas
  d’échec, corriger et vérifier d’abord le cas ciblé, puis relancer la gate.
  Faire `pnpm build` avant un Playwright isolé.
- Garder les logs détaillés dans un fichier ; remonter le résumé ou les erreurs
  utiles. Éviter les dumps de DOM, diffs complets et listes de tests verts.
- Suivre l’instruction actuelle de l’auteur : aucune capture ni vérification
  d’image pendant l’implémentation. Consigner la recette visuelle différée ;
  ne pas annoncer une validation à l’œil qui n’a pas eu lieu.
- Mettre à jour le journal et l’état livré de façon concise, puis committer le
  lot validé selon les règles de la reprise. Ne pas pousser sans autorisation.
- Rapport final court : comportement livré, validation, commit, reste à faire.
  Signaler les limites réelles et contradictions, sans répéter le brief.
- Respecter le périmètre autorisé et tout arrêt demandé. Pour changer de
  conversation, laisser une reprise de 10 à 20 lignes : dernier commit, prochaine
  étape, contrats utiles, commandes et points ouverts. Ne pas recréer un historique.

## Références facultatives

- [routing.md](references/routing.md) : modèle et effort pour une délégation.
- [protocol.md](references/protocol.md) : brief et rapport compacts.
- [roles.md](references/roles.md) : périmètres pour un lot inhabituel.

Ne lire une référence que si elle aide le lot courant.
