# Contenu du dossier

Ce dossier contient des exports JSON de niveaux jouables créés par le mainteneur du projet.

## demo-landing

Source auteur de la machine animée de l’accueil. Depuis le 6 octobre 2026,
`demo-landing-remix.json` est l’export actif, sans objectif, avec les deux balles
déjà posées et le convoyeur retourné. Sa copie embarquée est dans
`src/content/levels/demo-landing.json`, validée par le schéma v3 avant utilisation.
Pour mettre à jour la démo, remplacer cette copie par le nouvel export.
`demo-landing.json` conserve l’export original jouable et sa solution pour les
tests de projection.

À l’accueil, si l’export fournit une solution, elle est posée puis le panier,
la balle rouge et la bascule sont retirés de la projection. Le remix actif n’en
a pas besoin. Les deux balles bleues, les fils, le minuteur et
les pistons tournent avec le moteur physique du jeu. La démo reste hors campagne ;
un bouton permet de la suspendre et la préférence de réduction des animations
la laisse arrêtée au départ.

## Ajustement du tutoriel 5

Le 6 octobre 2026, le convoyeur est recalé de −0,02 unité en x et −0,04 en y
après l’intégration du contour arrondi sans pieds. Source et copie embarquée
sont synchronisées ; la solution joueur reste identique et gagne toujours.
