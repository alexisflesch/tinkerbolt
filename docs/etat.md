# État du dépôt — TinkerBolt

Mis à jour le 6 octobre 2026. Ce fichier décrit ce qui est effectivement livré,
les limites connues et la dernière gate. Les décisions appartiennent aux ADR ;
le travail restant est ordonné dans `feuille-de-route.md`. Les anciens journaux
sont consultables dans l’historique Git, avant le nettoyage documentaire.

## Application livrée

Le core desktop v1 est validé par l’auteur. La campagne contient **sept
tutoriels** et l’Atelier ; neuf documents sont validés par `content:check` (dont la démo de l’accueil).
Les sources auteur dans `levels/` et les niveaux embarqués dans
`src/content/levels/` sont conservés, ainsi que les fixtures de régression.

- Plateau commun au jeu et à l’éditeur, Canvas 2D, caméra en unités du monde,
  simulation Planck à pas fixe 1/60 s, snapshot distinct du document édité.
- Construction avec inventaire, pose, déplacement, rotation et suppression,
  historique annuler/rétablir, taille de poutre par glissement aimanté aux
  trois variantes. Les permissions et zones sont validées dans le domaine.
- Fils de commande, bouton, levier, convoyeur, ventilateur et barrière ;
  caisses bois/métal, électroaimant, piston et minuteur sont intégrés et testés.
  Un minuteur intermédiaire retarde les transitions d’un fil logique unique.
- Objectif de panier, victoire, pause, reprise et retour à la construction.
  Le haut de la scène est ouvert ; sortie latérale/basse et durée maximale
  terminent une tentative. Les règles précises sont exécutables dans le domaine
  et la simulation.
- Atelier libre et création de puzzle : objets « À placer », essai joueur,
  export avec solution vérifiée, fichier et lien, solution cachée en jeu.
  Import, partage, duplication, réception et remix depuis « Mes niveaux ».
  « Atelier » rouvre la dernière création modifiée ; nom et description se
  saisissent dans l’atelier ; « Nouveau niveau » en commence une autre (ATL1,
  validation visuelle attendue).
- Niveaux « Machine » (ADR 0020, MACH1) : `goal` et ses identifiants sont
  facultatifs en v3 (`hasCompleteGoal`, `isMachine`) ; le catalogue de l’atelier
  pose et retire balle rouge et panier ; l’export propose « Défi » ou « Machine »,
  une machine se reçoit, se regarde (sans objectif complet, ni victoire ni échec,
  arrêt à la durée maximale) et se remixe depuis la barre. Validation visuelle
  auteur attendue (boîte d’export, carte « Machine », bouton « Remixer »).
- IndexedDB/Dexie pour progression, préférences, créations, niveaux reçus et
  constructions engagées. Reprise avant simulation, barrières avant navigation
  et reset atomique progression/constructions. Les erreurs de stockage ne
  bloquent pas le jeu en mémoire et n’écrasent pas des données inconnues.
- Format `LevelDocument` **v3**, migrations v1→v2→v3 par codecs validés.
  Aucune reprise de l’ancien stockage `localStorage`, sur décision auteur.
- Identité graphique de l’accueil, du plateau, des pages et Paramètres,
  Bolt à l’accueil/victoire, catalogue par catégories, poignées harmonisées,
  splash avec progression réelle, sept niveaux annoncés et cadrage utile.
- Démo de l’accueil issue de `levels/demo-landing.json`, simulée sans panier,
  balle rouge ni bascule, hors campagne et progression. Pause/reprise, suspension
  hors onglet visible et réduction des animations ; validation visuelle auteur attendue.
- PWA installable, précache des assets/campagne/polices et navigation hors
  ligne. Invitations d’installation et de mise à jour en phase sûre.
- Version applicative dans `package.json` ; le panneau À propos affiche version
  et SHA du build (`-dirty` si modifié, `local` sans Git). Changelog et contrôle
  de cohérence sont en place depuis `9f4ec8f`.

## Outillage et déploiement

Les versions exactes sont dans `package.json` et `pnpm-lock.yaml` : Node 24,
pnpm 11, TypeScript strict, React, Vite, Zod, Planck, Dexie. Vitest/Testing
Library et Playwright couvrent domaine, intégration et navigateur ; ESLint,
Prettier, Knip et validation du contenu composent la gate.

`.github/workflows/check.yml` lance `pnpm check` sur push et pull request.
GitHub Pages déploie chaque push sur `main` sous `/tinkerbolt/`, avec repli des
routes profondes via `404.html`. La procédure de release est dans
`release-process.md` et la politique dans l’ADR 0003.

Le code est AGPL-3.0-or-later ; les niveaux sont CC BY 4.0 (ADR 0016).
Les polices embarquées et leurs licences restent dans `public/fonts/`.
L’intégralité de `art/`, ses sources et scripts d’export, est conservée. Les
propositions d’évolution Gemini, Astra et Canary restent dans `docs/archives/`
pour mémoire, sur demande explicite de l’auteur ; elles ne sont pas des contrats.

## Travail restant et limites

- **C7d** : recherche et filtre Tous/Créations/Reçus dans Mes niveaux.
  Pas de tri demandé. La maquette d’identité utile reste disponible.
