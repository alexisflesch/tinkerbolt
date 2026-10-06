# Journal des changements

Les entrées décrivent les changements notables pour les joueurs et les créateurs
de niveaux. Les refactorings sans effet visible ne nécessitent pas d’entrée.

## [Non publié]

Aucun changement notable pour le moment.

## [0.3.1] - 2026-10-06

- Les convoyeurs utilisent le nouveau visuel sans pieds, avec flèches et roues
  animées. Leur courroie entraîne aussi sur les extrémités arrondies ; le dessous
  va dans le sens opposé au dessus. Le sens suit la rotation du convoyeur.
- La démonstration de l’accueil utilise le nouveau remix de l’auteur, avec
  le convoyeur retourné et les deux balles déjà posées.
- Les Paramètres reprennent les panneaux papier et plan bleu de l’atelier.
  Deux boutons permettent d’exporter et d’importer les niveaux résolus et les
  records de campagne ; l’import conserve les meilleurs résultats déjà présents.
- Le texte de la feuille d’accueil reste droit pour améliorer sa netteté.

## [0.3.0] - 2026-10-06

- L’accueil montre une machine animée avec deux balles et deux pistons ;
  la démonstration peut être mise en pause et respecte la réduction des animations.

- « Atelier » rouvre la dernière création modifiée au lieu d’un atelier vierge ;
  « Nouveau niveau » en commence une autre, depuis Mes niveaux ou l’atelier.
- Dans l’atelier, un crayon permet de nommer et décrire le niveau sans passer par
  l’export. Un niveau jamais nommé s’appelle « Sans titre ».
- Une machine sans objet à placer peut se partager : la boîte « Exporter » propose
  « Défi » ou « Machine », celui qui la reçoit la regarde tourner (et la remixe),
  et le catalogue de l’atelier pose ou retire la balle rouge et le panier.

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
