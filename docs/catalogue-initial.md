# Catalogue initial

Statut : périmètre fonctionnel accepté ; dimensions, rendu et constantes physiques
à mesurer pendant le développement.

## Principe

Le premier vocabulaire du jeu contenait exactement quatre familles visibles :
balle, panier, poutre et bascule. Le 25 septembre 2026, trois familles s'y
ajoutent avec leurs assets : la **masse**, le **levier** et le **convoyeur**,
reliés par des fils de commande ([ADR 0009](decisions/0009-control-wires.md)).
Le 26 septembre 2026, quatre autres arrivent avec leurs assets : le **bouton**,
le **ventilateur**, la **barrière** et le **tremplin**. Le catalogue compte donc
douze familles après C9a :

- balle ;
- panier ;
- poutre ;
- bascule ;
- masse ;
- caisse (bois ou métal, une seule famille) ;
- levier ;
- convoyeur ;
- bouton ;
- ventilateur ;
- barrière ;
- tremplin.

La simplicité du catalogue est une contrainte de game design. Une variante visuelle
ou une taille ne devient pas automatiquement une nouvelle famille. Les propriétés
non nécessaires à un puzzle ne sont pas exposées au joueur ou au créateur.

Pendant l'édition, la physique est arrêtée. La balle et la partie mobile de la
bascule ne réagissent à la gravité qu'après le lancement de la simulation.

## Balle

### Rôle

La balle est le seul corps libre nécessaire aux premiers niveaux. La gravité la met
en mouvement ; les poutres et la bascule modifient sa trajectoire jusqu'au panier.

### Modèle initial

- corps dynamique circulaire ;
- rayon, masse, friction et rebond fixes par la définition du jeu ;
- résistance au roulement (couple opposé à la rotation tant qu'elle touche une
  surface, coefficient 0,1) : le moteur n'en a pas, et sans elle une balle qui
  roule ne s'arrête jamais et tourne sur place sur un convoyeur ;
- aucune propriété physique modifiable dans les premiers niveaux ;
- position initiale configurable par l'auteur ;
- permissions explicites de déplacement, rotation et retrait, ou disponible dans
  l'inventaire selon le niveau.

Il n'existe qu'une seule mécanique de balle au départ. Le choix tennis, basket ou
autre relève d'abord de la direction graphique. Des balles aux propriétés physiques
différentes ne seront ajoutées que si un futur puzzle justifie cette distinction.

## Panier

### Rôle

Le panier matérialise la cible finale. Le joueur doit y faire entrer la balle
désignée par le niveau.

### Modèle initial

- objet fixe pendant la simulation ;
- forme visuelle et colliders qui retiennent ou guident la balle ;
- volume capteur interne non visible ;
- position configurable par l'auteur ;
- orientation fixe par défaut, la rotation n'étant exposée que si les niveaux en ont
  réellement besoin ;
- normalement non déplaçable, non rotatable et non retirable en mode résolution.

Le panier émet un fait de domaine du type `ball-entered-target`. L'objectif du
niveau référence ce fait ou l'état du capteur ; il n'est pas codé directement dans
le renderer ou le moteur physique.

La condition exacte de réussite reste à tester. Le point de départ recommandé est :
le centre de la balle entre dans le volume du panier et y reste pendant une courte
durée. Une contrainte de direction ou de vitesse ne sera ajoutée que si des faux
positifs apparaissent dans de vrais niveaux.

## Poutre

### Rôle

La poutre sert de sol, rampe, mur ou guide. Elle est le principal objet manipulable
des premiers puzzles.

### Modèle initial

- corps statique pendant la simulation ;
- épaisseur et matériau physiques communs à toutes les tailles ;
- trois tailles provisoires : courte, moyenne et longue ;
- déplacement et rotation autorisables séparément par le niveau ;
- rotation avec snapping adapté au tactile, sans interdire un angle libre dans
  l'éditeur de niveau ;
- quantité gérée par l'inventaire pour chaque taille.

