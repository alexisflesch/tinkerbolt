# ADR 0020 - Niveaux « Machine » : exporter sans objectif

Statut : accepté

Date : 2026-10-06

## Contexte

L’export (ADR 0013) n’accepte qu’un **défi** : des objets « À placer », une
solution d’auteur qui gagne, un niveau qui ne se gagne pas seul. Un auteur qui
construit une machine pour le plaisir, sans objet à placer ni objectif
atteignable, ne peut pas la partager. La machine animée de l’accueil montre
l’intérêt du genre, mais `MachineScene` n’est qu’une projection éphémère : le
schéma v3 rend `goal` obligatoire.

Décisions de l’auteur du 6 octobre 2026 : `goal` devient facultatif sans changer
de version ; la balle rouge et le panier restent dans la machine, la balle
restant rouge, car une machine peut aussi porter un objectif ; l’auteur pose et
retire balle rouge et panier depuis le catalogue ; celui qui reçoit une machine
peut la remixer ; sans objectif, la simulation tourne jusqu’à la durée maximale
puis s’arrête, sans échec. Ce lot sort ce seul cas de la réserve v4 « nouveaux
objectifs », qui reste par ailleurs sans implémentation.

## Décision

### Deux notions indépendantes

- **Objectif** : la balle rouge doit entrer dans le panier. Il est complet quand
  le document désigne les deux.
- **Machine** : un niveau où le joueur n’a rien à poser — `inventory` vide,
  pas de `solution`, aucun `toPlace`. Une machine peut avoir un objectif ou non.

### Format

- Dans le schéma v3, `goal` est facultatif, ainsi que chacun de ses deux
  identifiants `ballId` et `basketId`. La balle désignée par `ballId` est la
  balle rouge, même sans panier. Un `goal` sans aucun identifiant est refusé :
  on omet alors `goal`. Les versions 1 et 2 gardent l’objectif complet
  obligatoire.
- Un niveau qui porte un `inventory` non vide, une `solution` ou un `challenge`
  exige un objectif complet.
- Aucune migration : tout document existant reste valide et inchangé. Les
  codecs de fichier et de lien ne changent pas, hors schéma. Limite acceptée :
  une version publiée avant ce lot refuse un niveau sans objectif complet comme
  un fichier invalide.
- Deux prédicats du domaine, `hasCompleteGoal(document)` et
  `isMachine(document)`, sont la seule façon de poser ces questions.

### Atelier

- Le catalogue d’auteur propose « Balle rouge » et « Panier », un exemplaire de
  chacun au plus : l’entrée est désactivée quand l’objet est déjà posé. Les
  poser les désigne dans `goal` ; ils se suppriment comme tout objet d’auteur,
  ce qui retire leur identifiant de `goal` (et `goal` s’il devient vide). Ces
  commandes sont annulables.
- L’atelier libre s’ouvre toujours avec sa balle rouge et son panier.
- L’objectif n’est jamais « À placer » (ADR 0013, inchangé).

### Export depuis l’atelier

- La boîte « Exporter » propose deux types, « Défi » et « Machine », par un
  choix exclusif utilisable au clavier et au doigt.
  - « Défi » garde la vérification de l’ADR 0013 et exige un objectif complet.
    S’il est refusé, il est désactivé, sa raison est affichée (une raison
    dédiée quand l’objectif manque) et une phrase explique comment obtenir un
    défi : poser la balle rouge et le panier, marquer des objets « À placer »,
    vérifier que la balle atteint le panier. « Machine » est alors sélectionné.
  - « Machine » est disponible dès que le document est valide. Une fonction
    pure de `src/application/puzzle/` la construit : `solution` et `challenge`
    retirés, `inventory` et `buildZones` vidés, marques `toPlace` retirées (les
    objets et fils restent posés, avec leurs permissions d’auteur). `goal` est
    conservé tel quel : la balle rouge reste rouge. Une phrase dit que le
    niveau se regarde, sans objet à placer.
- Nom, description, pseudo, licence, fichier et lien fonctionnent de la même
  façon pour les deux types (ADR 0016).

### Réception et jeu

- Une machine se reçoit par lien ou par fichier comme tout niveau (ADR 0015) et
  rejoint « Niveaux reçus ». Sa carte porte le badge « Machine ».
- Jouée, elle s’ouvre sans catalogue ni inventaire. « Lancer », pause, reprise
  et retour à la construction restent, ainsi qu’une action « Remixer » dans la
  barre, qui ouvre la création comme « Modifier » depuis la carte.
- **Avec un objectif complet**, rien d’autre ne change : victoire, échecs,
  bouton « Objectif », `solved` et bannières fonctionnent comme aujourd’hui.
- **Sans objectif complet**, la simulation n’évalue ni victoire ni échec : elle
  tourne jusqu’à la durée maximale existante puis revient à l’arrêt, sans
  bannière ni boîte de résultat ; une balle qui sort de la scène ne
  l’interrompt pas. Le bouton « Objectif » est absent, le niveau n’est jamais
  `solved` et la carte ne dit pas « Pas encore résolu ».
- Le remix d’une machine est une création ordinaire : avec le catalogue, son
  auteur peut y remettre un objectif et l’exporter en « Défi ».

## Conséquences

- `LevelDocument['goal']` et ses identifiants deviennent facultatifs : chaque
  lecteur (simulation, rendu, commandes d’auteur, tentative, régression de
  contenu) traite explicitement l’absence. La campagne embarquée garde un
  objectif complet ; la validation de contenu le vérifie.
- ADR 0013 : l’export n’est plus toujours un puzzle vérifié. ADR 0015 : un
  niveau reçu peut être une machine.
- Tests requis : schéma (objectif absent, partiel, complet ; combinaisons
  refusées ; anciens documents inchangés), catalogue (pose, suppression,
  exemplaire unique, annulation), fonction d’export, boîte d’export (deux
  types, défi désactivé et expliqué), aller-retour fichier et lien, réception,
  carte, jeu avec et sans objectif, remix puis réexport en défi.
- Hors de cette décision : nouveaux types d’objectif, machines dans la
  campagne, lecture en boucle, et remplacement de la projection de l’accueil.
