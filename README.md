# TinkerBolt

TinkerBolt est un jeu de puzzles mécaniques en 2D : place des objets, règle leurs
mécanismes, lance la simulation et guide la balle jusque dans le panier.

## Licence

Le code de TinkerBolt est distribué sous la GNU Affero General Public License,
version 3 ou ultérieure (`AGPL-3.0-or-later`). Le texte complet est dans
[`LICENSE`](LICENSE). Le [dépôt source](https://github.com/alexisflesch/tinkerbolt)
contient le code de l’application ; les dépendances et ressources tierces restent
soumises à leurs propres licences.

Le contenu de niveau (les niveaux embarqués dans la campagne comme ceux qu’on
partage depuis l’application) est sous licence
[Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/deed.fr) :
d’autres peuvent le modifier et le republier en citant son auteur. La licence
n’est pas un champ du fichier de niveau ; elle est rappelée au moment de
partager. Elle ne couvre pas les sprites et illustrations de `art/` et de
`public/assets/`. La décision est dans
[l’ADR 0016](docs/decisions/0016-attribution-licence-niveaux.md).

La police de l’interface, Nunito (© 2014 The Nunito Project Authors), est
embarquée dans `public/fonts/` sous
[SIL Open Font License 1.1](public/fonts/OFL.txt). La police des titres,
Baloo 2 (© 2019 The Baloo 2 Project Authors), l’est sous la même licence
([texte](public/fonts/Baloo2-OFL.txt)).

La v1 desktop est validée pour le fonctionnement du core de l’application.
Les détails visuels seront réévalués avec l’auteur lors d’une prochaine reprise.
La campagne contient cinq tutoriels conçus par Bolt, avec leurs solutions
vérifiées ; l’Atelier permet de créer, essayer, modifier, sauvegarder et
partager des niveaux localement. L’interface téléphone sera reprise en v2.

La page « Mes niveaux » rassemble, sur l’appareil, les niveaux reçus par lien ou
par fichier et les créations du joueur. On y importe un fichier, on joue un
niveau reçu, on le partage à nouveau ou on le remixe dans l’atelier, qui garde
l’auteur et les sources d’origine ; une création se modifie, se joue, se
duplique et se partage avec un nom, une description et un pseudo facultatif.
Tout reste dans le navigateur ([ADR 0015](docs/decisions/0015-mes-niveaux.md)).

Pour créer un puzzle jouable, marque les objets que le joueur devra poser
avec « À placer » dans leurs propriétés. À l’export, l’Atelier vérifie que ta
construction atteint le panier ; le fichier et le lien partagés gardent la
solution cachée au joueur.

## Développement

Pré-requis : Node.js 24 et pnpm 11.

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Pour vérifier le projet :

```bash
pnpm check:fast  # typecheck, lint et tests unitaires
pnpm check       # gate complète, build et tests E2E du projet desktop v1
```

Le projet Playwright `mobile` reste disponible hors gate : après `pnpm build`,
il se lance avec `pnpm exec playwright test --project=mobile`.

Le build de production se lance avec `pnpm build`, puis peut être servi avec
`pnpm preview`.

## Organisation

- `src/domain/` contient le modèle de niveau et les règles métier ;
- `src/application/` contient les commandes, l’historique et les cas d’usage ;
- `src/simulation/` contient la simulation physique déterministe ;
- `src/presentation/` contient la projection et le rendu du plateau ;
- `src/ui/` et `src/app/` composent l’interface ;
- `src/content/levels/` contient les niveaux embarqués ;
- `docs/index.md` indique la source de vérité à consulter pour chaque sujet.

Les décisions d’architecture, l’état livré et les tâches restantes sont
documentés dans [`docs/`](docs/), notamment [`docs/etat.md`](docs/etat.md) et
[`docs/feuille-de-route.md`](docs/feuille-de-route.md).

Le suivi des versions, le changelog et la procédure de release sont décrits dans
le [`CHANGELOG.md`](CHANGELOG.md) et [`docs/release-process.md`](docs/release-process.md).

## Déploiement

Le workflow [Déploiement GitHub Pages](.github/workflows/deploy-pages.yml)
publie automatiquement le build lors d’un push sur `main`. Le chemin de base
est calculé à partir du nom du dépôt, ce qui permet aussi de lancer TinkerBolt
localement à la racine.
