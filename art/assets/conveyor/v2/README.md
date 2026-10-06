# Convoyeur sans pieds — sources v2

Créé le 6 octobre 2026 avec l’outil intégré imagegen, à partir des deux
sources du convoyeur existant. Les originaux sont conservés. Les flèches
reprennent exactement le motif actuel, sans retouche.

Le nouveau contour est fermé et arrondi, sans pieds ni pièce débordante.
Les calques séparent les éléments fixes des éléments animables.
Visuel validé par l’auteur le 6 octobre 2026. Le jeu utilise désormais ces
calques : flèches défilantes et deux roues animées, châssis et caoutchouc fixes.

## Fichiers

| Fichier | Rôle | Dimensions source |
| --- | --- | --- |
| [conveyor-assembled.png](conveyor-assembled.png) | Référence du convoyeur complet | 2172 × 724 |
| [conveyor-frame.png](conveyor-frame.png) | Châssis, vis et caches d’axes fixes ; fenêtres transparentes | 2172 × 724 |
| [conveyor-arrows.png](conveyor-arrows.png) | Motif existant à faire défiler dans la fenêtre centrale | 2172 × 724 |
| [conveyor-wheel.png](conveyor-wheel.png) | Une roue à réutiliser aux deux extrémités | 1254 × 1254 |
| [conveyor-loop.png](conveyor-loop.png) | Courroie périphérique, intérieur transparent | 2171 × 724 |
| [preview.html](preview.html) | Aperçu assemblé et animé, pause, inversion et rotation par pas de 15° | — |
| [PROMPTS.md](PROMPTS.md) | Prompts complets et références utilisés | — |

Tous les PNG ont un canal alpha réel. Le damier de la page d’aperçu appartient
à la page, pas aux images. Ces fichiers sont des sources haute résolution,
pas les exports @2x limités à 60 Ko de l’application.

## Assemblage de l’aperçu

Les coordonnées ci-dessous sont des pixels des sources artistiques ; elles
ne sont ni des positions du domaine ni des données de niveau.

- Cadre de travail commun : 2172 × 724. La courroie de 2171 pixels de large
  est dessinée dans ce cadre commun, sans changer son fichier source.
- Ordre des calques : flèches, roues, châssis, courroie, puis repères mobiles
  optionnels sur la courroie.
- Centres des axes fixes mesurés sur le châssis : gauche `(207, 358)` ;
  droite `(1967,5, 358,5)`.
- La roue est centrée sur `(627, 627)` dans sa source ; l’aperçu la dessine
  dans un carré de 250,8 pixels autour de chaque axe, derrière les caches fixes.
- Fenêtre centrale de l’aperçu : `(361, 278)`, dimensions `1452 × 154`,
  masque arrondi. La bande reprend la période de 407 pixels et la tranche
  verticale `297..433` de la source actuelle.
- Courroie : boîte alpha mesurée avec le seuil 8 du pipeline existant,
  `(26, 172)..(2146, 548)`. Le contour visible englobe le châssis.

L’aperçu permet de voir les flèches et les deux roues en mouvement. Son option
« Repères mobiles sur la courroie » démontre un défilement sur le pourtour,
avec sens opposés en haut et en bas et continuité sur les arrondis. La courroie
ne se traite pas comme une image entière qu’on ferait tourner autour du centre.
Le rythme de l’aperçu est artistique et ne pilote aucune simulation.

## Intégration dans le jeu

`python3 art/build-conveyor-sprites.py` exporte uniquement cette famille à
128 px par unité monde, avec nettoyage de l’alpha au seuil 8 et compression
à moins de 60 Ko. L’export global réutilise cette fonction ; les autres
familles n’ont pas été régénérées pendant cette intégration.

Cadre monde commun : largeur 3, hauteur `376 × 3 / 2120` (0,532075).
Le renderer réutilise un seul PNG de roue deux fois, centré sur chaque axe.
Les roues tournent selon `beltOffset / (180 × 3 / 2120)` ; le défilement
reprend la même distance simulée. Arrêt, pause et reset suivent la simulation,
sans horloge graphique séparée. La bande compilée mesure 338 × 28 px :
fenêtre de 264 px plus une période de 74 px.

Le contour physique est une capsule pleine : rectangle central et deux
cercles, sans pieds. La vitesse de surface suit la tangente tout autour :
haut et bas en sens opposés, continuité sur les arrondis. Les directions sont
locales au placement ; une rotation de 180° retourne aussi les chevrons.
Les repères mobiles périphériques de l’aperçu restent facultatifs et ne
sont pas ajoutés au jeu : le caoutchouc est fixe, les roues montrent sa rotation.

Contrats : `docs/catalogue-initial.md` et ADR 0007. Tests :
`conveyor-rotation.test.ts` (24 angles, deux sens, 12 zones de contact),
`board-renderer.test.ts` (pivots et rotations) et `sprite-assets.test.ts`
(dimensions et budgets). Captures intégrées : `tmp/conveyor-integration/`.
