# ADR 0008 - Routage côté client

Statut : accepté

Date : 2026-09-25

## Contexte

`src/app/App.tsx` pilotait toute la navigation (menu, liste des niveaux,
atelier, résultat) avec une poignée de `useState` booléens locaux
(`isMenuOpen`, `isLevelListOpen`) et des fonctions impératives
(`loadLevelOne`, `loadWorkshop`, `returnToLevels`) qui recréaient directement
la session. Aucune de ces destinations n'avait d'URL propre : ni retour
navigateur, ni lien partageable, ni rechargement fidèle à l'écran courant.

L'auteur du produit a demandé l'installation de routes pour simplifier ce
code et parce que d'autres destinations évidentes arrivent à court terme :
réglages, éditeur de niveaux, liste de niveaux, un niveau joué. ADR 0003 §
Politique de dépendances liste explicitement le routeur parmi les dépendances
non décidées et exige qu'une dépendance structurante passe par une ADR — la
présente décision comble ce point ouvert.

`cahier-des-charges.md` § Persistance, partage et évolution communautaire et
`architecture.md` § Stockage et partage réservent déjà le fragment d'URL
(`#...`) au codec de partage de niveau versionné et protégé par somme de
contrôle. Un routeur basé sur le hash (`#/route`) entrerait donc en collision
avec ce contrat existant : il est exclu d'office, indépendamment du choix de
bibliothèque.

## Décision

- Router côté client par chemin (History API), jamais par fragment : le
  fragment reste entièrement disponible pour le codec de partage de niveau.
- Bibliothèque retenue : `react-router-dom`, épinglée exactement à `7.18.4`
  dans `dependencies` (compatible React 19, sans avertissement de peer
  dependency propre à ce paquet). Alternative écartée : un routeur maison
  minimal, qui aurait évité une dépendance mais reporté sur le dépôt la
  gestion de `popstate`, du focus et des cas limites d'historique qu'une
  bibliothèque mature couvre déjà et teste en dehors de ce projet.
- Schéma d'URL, en anglais comme demandé par l'auteur :
  - `/` — accueil de l’application, avec accès aux routes publiques et reprise
    de la campagne (amendement du 1er octobre 2026) ;
  - `/levels` — liste des niveaux de la campagne ;
  - `/levels/:levelId/play` — un niveau joué ; `levelId` est l'`id` du
    `LevelDocument`, jamais un identifiant inventé séparément ;
  - `/editor` — l'atelier de création libre (`embeddedWorkshopDocument`) ;
  - `/import` — import d'un fichier JSON de niveau vers un nouveau brouillon ;
  - `/settings` — réglages ; page provisoire tant qu'aucun réglage réel
    n'existe (depuis U11 : pseudo retenu et remise à zéro de la progression,
    amendement du 2 octobre 2026) ;
  - toute autre route redirige vers `/levels`.
- `<BrowserRouter>` est monté par `App.tsx`, qui ne contient plus que la
  déclaration des routes. Chaque route mène à une page de `src/app/`
  (`LevelsPage`, `PlayLevelPage`, `EditorPage`, `SettingsPage`) qui initialise
  la session d'édition depuis le document approprié ; la construction de
  l'écran plateau partagé (`BoardShell`) reste un composant unique factorisé
  entre `PlayLevelPage` et `EditorPage`.
- Le menu ☰ (`AppHeader`) devient un vrai déclencheur de navigation
  (`useNavigate`) vers ces routes plutôt qu'un état local dupliquant ce que
  l'URL sait déjà représenter.

## Conséquences

- Les quatre écrans sont désormais adressables individuellement : lien
  partageable, retour/avant navigateur fonctionnels, rechargement fidèle.
- Cette tranche a corrigé un bug latent révélé par elle :
  `spriteAssetPath` (`src/presentation/sprite-loader.ts`) construisait un
  chemin relatif (`./assets/sprites/...`), qui ne se résolvait correctement
  que parce que l'application ne vivait auparavant qu'à `/`. Une route
  imbriquée comme `/levels/level-1-laisser-tomber/play` le résout contre le
  mauvais préfixe et les sprites échouent silencieusement à charger. Corrigé
  en chemin absolu (`/assets/sprites/...`), cohérent avec le fond CSS qui
  utilisait déjà cette convention ; couvert par un test dédié dans
  `sprite-loader.test.ts`.
- Un hébergement de fichiers statique sans réécriture (« hébergement de
  fichiers » au sens large de `cahier-des-charges.md`) doit servir
  `index.html` pour toute URL inconnue, sous peine de 404 au rechargement
  d'une route profonde. Le serveur de développement et `vite preview`
  (`appType` par défaut de Vite) le font déjà sans configuration
  supplémentaire ; l'hébergement de production choisi devra être configuré en
  conséquence (réécriture générique ou `404.html` de secours). Ce point reste
  ouvert au choix d'hébergement, pas à cette ADR.
- `react-router-dom` rejoint la liste des dépendances sensibles à faire
  passer par les suites complètes lors d'une mise à jour (même statut que
  React, Vite, Zod dans ADR 0003).
- `docs/decisions/0003-project-bootstrap.md` § Ce qui reste non décidé est mis
  à jour pour retirer le routeur de la liste ouverte et renvoyer ici.

## Amendement du 26 septembre 2026

- Routes ajoutées, absentes des menus : `/bench` et `/bench/play`, la page de
  mesure de performance de la porte de l'ADR 0002 ; `/shared` est prévue par
  l'ADR 0011.
