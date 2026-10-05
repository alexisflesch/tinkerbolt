# Demandes de reprise — 5 octobre 2026

Cette note remet en ordre les demandes de l’auteur avant le passage aux
interfaces téléphone et tablette. La [feuille de route active](feuille-de-route.md)
reste la seule séquence d’exécution. Le code des poignées et du splash existe,
mais l’auteur demande maintenant de les reprendre : ils ne sont pas considérés
comme validés.

## 1. Retouches à faire avant de clôturer C10

### Taille de la scène

Une fois un niveau enregistré, il faudrait noter la taille de la scène dans le
fichier de sauvegarde pour l'afficher avec le bon niveau de zoom à l'ouverture
(surtout via partage de lien etc), sinon on se retrouve sur téléphone à devoir
zoomer pour y voir qqc.

### Taille du piston et autres objets

Les tailles des objets ne sont pas toutes cohérentes. On n'a pas besoin d'avoir
un truc qui corresponde à la réalité, bien évidemment, mais je pense que
certains objets devraient avoir _à peu près la même taille_, à savoir
ventilateur, aimant, piston, tremplin. Il faudrait poser tous les objets côte à côte et faire un audit. On ne modifie pas complètement l'app, on fait des petits ajustements si besoin.

### Nouveaux niveaux

Intégrer les deux nouveaux niveaux de l'auteur.


### Poignées des poutres

- Placer la poignée de rotation au coin supérieur gauche, pas au milieu.
- Reprendre la poignée de redimensionnement pour qu’elle soit cohérente avec
  celle de rotation.
- La réalisation actuelle ne convient pas à l’auteur ; ne pas la considérer
  comme terminée parce que le code ou les tests existent déjà.
- au passage, voir si on peut pas faire plus joli que l'UI actuelle pour les poignées de rotation/redimensionnement car elles jurent un peu avec le reste.
è
### Barre de chargement du splashscreen

Reprendre l’aspect de la barre de chargement sur le splashscreen. Le reste de la
disposition du splash n’est pas remis en question par cette demande.

Une fois ces retouches intégrées, terminer C10 selon la feuille de route avant
d’ouvrir le chantier téléphone.

## 2. Corriger et améliorer le câblage

1. Corriger le point d’accroche des fils sur les pistons : le fil semble partir
   du coin inférieur gauche, sur une partie vide de l’image, sans toucher le
   piston.
2. Pendant la pose d’un fil, afficher un segment qui suit le curseur après la
   sélection du premier objet, jusqu’à la pose du second.
3. Avec un minuteur, afficher de même le second segment entre le minuteur et le
   curseur dès que le premier segment est relié au minuteur, jusqu’à la pose de
   l’objet suivant.

## 3. Clarifier le catalogue d’objets

Regrouper les objets par catégories pour rendre le catalogue plus facile à
parcourir, puis reprendre leurs descriptions. Faire ce travail avant de figer
les nouvelles dispositions du catalogue.

## 4. Dégager la scène sur ordinateur

1. Étudier la suppression du panneau de droite pour donner plus de place à la
   scène.
2. Si le panneau est conservé, retirer la liste « Objets sur le plateau », qui
   semble peu utile.
3. Déplacer les commandes d’ajustement de la scène, qui prennent actuellement
   trop de place, et réaligner verticalement l’icône mal alignée.

## 5. Reprendre l’intégration visuelle de Bolt

Bolt est déjà présent sur l’accueil et dans la modale de victoire, mais le
résultat visuel est à retravailler. Préparer de nouvelles propositions pour ces
deux emplacements avant de modifier l’interface ; l’auteur souhaite une
conception d’un niveau esthétique supérieur (référence demandée : Opus).

## 6. Préparer les interfaces téléphone et tablette

### Téléphone

- Ne pas décider seul de la nouvelle interface : présenter des propositions à
  l’auteur avant de la réaliser.
- Rendre visible la présence du tiroir d’objets lorsqu’on commence à jouer.
  Étudier un mini-tutoriel avec Bolt, au moins lors de la première partie.

### Tablette

- Proposer une disposition qui s’adapte à l’orientation, en s’appuyant sur les
  solutions retenues pour ordinateur et téléphone.
