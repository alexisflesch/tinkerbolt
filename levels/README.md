# Contenu du dossier

Ce dossier contient des exports JSON de niveaux jouables créés par le mainteneur du projet.

## demo-landing

Source auteur de la machine animée de l’accueil. L’export original reste jouable :
sa copie embarquée est dans `src/content/levels/demo-landing.json`, validée par le
schéma v3 avant utilisation. Pour mettre à jour la démo, remplacer cette copie
par le nouvel export.

À l’accueil, la solution est posée puis le panier, la balle rouge et la bascule
sont retirés de la projection. Les deux balles bleues, les fils, le minuteur et
les pistons tournent avec le moteur physique du jeu. La démo reste hors campagne ;
un bouton permet de la suspendre et la préférence de réduction des animations
la laisse arrêtée au départ.
