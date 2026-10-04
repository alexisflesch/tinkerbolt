# ADR 0009 - Fils de commande entre levier et convoyeur

Statut : accepté

Date : 2026-09-25

## Contexte

De nouveaux assets introduisent un levier à trois positions et un convoyeur. Une
première note de conception, produite en amont
([`tinkerbolt_control_wires_v1.md`](../tinkerbolt_control_wires_v1.md), depuis
réécrite), proposait des liaisons directes contrôleur → dispositif, routées
automatiquement, avec des ponts graphiques aux croisements. Le principe est
retenu ; plusieurs moyens proposés contredisaient les décisions en place ou
créaient de l'état inutile. Cette ADR tranche ces points. La spécification
fonctionnelle (comportement, gestes, rendu) vit dans la note réécrite.

## Décision

### Le document ne stocke que la relation

`LevelDocument v2.wires` est une liste de `{ id, sourceId, targetId }`. Le
format v3 peut également référencer le minuteur intermédiaire (`timerId`, voir
l’amendement C9 ci-dessous). La lettre
du circuit, sa couleur, les points d'ancrage et le tracé ne sont **pas**
persistés : ils se dérivent de l'ordre des fils et de la position des objets.

- Un circuit est l'ensemble des fils d'un même levier. Sa lettre (A, B, …, Z,
  A2…) suit l'ordre dans lequel les leviers ont été reliés pour la première fois
  (`src/domain/control-circuits.ts`). La note d'origine attribuait une lettre
  par fil tout en montrant un bouton A relié à trois appareils : la lettre par
  levier lève cette contradiction.
- Les points d'ancrage appartiennent à la projection visuelle de chaque famille,
  pas au niveau.

Validation (`src/domain/level-document.ts`) : identifiant de fil unique, source
= levier placé, cible = convoyeur placé, **au plus un levier par convoyeur**
(deux leviers opposés rendraient le sens ambigu). Un levier peut commander
plusieurs convoyeurs. Supprimer un objet supprime ses fils dans la même
commande.

### Évolution compatible du format, sans nouvelle version — précédent historique v2

`wires` est facultatif en entrée et vaut `[]` par défaut. Tout document v2 écrit
avant cette décision reste valide et se relit à l'identique, fils vides compris.
Aucune migration n'était donc requise à cette étape, comme pour l'ajout des
familles masse, levier et convoyeur à l'union discriminée. La justification
historique selon laquelle aucun document n'était persisté hors du dépôt est
caduque depuis C2a/C3. Le choix courant pour les familles C9 est v3 avec
migration, suivant l'ADR 0018.

### Rendu en Canvas 2D, pas en SVG

La note proposait le SVG. L'[ADR 0006](0006-board-renderer.md) a choisi Canvas 2D
et un seul renderer pour le plateau : un calque SVG devrait suivre séparément la
caméra, le zoom et le `devicePixelRatio`. La chaîne proposée est conservée —
objets et fils → routeur → polyligne → dessin déterministe — mais le dessin
passe par le même renderer (`src/presentation/wire-renderer.ts`), sous les
objets, avec les pastilles de lettre par-dessus.

### Routage indépendant, ponts en post-traitement

Chaque fil est routé seul, orthogonalement, en évitant l'empreinte des autres
objets (`src/presentation/control-wires.ts`). La note voulait tenir compte des
autres fils pendant le routage : ajouter un fil pourrait alors déplacer tous les
autres. Les croisements sont traités ensuite : le fil le plus récent enjambe
l'ancien par un demi-cercle. « Éviter les zones de gameplay importantes »,
non défini, n'est pas retenu.

### Le câblage est un acte d'auteur

Relier et délier sont refusés au joueur (`wiring-not-permitted`). En résolution,
les circuits sont ceux que le niveau impose. Rien n'est déplacé pendant la
simulation par le joueur : seuls des objets peuvent faire changer un levier de
cran (décision produit du 25 septembre 2026).

### Sémantique du levier et du convoyeur

Levier gauche / centre / droite → convoyeur vers la gauche / arrêté / vers la
droite, lu à chaque pas fixe. Le convoyeur non relié suit sa propre propriété
`direction`. Le bouton momentané, le ventilateur et la porte de la note n'ont pas
d'assets et ne sont pas implémentés.

## Amendement du 26 septembre 2026 — bouton, ventilateur, barrière

