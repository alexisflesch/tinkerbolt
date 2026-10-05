# ADR 0013 - Atelier créateur de puzzles : objets à placer et solution de référence

Statut : accepté

Date : 2026-09-27

## Contexte

L'atelier produit une machine complète qui gagne seule. Décision de l'auteur du
27 septembre 2026 (U22, historique Git) : il doit produire un
puzzle. Chaque objet posé est « fixe » ou « à placer » ; l'export donne un
document dont le décor est l'ensemble des objets fixes, l'inventaire les objets
à placer, et qui contient une **solution de référence** visible. Le document
doit rester un `LevelDocument` v2 relu par le codec de fichier (ADR 0011).

## Décision

Des champs facultatifs, compatibles avec la v2 : un document v2 qui ne les porte
pas reste valide et se relit à l'identique, donc **pas de nouvelle version ni de
migration** (même régime que `wires`, ADR 0009, et `challenge`, ADR 0010).

### Forme atelier : `toPlace` sur un objet posé

```ts
objects[i].toPlace?: true
```

Absent, l'objet est fixe. Seul `true` est accepté, pour qu'un objet fixe n'ait
qu'une écriture. La balle et le panier de l'objectif ne sont jamais à placer.
Ce marquage n'existe que dans l'atelier et ses brouillons (ADR 0011) : un
document qui porte une `solution` n'a aucun objet `toPlace`.

### Forme puzzle : `solution`

```ts
solution?: {
  placements: {
    inventoryId: string;
    placementId?: string;
    transform: { position; rotation };
  }[];
  wires?: {
    id: string;
    inventoryId: string;
    sourceId: string;
    targetId: string;
  }[];
}
```

Chaque pose désigne une entrée d'inventaire posable et une pose ; la famille et
les propriétés sont celles de l'entrée, visibles dans le même fichier. Quand un
fil relie une pose, `placementId` conserve l'identifiant de l'objet d'atelier
correspondant afin de remapper ses extrémités. Chaque fil de solution désigne
une entrée `wire` et relie un objet fixe ou une pose à un appareil compatible.
Règles validées par le schéma :

- chaque entrée existe et a le bon type (`wire` pour un fil, autre pour une pose) ;
- une entrée n'est pas utilisée plus de fois que sa quantité (vérifié contre
  l'inventaire d'origine, pas contre l'inventaire restant d'une tentative) ;
- le centre de chaque pose est dans la scène ; la rotation suit la règle de la
  famille (quarts de tour, butée du levier) ;
- les cibles restent uniques, y compris entre décor et solution ;
- au plus 512 poses et 512 fils.

La solution n'est pas une tentative : `placementId` est seulement une référence
de remappage vers l'atelier, jamais l'identifiant de l'objet créé pendant une
tentative. La jouer (régression, vérification) pose chaque objet par la commande
joueur `placeFromInventory`, puis chaque fil par `connectControlWire`, zones de
construction comprises.

### Passage de l'atelier au puzzle

Une fonction pure de `src/application/` transforme l'atelier en puzzle :

- les objets fixes et les fils fixes restent le décor ;
- l'inventaire de l'atelier (invisible pour l'auteur, qui pose depuis le
  catalogue) est remplacé par les objets à placer, regroupés par famille et
  propriétés identiques ; permissions : déplacer et retirer, tourner selon la
  règle de la famille (`rotationMode`) ;
- la solution reçoit la pose de chaque objet à placer ;
- un fil marqué `toPlace`, ou touchant un objet `toPlace`, devient une unité de
  l'entrée d'inventaire `wire` et une connexion dans la solution ;
- sans zone de construction, la zone est toute la scène ; les zones existantes
  sont conservées ;
- `challenge` n'est pas copié dans le puzzle exporté (U24) ;

La transformation inverse (puzzle → atelier) remet les poses de la solution sur
le plateau, marquées `toPlace`, restaure les fils de solution avec le même
marquage, et conserve l'inventaire ; elle sert à rouvrir un niveau de campagne
dans l'atelier (U17).

### Vérifications à l'export

Avant tout export (fichier L22 ou lien L23), sans action de l'auteur, par
simulation déterministe à pas fixe (sans horloge réelle) :

1. au moins un objet est à placer ;
2. le puzzle, solution posée par les commandes du joueur, gagne ;
3. le puzzle sans aucune pose du joueur ne gagne pas.

Un échec refuse l'export avec un message. La simulation est injectée dans la
couche application par un port ; l'application ne dépend pas du moteur.

## Conséquences

- Tests : ancien document (sans les champs) relu à l'identique ; nouveau document
  relu à l'identique par le codec de fichier et le codec URL.
- Le schéma des tentatives ne contrôle pas le nombre de poses contre
  l'inventaire restant, comme il ne contrôle pas `challenge`.
- La régression d'un niveau de campagne peut rejouer sa `solution`.
- Les fils de l'atelier peuvent être fixes ou « à placer ». Un fil « à placer »
  est exporté comme une entrée `wire` de l'inventaire et une connexion de la
  solution ; lorsqu'une extrémité est un objet à placer, sa pose conserve une
  référence `placementId` pour que la solution reste rejouable.

## Amendement du 1er octobre 2026 — solution cachée (ADR 0015)

Ouvrir un niveau puzzle dans l’atelier ne pose plus sa solution : le décor est
repris, l’inventaire et la solution sont retirés, et le niveau d’origine est
gardé hors du document (`source` de la création). La solution n’est posée que
par la commande « Révéler la solution de l’auteur », ou d’office sous
`pnpm dev` pour un niveau de campagne. La transformation inverse décrite plus
haut sert à cette révélation, appliquée en ajout sur le document courant.
`workshopFromPuzzle` reste la référence du placement des poses et du remappage
des fils.

L’export conserve `metadata.author` et `metadata.basedOn` (ADR 0016).