Les tailles sont des valeurs d'une propriété énumérée, pas des types `short-beam`,
`medium-beam` et `long-beam`. Cela garde les objectifs, outils et tests communs.
Un redimensionnement continu n'est pas exposé initialement : il serait moins lisible
sur téléphone et rendrait l'inventaire ainsi que les solutions plus difficiles à
contrôler.

## Bascule

### Rôle

La bascule introduit la rotation et le transfert de mouvement sans demander au
joueur de comprendre ou de configurer des joints.

### Modèle initial

- objet composite créé par un seul module ;
- socle fixe, planche dynamique et joint de rotation internes ;
- géométrie, limites angulaires, masse et friction fixes initialement ;
- déplacement de l'ensemble autorisable par le niveau ;
- pas de démontage, de redimensionnement ou de connexion manuelle ;
- normalement introduite déjà placée, sans permissions joueur, avant de devenir
  disponible dans l'inventaire.

La planche et le joint internes appartiennent à l'instance de simulation de la
bascule. Ils n'ont pas d'identifiants persistants de niveau et ne sont pas
sélectionnables indépendamment dans l'éditeur.

Le socle est un polygone mesuré sur son sprite (trapèze sous la planche), et non
plus une boîte : une balle glisse sur ses flancs. Le rendu sépare pied immobile
et planche qui pivote.

## Masse

### Rôle

Un corps libre lourd : il fait basculer une bascule, catapulte une balle posée à
l'autre bout, ou se laisse emporter par un convoyeur.

### Modèle

- corps dynamique de 0,8 × 0,505 : un trapèze polygonal et un cercle pour
  l'anneau de levage, mesurés sur le sprite (une seule enveloppe convexe ferait
  de l'anneau une pointe) ;
- propriété `weight` énumérée, seule valeur `10kg` en v1 : la masse physique est
  réellement de 10 kg, contre environ 0,28 kg pour la balle ;
- une autre masse (autre sprite, autre poids) ajoute une valeur à l'énumération,
  pas une famille ;
- non rotatable par commande ; elle peut basculer pendant la simulation.

## Caisse

### Rôle

Un corps libre qui tombe, repose sur une poutre, suit un convoyeur ou appuie sur
un bouton. Les matériaux sont deux variantes de la seule famille `box`, suivant
l’[ADR 0019](decisions/0019-c9-object-contracts.md).

### Modèle livré en C9a

- carré dynamique de 0,8 × 0,8 unité monde, centré sur sa pose ;
- propriété persistée `material: 'wood' | 'metal'`, obligatoire dans le format v3 ;
- masses de jeu : bois 1 kg, métal 3 kg ; friction 0,6 et restitution 0,05 ;
- dimensions et masses choisies par les tests de chute, de repos, de convoyeur,
  de poussée par le ventilateur et un puzzle de bouton commandant une barrière ;
- déplacement, rotation et retrait selon les permissions du niveau ; matériau
  réglable en Atelier, fixé par l’inventaire en résolution ;
- deux sprites et deux choix visibles dans le catalogue ; même géométrie pour
  les collisions, le rendu, la sélection et l’aperçu de pose ;
- attraction de la variante métallique réservée à C9b.

## Levier

### Rôle

Le contrôleur des circuits : sa position commande les convoyeurs qui lui sont
reliés.

### Modèle

- socle polygonal orientable dans tous les sens, par pas de 15° ; poignée dynamique
  sur pivot, limitée à ±45° par rapport au socle ;
- trois crans — gauche, centre, droite — tenus par un moteur à couple limité et
  compensés pour que la gravité due à l'orientation du socle ne change pas le
  cran de départ ; un choc peut toujours faire basculer la poignée ;
- propriété `position` : la position de départ imposée par le niveau ;
- le joueur ne tourne pas un levier pendant la simulation ; seul un objet qui le
  percute peut lui faire changer de cran ;
- l'état lu est gauche au-delà de −22,5°, droite au-delà de +22,5°, centre entre
  les deux, relativement à l'orientation du socle.

## Convoyeur

### Rôle