- **Chemin de base.** L'application peut être servie sous un sous-chemin
  (GitHub Pages : `/tinkerbolt/`). Le build lit `TINKERBOLT_BASE_PATH` (défaut `/`) ;
  Vite préfixe alors JS, CSS et `url()` des feuilles de style, `BrowserRouter`
  reçoit `basename={import.meta.env.BASE_URL}`, et les chemins d'assets publics
  passent par `publicAssetUrl` (`src/presentation/sprite-loader.ts`).
- **Hébergement.** GitHub Pages, par `.github/workflows/deploy-pages.yml`, avec
  `404.html` copié d'`index.html` comme repli des routes profondes. Cela tranche
  le repli 404 laissé ouvert ci-dessous.

## Amendement du 27 septembre 2026 (U17)

- `/editor?draft=<id>` ouvre dans l’atelier le brouillon L26 d’identifiant
  `<id>` (ADR 0011). Le paramètre est non fiable : le dépôt de brouillons
  valide l’identifiant et décode le document par le codec de fichier ; un
  brouillon absent ou illisible affiche une erreur avec un lien vers la liste.
  Sans paramètre, `/editor` reste l’atelier libre.

## Amendement du 1er octobre 2026 — accueil

À la demande de l’auteur, `/` affiche une landing dans le style de l’application
au lieu de rediriger vers le premier niveau. Elle donne accès à `/levels`,
`/editor`, `/demo` (supprimée le 2 octobre 2026) et `/settings`. Les routes techniques `/bench` et `/bench/play`
restent absentes de la navigation publique ; `/shared` nécessite son fragment
de partage et ne constitue pas une destination autonome de l’accueil.

La commande principale ouvre le premier niveau accessible non résolu, ou la
liste des niveaux une fois la campagne terminée. Les statistiques de l’accueil
utilisent la progression déjà validée par le repository et le contexte existants
(ADR 0010 et ADR 0011), sans nouveau stockage. Le menu partagé propose « Accueil »
pour revenir à `/` depuis chaque écran. Cette demande explicite autorise la
mise en page de l’accueil indépendamment de l’ordre de reprise de la feuille de route.

## Amendement du 1er octobre 2026 — import de niveau

À la demande de l’auteur, le menu partagé propose « Importer un fichier JSON » et
ouvre `/import`. Cette page valide le fichier avant de créer un brouillon ; elle
ne remplace aucun brouillon existant. Le niveau validé s’ouvre ensuite dans
`/editor?draft=<id>` selon les règles de l’ADR 0011.

## Amendement du 1er octobre 2026 — « Mes niveaux » (ADR 0015)

- `/my-levels` : page « Mes niveaux », présente dans le menu partagé et sur
  l’accueil ; sections « Mes créations » et « Niveaux reçus ».
- `/my-levels/:id/play` : un niveau reçu joué ; `id` vient de l’URL, il est non
  fiable et ne sert qu’à une lecture du dépôt des niveaux reçus. Un identifiant
  inconnu affiche une erreur avec un lien vers `/my-levels`.
- `/import` redirige vers `/my-levels`, qui porte l’import de fichier ;
  l’entrée « Importer un fichier JSON » du menu disparaît.
- `/editor` sans paramètre : à la première modification engagée, l’URL est
  remplacée par `/editor?draft=<id>` de la création enregistrée.

## Amendement du 2 octobre 2026 — paramètres (U11)

`/settings` n’est plus vide. La page montre deux réglages, et seulement eux :
le pseudo retenu (ADR 0016 § Pseudo), à voir, modifier ou effacer, et
« Remettre la progression à zéro », qui efface la progression de campagne
(ADR 0010, ADR 0011) après une confirmation. La route ne change pas.

## Ce qui reste non décidé

- Tout autre réglage de `/settings` : U11 n’y a mis que le pseudo retenu et la
  remise à zéro de la progression, sans inventer d’autre réglage.
- La stratégie exacte de repli 404 → `index.html` pour l'hébergement de
  production final.
- Le routage imbriqué (sous-routes de l'éditeur, par exemple) : aucun besoin
  concret ne le justifie encore.

## Références officielles consultées

- [Documentation react-router-dom (v7)](https://reactrouter.com/)

## Amendement du 2 octobre 2026 — suppression de `/demo`

La route `/demo`, sa page et son niveau embarqué sont supprimés (feuille de route
v1, décision 4). Une URL `/demo` retombe sur le repli `*` et redirige vers
`/levels`. L'accueil et le menu ne la proposent plus, et le repli hors ligne de
la PWA ne la liste plus. `/bench` et `/bench/play` restent, hors menu.

## Amendement du 2 octobre 2026 — navigation et vocabulaire (V3)

- Le bloc « TinkerBolt » de l’en-tête est un lien vers `/` (nom accessible
  « TinkerBolt, accueil »).
- Le menu partagé liste, dans cet ordre, les cinq entrées du lexique de la v1 :
  **Accueil** (`/`), **Campagne** (`/levels`), **Atelier** (`/editor`), **Mes
  niveaux** (`/my-levels`) et **Paramètres** (`/settings`). « Liste des niveaux »
  et « Atelier de construction » disparaissent ; les actions propres à l’écran
  restent en tête du menu.
- La commande principale de l’accueil, « Jouer », mène à `/levels` (et non plus
  au premier niveau non résolu : l’amendement du 1er octobre 2026 sur ce point
  est remplacé).
- `/import` est servi hors ligne par le repli de la PWA (ADR 0012).

## Amendement du 6 octobre 2026 — reprise de l’Atelier (ADR 0015)

- `/editor` sans paramètre rouvre la dernière création modifiée en remplaçant
  l’URL par `/editor?draft=<id>` ; sans création ouvrable, l’atelier libre.
- `/editor?new` ouvre toujours un atelier libre vierge.
