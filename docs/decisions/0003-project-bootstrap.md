# ADR 0003 - Bootstrap du projet

Statut : accepté

Date : 2026-09-01

## Contexte

Le dépôt doit devenir une PWA statique mobile-first, avec un éditeur et une
simulation partageant le même plateau. Le bootstrap doit fournir une boucle TDD
rapide et des garde-fous exécutables sans figer le moteur physique, le renderer du
plateau, la direction graphique ou des abstractions encore sans second cas réel.

Une configuration stricte n'est utile que si elle reste compréhensible et si la
même vérification peut être exécutée localement et en CI. Un empilement de packages
ou d'outils redondants augmenterait au contraire les faux positifs et les chemins
que les contributeurs et agents doivent connaître.

## Décision proposée

### Runtime et gestionnaire de packages

- utiliser Node.js 24 LTS pour le développement et la CI ;
- accepter uniquement la majeure 24 dans `engines.node` et consigner la version de
  référence dans un fichier reconnu par les gestionnaires de versions ;
- utiliser pnpm 11, épinglé à une version exacte dans `packageManager` ;
- committer un unique `pnpm-lock.yaml` et installer en CI avec
  `pnpm install --frozen-lockfile` ;
- déclarer le projet `private` et ESM avec `"type": "module"`.

Node.js 26 est encore en phase Current à la date de cette décision. pnpm 12 vient
de remplacer une grande partie de son implémentation par un binaire natif et son
tag npm par défaut reste pnpm 11. Les adopter immédiatement ne donne aucun bénéfice
produit. Leur évaluation se fera lors d'une mise à jour outillage dédiée, pas au
milieu d'une fonctionnalité.

La version exacte de Node utilisée par la CI et la version exacte de pnpm sont
mises à jour explicitement. Un intervalle non borné, `latest`, un lockfile régénéré
sans revue ou plusieurs gestionnaires de packages sont interdits.

### Build et application DOM

- utiliser Vite 8 pour le serveur de développement et le build statique ;
- utiliser React avec le plugin React officiel de Vite pour la coque DOM : écrans,
  tiroirs, formulaires, dialogues, focus et accessibilité ;
- ne pas utiliser React comme modèle de domaine, horloge de simulation ou renderer
  du plateau ;
- ne pas ajouter de gestionnaire d'état, routeur ou bibliothèque de composants tant
  qu'un besoin concret ne le justifie ;
- ne pas ajouter PixiJS, Planck.js ou Rapier au bootstrap.

React est retenu plutôt qu'une UI DOM maison : l'éditeur comporte assez d'état
d'interface, de formulaires et de contraintes d'accessibilité pour qu'une couche de
composants explicite soit utile. Sa maturité, ses outils de test et sa familiarité
réduisent aussi l'ambiguïté pour les contributeurs. Le coût de bundle supplémentaire
est acceptable face au renderer et au moteur futurs, mais devra être mesuré.

React ne peut être importé que par la couche UI et le point de composition. Les cas
d'usage restent du TypeScript indépendant du framework afin qu'un changement de
framework ne remette pas en cause le domaine ou le format des niveaux.

Le mécanisme de service worker n'est pas activé par un preset opaque pendant ce
bootstrap. Le manifeste web peut être posé tôt, mais la stratégie de précache,
d'activation d'une nouvelle version et de restauration des brouillons doit être
décidée et testée avant l'enregistrement du service worker. Cette décision a
depuis été prise par l'[ADR 0012](0012-pwa-service-worker.md), qui accepte
`vite-plugin-pwa` et Workbox pour le build PWA.

### Un seul package, plusieurs frontières

Le dépôt commence avec un seul package applicatif. Un workspace ou un monorepo ne
sera créé que lorsqu'un deuxième livrable déployable ou une bibliothèque réutilisée
indépendamment l'exigera. Les dossiers initiaux sont :

