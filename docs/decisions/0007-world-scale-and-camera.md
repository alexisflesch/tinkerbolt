# ADR 0007 - Repère du monde, scène, caméra et échelle des sprites

Statut : accepté

Date : 2 septembre 2026

## Contexte

Un essai complet de l'application dans un navigateur, consigné par
[le plan de remise en jeu](../plan-remise-en-jeu.md) § 1, a montré une situation
qu'aucune gate ne détectait : l'application démarre, ne lève aucune erreur
console, `pnpm check` passe, et pourtant rien de ce que le jeu promet n'est
visible à l'écran.

Ce n'est pas une accumulation de petits défauts d'affichage. Deux systèmes de
coordonnées incompatibles cohabitent. Le document « atelier » chargé au démarrage
([`App.tsx:80-132`](../../src/app/App.tsx#L80-L132)) place la balle en `(40, 40)`,
le panier en `(600, 400)` et déclare une zone de construction `0..640 × 0..480` :
ce sont des pixels. Tout le reste du dépôt travaille en mètres —
`BALL_RADIUS = 0.3`, `BEAM_LENGTHS.medium = 4`, `BASKET_HALF_WIDTH = 0.75` dans
`src/simulation/simulation-session.ts`, repris à l'identique par `familyVisuals`
et `beamVisuals` dans `src/presentation/board-renderer.ts`. La caméra a été
réglée à `pixelsPerWorldUnit: 0.32` pour que ce document en pixels tienne dans le
canvas ; les objets réels y sont alors dessinés en sub-pixel : 0,19 px pour la
balle, 0,48 px pour le panier, 1,28 px pour une poutre moyenne. Le plateau ne
paraît pas vide parce qu'il l'est, mais parce que tout y est mille fois trop
petit.

Trois conventions manquantes expliquent le reste des symptômes :

- **aucune convention de repère écrite** : la géométrie du panier a été rédigée
  en `y` vers le haut alors que la gravité et ses tests sont en `y` vers le bas,
  et le niveau 1 compense par une rotation de π qui retournera le sprite dès
  qu'il sera visible ;
- **aucune scène déclarée** : « Ajuster à la scène » ne peut rien calculer tant
  qu'aucun rectangle ne dit ce qu'est la scène ; le bouton se contente de
  réaffecter la constante de caméra initiale, et il n'existe donc ni cadrage, ni
  panoramique, ni bornes de zoom ;
- **aucune convention de sprite** : rien ne lie la boîte alpha d'un PNG à
  l'empreinte de son collider, donc `drawImage` étire arbitrairement, et les
  quatre PNG livrés sont des illustrations de présentation totalisant 3,8 Mo.

Tant que ces conventions ne sont pas figées, chaque correction réinvente sa
propre échelle et aucune n'est vérifiable. Elles sont donc actées ici, avant
toute écriture de code.

## Décision

Quatre conventions sont figées. Elles forment le contrat commun du domaine, de la
simulation, du rendu, de l'édition et du contenu, et ne se rediscutent pas tâche
par tâche.

### Repère du monde

- 1 unité monde vaut 1 mètre. Les constantes physiques existantes sont déjà à
  cette échelle et ne changent pas.
- L'axe `x` croît vers la droite, l'axe `y` **croît vers le bas**.
- L'origine d'un niveau est le coin supérieur gauche de sa scène.

Le sens de `y` n'est pas un choix neuf : c'est celui de la gravité Planck, déjà
alignée sur le repère écran et couverte par un test de non-régression. L'écrire
ici en fait un invariant opposable plutôt qu'un usage. Le retenir plutôt que la
convention mathématique supprime toute inversion de signe entre le collider, la
projection et le canvas : une seule convention, de la physique au pixel.

**Toute géométrie de collider écrite en `y` vers le haut est un bug.** Elle se
corrige dans la géométrie, jamais par une rotation compensatoire du placement :
un tel contournement retourne aussi le sprite et déplace le défaut dans le
contenu.

### Scène d'un niveau

Un niveau déclare explicitement son rectangle de scène en unités monde. Ce
rectangle sert à trois choses, et c'est ce qui justifie qu'il soit une donnée du
niveau et non un réglage de la vue : le cadrage initial, la détection de sortie de
monde, et (jusqu'à l'amendement du 2 octobre 2026) le calage du fond. Aucune des
trois ne peut le deviner.

- Un niveau du premier chapitre tient dans **8 × 5,5 unités**. C'est une règle de
  contenu et non une contrainte du format : sur un écran de 320 px de large,
  8 unités donnent 40 px par unité, donc une balle de 24 px — la plus petite
  cible encore lisible et manipulable au doigt.
- La scène de référence pour un niveau large est **16 × 9**.

### Caméra

- « Ajuster à la scène » calcule un `contain` du rectangle de scène dans le
  canvas, avec **4 % de marge**, et recentre l'origine. C'est le cadrage appliqué
  au chargement d'un niveau, et celui que le bouton restaure.
- Les bornes de zoom sont **`[0,6 × ajusté, 4 × ajusté]`**, avec un **plancher
  absolu de 24 px par unité monde**. Les bornes relatives tiennent l'exigence de
  `mobile-editor-interactions.md` § Zoom — objets manipulables au maximum, niveau
  retrouvable au minimum. Le plancher absolu rend structurellement impossible la
  panne constatée, où une échelle arbitraire ramenait la scène entière sous le
  pixel.
- L'origine est bornée de sorte que le rectangle de scène ne puisse jamais sortir
  entièrement du canvas.
- La navigation reste celle de `mobile-editor-interactions.md` § Navigation du
  plateau : panoramique à un doigt depuis une zone vide, pincement à deux doigts,
  et les trois boutons comme alternative complète.

Ces règles sont un calcul pur sur un rectangle de scène et une taille de canvas.
Elles n'appartiennent ni au document de niveau, ni au DOM : aucun état de caméra
n'est persisté.

### Convention de sprite

- Un sprite est un PNG à **fond transparent**, sans halo, sans ombre portée
  incrustée et sans perspective. C'est l'application directe de la direction
  artistique 2D plate actée par [l'ADR 0006](0006-board-renderer.md).
- Résolution de référence : **128 px par unité monde à @2x**, donc 64 à @1x.
- **La boîte englobante alpha du PNG est exactement l'empreinte du collider.**
  C'est cette règle qui rend `drawImage` correct sans facteur de correction : le
  rectangle de destination se déduit de l'empreinte physique, sans table de marges
  par asset et sans réglage à l'œil.
- L'ancre de dessin est le centre de cette boîte, et elle coïncide avec l'origine
  du corps physique.
- Budget : **≤ 60 Ko par sprite** après compression. C'est la condition d'un
  précache hors ligne tenable sur téléphone, exigé par l'ADR 0006.

Tailles cibles qui découlent de la convention, à @2x :

| Sprite        | Empreinte monde | PNG @2x   |
| ------------- | --------------- | --------- |
| `ball`        | 0,6 × 0,6       | 77 × 77   |
| `basket`      | 1,5 × 1,1       | 192 × 141 |
| `beam-short`  | 2 × 0,25        | 256 × 32  |
| `beam-medium` | 4 × 0,25        | 512 × 32  |
| `beam-long`   | 6 × 0,25        | 768 × 32  |
| `seesaw`      | 3 × 0,94        | 384 × 120 |

La colonne « empreinte monde » reprend les dimensions déjà utilisées par la
simulation et par la projection du plateau. Puisque la boîte alpha du PNG doit
désormais leur correspondre exactement, **ces empreintes sont figées** : les
dimensions des quatre familles et les tailles des trois poutres cessent d'être
des questions ouvertes. Les masses, frictions, rebonds et limites de la bascule
restent ouverts.

## Ce que cette décision acte explicitement

### Le document « atelier » écrit en pixels est supprimé

[`App.tsx:80-132`](../../src/app/App.tsx#L80-L132) viole l'invariant d'`AGENTS.md`
« Les positions du domaine sont exprimées en unités du monde, jamais en pixels
d'écran ». Ce n'est pas un réglage malheureux : c'est un document de niveau
valide au regard du schéma, chargé au démarrage, dont toutes les coordonnées sont
dans une autre unité que le reste du système. Il est la raison pour laquelle la
caméra a été réglée à une valeur absurde, et donc la cause racine de l'écran
vide.

**Conséquence :** ce document est supprimé, non corrigé sur place. Le mode
création part d'un document d'atelier écrit en unités monde et validé comme tout
autre contenu embarqué. Aucune constante de caméra ne doit plus être choisie pour
compenser l'unité d'un document.

### Le rectangle de scène entre dans le format persistant

La scène n'est pas un réglage de vue : deux de ses trois usages — sortie de monde
et calage du fond — sont des règles de niveau, et le troisième doit être
reproductible d'une session à l'autre. Elle appartient donc au document, au même
titre que ses zones de construction.

**Conséquence :** c'est une évolution incompatible d'un document persistant. Elle
impose `schemaVersion: 2`, une migration v1 → v2 et des tests couvrant l'ancienne
et la nouvelle version, comme l'exigent `AGENTS.md` et
[l'ADR 0004](0004-level-document-v1.md). L'implémentation ne relève pas de cette
décision : elle est la tâche A2 du plan de remise en jeu.

### Les quatre PNG livrés sont des prototypes non conformes, et sont remplacés

Les assets présents dans `public/assets/sprites/` sont des illustrations de
présentation, pas des éléments de jeu :

| Fichier         | Dimensions  | Poids   | Problème                                             |
| --------------- | ----------- | ------- | ---------------------------------------------------- |
| `ball@2x.png`   | 1254 × 1254 | 396 Ko  | 2090 px par unité monde                              |
| `basket@2x.png` | 1230 × 1278 | 1301 Ko | perspective 3/4, ratio 0,96 pour une boîte 1,5 × 1,1 |
| `beam@2x.png`   | 1536 × 1024 | 953 Ko  | fond noir opaque et halo, marge morte de 65 %        |
| `seesaw@2x.png` | 1536 × 1024 | 1172 Ko | même marge morte                                     |

Chacun manque au moins deux points de la convention ci-dessus : aucun n'a une
boîte alpha égale à l'empreinte de son collider, aucun ne tient dans 60 Ko, le
fond de `beam@2x.png` n'est pas transparent, et la perspective 3/4 de
`basket@2x.png` contredit frontalement la direction artistique plate de
l'ADR 0006. L'ensemble pèse environ 3,8 Mo pour quatre objets, dans une PWA qui
doit fonctionner hors ligne sur téléphone.

**Conséquence :** ces quatre fichiers sont des prototypes à remplacer, et non un
acquis. Ils sont reproduits à la convention et aux tailles du tableau ci-dessus
(tâche D2 du plan). `etat.md` est corrigé en ce sens : leur présence est une
dette, pas une livraison.

## Ce que cette décision ne tranche pas

- les masses, frictions, rebonds et limites de la bascule ;
- le volume du panier et la durée de maintien validant la réussite ;
- l'identité graphique finale, la palette, les animations et la direction audio ;
- les budgets globaux de bundle, de mémoire et de performance : seul le budget
  par sprite est fixé ici ;
- le recours éventuel à un atlas de sprites, que la convention n'impose ni
  n'interdit ;
- la matrice de navigateurs et de téléphones.

## Conséquences

- Toute valeur de cadrage, de borne de zoom ou d'échelle de sprite se lit dans
  cette ADR et nulle part ailleurs. Les constantes correspondantes vivent dans un
  module pur de `src/presentation/`, nommées, exportées et testables sans
  navigateur.
- Le format de niveau passe en v2 avec sa migration (tâche A2), le document
  d'atelier en pixels disparaît au profit d'une vraie caméra (tâche A3), et les
  sprites sont reproduits à la convention (tâche D2).
- L'aperçu de placement doit être produit par la même projection que l'objet
  placé. À échelle, ancre et empreinte communes, une forme CSS fixe en overlay
  DOM n'est plus défendable : elle ne peut ni suivre le zoom, ni montrer la
  géométrie réelle.
- Le fond du plateau suit la caméra. Un `background-size: cover` en CSS ment sur
  l'échelle du monde. (Depuis l'amendement du 2 octobre 2026, il n'est plus calé sur
  la scène : parchemin uni et grille sur tout le viewport.)
- La détection de sortie de monde devient possible et attendue : une simulation
  dont la balle quitte la scène par le bas ou un côté a une fin (le haut est
  ouvert depuis l'amendement du 2 octobre 2026).
- Le domaine, les commandes et le test d'appartenance aux zones continuent
  d'ignorer l'écran, conformément à l'ADR 0006 et à `AGENTS.md`.
- Rien de cette décision n'entre dans le document de niveau hormis le rectangle
  de scène : ni chemin d'asset, ni résolution, ni échelle de rendu, ni état de
  caméra.
- L'ADR 0004 laissait explicitement les conventions d'orientation du monde
  indépendantes de la représentation par minima et maxima. Cette ADR les fixe ;
  la représentation des rectangles, elle, ne change pas.

## Références

- [Plan de remise en jeu](../plan-remise-en-jeu.md) §§ 1 et 2
- [ADR 0004 - Contrat persistant `LevelDocument v1`](0004-level-document-v1.md)
- [ADR 0006 - Renderer du plateau et pipeline de sprites](0006-board-renderer.md)
- [Interactions mobiles](../mobile-editor-interactions.md) § Navigation du plateau

## Amendement du 25 septembre 2026 — sprites en calques et nouveaux assets

Les prototypes ci-dessus sont remplacés par des sources dessinées, rangées dans
`art/assets/`, et exportées par `art/build-sprites.py` (Python, Pillow, numpy,
pngquant ; hors de la gate). Les PNG produits sont commités ; le test
`src/presentation/sprite-assets.test.ts` vérifie chaque dimension contre la
géométrie projetée, et le budget de 60 Ko.

**Une famille peut être faite de plusieurs calques** pour qu'une partie bouge
seule. La convention devient : _la boîte alpha du cadre commun d'un calque est
exactement l'empreinte monde que la projection lui attribue_. Chaque calque
suit l'une de trois poses : celle du placement (pièce immobile), celle du corps
simulé, ou la position du corps sans sa rotation (ombrage et reflet qui restent
face à la lumière).

| Famille    | Calques, de l'arrière à l'avant                           | Empreinte monde (origine)                     |
| ---------- | --------------------------------------------------------- | --------------------------------------------- |
| balle      | `ball-base`, `ball-spin` (tourne), `ball-highlight`       | 0,6 × 0,6 (centre)                            |
| panier     | `basket-back`, `basket-front`                             | 1,5 × 1,1 (centre)                            |
| poutre     | `beam-short`, `beam-medium` ou `beam-long` (U12)          | 2, 4 ou 6 × 0,25 (centre)                     |
| bascule    | `seesaw-fulcrum` (immobile), `seesaw-beam` (pivote)       | ensemble 3 × 0,82 (pivot)                     |
| masse      | `mass-10kg`                                               | 0,8 × 0,772 (centre)                          |
| électroaimant C9b | `electro-magnet-off` ou `electro-magnet-on` (même cadre) | 1 × 0,8 (centre) |
| caisse C9a | `box-wood` ou `box-metal` (corps dynamique)               | 0,8 × 0,8 (centre)                            |
| levier     | `lever-base` (immobile), `lever-handle` (pivote)          | socle 0,8 × 0,414, poignée 0,35 × 1,0 (pivot) |
| convoyeur  | `conveyor-belt` ou `conveyor-belt-left`, `conveyor-frame` | 3 × 0,58 (centre)                             |

La bande du convoyeur fait exception au cadre commun : son sprite couvre la
fenêtre du cadre plus une période exacte du motif (77 px), et le renderer fait
glisser son rectangle source pour la faire défiler. Chaque famille a aussi une
vignette pré-composée, `thumbs/<famille>.png`, pour le tiroir du catalogue.

Les colliders polygonaux (pied de la bascule, masse, socle du levier) sont
mesurés sur les sources par le même script et vivent dans
`src/domain/family-geometry.ts`, source unique des empreintes pour la physique
comme pour le rendu.

## Amendement du 2 octobre 2026 — pas de bordure, pas de perte par le haut

À la demande de l'auteur (feuille de route v1, décision 2), la scène cesse d'être
une zone visible du plateau.

- **Rendu.** Le renderer ne dessine plus d'image de fond ni de cadre : il peint
  tout le viewport d'un parchemin uni (`#f6ead3`), puis une grille d'un mètre sur
  **tout** le viewport, alignée sur les entiers du monde, avec la même
  atténuation au faible zoom. Rien ne marque la limite de la scène, ni couleur
  hors scène, ni trait, ni ombre. Les zones de construction (U13) gardent leur
  rendu. `board-generic-v0.png` n'est plus chargé ; le fichier reste dans
  `public/assets/backgrounds/`.
- **Rôle de la scène.** Le rectangle de scène garde deux usages : le cadrage
  (« Ajuster à la scène », bornes de la caméra) et la règle de perte. Il ne cale
  plus le fond. Aucun mur physique n'est ajouté.
- **Perte.** L'échec « hors de la scène » garde sa marge de 2 unités à gauche, à
  droite et en bas (`y` croît vers le bas : le bas est `scene.max.y`). **Le haut
  est ouvert** : une balle au-dessus de `scene.min.y - marge` reste en jeu, la
  gravité la ramène, et la limite de 20 s simulées met fin à la tentative si elle
  ne revient pas. Le comportement est porté par `isOutOfScene` dans
  `src/domain/attempt-failure-evaluator.ts`.