Un tapis qui entraîne ce qu'il porte, vers la gauche, vers la droite, ou pas du
tout.

### Modèle

- corps statique de 3 × 0,58 ; la bande est une vitesse de surface
  (1,5 unité/s), pas un corps qui bouge ;
- propriété `direction` (`left`, `stopped`, `right`) : son sens quand aucun
  levier ne le commande ;
- relié à un levier, il suit ce levier dès le premier pas et à chaque
  changement de cran — gauche, arrêt, droite — et sa propriété est ignorée ;
- un seul levier par convoyeur ; un levier peut commander plusieurs convoyeurs.

## Bouton

### Rôle

Un contrôleur momentané : il commande un ventilateur ou une barrière tant
qu'un objet appuie dessus.

### Modèle

- socle et capuchon statiques (0,8 × 0,48 au total), aucune propriété ;
- capteur juste au-dessus du capuchon : enfoncé tant qu'un corps dynamique le
  touche, relâché sinon, sans mémoire ;
- le capuchon dessiné descend de 0,06 quand il est enfoncé, son collider ne
  bouge pas ;
- ne commande jamais un convoyeur (ADR 0009, amendement du 26 septembre).

## Ventilateur

### Rôle

Souffle sur ce qui passe devant lui : pousse une balle, la soulève, dévie une
chute.

### Modèle

- corps statique de 1,2 × 0,94, dessiné soufflant à droite ;
- orienté par sa rotation, par pas de 15° : sa rotation est la direction où il
  souffle ; tourné vers la gauche de la verticale, il est dessiné et simulé en
  miroir, pour ne jamais le mettre la tête en bas. « Retourner » le met en
  miroir de gauche à droite (rotation θ → 180° − θ) ;
- propriété `state` (`on`, `off`) : son état quand aucun contrôleur ne le
  commande ; relié, il tourne quand le levier est d'un côté ou le bouton
  enfoncé ;
- souffle : cône de 3 unités depuis la bouche, évasé de 15°, force décroissant
  linéairement avec la distance et proportionnelle à la largeur que le corps
  présente au souffle (9 N par unité à la bouche) — une balle flotte à environ
  1,4 unité d'un ventilateur tourné vers le haut, une masse de 10 kg bouge à
  peine ;
- les pales tournent derrière le corps, vues par l'ouverture de la virole et
  écrasées horizontalement ; leur angle vient de la simulation, dessin
  seulement.

## Barrière

### Rôle

Une barre qui coulisse dans son poteau : une trappe qui lâche ce qu'elle porte,
ou un passage qui s'ouvre.

### Modèle

- poteau statique de 0,9 × 0,96, barre de 1,7 × 0,38 (agrandis le 1er octobre 2026) ;
- orientée par sa rotation, par pas de 15°, comme le ventilateur : tournée vers
  la gauche de la verticale, elle est dessinée en miroir, barre à gauche ;
  « Retourner » la met en miroir de gauche à droite ;
- propriété `state` (`closed`, `open`) : son état quand aucun contrôleur ne la
  commande ; reliée, elle s'ouvre quand le levier est d'un côté ou le bouton
  enfoncé ;
- la barre coulisse à 2,5 unités/s ; son collider est la seule partie sortie du
  fût, reconstruite à chaque pas de coulissement, et ce qu'elle portait est
  réveillé pour tomber ;
- le renderer ne dessine que cette partie : la barre passe derrière le poteau,
  jamais de l'autre côté.

## Tremplin

### Rôle

Renvoie vers le haut ce qui tombe dessus.

### Modèle

- socle, ressort et plateau statiques (1 × 0,93 au total), aucune propriété ;
- orienté par sa rotation, par pas de 15° ;
- le plateau a une restitution de 1 : une balle repart presque à sa hauteur de
  chute ; sous 1 m/s, Box2D n'applique pas de rebond, si bien qu'un objet posé
  reste posé ;
- à l'impact, le ressort dessiné se tasse (jusqu'à 0,12) proportionnellement à
  la vitesse, puis se détend ; le collider ne bouge pas.