```text
/
|-- content/
|   `-- levels/             # niveaux JSON embarques
|-- e2e/                    # parcours Playwright
|-- public/                 # fichiers copies tels quels, sans logique
|-- scripts/                # validation/build du contenu et maintenance
|-- src/
|   |-- app/                # composition, cycle de vie navigateur
|   |-- application/        # cas d'usage, commandes, historique et ports
|   |-- domain/             # schemas Zod et regles pures
|   |-- infrastructure/     # IndexedDB, fichiers, URL et autres adaptateurs
|   |-- presentation/       # projection et futur renderer du plateau
|   |-- simulation/         # boucle fixe et port physique abstrait
|   `-- ui/                 # composants React et styles DOM
|-- test/
|   |-- fixtures/           # donnees partagees, petites et intentionnelles
|   `-- conformance/        # contrats transversaux et physique future
`-- docs/
```

Les tests unitaires sont colocalisés avec le code sous la forme
`*.test.ts`/`*.test.tsx`. `test/` ne contient que les fixtures et suites réellement
transversales. Les artefacts de build, rapports et captures de test sont ignorés.

Les imports entre couches passent par leurs API publiques explicites. Les imports
profonds entre deux couches, les cycles et les dépendances interdites par
`docs/architecture.md` échouent au lint. Les fichiers `index.ts` ne sont pas générés
automatiquement et ne doivent pas devenir des barils exportant tout un dossier.

Le placement exact des modules `ball`, `basket`, `beam` et `seesaw` reste ouvert
jusqu'à la définition de leur premier contrat exécutable. Il devra permettre la
colocalisation des éléments d'une famille sans autoriser le domaine à importer
React, le renderer ou un moteur physique.

### TypeScript et validation runtime

TypeScript est exécuté avec `strict` et sans émission lors du typecheck. Le socle
commun de compilateur, dont les options strictes activées au-delà de `strict`,
est défini dans `tsconfig.base.json`, qui fait autorité sur cette liste.

Une configuration navigateur et une configuration outillage étendent cette base
commune sans affaiblir ses options strictes. Vite transpile, mais ne remplace
jamais `tsc --noEmit` comme gate de types.

Zod est une dépendance de production et la source de vérité des données runtime.
Les types persistants sont inférés depuis les schémas lorsque possible. Toute
entrée JSON, IndexedDB, fichier ou URL commence en `unknown`, passe par un codec
borné puis par Zod et la validation sémantique. Les composants React et les
adaptateurs ne recréent pas de schéma concurrent.

### Tests

Vitest est le runner des tests unitaires, contractuels et d'intégration headless.
Son environnement par défaut est `node` afin que le domaine ne dépende pas
accidentellement du navigateur. Les rares tests de composants DOM utilisent un
environnement DOM déclaré fichier par fichier et Testing Library ; les gestes,
le layout, le canvas et les APIs navigateur restent vérifiés par Playwright.

Playwright couvre les parcours end-to-end sur le build de production servi
localement, pas uniquement sur le serveur HMR. Il fournit des projets séparés :

- Chromium tactile avec un petit viewport, obligatoire sur chaque changement ;
- Chromium desktop pour vérifier l'adaptation de l'interface ;
- Firefox et WebKit pour la suite complète avant livraison et régulièrement sur la
  branche principale.

