# C8 — Audit des assets et des raccords

**État : audit documentaire terminé.** L’auteur a confirmé le format `v3`, les
comportements C9, le modèle des caisses, les réglages du minuteur et l’ordre le
4 octobre 2026. Les valeurs d’équilibrage physique se règlent pendant chaque
intégration. Ce relevé n’est pas le propriétaire des décisions et ne crée pas
une séquence active ; les assets ne fixent aucune valeur physique.

## Inventaire rapproché

Le relevé des groupes d’images présents sous `art/assets/` en fait apparaître 17 : douze groupes raccordés aux onze familles actuelles (les deux groupes de balles partagent `ball`), quatre groupes candidats C9 et la mascotte Bolt. Les exports du dépôt sont sous `public/assets/sprites/`, comme le fixe `OUT` dans `art/build-sprites.py`.

| Groupe source                   | Sources repérées                                                                                                                                                                                                | Exports dans `public/assets/sprites/`                                                                           | Raccord vérifié ou statut                                                                                                                                           |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ball`                          | `ball-base.png`, `ball-highlight.png`, `ball-spin-pattern.png`                                                                                                                                                  | `ball-base@2x.png`, `ball-highlight@2x.png`, `ball-spin@2x.png`, `thumbs/ball.png`                              | Famille `ball` ; apparence rouge de la balle cible.                                                                                                                 |
| `second-ball`                   | `second-ball-base.png`, `second-ball-highlight.png`, `second-ball-spin-pattern.png`                                                                                                                             | `second-ball-base@2x.png`, `second-ball-highlight@2x.png`, `second-ball-spin@2x.png`, `thumbs/second-ball.png`  | Même famille `ball` ; seconde apparence chargée par le renderer, pas un nouveau type persistant.                                                                    |
| `basket`                        | `basket-back.png`, `basket-front.png`                                                                                                                                                                           | `basket-back@2x.png`, `basket-front@2x.png`, `thumbs/basket.png`                                                | Famille `basket`. Pas de carte `Panier` dans `authorCatalogue` : le commentaire de `src/app/object-catalog.ts` indique que le panier de l’objectif est déjà placé.  |
| `beam`                          | `beam-short.png`, `beam-medium.png`, `beam-big.png`                                                                                                                                                             | `beam-short@2x.png`, `beam-medium@2x.png`, `beam-long@2x.png`, `thumbs/beam.png`                                | Famille `beam`, avec `props.size` ; `beam-big` alimente l’export `beam-long`.                                                                                       |
| `seesaw`                        | `seesaw_beam.png`, `seesaw_fulcrum.png`                                                                                                                                                                         | `seesaw-beam@2x.png`, `seesaw-fulcrum@2x.png`, `thumbs/seesaw.png`                                              | Famille composée `seesaw`.                                                                                                                                          |
| `mass`                          | `mass-10kgs.png`                                                                                                                                                                                                | `mass-10kg@2x.png`, `thumbs/mass.png`                                                                           | Famille `mass`, propriété `weight: '10kg'`.                                                                                                                         |
| `lever`                         | `lever-base.png`, `lever-handle.png`                                                                                                                                                                            | `lever-base@2x.png`, `lever-handle@2x.png`, `thumbs/lever.png`                                                  | Famille `lever`.                                                                                                                                                    |
| `conveyor`                      | `conveyor-fixed-part.png`, `conveyor-moving-part.png`                                                                                                                                                           | `conveyor-frame@2x.png`, `conveyor-belt@2x.png`, `conveyor-belt-left@2x.png`, `thumbs/conveyor.png`             | Famille `conveyor` ; le script dérive l’export gauche par retournement horizontal.                                                                                  |
| `button`                        | `button-base.png`, `button-push-button.png`                                                                                                                                                                     | `button-base@2x.png`, `button-cap@2x.png`, `thumbs/button.png`                                                  | Famille `button`.                                                                                                                                                   |
| `fan`                           | `fan-fixed-part.png`, `fan-blades.png`                                                                                                                                                                          | `fan-body@2x.png`, `fan-blades@2x.png`, `thumbs/fan.png`                                                        | Famille `fan`. Le dossier contient aussi un `README.md`, non utilisé comme contrat dans cet audit.                                                                  |
| `barrier`                       | `tinkerbolt_barrier_fixed.png`, `tinkerbolt_barrier_mobile.png`                                                                                                                                                 | `barrier-pillar@2x.png`, `barrier-bar@2x.png`, `thumbs/barrier.png`                                             | Famille `barrier`.                                                                                                                                                  |
| `springboard`                   | `springboard_base.png`, `springboard_platform.png`, `springboard_spring.png`                                                                                                                                    | `springboard-base@2x.png`, `springboard-platform@2x.png`, `springboard-spring@2x.png`, `thumbs/springboard.png` | Famille `springboard`. Le dossier contient aussi un `README.md`, non utilisé comme contrat dans cet audit.                                                          |
| `boxes` — candidate C9          | `wooden-box.png`, `metallic-box.png`                                                                                                                                                                            | Aucun export repéré                                                                                             | Pas de variante ni de famille dans le schéma, le registre, la géométrie, le chargement/rendu, la simulation ou le catalogue consultés. Contrat confirmé ci-dessous. |
| `electro-magnet` — candidate C9 | `magnet-off.png`, `magnett-on.png`                                                                                                                                                                              | Aucun export repéré                                                                                             | Pas de famille raccordée dans les sources de code consultées. Le nom exact du second fichier est `magnett-on.png`. Contrat ouvert ci-dessous.                       |
| `piston` — candidate C9         | `piston-housing.png`, `piston-plate.png`, `piston-rod.png`                                                                                                                                                      | Aucun export repéré                                                                                             | Pas de famille raccordée dans les sources de code consultées. Contrat ouvert ci-dessous.                                                                            |
| `timer` — candidate C9          | `artwork-reference.png`, `time-background.png`, `timer-hand.png`                                                                                                                                                | Aucun export repéré                                                                                             | Pas de famille raccordée dans les sources de code consultées. Le dossier a aussi un `README.md` ; son contenu n’est pas utilisé comme contrat.                      |
| `bolt` — mascotte               | `bolt-explaining.png`, `bolt-neutral.png`, `bolt-sad.png`, `bolt-surprised.png`, `bolt-thinking.png`, `bolt-thinking2.png`, `bolt-thinking3.png`, `bolt-thinking4.png`, `bolt-victory.png`, `bolt-victory2.png` | Aucun export repéré dans `public/assets/sprites/`                                                               | Ne figure pas dans les familles d’objet consultées. La feuille de route rattache Bolt à C7 ; ce groupe reste hors des familles C9.                                  |

Les noms de couches et de vignettes ci-dessus sont rapprochés entre `art/build-sprites.py`, la liste des fichiers `public/assets/sprites/`, `src/presentation/sprite-loader.ts` et les choix de couches de `src/presentation/board-renderer.ts`. Le fichier `src/domain/level-document.ts`, le registre `src/domain/object-family-registry.ts`, `src/domain/family-geometry.ts` et le dispatch de `src/simulation/simulation-session.ts` exposent les onze familles existantes et aucune des quatre candidates. `src/app/object-catalog.ts` donne les types plaçables correspondants ; son catalogue auteur ne propose pas le panier comme carte.

## Dimensions mesurées des sources candidates

Dimensions en pixels du fichier PNG source, relevées avec `file` (dimensions IHDR). Elles ne déterminent ni la géométrie du collider ni les dimensions en unités monde.

| Candidate     | Fichier source                             |  Dimensions | Format/canal rapporté |
| ------------- | ------------------------------------------ | ----------: | --------------------- |
| Caisses       | `art/assets/boxes/wooden-box.png`          | 1254 × 1254 | PNG RGBA              |
| Caisses       | `art/assets/boxes/metallic-box.png`        | 1391 × 1131 | PNG RGBA              |
| Électroaimant | `art/assets/electro-magnet/magnet-off.png` | 1254 × 1254 | PNG RGBA              |
| Électroaimant | `art/assets/electro-magnet/magnett-on.png` | 1254 × 1254 | PNG RGBA              |
| Piston        | `art/assets/piston/piston-housing.png`     | 1254 × 1254 | PNG RGBA              |
| Piston        | `art/assets/piston/piston-plate.png`       | 1254 × 1254 | PNG RGBA              |
| Piston        | `art/assets/piston/piston-rod.png`         |  2172 × 724 | PNG RGBA              |
| Minuteur      | `art/assets/timer/artwork-reference.png`   |  2172 × 724 | PNG RGB               |
| Minuteur      | `art/assets/timer/time-background.png`     |  2170 × 725 | PNG RGBA              |
| Minuteur      | `art/assets/timer/timer-hand.png`          | 1254 × 1254 | PNG RGBA              |

Les dix PNG candidats ont été affichés pour confirmer les fichiers observés. Les différences visibles entre les variantes et couches sont des indices graphiques uniquement ; elles ne sont pas interprétées comme un contrat de jeu.

## Décisions produit C9 confirmées le 4 octobre 2026

Les règles ci-dessous viennent de l’auteur ; les ADR propriétaires sont
[0018](decisions/0018-level-document-v3.md),
[0019](decisions/0019-c9-object-contracts.md) et
[0009](decisions/0009-control-wires.md).

| Famille       | Comportement confirmé                                                                                                                                                                                       | Paramètres ou travail restant                                                                                     |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Caisse        | Une famille `box` avec variantes bois/métal ; seule la métallique est attirée. La bille en acier est hors périmètre C9.                                                                                     | Choisir forme, dimensions et masses par essais.                                                                   |
| Électroaimant | Commandé uniquement par un bouton, comme le ventilateur ; pas par le levier. Portée voisine de celle du ventilateur ou légèrement inférieure.                                                               | Mesurer l’attraction et régler portée/force dans une scène de jeu. Le ventilateur a une portée de 3 unités monde. |
| Piston        | Commandé uniquement par un bouton. Enfoncé : sortie et maintien en position. Relâché : retour à la position initiale. Un appui bref produit une sortie puis une rétraction ; la sortie propulse les objets. | Régler la course, la vitesse et la force pendant C9c.                                                             |
| Minuteur      | En Atelier, délai réglé en secondes entières de 1 à 10 s, valeur initiale 3 s ; en résolution, délai défini par le niveau et verrouillé. Chaque transition est retransmise après N secondes.                | Afficher le décompte en secondes et dixièmes ; le délai configuré reste entier.                                   |

### Expérience de câblage avec minuteur

L’auteur pose d’abord le minuteur, puis relie le contrôleur au minuteur et le
minuteur au dispositif. C’est **un fil logique**, une seule unité consommée dans
l’inventaire et deux segments visibles. Le minuteur s’insère en série et retarde
chaque changement d’état ; ce n’est ni deux fils indépendants ni un nouveau
contrôleur. Le temps reste mesuré au pas fixe.

### Format et ordre

- Le format v3 avec migration v2 → v3 est décidé ; v1 → v2 est conservée. La
  migration des constructions C3 persistées doit aussi préserver les tentatives
  v2 valides et distinguer une nouvelle version d’une source modifiée.
- L’ordre confirmé par l’auteur est **caisses → électroaimant → piston →
  minuteur**.
- Les dimensions et constantes physiques sont des choix d’équilibrage à tester,
  jamais déduits des images.

## Limites

L’audit rapproche les chemins, types, géométries, couches, dispatchs et dimensions des sources candidates. Il ne vérifie ni les boîtes alpha des images, ni les dimensions visuelles exportées, ni une géométrie physique proposée pour les candidates. Les dimensions des assets des onze familles existantes n’ont pas été mesurées. Aucun code, test de comportement, build, Playwright, export de sprite ou gate globale n’a été lancé pour C8.