De nouveaux assets ajoutent un contrôleur, le **bouton**, et deux dispositifs, le
**ventilateur** et la **barrière** (plus le tremplin, passif et jamais câblé).

- Sources : levier et bouton. Cibles : convoyeur, ventilateur, barrière.
  `canCommand` (`src/domain/level-document.ts`) fait autorité ; la validation
  et l'outil de câblage l'utilisent tous deux.
- Un dispositif obéit toujours à **un seul** contrôleur.
- Un **bouton ne commande jamais un convoyeur** : il a deux états, le convoyeur
  trois (gauche, arrêt, droite) ; aucun sens ne se déduirait d'un appui.
- Ventilateur et barrière sont à deux états. Relié à un **levier**, le centre
  vaut « arrêt / fermé » et chaque côté « marche / ouvert » : c'est la règle du
  convoyeur, où le centre est toujours l'arrêt, sans donner de sens à un
  dispositif qui n'en a pas. Relié à un **bouton**, l'appui vaut « marche /
  ouvert ». Non relié, chacun suit sa propriété `state` ; relié, elle est
  ignorée, comme `direction` pour le convoyeur.
- Le bouton est momentané : actif tant qu'un corps dynamique pèse sur son
  capuchon, sans mémoire.
- Le document gagne quatre familles à l'union discriminée, sans nouvelle
  version ni migration, pour la même raison que la masse et le levier.
- Le sens du ventilateur, le côté de la barre et l'orientation du tremplin sont
  la rotation du placement, limitée aux quarts de tour, et non une propriété :
  l'auteur les tourne avec les mêmes gestes qu'une poutre. Le demi-tour d'un
  ventilateur ou d'une barrière est dessiné en miroir.

La phrase « Le bouton momentané, le ventilateur et la porte de la note n'ont pas
d'assets et ne sont pas implémentés » ci-dessus est caduque pour le bouton et le
ventilateur ; la porte est la barrière.

## Amendement du 27 septembre 2026 — fils droits et discrets (U14)

