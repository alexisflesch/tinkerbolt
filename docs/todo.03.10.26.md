# A lire et à discuter avec le mainteneur du projet

Ces items sont à faire quand la feuille de route de la v1 sera terminée. Pour rappel, la v2 correspond à l'UI/UX sur téléphone portable. La v3 à l'intégration grist et déplacement du dépôt sur la Forge. Il y a donc des items présents ici qui doivent venir compléter la v1.

Les nouvelles règles de jeu (par exemple : la balle doit rester au moins 15s à l'écran, deux balles dans deux paniers, déplacer la caisse, etc, etc) viendront en v4.

## Vue portable. 

Tous les points ci-dessous sont à rediscuter, c'est un draft pas un cahier des charges. Règle générale : libérer de la place au plateau de jeu et fluidifier le parcours. A priori on pose des objets, on les tourne et on clique sur play. Tout le reste est secondaire et ne doit pas prendre de place à l'écran.

Ne pas ouvrir les propriétés de l'objet quand on le pose
Ouvrir les propriétés de l'objet sur un clique simple (pas de click and drag, clique simple uniquement)

En mode paysage, faire comme sur ordi pour le catalogue. Faire un drawer pour les propriétés de l'objet. Déplacer les divs horizontales du haut qui réduisent bcp trop la place allouée à la scène. Il y a de la place sur la droite par exemple.

Voir si on ne pourrait pas se passer complètement de la div propriétés de l'objet. Cette remarque est vraie aussi sur ordinateur.

## Général

Pour les poutres, une petite icône de redimensionnement (similaire à la rotation) serait une meilleure UX pour choisir la taille de la poutre. 

Quand on quitte un niveau ou un brouillon de l'atelier il faut garder ce que le joueur a commencé à faire en local storage quelque part

À ce sujet, utilise-t-on bien une db en local storage ? Si non, il est probablement temps de le faire. Il me faut un avis sur la question.

Il faut compléter l'inventaire avec les objets dans art/ qui n'ont pas encore été intégrés

Il faut mettre en place le favicon et le splashscreen. Pour le splash, mettre une barre de chargement de 1,2s mini avec affichage du nom de l'auteur (Créé par Alexis Flesch) en petit en-dessous de la bar, sur le bas de l'écran.

Il faut intégrer la mascotte (Bolt) à l'App : où ? Probablement sur la landing et aussi lorsqu'on gagne un niveau. À ce propos la modal de victoire apparaît après les boutons permettant de rejouer. Le délai de la modal est le bon. Aligner celui des boutons dessus.


Bug sur la pose d'objet. Des fois je pose un fil puis je clique sur la masse et elle s'affiche pas et j'ai un avertissement (pas sûr pour l'avertissement) qui me dit que ça peut pas être placé. Très dur à reproduire. Mauvaise ux, à investiguer. Je me demande si ça n'arrive pas aussi avec d'autres objets que le fil.


## Grist

On utilisera le grist de la forge (en v3) pour que les utilisateurs puissent partager leurs créations avec moi. On leur expliquera la licence, avec une case à cocher, et ça enverra l'URL du niveau (contenant pseudo/description) sur le grist. Je récupérerai tout ça depuis mon environnement de travail. Prévenir l'utilisateur qu'on filtrera le contenu et qu'il faut faire attention à ce qu'il partage (mots vulgaires, etc).
