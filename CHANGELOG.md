# Journal des changements

Les entrées décrivent les changements notables pour les joueurs et les créateurs
de niveaux. Les refactorings sans effet visible ne nécessitent pas d’entrée.

## [Non publié]

Aucun changement notable pour le moment.

## [0.2.0] - 2026-10-05

- Les paramètres affichent la version de l’application et le SHA court du build.
- La commande `pnpm release X.Y.Z` prépare, vérifie et publie une release ;
  elle utilise les identifiants Git habituels et GitHub Actions pour la publication.
  `--dry-run` affiche un aperçu sans modification ni publication.
- La documentation du dépôt est consolidée : anciens plans, todos, journaux,
  maquettes terminées et captures de travail retirés ; contrats, tâches encore
  ouvertes, propositions d’évolution, maquette d’identité utile et sources
  artistiques conservés.

## Référence initiale — 0.1.0

Cette référence décrit l’état livré du dépôt au démarrage du suivi des versions,
le 5 octobre 2026. Elle ne reconstitue pas de releases ni de tags antérieurs.

- La campagne embarque sept tutoriels pour découvrir puis mettre en pratique
  l’atelier mécanique.
- L’atelier permet de construire et tester des puzzles, puis d’importer, partager
  et remixer des niveaux depuis un fichier ou un lien.
- La progression, les créations, les niveaux reçus et les préférences sont
  conservés localement dans le navigateur.
- L’application s’installe comme une PWA et met en cache ses écrans et ses assets
  pour les ouvrir hors ligne.