Le routage orthogonal et ses ponts produisaient des dizaines de virages et des
fils trop voyants. Demande de l'auteur : chaque fil est désormais **un segment
droit** entre le port de la source et celui de la cible (le port de chaque
objet tourné vers l'autre), dessiné sous les objets, sans contournement ni pont.
Les fils sont translucides en construction et presque effacés pendant la
simulation. La lettre de circuit reste aux deux bouts (la couleur n'est jamais
le seul indice), en petite pastille aussi translucide que le fil. La section
« Routage indépendant, ponts en post-traitement » ci-dessus est caduque ; la
chaîne devient objets et fils → ports → segment → dessin.

## Amendement du 27 septembre 2026 — équerre horizontale/verticale (U14b)

Le segment droit diagonal de U14 restait jugé peu lisible. Demande de
l'auteur : le tracé reste un calcul pur et direct, sans contournement ni pont,
mais n'est plus jamais diagonal — horizontal ou vertical seulement, avec au
plus un coude (`src/presentation/control-wires.ts`). L'orientation du coude
est déterministe : le fil part dans l'axe du port de la source (le port
sortant surtout à l'horizontale ou surtout à la verticale de son objet), tourne
une fois vers la cible. Si les deux ports sont déjà alignés sur un axe, un
segment unique suffit, sans coude. Le reste de U14 est inchangé (dessin sous
les objets, translucidité, quasi-effacement en simulation, lettre aux deux
bouts). La chaîne devient objets et fils → ports → équerre → dessin ; le
paragraphe « chaîne devient objets et fils → ports → segment → dessin » de U14
ci-dessus est caduc.

## Amendement du 27 septembre 2026 — fil dans l'inventaire du joueur (U21)

Décision de l'auteur : **un fil est un objet d'inventaire comme les autres** ;
un puzzle peut en donner au joueur. La section « Le câblage est un acte
d'auteur » ci-dessus est caduque pour les fils d'inventaire.

- Format : l'inventaire v2 accepte
  `{ id, type: 'wire', quantity, props: {}, permissions }`, avec `move` et
  `rotate` toujours `false` (un fil n'a ni position ni angle) ; `remove` dit si le joueur peut reprendre un fil qu'il a
  posé, comme pour un objet. Ajout compatible, sans nouvelle version ni
  migration ; l'inventaire v1 n'accepte pas de fil.
- Commande : `connectControlWire` en contexte joueur exige `inventoryEntryId`
  (sinon `wiring-not-permitted`), consomme une unité de cette entrée et
  enregistre la provenance du fil (ADR 0005 : la provenance associe l'id d'un
  objet ou d'un fil à son entrée). Mêmes règles de domaine que pour l'auteur.
- Retrait : `disconnectControlWire` en contexte joueur ne délie qu'un fil
  posé par le joueur (`inventory-provenance-missing` pour un fil du niveau) et
  le rend à l'inventaire ; retirer un objet rend aussi les fils du joueur qui
  y étaient attachés.
- Défi : un fil posé par le joueur compte comme un objet (ADR 0010), et la
  quantité de fils compte dans le total opposé à `minimalObjectCount`.

## Amendement du 1er octobre 2026 — état de départ et geste du fil

À la demande de l'auteur :

- un ventilateur ou une barrière relié garde son état de départ (`state`) : la
  commande active (levier d'un côté, bouton enfoncé) le fait passer à l'état
  inverse, puis il y revient. Une barrière ouverte au départ se ferme donc à
  l'appui. Le convoyeur relié reste mené par la position du levier. Les niveaux
  embarqués dont un ventilateur relié valait `on` passent à `off`, ce qui garde
  leur comportement ; aucune migration n'est prévue pour les autres documents ;
- le geste de la carte Fil se fait dans les deux ordres, commande puis appareil
  ou l'inverse, et se termine dès que le fil est posé, sans bouton « Terminer » ;
- le réglage « Fixe / À placer » de chaque fil reste dans le panneau de l'objet
  relié, sous le titre « Fil du circuit … ».

## Amendement du 4 octobre 2026 — nouvelles familles C9 et minuteur en série

L’auteur confirme les raccords de commande et l’expérience du minuteur ; les
contrats produit complets sont dans l’[ADR 0019](0019-c9-object-contracts.md).
Le document évolue en v3 suivant l’[ADR 0018](0018-level-document-v3.md).

- Le bouton commande aussi l’électroaimant et le piston. Le levier ne commande
  ni l’un ni l’autre. Le minuteur peut s’insérer dans un fil valide sans
  remplacer son contrôleur ni son dispositif.
- Un fil qui passe par un minuteur reste une seule relation logique entre son
  contrôleur et son dispositif et consomme une unité d’inventaire. Il est rendu
  par deux segments : contrôleur → minuteur → dispositif. La relation conserve
  l’identité du circuit du contrôleur ; le minuteur ne crée ni dérivation ni
  circuit distinct.
- Le geste d’édition est : placer le minuteur, toucher la carte Fil, toucher
  le contrôleur, le minuteur puis le dispositif. La liaison n’est enregistrée
  et son unité consommée qu’une fois le parcours complet.
- Le minuteur retransmet chaque état reçu après son délai, y compris les
  transitions d’activation et de désactivation. Il n’inverse pas le signal et
  ne transforme pas une suite d’états en une impulsion unique.
- La valeur du délai est fixée en Atelier par l’auteur entre 1 et 10 secondes ;
  elle est verrouillée en résolution de niveau. Le détail du contrôle visuel et
  sa valeur de départ restent à définir en C9d.

## Conséquences

- Aucune dépendance ajoutée ; le port physique gagne des « dispositifs » dans
  son instantané (`devices` : position des leviers, sens et défilement des
  convoyeurs), lus par la présentation sans importer le moteur.
- Le tracé est un calcul pur, testé sans navigateur.
- Un besoin futur de réseau (jonctions, dérivations, logique) rouvre cette ADR :
  il n'est pas anticipé par le minuteur en série.

## Amendement C9b — état initial de l’électroaimant (4 octobre 2026)

L’électroaimant `electro-magnet` est une cible de fil, avec **le bouton seul**
comme source autorisée ; le levier est refusé à l’édition et à l’import.
L’[ADR 0019](0019-c9-object-contracts.md) fixe sa propriété initiale persistée
`state: 'on' | 'off'`.

Il partage la règle du ventilateur et de la barrière livrés : sans fil ou avec
un signal inactif, l’appareil conserve son état initial ; un signal actif
inverse cet état ; son relâchement rétablit l’état initial. Pour l’électroaimant,
`off` devient actif sous appui puis retourne à `off`, et `on` devient inactif
sous appui puis retourne à `on`. Aucun état de simulation n’est persisté.
La règle de direction du convoyeur commandé par levier reste distincte : son
sens initial est ignoré lorsqu’il est relié.