Amendement du 2 octobre 2026 : pour la v1 (desktop d'abord), la gate E2E
(`test:e2e:critical`) cible le projet `v1` (Chromium desktop 1440 × 900 avec
`hasTouch`, specs `@mobile` exclues) au lieu du projet tactile `mobile`, qui reste
lançable à la main hors gate ; l'obligation du projet tactile revient en v2.

La matrice finale des appareils reste à décider dans le cahier des charges. Les
profils Playwright ne constituent pas à eux seuls une validation sur de vrais
téléphones. En CI, `forbidOnly` est actif, les retries sont limités et chaque
échec final publie trace, capture et rapport. Un test instable n'est ni ignoré ni
relancé indéfiniment : il est corrigé ou le changement reste bloqué.

Le bootstrap ne fixe pas un pourcentage global de couverture. Une cible arbitraire
encourage les assertions sans valeur. La couverture est produite pour rendre les
trous visibles ; des seuils par couche seront ajoutés dès qu'il existe assez de
comportement pour les calibrer, sans remplacer les contrats obligatoires de
`docs/qualite.md`.

### Lint, formatage et code mort

ESLint utilise la flat config et le service de projet de `typescript-eslint` pour
un lint type-aware, avec les presets stricts type-aware comme point de départ. Les
règles actives, dont les frontières de couches, font autorité dans
`eslint.config.ts`.

Le lint s'exécute avec `--max-warnings 0`. Une désactivation locale exige un
commentaire précis et respecte les exceptions de `AGENTS.md`; une désactivation de
fichier ou de configuration pour faire passer un changement est refusée.

Prettier est l'unique responsable du formatage. ESLint ne duplique pas ses règles
cosmétiques. La CI lance `prettier --check`; la commande d'écriture reste une action
locale explicite.

Knip détecte fichiers, exports et dépendances inutilisés. Ses entrypoints sont
configurés explicitement pour Vite, les scripts, Vitest et Playwright. Une
exception Knip doit nommer le consommateur dynamique qui la rend nécessaire. Knip
complète TypeScript et ESLint, il ne les remplace pas.

### Scripts `package.json`

Les noms de scripts et leur commande exacte sont définis dans `package.json`, qui
fait seul autorité sur cette interface. Ces noms forment l'interface stable du
dépôt : un script vide ou un `echo` de remplacement n'est pas acceptable, un nom
n'est ajouté que lorsque sa vérification existe. Ainsi, avant l'existence du
premier schéma et niveau, `content:check` et son appel depuis `check` ont été
ajoutés dans le même changement comportemental.

`check` est la gate locale et CI complète. Il enchaîne séquentiellement, dans
l'ordre déclaré par `package.json`, toutes les vérifications du dépôt ; il ne
masque pas les sorties des sous-commandes et s'arrête au premier échec.

Les suites plus lentes que celles de `check`, comme la matrice Playwright
complète, peuvent être lancées en plus, mais aucune CI ne réimplémente une
variante plus faible des commandes de `check`.

### Version de l’application et releases

`package.json` est la source de vérité de la version de l’application. Le
`CHANGELOG.md` maintient une section « Non publié » et des notes datées pour les
versions publiées, en décrivant les effets visibles pour les joueurs et les
créateurs de niveaux. La section `0.1.0` créée avec cette décision est une
référence de l’état actuel du dépôt, pas une release antérieure reconstituée.
Les refactorings sans effet notable ne nécessitent pas d’entrée.

La convention suit SemVer, avec une règle explicite pour le développement avant
la première stable : rester en `0.y.z`, incrémenter `z` pour les corrections et
`y` pour les nouveautés ou ruptures, en indiquant les incompatibilités dans le
changelog. `1.0.0` marque la livraison stable du jalon produit v1 (ordinateur).
Après `1.0.0`, une correction compatible incrémente `z`, une nouveauté compatible
incrémente `y` et une rupture de compatibilité incrémente `x`. Les jalons de
feuille de route (dont l’expérience téléphone v2) décrivent le périmètre produit ;
ils ne déterminent pas mécaniquement le numéro SemVer. La version de l’application
ne remplace ni ne modifie `LevelDocument.schemaVersion`, qui conserve son contrat
de migration indépendant.

Chaque release publiée synchronise `package.json` et la section datée du
changelog, passe `pnpm check`, puis reçoit un tag Git annoté `vX.Y.Z` sur le commit
de release. La commande sans dépendance supplémentaire `pnpm release X.Y.Z`
orchestre ces étapes depuis `main` propre, vérifie le tag et l’authentification
GitHub avant les mutations, puis pousse atomiquement `main` et le tag avant de
créer la GitHub Release. `pnpm release X.Y.Z --dry-run` affiche le plan sans
accès réseau ni mutation. La procédure opérationnelle et la reprise après échec
sont dans `docs/release-process.md`. La vérification `release:check`, intégrée à
`check`, confirme que la version du package est présente dans le changelog. Le
build affiche la version et le SHA court du commit dans « À propos » ; un checkout
modifié ajoute `-dirty`, et une source sans Git affiche `local`.

### Gates CI

Chaque pull request et chaque push sur la branche principale doivent :

1. installer Node et la version pnpm épinglée ;
2. exécuter `pnpm install --frozen-lockfile` ;
3. installer le navigateur Playwright requis ;
4. exécuter `pnpm check` ;
5. conserver les rapports utiles en cas d'échec.

La suite Playwright multi-navigateurs s'exécute sur la branche principale, avant
une livraison et de façon planifiée. La validation sur téléphones physiques devient
une gate de jalon dès que la matrice d'appareils est fixée.

Une CI ne lance pas de correction automatique, ne régénère pas le lockfile et ne
tolère aucun warning. Les contrôles dépendant du réseau, comme les advisories de
sécurité, sont planifiés et visibles mais ne sont pas intégrés à `check`, afin que
la gate reste reproductible hors ligne.

### Politique de dépendances

- toute dépendance directe est épinglée exactement et le lockfile est revu ;
- les dépendances runtime et de développement sont distinguées ;
- aucun import direct d'une dépendance transitive n'est autorisé ;
- aucune dépendance provenant d'une branche Git, d'une URL ou d'un tag flottant
  n'est acceptée en production ;
- les scripts d'installation des dépendances sont bloqués par défaut et chaque
  exception est explicitement approuvée ;
- une dépendance structurante exige une ADR ou une mise à jour d'ADR ;
- une dépendance plus petite exige au minimum une justification dans le changement,
  une licence compatible et un signal de maintenance acceptable ;
- les mises à jour sont groupées par sujet, jamais mélangées à une fonctionnalité ;
- Zod, React, Vite, le futur renderer, le futur moteur physique, IndexedDB et le
  service worker sont traités comme sensibles et passent leurs suites complètes.

### Amendement C2a — IndexedDB, 3 octobre 2026

L’ADR 0017 acceptée remplace les adaptateurs `localStorage` par IndexedDB :
**Dexie 4.4.6**, dépendance runtime épinglée, fournit les tables, transactions
et migrations de base. **fake-indexeddb 6.2.5**, dépendance de développement
épinglée, fournit une fabrique IndexedDB isolée pour les tests de repositories.
Les deux projets sont sous licence Apache-2.0 et maintenus ; versions retenues
vérifiées sur les [releases Dexie](https://github.com/dexie/Dexie.js/releases)
et [fake-indexeddb](https://github.com/dumbmatter/fakeIndexedDB/releases).

Dexie reste dans l’infrastructure. Les ports applicatifs retournent des
promesses de résultats, sans exposer tables ni transactions. Aucun transfert
de l’ancien stockage. Les empreintes et payloads sont préparés avant les
transactions : aucun appel asynchrone extérieur à IndexedDB dans leur portée,
conformément à la [documentation transactionnelle](https://dexie.org/docs/Dexie/Dexie.transaction()).
Les tests fake-indexeddb vérifient validation, réouverture et rollback ; les
parcours Playwright couvrent aussi le vrai IndexedDB du navigateur.
Les scripts d’installation restent bloqués ; aucune nouvelle exception.
Les nouvelles dépendances ne remplacent ni les codecs ni leurs migrations.

Un audit automatisé de vulnérabilités est utile comme signal, mais sa sortie n'est
pas assimilée aveuglément à une faille exploitable. Toute alerte affectant du code
livré est analysée, documentée et corrigée ou acceptée explicitement.

## Séparation du moteur physique

Le bootstrap crée seulement la frontière conceptuelle suivante :

```text
application/domain -> simulation a pas fixe -> port physique minimal
                                              ^
                                              |
                                      adaptateur choisi plus tard
```

Le port physique est défini à partir des besoins des scènes de conformité, pas en
copiant l'API de Planck ou Rapier. Aucun type, handle, vecteur ou callback propre à
un candidat ne traverse ce port.

Pendant l'ADR 0002, les adaptateurs candidats et leurs dépendances vivent dans un
espace de conformité hors du graphe d'import de l'application de production. Les
gates vérifient que l'entrée Vite ne peut pas les importer par accident. Après la
décision, un seul adaptateur rejoint le graphe de production et l'autre candidat
est retiré. Il n'y aura pas de sélection dynamique de moteur ni de façade visant à
supporter toutes leurs fonctions.

Cette séparation permet de commencer schémas, commandes, historique, UI tactile et
projection visuelle avant le choix physique, sans inventer une fausse simulation.

## Compromis

- Un seul package donne moins d'isolation qu'un monorepo, mais réduit fortement le
  coût de configuration. Les frontières sont compensées par TypeScript, ESLint et
  des imports publics vérifiés.
- React alourdit la coque par rapport à Preact ou au DOM nu, mais apporte un contrat
  de composants et un écosystème de test plus prévisibles. Il reste confiné à l'UI.
- Le lint type-aware et Knip ralentissent `check`; ce coût est accepté pour obtenir
  des erreurs actionnables avant le navigateur.
- Faire tourner un E2E tactile dans `check` impose l'installation d'un navigateur,
  mais garantit que la promesse mobile-first n'est pas réservée à la CI distante.
- L'épingle exacte rend les mises à jour plus explicites et moins automatiques ;
  c'est intentionnel pour les premiers schémas persistants et la simulation.

## Ce qui reste non décidé

- PixiJS ou un autre renderer du plateau ;
- Planck.js ou Rapier 2D, conformément à l'ADR 0002 ;
- wrapper IndexedDB ;
- gestionnaire d'état ou bibliothèque de composants, si un besoin apparaît
  (le routeur est tranché par [l'ADR 0008](0008-client-side-routing.md)) ;
- CSS Modules, CSS natif structuré ou autre convention de styles ;
- emplacement interne définitif des modules d'objets ;
- navigateurs, téléphones et budgets chiffrés de bundle/performance ;
- seuils de couverture par couche ;
- outil d'automatisation des mises à jour de dépendances.

Ces points ne bloquent pas le bootstrap de la chaîne TypeScript, React, Vite et des
gates de qualité. Chacun doit être tranché au plus tard dans le changement qui en a
besoin.

## Conséquences

- le premier changement de scaffolding peut être purement structurel mais doit
  faire fonctionner les scripts applicables, sans faux tests ;
- tout comportement suivant commence par un test en échec pour la bonne raison ;
- la direction graphique peut avancer en parallèle sous forme d'assets et de
  prototypes jetables sans devenir une dépendance du domaine ;
- un passage futur en workspace reste possible sans modifier les contrats du jeu ;
- le choix physique peut reposer sur des mesures plutôt que sur le coût déjà investi
  dans un candidat.

## Références officielles consultées

- [Calendrier des versions Node.js](https://nodejs.org/en/about/previous-releases)
- [Guide de démarrage Vite](https://vite.dev/guide/)
- [Annonce Vite 8](https://vite.dev/blog/announcing-vite8)
- [Installation et compatibilité pnpm](https://pnpm.io/installation)
- [Lint TypeScript avec informations de type](https://typescript-eslint.io/getting-started/typed-linting/)
- [Configuration Vitest](https://vitest.dev/config/)
- [Playwright en CI](https://playwright.dev/docs/ci)
- [Détection de code inutilisé avec Knip](https://knip.dev/overview/getting-started)
