# ADR 0019 — Contrats produit des familles C9

Statut : acceptée par l’auteur — 4 octobre 2026.

Date : 2026-10-04

## Décisions confirmées

### Caisse et électroaimant

- Les caisses bois et métal appartiennent à une seule famille d’objet `box`,
  avec le matériau comme variante. Le catalogue peut garder deux choix visibles
  pour que cela ne change rien à l’usage.
- La caisse métallique est attirée par l’électroaimant ; la caisse en bois ne
  l’est pas.
- Dans cette tranche, aucun autre objet métallique n’est attiré. La bille en
  acier est reportée hors de C9.
- L’électroaimant est commandé par le bouton uniquement, comme le ventilateur ;
  le levier ne le commande pas.
- L’électroaimant conserve un état initial `state: 'on' | 'off'`, choisi en
  Atelier et fixé dans l’inventaire en résolution. Sans fil, il conserve cet
  état ; un aimant peut donc commencer actif sans bouton ni commande.
- Comme le ventilateur livré, un bouton enfoncé inverse l’état initial ;
  au relâchement, l’appareil reprend son état initial. `off` devient actif
  sous appui ; `on` devient inactif sous appui. Le levier reste exclu pour
  l’électroaimant. Le convoyeur conserve sa commande de direction par levier.
- La portée de l’électroaimant est comparable à celle du ventilateur, voire un
  peu inférieure. La portée du ventilateur existante sert de référence ; la
  force magnétique est à régler par essais de jeu.

### Piston

- Le piston est commandé par le bouton uniquement.
- Le piston a une seule position initiale : fermé. Il n’expose pas de réglage
  `on/off` et sa position initiale n’est pas persistée.
- Un front d’activation lance une course complète vers la sortie, même si le
  bouton est relâché avant que la tige ait fini de sortir. Une fois sortie, la
  tige reste en place tant que le bouton est enfoncé ; si le bouton est déjà
  relâché, elle se rétracte automatiquement. Un appui bref, comme celui d’un
  objet qui roule sur le bouton, produit donc une sortie puis une rétraction.
- Le gabarit du piston est comparable au ventilateur : empreinte de sélection
  1,248 × 0,643 unité monde. Après le retour de test, la course reste de 0,414
  unité et la tête se déplace à 18 unités monde par seconde ; une balle posée
  dessus atteint une vitesse verticale supérieure à 20 unités/s et traverse la
  hauteur d’une scène de 10 unités. Un test physique couvre ce réglage, et un
  puzzle vérifie que la puissance laisse le jeu solvable.

### Minuteur

- En Atelier, l’auteur choisit un délai de 1 à 10 secondes. En résolution d’un
  niveau, cette valeur est fixée par le niveau et n’est pas réglable par le
  joueur. Elle fait partie des données persistées du niveau.
- Le réglage Atelier est en secondes entières ; une nouvelle pose commence à
  **3 secondes**. L’affichage pendant le décompte peut montrer les dixièmes sans
  rendre le délai configurable fractionnaire.
- Le minuteur est inséré en série sur un fil électrique. Chaque changement
  d’état du signal transmis — activation comme désactivation — ressort avec le
  même état après le délai choisi. Le temps reste mesuré par les pas fixes de la
  simulation.
- L’auteur place le minuteur avant le câblage, puis relie le contrôleur au
  minuteur et le minuteur au dispositif. Le chemin compte comme **un fil
  logique et une unité de fil d’inventaire**, rendu en deux segments autour du
  minuteur ; il ne s’agit pas de deux fils indépendants.

## Ordre et réglages physiques

L’ordre accepté est **caisses → électroaimant → piston → minuteur**. Les
dimensions et masses des caisses, la course et la vitesse du piston, ainsi que
la portée et les forces sont équilibrées dans les scènes de test. Ces valeurs
ne sont pas extrapolées des images.

## Amendement du 5 octobre 2026 — gabarit du piston

Après un audit côte à côte demandé par l’auteur, le piston est agrandi de 40 % :
son boîtier faisait la moitié de la hauteur du ventilateur et du tremplin.
L’empreinte de sélection passe de 1,248 × 0,643 à 1,747 × 0,900 unité monde
(boîtier 1,095 × 0,601), le décalage de repos de 0,254 à 0,356 et la course de
0,414 à 0,580 unité. La vitesse de la tête reste de 18 unités monde par seconde.
Les sprites sont réexportés par `art/build-sprites.py`. La clause « gabarit
comparable au ventilateur » se lit désormais sur la hauteur ; l’empreinte est
plus longue, car elle inclut la course. Le fil s’ancre à l’arrière du boîtier.

## Raccords aux décisions existantes

L’évolution de version et les migrations sont fixées par l’[ADR 0018](0018-level-document-v3.md).
Le modèle du fil unique avec minuteur intermédiaire, ses gestes et son rendu
complètent l’[ADR 0009](0009-control-wires.md) et sa
[spécification fonctionnelle](../tinkerbolt_control_wires_v1.md).
