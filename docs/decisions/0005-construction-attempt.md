# ADR 0005 - Provenance éphémère d'une tentative de construction

Statut : accepté

Date : 2026-09-01

## Contexte

En résolution, retirer un objet placé depuis l'inventaire doit restituer exactement
l'entrée consommée. `LevelDocument v1` ne conserve pas cette origine et ne doit pas
mélanger l'intention persistante de l'auteur avec l'état d'une tentative du joueur.

## Décision

L'application manipule un `ConstructionAttempt` immuable et JSON-like contenant :

- le `LevelDocument` courant de la construction ;
- une table éphémère `placementId -> inventoryEntryId` nommée `provenance`.

Une nouvelle tentative clone et valide le niveau source puis commence avec une
provenance vide. Placer depuis l'inventaire ajoute la provenance dans la même
commande atomique que la création du placement et le décrément de quantité.
Retirer en mode joueur exige une provenance existante, une entrée source encore
présente et une définition identique (`type`, `props`, `permissions`) avant de
restituer la quantité. Retirer un objet fixe sans provenance reste possible pour
l'auteur, mais jamais pour le joueur. La balle et le panier référencés par
l'objectif ne peuvent être retirés dans aucun contexte.

Les commandes reçoivent explicitement le contexte `player` ou `author`. Le joueur
est contraint par les permissions persistantes et les zones de construction ; ces
règles de futur joueur ne bloquent pas l'auteur. La rotation reste une capacité des
poutres uniquement. Chaque document produit est revalidé par le schéma
`LevelDocument v1` avant acceptation, et chaque refus retourne un code d'erreur
stable sans mutation partielle.

Pour la v1, un placement ou un déplacement est dans une zone lorsque le centre de
sa transformée appartient à au moins un rectangle, bornes incluses. Vérifier la
géométrie complète attend les dimensions provenant du futur catalogue physique ;
elles ne sont pas disponibles dans le contrat persistant actuel.

## Amendement du 26 septembre 2026

Cet amendement remplace la règle précédente du centre seul. En contexte `player`,
la pose, le déplacement et la rotation sont acceptés uniquement si les quatre
coins de l’empreinte complète transformée appartiennent à une même zone de
construction. Les bords sont inclus. Un objet ne peut pas répartir son empreinte
entre deux zones adjacentes. Le calcul utilise une tolérance limitée à l’erreur
numérique des coordonnées flottantes pour préserver l’inclusion aux bords après
rotation. Le contexte `author` reste sans contrainte de zone.

Les empreintes locales sont celles de `src/domain/family-geometry.ts` : balle
(bornes de son cercle, inchangées par la rotation), panier, poutre selon sa taille,
bascule (planche et pied, depuis le pivot), masse, levier selon sa position
initiale, convoyeur, bouton, ventilateur (corps), barrière selon son état ouvert
ou fermé, et tremplin. Pour les formes rectangulaires, la rotation s’applique
autour de l’origine du placement avant le contrôle des quatre coins.

## Conséquences

- `LevelDocument` reste partageable sans historique d'une partie particulière ;
- l'historique porte le document et sa provenance ensemble, donc annuler et
  rétablir restaurent atomiquement objets et quantités ;
- recharger uniquement un `LevelDocument` recommence une tentative et perd, par
  conception, la possibilité de retirer comme inventaire les objets fixes ;
- une future sauvegarde de partie devra sérialiser une enveloppe de session
  versionnée distincte, sans ajouter la provenance au niveau ;
- le confinement par forme complète devra remplacer le test du centre lorsque le
  catalogue physique fournira des dimensions testables.

## Contrat de reprise proposé — C2

La [proposition ADR 0017](0017-player-construction-and-async-storage.md)
détaille l’enveloppe de construction qui pourrait persister document et
provenance ensemble, hors du `LevelDocument` partageable. Elle distingue
le codec de tentative consommée du codec de niveau source et exige leur
validation relationnelle. **Statut proposé : aucun détail C2 n’est acquis
par ce renvoi**, notamment les trois arbitrages produit en attente.