## Inventaire

Une entrée d'inventaire a son propre identifiant, référence une famille et les
propriétés déjà choisies. Elle porte aussi les permissions qui seront copiées vers
le placement créé :

```ts
interface InventoryEntry {
  id: string;
  type:
    | 'ball'
    | 'basket'
    | 'beam'
    | 'seesaw'
    | 'mass'
    | 'box'
    | 'lever'
    | 'conveyor'
    | 'button'
    | 'fan'
    | 'barrier'
    | 'springboard';
  props:
    | {}
    | { size: 'short' | 'medium' | 'long' }
    | { weight: '10kg' }
    | { material: 'wood' | 'metal' }
    | { position: 'left' | 'center' | 'right' }
    | { direction: 'left' | 'stopped' | 'right' }
    | { state: 'on' | 'off' }
    | { state: 'closed' | 'open' };
  quantity: number;
  permissions: { move: boolean; rotate: boolean; remove: boolean };
}
```

Le schéma concret est une union Zod stricte discriminée afin que les propriétés
soient typées selon `type` ; il fait autorité (`src/domain/level-document.ts`).
Balle, panier et bascule n'acceptent aucune propriété. Toutes les familles
tournent librement — l'éditeur procède par pas de 15° — sauf la balle et le
panier (décision de l'auteur, 1er octobre 2026 ; `rotationMode`,
`src/domain/level-document.ts`), levier compris. `permissions.rotate` doit être `false` pour la balle et le panier.

Les premiers niveaux peuvent n'offrir qu'une ou deux poutres. La balle, le panier
et la bascule peuvent être placés par l'auteur avec leurs trois permissions à
`false`, sans apparaître dans le tiroir du joueur.

## Progression

La progression de la campagne et la géométrie mesurée de chaque niveau sont dans
[`levels/initial-progression.md`](levels/initial-progression.md).

## Tests contractuels minimaux

- la balle commence exactement à la transform déclarée à chaque reset ;
- les trois tailles de poutre partagent épaisseur et matériau ;
- une poutre ne bouge pas sous l'effet de la simulation ;
- la bascule revient à son état initial après reset ;
- détruire une bascule détruit tous ses composants physiques internes ;
- le panier ne valide que la balle cible d'un objectif ;
- le capteur du panier ne modifie pas la trajectoire physique ;
- les objets dont une permission est à `false` refusent la commande correspondante ;
- l'inventaire distingue et décompte correctement les tailles de poutre ;
- une caisse de chaque matériau tombe, repose sur une face et revient à sa pose au reset ;
- les deux variantes suivent le convoyeur et ouvrent une barrière par un bouton ;
- la caisse en bois est plus facile à pousser par un ventilateur que la caisse métallique ;
- une masse posée sur une poutre repose à la hauteur de son empreinte ;
- une masse lâchée sur une bascule catapulte la balle posée à l'autre bout ;
- un levier tient chacun de ses trois crans, sans dépasser ses butées ;
- une balle qui percute le pommeau fait changer le levier de cran, et le
  convoyeur relié change de sens dans la même simulation ;
- un convoyeur entraîne ce qu'il porte dans son sens, et rien à l'arrêt ;
- un bouton est enfoncé tant qu'un objet pèse dessus, et seulement alors ;
- un ventilateur en marche soulève une balle, pousse une balle bien plus qu'une
  masse, et tourne quand son levier est d'un côté ou son bouton enfoncé ;
- une barrière fermée porte une balle, ouverte la laisse tomber, et s'ouvre
  quand une masse enfonce le bouton relié ;
- un tremplin renvoie une balle presque à sa hauteur de chute.

## Décisions à prendre par expérimentation

- apparence exacte de la balle et du panier ;
- dimensions relatives des objets ;
- coefficients de friction et de rebond ;
- trois tailles de poutre définitives ;
- angles de snapping et comportement près des limites ;
- durée de maintien nécessaire dans le panier ;
- limites angulaires et amortissement de la bascule.