- **C10** : recette visuelle de l’auteur sur les compléments desktop et
  l’identité actuelle ; ne pas confondre gate verte et validation visuelle.
  Examiner la poignée de taille sans action en résolution et discuter les
  zones/scènes selon la feuille de route.
- **Téléphone/tablette M0–M4** : conception à valider avant code ; le projet
  Playwright `mobile` reste lançable manuellement, hors gate desktop v1.
  Le comportement des chargeurs de sprites doit encore être vérifié sur le
  vieux Xiaomi signalé par l’auteur ; aucune matrice physique validée.
- **Forge/Grist F0–F3** : hébergement cible et mécanisme Q8 à confirmer,
  consentement/licence, réception et modération à prototyper. Aucun backend
  ajouté au jeu et aucun transfert de données entre origines prévu.
- **Objectifs v4** : plusieurs balles/paniers, maintien à l’écran, caisse à
  déplacer et autres objectifs restent des propositions, pas des contrats.
- L’éditeur ne fournit pas encore l’ensemble des commandes d’auteur pour
  gérer scène, zones, inventaire et objectif. La solution joueur ne retient
  pas le déplacement d’un objet du décor.
- L’autosauvegarde enregistre chaque état engagé ; la limitation à une fois
  par seconde existe mais n’est pas raccordée, pour ne pas perdre le dernier
  état. Sans stockage disponible, la création continue en mémoire avec avis.
- Export pendant simulation : fichier/lien possibles, mais les commandes de
  titre/pseudo/description sont refusées. Cas rare non couvert en navigateur.
- Une création de campagne se recrée depuis l’origine en supprimant la
  création puis en choisissant Modifier. Les copies remixées gardent leurs
  propres identifiants après remise à zéro de la progression.
- Le marquage de défi existe ; les sept tutoriels actuels n’en déclarent pas.
- Les sources de poutres n’ont pas toutes le rapport de leur empreinte ; une
  régénération générale des sprites produit aussi des octets différents pour
  certains boutons, leviers et balles. Ne pas relancer `art/build-sprites.py`
  sans audit ; Pillow/numpy/pngquant sont hors gate.
- Attribution longue tronquée en petit format ; position du bouton Modifier
  et encombrement des propriétés à réévaluer pendant le chantier téléphone.
- Sur un plateau déjà modifié, l’invitation de mise à jour attend l’accueil ou
  un autre plateau. Le rechargement après Mettre à jour est couvert par le
  test applicatif, pas par un parcours navigateur dédié.
- Des timeouts E2E sous forte surcharge ont été observés ; les attentes
  synchronisées ont été corrigées. Ne pas affaiblir les tests pour les masquer.
- `format:check` ne couvre pas le Markdown. Le peer TypeScript `<6` annoncé
  par `typescript-eslint@8.42.0` reste à traiter lors d’un lot dépendances.

## Maintenance livrée le 5 octobre 2026

`pnpm release X.Y.Z` automatise les releases stables : préconditions Git/GitHub,
préparation version/changelog, gate, commit ciblé, tag annoté, push atomique et
GitHub Release via le workflow « Release GitHub » après réception du tag.
La commande locale utilise les identifiants Git du push, sans `gh auth login`.
L’aperçu `pnpm release 0.2.0 --dry-run` passe sans mutation.
`tmp/`, déjà ignoré par Git, est exclu du lint et du formatage ; le scratch de
l’auteur reste identique.

131 fichiers obsolètes ou redondants ont été retirés (environ 51,5 Mio).
La documentation restante occupe environ 3,1 Mio. Les demandes ouvertes sont
consolidées dans la feuille de route ; les liens locaux sont vérifiés. Les
propositions Gemini/Astra/Canary et les sources de la maquette d’identité restent
identiques. Le manifeste de `art/` confirme 91 fichiers et permissions inchangés.
Les corrections de références dans dix fichiers TS/TSX émettent exactement le
même JavaScript qu’avant nettoyage ; aucun comportement produit n’est modifié.

La version reste `0.1.0` jusqu’à l’exécution réelle de la release `0.2.0`.
Les notes sont prêtes dans « Non publié ». Aucun tag ni push n’a été effectué :
le push doit être lancé depuis une machine authentifiée auprès du dépôt Git.

## Dernière gate

Après les lots MACH1, CARTES1, UI3, ATL1 et UI1 du 6 octobre, la validation
visuelle de l’auteur reste attendue pour les lots concernés. Aucun commit ni
push n’a été effectué.

`pnpm check --config=/tmp/tinkerbolt-catalogue-preview.config.ts` après MACH1,
6 octobre 2026 : **vert** — contrôle version/changelog, typecheck, lint,
formatage, Knip, validation de neuf niveaux embarqués,
**1503 tests Vitest dans 119 fichiers**, build et **118 E2E v1**.
La configuration externe utilise Chromium 151 déjà installé ; aucun changement
d’outillage dans le dépôt. Les tests d’en-tête et du catalogue consignés
auparavant en échec passent après un build frais.
Validation visuelle de l’auteur toujours attendue pour les lots concernés.
