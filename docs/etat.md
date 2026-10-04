# État du dépôt — TinkerBolt

Dernière mise à jour : 4 octobre 2026. V1 desktop clôturée (V0 à V9), core
validé par l’auteur. Nouvelle reprise C/M/F active : **C0, C1, C2, C2a, C3.1,
C3.2, C8 et C9a à C9d livrés**. La suite prioritaire demandée par l’auteur est
C7 puis C6, avant C4/C4a et C10. C5 est implémenté ; sa recette visuelle reste
différée. Dernière gate globale verte : 1 338 tests Vitest et 93 E2E v1. U3
reste abandonnée.

Ce fichier décrit l’état réel du dépôt : ce qui est livré, les dettes connues et
la dernière exécution de la gate globale. Il est réécrit à chaque fin de tâche
et ne contient ni décision ni spécification ; celles-ci restent dans
[le cahier des charges](cahier-des-charges.md) et les ADR du dossier
`decisions/`. Le travail restant et son ordre sont dans
[la feuille de route](feuille-de-route.md).

## Reprise active après la v1

La [feuille de route](feuille-de-route.md) porte seule les tâches C/M/F et
leur ordre. C0 raccorde index, backlog, architecture et ADR 0011/0015 aux
décisions confirmées : Dexie asynchrone, base vide sans transfert des anciennes
données locales, reprise automatique de la construction avant simulation.
C2a est livré : les quatre stockages utilisent désormais
Dexie avec ports asynchrones. Aucun transfert des anciennes données locales.
C3.1 ajoute l’enveloppe, le codec relationnel et le repository IndexedDB pour
les constructions. C3.2 charge et sauvegarde les tentatives de campagne et de
niveaux reçus, y compris `/shared`, avec des barrières avant navigation,
simulation, recommencement et reset de campagne. Les erreurs de stockage
laissent jouer en mémoire sans écraser un état inconnu. La gate globale finale
est verte : 1 236 Vitest et 92 Playwright v1.
Le contrat C2 est accepté dans l’[ADR 0017](decisions/0017-player-construction-and-async-storage.md) :
conserver après victoire, effacer progression et constructions de campagne au
reset, supprimer une construction incompatible avec une source modifiée sans
secours. C3.2 est terminé ; ses parcours sont consignés dans la feuille de route.
Les [maquettes C4/C4a](maquettes/complements-desktop/c4-c4a.html) et leurs captures
aux deux formats dans `tmp/c4/captures/` ont été examinées par l’auteur. Les
positions demandées sont corrigées : rotation au coin haut gauche, taille à
droite centrée ; la poursuite est autorisée. Aucun de ces nouveaux contrôles
n’est implémenté dans l’application. La recette visuelle est différée sur instruction de l’auteur ; elle ne bloque
pas l’implémentation autorisée. Les comportements principaux des nouvelles
familles sont confirmés ; leurs détails de modèle et d’équilibrage restent
consignés dans les tâches C9. Pour C9a à C9c, la recette visuelle est différée
selon l’instruction de l’auteur.
L’[audit C8](audit-assets-c8.md) rapproche les 17 groupes d’assets du code livré
et mesure les sources candidates. C8 est clôturé : les contrats auteur sont
consignés dans les ADR 0018/0019 et l’amendement 0009. C9 suit l’ordre accepté
caisses → électroaimant → piston → minuteur. C9a ajoute la famille dynamique
`box`, variante bois/métal, à géométrie commune 0,8 × 0,8 unité monde et masses
1/3 kg. C9b ajoute l’électroaimant : état initial `on/off`, état `on` par défaut
au catalogue, conservation de l’état sans fil, inversion temporaire par bouton
et attraction de la seule caisse métallique dans un rayon de 2,8 unités. C9c
ajoute le piston fermé au démarrage : un appui même bref déclenche la course
complète ; il reste sorti tant que le bouton est maintenu, puis se rétracte
automatiquement. Après le test de jeu, son gabarit est de 1,248 × 0,643 unité et
sa tête se déplace à 18 unités/s ; une balle dépasse l’écran vertical et le
puzzle de démonstration reste solvable. Sa plaque propulse les corps dynamiques.
C9d ajoute le minuteur à délai entier de 1 à 10 s, 3 s par défaut. Un fil
logique unique passe par lui et retarde l’activation comme la désactivation au
pas fixe. L’aiguille tourne autour du moyeu du cadran ; les secondes et
dixièmes apparaissent en segments ambrés. La bille en acier reste hors C9.
Le plan du 3 octobre conserve le contexte préparatoire ; V0–V9 ne sont pas
rouvertes. Le todo auteur reste intact ; le contenu des niveaux existants ne
change que par `schemaVersion: 3`. C9a ajoute les sprites et vignettes des deux
variantes de caisse.

C1 (`6150c94`, autre agent de l’auteur) corrige la pose après câblage dans le
tutoriel 3 : les identifiants des poses de la solution cachée sont réservés,
afin qu’un objet joueur ne les masque pas. Sa régression DOM et la gate globale
ont été vérifiées par l’orchestrateur. C2 est accepté après les arbitrages de
l’auteur. C5 synchronise désormais les
actions de victoire et la modale au délai existant de 600 ms, ou sans délai si
les animations sont réduites. Fermer la modale garde les actions disponibles ;
une nouvelle tentative ou la navigation annule l’ancien délai. Le résultat
d’un essai auteur reste immédiat. Captures aux deux formats desktop dans
`tmp/c5/captures/`, inspectées ; validation visuelle de l’auteur attendue.

## Arrêt et reprise — historique v1

La feuille de route v1 (desktop d’abord) est dans
[la feuille de route](feuille-de-route.md). **V0** (règle mobile-first suspendue,
archives, projet Playwright `v1`), **V1** (fin de N2 : Knip, test d’export,
copies des tutoriels vérifiées), **V2a** (route, page, contenu et tests de la
démonstration supprimés), **V2b** (parchemin et grille sur tout le viewport,
plus de perte par le haut) et **V2c** (repli hors ligne de `/my-levels`) sont
livrées, gate globale verte. **V3**
(navigation et vocabulaire : logo lié à l’accueil, « Jouer » → Campagne, lexique
Accueil · Campagne · Atelier · Mes niveaux · Paramètres, `/import` hors ligne ;
détails visuels à réévaluer en fenêtre fraîche) est livrée. **V5** (aperçu d’un
niveau :
`renderLevelPreview`, cache par empreinte, composant `LevelPreview`) est livrée.
**V6** (carte de niveau commune `LevelCard` avec aperçu, pour la campagne,
« Mes créations » et « Niveaux reçus » ; « Importer » et « Nouveau niveau » dans
le bandeau de Mes niveaux ; « Modifié le … » sur les créations ; détails visuels
à réévaluer en fenêtre fraîche) est livrée. **V7** (accueil de la maquette avec
l’aperçu réel du tutoriel 5 et la progression de la campagne ; en-tête
« Titre · Contexte » sans pastille ; scrollbar sable commune ; police Nunito
embarquée et précachée ; fonds retirés du précache ; atelier neuf « Nouveau
niveau » ; boîtes d’export au tutoiement ; détails visuels à réévaluer en
fenêtre fraîche) est livrée. **V7b** supprime la fiche de calibrage U28, son bouton
dans le catalogue, sa propagation et son CSS ; l'ouverture d'une nouvelle
création de campagne avec la solution révélée en développement reste couverte
par le test DOM `CampaignDraftEditing` et les tests de `openCampaignDraft`.
La version publiée garde la solution cachée à l'ouverture. Captures desktop
dans `tmp/v7b/captures/`.
La gate complète a trouvé une attente prématurée dans **U6 — remet l’atelier
à zéro** : `openWorkshop` cherchait « Atelier » pendant la navigation.
Le helper attend maintenant l'URL `/editor` et le plateau visible, puis
conserve l'assertion du texte. U6 passe seul après un nouveau build ; la gate
globale n'est pas relancée, à la demande explicite de l'auteur.
**V8** couvre maintenant le parcours complet du bêta-testeur sur desktop :
résoudre le tutoriel 1, le modifier, marquer une poutre « À placer », exporter
le puzzle vérifié en fichier et en lien, le recevoir dans un navigateur vierge,
le résoudre et remixer la construction gagnante. Fichier et lien sont validés
par leurs codecs et comparés ; une nouvelle réception conserve la victoire
sans doublon. Un troisième contexte reçoit le lien avec la solution cachée.
Les refus d'essayer et d'exporter sans objet « À placer » expliquent la marche
à suivre ; aucun changement de production nécessaire. Captures aux deux
formats dans `tmp/v8/captures/`, détails visuels à réévaluer en fenêtre fraîche.
La gate globale de V8 est verte, y compris U6 corrigé.
**V9** est terminée sur instruction de l'auteur : le fonctionnement du core
est validé et clôture cette reprise de la v1. Galerie dans
`tmp/v9/recette.html`, textes dans `tmp/v9/textes.md`, 136 captures pour
68 états aux deux formats desktop. README actualisé. Les retouches et les
détails visuels seront réévalués avec l'auteur dans une nouvelle fenêtre ;
aucune tâche de cette feuille de route ne reste en attente de validation.
Les mentions d'attente dans les comptes rendus de gates précédents décrivent
l'état au moment de leur exécution.
Les sources auteur et son fichier d’essai restent intacts ; rien n’est poussé.

## Stack en place

Node 24, pnpm 11.13.1, TypeScript 6 strict, Vite 8, React 19, React Router 7
(ADR 0008), Zod 4 et Planck 1.5.0. Vitest et Testing Library couvrent les tests
unitaires et DOM ; Playwright couvre le navigateur ; ESLint type-aware, Prettier
et Knip assurent les garde-fous statiques. Les versions exactes et scripts
exécutables sont dans [`package.json`](../package.json).

La gate `pnpm check` orchestre typecheck, lint sans warning, vérification du
formatage, code mort, validation du contenu, tests Vitest, build statique et E2E
du projet Playwright `v1` (desktop 1440 × 900 avec `hasTouch`, specs `@mobile`
exclues ; le projet `mobile` reste lançable à la main, hors gate). `pnpm check:fast` (typecheck, lint, Vitest) sert
pendant le travail.

## Licence

Le code de TinkerBolt est sous GNU AGPL version 3 ou ultérieure
(`AGPL-3.0-or-later`). Le texte intégral est dans [`LICENSE`](../LICENSE) ; le
README et `package.json` déclarent aussi cette licence. Les dépendances et
ressources tierces gardent leurs licences respectives.

Le contenu de niveau (campagne embarquée et niveaux partagés depuis
l’application) est sous CC BY 4.0 (ADR 0016) : le README la déclare à côté de
l’AGPL du code (M15) et la boîte d’export la rappelle au moment de partager
(M14). Ce n’est pas un champ du document de niveau. Les sprites et
illustrations de `art/` et `public/assets/` n’entrent pas dans cette
déclaration.

## Réellement livré et couvert par des tests

Les marques M1 à M14b renvoient aux tâches de la phase 1 « Mes niveaux »
(ADR 0015 et 0016) ; leur journal est dans
[la feuille de route](feuille-de-route.md) § 7.

### Domaine, format et attribution

- `LevelDocument v2` (schéma Zod strict dans `src/domain/level-document.ts`) :
  rectangle de scène obligatoire, onze familles (balle, panier, poutre, bascule,
  masse, levier, convoyeur, bouton, ventilateur, barrière, tremplin), inventaire,
  zones de construction, objectif panier unique, fils de commande `wires`
  facultatifs (ADR 0009). Migration v1 → v2 (`migrateLevelDocumentV1ToV2`)
  testée.
- Attribution M1 (ADR 0016) : `metadata.author` (pseudo de 1 à 40 caractères
  espaces de bord exclus, sans saut de ligne ni caractère de contrôle ;
  `authorSchema`, exporté) et `metadata.basedOn` (au plus 16 sources
  `{ title, author? }`), facultatifs en v2, absents de v1. Un document sans ces
  champs se relit à l’identique ; avec, il fait l’aller-retour par le codec de
  fichier et le codec URL, et `puzzleFromWorkshop` les conserve. Affichés en
  texte brut sur les cartes de « Mes niveaux » (M9) et dans l’en-tête de jeu
  d’un niveau reçu (M10) ; le titre et le pseudo se renseignent dans la boîte
  d’export depuis M14, la description depuis M14b, `basedOn` n’est jamais
  édité.
- Description M14b (ADR 0016) : `updateLevelDescription` (commande d’auteur
  annulable, refusée au joueur) ne retire plus que `description` et garde
  titre, `author` et `basedOn` ; elle ne rogne rien et refuse plus de
  2000 caractères. L’atelier libre (`workshop.json`) n’a plus de
  description : une création partie de zéro n’en a pas, une création issue
  d’un niveau garde celle du niveau.
- Empreinte M2 (ADR 0015) : `levelFingerprint(document)`
  (`src/infrastructure/level-file/level-fingerprint.ts`, asynchrone) renvoie les
  16 premiers chiffres hexadécimaux du SHA-256 (`crypto.subtle`) du texte du
  codec de fichier ; deux documents égaux ont la même empreinte et
  `recu-<empreinte>` respecte le schéma d’identifiant. Appelée par `/shared`
  et par l’import de fichier depuis M8 et M9.
- Géométrie des familles centralisée dans `src/domain/family-geometry.ts`,
  partagée par la physique et le rendu.
- `History` générique (commande atomique, undo/redo, no-op sans entrée,
  regroupement des prévisualisations).
- `ConstructionAttempt` : placement depuis l’inventaire, déplacement, rotation,
  propriétés, retrait, relier/délier un fil (le joueur avec un fil de son
  inventaire, rendu quand il le délie ; U21), pour les contextes joueur et auteur,
  avec permissions, zone de construction (empreinte entière contenue dans une
  même zone en contexte joueur), protection de l’objectif et provenance éphémère
  (ADR 0005).
- `EditorSession` : tentative, historique, sélection, manipulation groupée,
  phases construction/simulation/pause/résultat, reset exact.
- Évaluateurs purs : objectif panier (durée de maintien injectée) et échec de
  tentative (hors scène élargie de 2 unités à gauche, à droite et en bas — le
  haut est ouvert depuis V2b —, temps écoulé à 20 s simulées).
- Commandes auteur L25 : `src/application/construction/authoring-commands.ts`
  fournit les commandes annulables pour la scène, les zones, l’inventaire, les
  permissions, l’objectif, les métadonnées (titre, description M14b, pseudo
  M14 par `updateLevelTitle`, `updateLevelDescription` et
  `updateLevelAuthor`), le défi et l’ajout d’un objet hors inventaire. Elles
  sont refusées en contexte joueur et chaque document accepté est revalidé par
  le schéma. Seuls l’ajout d’objet et, depuis M14 et M14b, le titre, la
  description et le pseudo sont exposés par l’interface (catalogue U20, boîte
  d’export).

### Stockage

- C2a : une base `tinkerbolt`, version Dexie 1 (version native IndexedDB 10),
  composée dans `App` avec horloge réelle injectée. Six tables : `creations`,
  `receivedLevels`, `progress`, `preferences`, `playerConstructions`, `backups`.
  Les quatre repositories existants et leurs consommateurs sont asynchrones ;
  chargement visible avant lecture du plateau, pseudo, collections ou verrous.
  La table de constructions est déclarée pour C3, sans reprise joueur livrée.
  Les quatre adaptateurs localStorage sont retirés ; aucun transfert legacy.
- Créations : `DraftRepository` conserve `document`, `source?` et `updatedAt`
  dans une ligne d’enveloppe `draft` v2. Les niveaux passent par le codec de
  fichier et ses migrations ; la base neuve ne lit pas d’enveloppe draft v1.
  `create` insère exclusivement et retente une collision d’identité avec
  l’aléa injecté. Chaque état engagé est ordonné par création, y compris les
  commits arrivant pendant la première insertion ; id et URL sont adoptés
  seulement après réussite. Lecture, navigation interne et lancement attendent
  les sauvegardes en cours. Une erreur laisse l’édition disponible et montre
  « Dernières modifications non enregistrées sur cet appareil. » ; un succès
  ultérieur retire ce message. La source chargée est conservée à chaque save.
- Reçus : `ReceivedLevelRepository` stocke l’enveloppe `received-level` v1,
  id `recu-<16 chiffres hexadécimaux>`, source validée par le codec de fichier,
  origine, date, record et solution du joueur. `receive` relit et fusionne
  atomiquement un doublon ; une collision de documents canoniques est refusée.
  `recordVictory` vérifie la source intacte et la présence du parent, puis garde
  le meilleur compte et la dernière solution gagnante. `delete` supprime le
  reçu et sa construction liée dans la même transaction ; créations indépendantes.
- Préférences : enveloppe `preferences` v1 dans la ligne `player`, pseudo validé
  par `authorSchema`, indices/refus d’installation facultatifs. `patch` fusionne
  seulement les champs demandés ; `rememberAuthor` utilise ce patch et
  `author: null` efface le pseudo sans perdre les drapeaux. Lecture attendue
  avant formulaire ; l’export conserve une saisie déjà engagée pendant la lecture.
  Un échec du stockage n’empêche pas l’export et n’annonce aucun pseudo enregistré.
- Progression : enveloppe `progress` v1 dans la ligne `campaign`. Les victoires
  utilisent `recordVictory` atomique ; la mémoire reste jouable avec avertissement
  si le stockage échoue. `clear` supprime progression et constructions `campaign`
  dans une transaction, sans toucher aux créations, reçus ou préférences.
  Le provider attend les victoires engagées avant reset, ignore leurs réponses
  obsolètes et confirme le reset seulement après réussite. La barrière des
  écritures de construction sera raccordée avec C3.
- Toute ligne lue est validée par Zod strict, colonnes et enveloppe cohérentes.
  Une donnée invalide est copiée brute dans `backups`, puis retirée ou remplacée
  dans la même transaction ; un échec du secours garde la valeur d’origine.
  Une version future de base ou d’enveloppe reste intacte et produit une erreur.
  Quota et indisponibilité sont des résultats typés. Les listes secourent aussi
  une clé numérique invalide ; delete reçu et reset protègent les constructions
  liées de version future. Les tests utilisent une IDBFactory neuve ; les fixtures
  E2E encodent et relisent les données avec les repositories/codecs de production.
- Créations de niveaux de campagne U17 : chaque carte de `/levels` porte
  « Modifier le niveau N » (M11), qui ouvre `/editor?draft=<id>-brouillon`.
  Depuis M6, une création neuve est construite par `creationFromLevel` (sans
  solution posée, sans inventaire, titrée « <titre> (remix) », niveau gardé en
  `source`) ; une création existante est rouverte telle quelle
  (`src/application/drafts/campaign-draft.ts`). En mode création, le tiroir du
  catalogue auteur et « Annuler »/« Rétablir » s’affichent même sans inventaire
  (`BoardShell`, `SimulationControls`) ; en mode joueur, la règle B1 est
  inchangée. Chaque état engagé de l’historique est enregistré dans la
  création. Le contexte auteur ignore les permissions joueur : les objets de
  départ se déplacent et tournent. Le niveau embarqué et la progression ne
  changent pas. V7b retire la fiche de calibrage U28 ; la solution d'une
  création neuve reste révélée en développement (M11).
- Atelier libre `src/content/levels/workshop.json` (scène 16 × 9, inventaire de
  99 par famille, contexte auteur, sans description depuis M14b). Depuis M13,
  il est enregistré à sa première modification engagée : une création
  `creation-<aléa>` (aléa du point de composition `src/app/random-id-part.ts`,
  date de l’horloge du dépôt), sans `source`, et l’URL `/editor` est remplacée
  par `/editor?draft=<id>` (`replace`, pas d’entrée d’historique en plus). Le
  même atelier reste monté sous la nouvelle URL : historique
  « Annuler »/« Rétablir » et sélection sont conservés ; les modifications
  suivantes l’enregistrent sous le même identifiant
  (`src/application/drafts/save-free-creation.ts`, `EditorPage.tsx`). Ouvrir
  l’atelier sans rien faire n’écrit rien ; « Atelier » (menu) depuis
  une création ouvre un atelier neuf.

### Réception et « Mes niveaux »

- Réception d’un niveau M8 (ADR 0015 § Réception) : cas d’usage pur
  `receiveLevel(repository, document, origin, fingerprint, clock)`
  (`src/application/received/receive-level.ts`) ; l’empreinte (ou
  `unavailable`) et l’horloge sont fournies par l’appelant. Un nouveau
  document est enregistré `recu-<empreinte>`, non résolu, daté par l’horloge ;
  un document déjà reçu garde `origin`, `solved`, record et solution du
  joueur, et seul son `receivedAt` est rafraîchi pour le remettre en tête
  (M9, au mieux : un échec d’écriture le laisse tel quel) ; un objet ou un
  fil `toPlace` est refusé (`workshop-document`) ; empreinte indisponible ou
  erreur du dépôt sont un résultat `not-kept`. `/shared` décode, calcule
  l’empreinte (`crypto.subtle` absent → non gardé), reçoit, puis joue ; un
  niveau non gardé affiche au-dessus du plateau un statut discret
  (`role="status"`, « Ce niveau n’a pas été gardé sur cet appareil. »), à
  masquer d’un toucher (« Masquer le message ») ; un lien d’atelier affiche
  « Ce lien est un atelier, pas un niveau à jouer. » sans plateau ; un lien
  invalide n’enregistre rien. Le dépôt est fourni par
  `ReceivedLevelRepositoryContext`
  (`src/app/received-level-repository-context.ts`), branché dans `App`
  (Dexie par défaut, prop `receivedLevelRepository` pour les tests).
  Validation visuelle attendue (statut discret, captures
  `test-results/shared/shared-not-kept-*.png`).
- Page « Mes niveaux » M9 (ADR 0015 § Page « Mes niveaux », ADR 0008
  amendée) : `/my-levels` (`MyLevelsPage.tsx`), dans le menu partagé et en
  troisième lieu de l’accueil (V7). Section « Mes créations » triée par `updatedAt`
  décroissant (`listCreations`) : Modifier (`/editor?draft=<id>`), Jouer
  (même route, état de navigation `{ playPuzzle: true }` qui ouvre
  directement « Jouer le puzzle » U22 ; désactivé sans objet à placer),
  Partager (boîte d’export U16, vérification ADR 0013 comprise), Dupliquer
  (`duplicateCreation` : `creation-<aléa>`, même `source`, titre « (copie) »
  gardé entier par `withTitleSuffix`, partagé avec « (remix) »), Supprimer ;
  la création `<id>-brouillon` d’un niveau de campagne verrouillé est marquée
  « Verrouillé » avec Supprimer seulement. Section « Niveaux reçus » triée par
  `receivedAt` décroissant (`listReceivedLevels`) : « par <auteur> » et
  « d’après <titre> (par <auteur>) » en texte brut, Résolu et record ou « Pas
  encore résolu », description en texte brut (M14b : classe
  `level-card-description` de `/levels`, sans troncature, rien sans
  description ; les cartes de « Mes créations » ne l’affichent pas), Jouer
  (`/my-levels/:id/play`), Modifier (M11), Partager (fichier ou lien du
  document tel quel, `ReceivedLevelShareDialog`, sans vérification),
  Supprimer. Toute suppression passe par une confirmation `Dialog`
  (« Annuler » ciblé). « Nouveau niveau » ouvre `/editor` ; « Importer un
  fichier » lit le fichier (taille puis codec L22, `read-level-file.ts`) et le
  reçoit (`origin: 'file'`) sans quitter la page ; un atelier est refusé
  (« Ce fichier est un atelier, pas un niveau à jouer. »). `/import`
  redirige vers `/my-levels` ; `LevelImportPage` et `import-level-draft.ts`
  sont retirés. Un identifiant inconnu sur `/my-levels/:id/play` affiche une
  erreur et un lien vers « Mes niveaux ». Validation visuelle attendue
  (captures
  `test-results/my-levels/my-levels-{empty,filled}-{390x844,844x390,1440x900}.png`,
  `my-levels-delete-390x844.png`,
  `my-levels-received-description-{390x844,844x390,1440x900}.png`,
  `test-results/home/accueil-*.png`).
- Jouer un niveau reçu M10 (ADR 0015 § Victoire sur un niveau reçu, ADR 0016
  § Affichage) : cas d’usage pur
  `recordReceivedVictory(repository, id, attempt)`
  (`src/application/received/record-received-victory.ts`) : à partir de
  l’instantané de la tentative pris au lancement, l’entrée devient résolue,
  `bestObjectCount` garde le minimum (`countObjectsUsed`, ADR 0010) et
  `playerSolution` est remplacée par `solutionFromAttempt` ; entrée absente
  (`not-found`) ou erreur du dépôt (`not-kept`) sont des résultats, sans
  exception. `ReceivedLevelBoard` (`src/app/`) joue un niveau reçu pour
  `/my-levels/:id/play` et `/shared` : il l’appelle à la victoire quand le
  niveau est gardé (rien sinon), ignore une erreur de stockage, n’affiche que
  ✅ (palier « Résolu » seul, sans niveau suivant) et ne touche jamais la
  progression de campagne. Une victoire qui ne peut pas être écrite affiche le
  statut discret « Ta victoire n’a pas pu être enregistrée sur cet
  appareil. » (M11). L’en-tête montre « par <auteur> · d’après <titre>
  (par <auteur>) » (première source) en texte brut, à la place de « Mode
  joueur » (`AppHeader`, prop `attribution`, helper `level-attribution.ts`
  partagé avec les cartes) ; en paysage téléphone, sur la ligne du titre.
  `/my-levels/:id/play` a un bouton d’en-tête « Mes niveaux » (sortie `exit`,
  libellé court `shortLabel`), qui sert aussi au bandeau d’échec. Un fichier
  importé non gardé (quota, stockage, `crypto.subtle` absent) affiche sous
  l’alerte « Jouer quand même » : le niveau se joue sur place dans
  `/my-levels`, sans rien enregistrer (victoire comprise), avec le statut
  discret « Ce niveau n’a pas été gardé sur cet appareil. » et « Mes niveaux »
  pour revenir à la liste. Validation visuelle attendue (captures
  `test-results/received-play/{received-header,received-victory,import-not-kept,import-not-kept-play}-{390x844,844x390,1440x900}.png`).

### Jouer, remixer et révéler

- Solution d’une tentative gagnante M5 (ADR 0015 § Victoire sur un niveau
  reçu) : `solutionFromAttempt(attempt)` (`src/application/puzzle/player-solution.ts`,
  pure) dérive de la provenance (ADR 0005) les poses issues de l’inventaire
  (`inventoryId`, `transform`, `placementId` quand un fil du joueur touche la
  pose) et les fils du joueur, à la forme `solution` de l’ADR 0013 ; un objet
  du décor déplacé n’y figure pas. `playSolution(level, solution)` est extraite
  et exportée de `puzzle-workshop.ts` (rend la tentative, `verifyPuzzle`
  inchangé). Rejouer la solution sur le niveau d’origine redonne la même
  tentative et gagne en simulation headless (fixture locale). Appelée par la
  victoire sur un niveau reçu depuis M10.
- Création depuis un niveau M6 (ADR 0015 § Ouvrir dans l’atelier, ADR 0016 §
  Remplissage automatique) :
  `creationFromLevel(level, { playerSolution?, createId })`
  (`src/application/drafts/creation-from-level.ts`, pure) rend une
  création `{ document, source }` : décor repris (objets, fils, zones, scène,
  objectif), `solution`, `inventory` et `challenge` retirés, poses et fils de la
  solution du joueur ajoutés `toPlace` par `restoreSolution` (extraite de
  `workshopFromPuzzle`, mêmes identifiants et même remappage), `source` = copie
  intacte du niveau ; titre « <titre> (remix) » de 160 caractères au plus, le
  titre d’origine tronqué pour garder « (remix) » entier (M6b), `author`
  retiré, `basedOn` prolongé par le niveau d’origine et tronqué à 16.
  Réexportée par `puzzleFromWorkshop`, la création d’une victoire redonne un
  puzzle dont la solution gagne (fixture, simulation headless).
- Révéler la solution de l’auteur M7, logique (ADR 0015 § Révéler) : commande
  d’auteur `revealAuthorSolution({ context, source })`
  (`authoring-commands.ts`) qui ajoute au document courant, marqués `toPlace`,
  les poses et les fils de `source.solution` par `restoreSolution` (déplacée
  dans `src/application/puzzle/restore-solution.ts`, qui dédoublonne aussi les
  identifiants de fils), sans rien retirer ; une seule entrée d’historique ; un
  fil dont une extrémité n’est plus sur le plateau, ou qui viserait un appareil
  déjà commandé, est ignoré et compté ; une pose hors de la scène l’agrandit
  par `withSceneIncluding`, comme `addAuthoredPlacement` (M7b : la révélation
  n’est jamais refusée en bloc). La commande expose `ignoredWireCount(state)`
  (nombre de fils ignorés pour l’état donné) ; refus `authoring-only` en
  contexte joueur, `solution-not-found` pour une source sans solution. Sur une
  création intacte, le résultat égale `workshopFromPuzzle` de la source.
- Modifier et Remixer M11 (ADR 0015 § Points d’entrée, « Un niveau de
  campagne verrouillé », § Révéler) : cas d’usage
  `saveCreationFromLevel(repository, level, { playerSolution?, createId })`
  (`src/application/drafts/save-creation-from-level.ts`) qui enregistre
  `creationFromLevel` sous un `creation-<aléa>` libre (`freeCreationId`,
  partagé avec `duplicateCreation`). « Modifier » d’un niveau reçu
  (« Mes niveaux ») ouvre une nouvelle création, la `playerSolution` posée
  « à placer » s’il est résolu ; « Remixer », dans la boîte de victoire de la
  campagne et des niveaux reçus (`CampaignVictory.onRemix`, icône `Shuffle`),
  pose la tentative gagnante, celle de l’instantané pris au lancement
  (`useRemix`, `solutionFromAttempt`) ; un échec de stockage s’affiche en
  alerte dans la boîte. Le niveau d’origine n’est jamais modifié. Un niveau
  de campagne verrouillé (`isLevelUnlocked` recalculé depuis la progression,
  ou `unlockAllLevels`) a son « Modifier le niveau N » désactivé, et
  `/editor?draft=<id>-brouillon` affiche « Ce niveau est encore verrouillé. »
  avec un lien vers `/levels` sans lire ni écrire la création
  (`LockedLevelPage`, partagée avec `/levels/:id/play`). Prop d’`App`
  `developmentMode` (`import.meta.env.DEV` passé par `main.tsx`, contexte
  `DevelopmentModeContext`) : une création de campagne **neuve** s’ouvre
  solution révélée par la commande M7 (`openCampaignDraft(…, { revealSolution
})`), une création existante est rouverte telle quelle ; la fiche de
  calibrage U28 est supprimée depuis V7b. Validation visuelle
  attendue (captures `test-results/remix/{levels-locked,remix-victory,remix-workshop,locked-draft}-{390x844,844x390,1440x900}.png`,
  `test-results/my-levels/my-levels-filled-*.png`).
- Révéler dans l’atelier M12 (ADR 0015 § Révéler) : dans l’atelier d’une
  création dont la `source` porte une solution, le menu d’en-tête propose en
  premier « Révéler la solution de l’auteur » (icône `Eye` ; prop
  `menuActions` d’`AppHeader`/`AppFrame`, prop `authorSource` de
  `BoardShell`, passée par `EditorPage` à l’atelier seulement). Une boîte de
  confirmation (`Dialog`, « Annuler » ciblé, « Révéler la solution »)
  exécute la commande M7 dans l’historique de l’atelier : une entrée, annulée
  par « Annuler », création enregistrée comme toute modification engagée. Si
  des fils sont ignorés, un statut discret (`role="status"`, à masquer d’un
  toucher) dit « 1 fil de la solution de l’auteur n’a pas pu être posé. » /
  « N fils … n’ont pas pu être posés. ». Entrée absente de l’atelier libre,
  d’une création sans `source` ou dont la `source` n’a pas de solution, hors
  construction et en « Essayer en joueur ». Le menu d’en-tête défile
  désormais quand il dépasse la hauteur de l’écran (téléphone en paysage).
  Validation visuelle attendue (captures
  `test-results/reveal/{reveal-menu,reveal-confirm,reveal-workshop}-{390x844,844x390,1440x900}.png`).

### Partager

- Export U16 : en mode auteur, le bouton « Exporter » de l’en-tête ouvre une
  boîte qui télécharge le document engagé de l’auteur (`<id>.json`, codec L22,
  `application/json`) ou copie le lien `/shared#level=…` (codec L23) avec le
  retour « Lien copié ». Sans presse-papiers, le lien s’affiche dans un champ
  sélectionnable. Un document que le schéma refuse n’est pas exporté : la boîte
  en donne les raisons (`src/app/level-export.ts`, `LevelExportDialog.tsx`).
- Export U24 et U25 : les puzzles produits par l’atelier ne portent aucun
  `challenge` ; les seuils Élégant/Minimal sont réservés aux niveaux qui les
  définissent explicitement. Les fils fixes restent dans le décor ; les fils
  marqués « À placer », ainsi que ceux qui touchent un objet à placer, passent
  dans l’inventaire `wire` et la solution de référence. L’inspecteur auteur
  permet de choisir « Fixe / À placer » pour chaque fil connecté.
- Titre, pseudo et licence M14 (ADR 0016 § Licence, § Pseudo) : la boîte
  d’export d’une création propose « Nom du niveau » et « Pseudo (facultatif) »,
  avec l’aide « Un pseudo, pas ton vrai nom » et la mention exacte de licence
  CC BY 4.0. Les espaces de bord sont retirés à la saisie ; un pseudo vide
  retire `author` ; un pseudo refusé par le schéma (caractère de contrôle,
  saut de ligne, U+2028) est dit sous le champ (`role="alert"`,
  `aria-invalid`) et désactive les deux exports. Le fichier et le lien portent
  les valeurs saisies. À chaque export, la boîte transmet des commandes
  d’auteur annulables, revalidées par le schéma (`updateLevelTitle`,
  `updateLevelAuthor`) : dans l’atelier, elles passent par son historique
  (« Annuler » les retire) et la création est enregistrée comme toute
  modification engagée ; depuis « Partager » de « Mes niveaux », elles sont
  appliquées à la création, enregistrée avec sa `source`. Le « Partager »
  d’un niveau reçu est inchangé. `index.html` déclare
  `interactive-widget=resizes-content` pour que le clavier virtuel d’Android
  réduise la fenêtre au lieu de recouvrir la boîte. Validation visuelle
  attendue (captures
  `test-results/share/{share-fields,share-invalid-pseudo}-{390x844,844x390,1440x900}.png`,
  `share-keyboard-390x508.png`).
- Description M14b (ADR 0016) : la boîte d’export d’une création propose
  « Description (facultatif) » (zone de texte de 3 lignes, `maxLength` 2000)
  entre le nom et le pseudo, préremplie avec la description du niveau ; les
  espaces de bord sont retirés à l’export et un champ vidé retire
  `description` (jamais `''`). Le fichier et le lien portent la saisie ; une
  troisième commande, `updateLevelDescription`, rejoint le titre et le pseudo
  (dans l’atelier, une entrée d’historique de plus au plus, « Annuler » la
  retire ; depuis « Mes niveaux », appliquée à la création enregistrée avec sa
  `source`). Le « Partager » d’un niveau reçu est inchangé. Validation visuelle
  attendue (captures
  `test-results/share/share-description-{390x844,844x390,1440x900}.png`,
  `share-description-keyboard-390x508.png`,
  `test-results/my-levels/my-levels-received-description-{390x844,844x390,1440x900}.png`).

### Simulation

- `SimulationSession` Planck à pas fixe, accumulateur à durée injectée, rattrapage
  plafonné à 5 pas par frame, y vers le bas, capteur de panier, sortie de scène,
  temps écoulé, reset exact, snapshot défensif, destruction idempotente.
- Onze familles simulées ; levier à trois crans, convoyeur à vitesse de surface
  commandé par levier ou par sa propriété `direction` ; bouton-capteur enfoncé
  tant qu’un corps dynamique pèse dessus ; ventilateur (cône de souffle, poussée
  proportionnelle à la largeur exposée) et barrière coulissante commandés par un
  levier de côté ou un bouton enfoncé ; tremplin à restitution 1. Masse redessinée
  (0,8 × 0,505, collider trapèze + anneau).
- Résistance au roulement de la balle (absente de Planck) : elle s’arrête sur une
  poutre plate.
- Suite de conformité (`test/conformance/`) : protocole commun ; les scènes 6 et
  7 sont conservées comme régressions contre Planck seul après la porte de validation.
  La validation de Planck sur téléphone réel est consignée dans l’ADR 0002.

### Présentation et interface

- Fond et grille (U2, refondus par V2b ; ADR 0007 amendée le 2 octobre 2026) :
  le renderer peint tout le viewport d’un parchemin uni (`#f6ead3`), puis une
  grille d’un mètre sur **tout** le viewport (trait de 1 px CSS, atténuée au
  faible zoom) ; zoom et panoramique suivent la même caméra que les objets.
  Aucune démarcation de la scène, aucune image de fond : `loadBackground` et son
  décodage dans `BoardView` n’existent plus, et `board-generic-v0.png` n’est plus
  chargé (le fichier reste dans `public/assets/backgrounds/`). Les tests U13,
  R1 et U3 comparent les pixels au parchemin et à la grille repeints hors écran
  (`e2e/board-paper.ts`). Captures dans `test-results/board-paper/` ; validation
  de l’auteur attendue (V2b).

- **Accueil `/`** (V7, maquette V4) : « Amène la balle jusqu’au panier. », un
  paragraphe, « Jouer » (→ `/levels`) et « ou créer un niveau » (→ `/editor`) ;
  à droite l’aperçu réel du tutoriel 5 (`LevelPreview`) ; trois cartes Campagne
  (progression `résolus / total`, barre et texte), Atelier et Mes niveaux,
  illustrées par une vignette de sprite ; pied de page « Les niveaux partagés
  sont sous licence CC BY 4.0. » et « Paramètres ». Pas de titre dans l’en-tête.
  L’invitation PWA et les notes de stockage restent. Le menu de chaque écran
  propose un retour à l’accueil (ADR 0008 amendée).
- **En-tête** (V7) : titre de page en texte simple centré, « Titre · Contexte »
  (contexte atténué ; auteur d’un niveau reçu à sa place), sans titre à
  l’accueil ; sous 700 px le contexte passe sous le titre, en paysage compact il
  est masqué. Police Nunito
  embarquée (`public/fonts/`, OFL) ; scrollbar commune fine, sable, sans flèches.
- Routage côté client (ADR 0008) : `/levels`, `/levels/:levelId/play`,
  `/my-levels`, `/my-levels/:id/play`, `/import` (redirige vers `/my-levels`),
  `/editor`, `/settings` (paramètres, U11) et `/shared` (niveau décodé depuis le fragment URL,
  enregistré comme niveau reçu avant d’être joué depuis M8).
  `/` ouvre l’accueil ; le premier niveau reste accessible par son URL directe.
- Renderer Canvas 2D (ADR 0006) avec DPR, sprites en calques (balle à motif
  tournant, rouge pour celle de l’objectif et bleue pour les autres, panier
  avant/arrière, bascule pied + planche, levier, convoyeur à tapis défilant,
  bouton à capuchon qui s’enfonce, ventilateur à pales tournantes écrasées en
  perspective et orientable, barrière dont seule la partie sortie du poteau est
  dessinée, tremplin à ressort tassé à l’impact), ordre de dessin
  déterministe (la balle après le panier).
- **U3 — ombres abandonnées** (décision auteur du 2 octobre 2026, ADR 0006
  amendée) : aucune ombre ajoutée au plateau, en jeu, dans l’éditeur, pendant
  un placement ou une simulation. Le code expérimental d’ellipse et de
  dégradé ainsi que les sept tests correspondants sont conservés ; l’option
  interne du renderer `objectShadows` vaut `false` par défaut et aucun appel
  de l’application ne l’active. Aucun réglage utilisateur. Un huitième test
  du renderer vérifie l’absence d’ombre par défaut ; trois E2E vérifient les
  pixels sans ombre au repos, avec les fantômes valide et invalide et pendant
  la chute. Captures dans `test-results/object-shadows-disabled/`, aux trois
  formats. U3 n’attend plus de validation visuelle ; une réactivation exige
  une nouvelle décision de l’auteur.
- Poutres en trois tailles (U12) : `beam-short`, `beam-medium` et `beam-long`
  (2, 4 et 6 × 0,25 unités, @2x), exportés par `art/build-sprites.py` depuis
  `art/assets/beam/` (`beam-short.png`, `beam-medium.png`, `beam-big.png`),
  chacun recadré sur ses pixels opaques ; le renderer choisit le sprite de la
  poutre d’après `props.size` (`layerAssetsFor`), comme il choisit la bande du
  convoyeur. L’ancien `beam@2x.png` (une image longue raccourcie) est retiré ;
  la vignette `thumbs/beam.png` reprend la poutre longue. Les sources n’ont pas
  le rapport largeur/hauteur de l’empreinte (voir la dette « Sources de poutre »
  ci-dessous). Test `board-renderer.test.ts` (longueur → sprite),
  `sprite-assets.test.ts` (dimensions et budget des trois fichiers, vignette) et
  parcours `e2e/beam-sprites.spec.ts` (captures
  `test-results/beam-sprites/beams-{390x844,844x390,1440x900}.png`).
  **Détails visuels à réévaluer en fenêtre fraîche.**
- Fantôme de placement (U1, spécification C1 de `plan-remise-en-jeu.md`) :
  l’objet en cours de placement est dessiné par le renderer avec son sprite,
  son empreinte et sa rotation réelles, à l’échelle de la caméra, translucide
  (alpha 0,55) et entouré d’un trait plein bleu de 2 px CSS quand la position
  est valide ; plus pâle (alpha 0,35) et entouré de tirets rouges quand elle
  est refusée (hors zone de construction). Le contour ne grossit pas avec le
  zoom. État de présentation seulement : `placementGhost(session)`
  (`src/app/placement-ghost.ts`) le déduit de la manipulation en cours,
  `projectLevel(document, simulation, ghost)` donne à chaque objet une
  `appearance` (`solid`, `ghost-valid`, `ghost-invalid`) ; ni le document ni
  l’historique ne changent. Le canvas expose `data-placement-ghost`
  (`valid`/`invalid`) et `data-placement-ghost-position`. L’ancien overlay DOM
  `.placement-preview` et ses règles CSS sont supprimés ; l’annonce
  « Aperçu de placement valide » (`role="status"`) reste. Tests
  `placement-ghost.test.ts`, `board-renderer.test.ts` (« fantôme de placement
  (U1) »), `App.test.tsx` et parcours `e2e/placement-ghost.spec.ts` (boîte du
  fantôme = empreinte puis objet posé, captures
  `test-results/placement-ghost/ghost-{valid,invalid}-{390x844,844x390,1440x900}.png`).
  **Détails visuels à réévaluer en fenêtre fraîche.**
- Zones de construction et déplacement hors zone (U13) : en résolution,
  pendant la construction, le plateau dessine chaque zone qui restreint la
  pose (teinte bleue légère et contour en tirets, sous les objets), toutes
  quand il y en a plusieurs ; aucune quand une zone couvre la scène, en
  création ni pendant la simulation (`highlightedBuildZones`,
  `src/app/build-zone-highlight.ts`, sur `constrainingBuildZones`). Le canvas
  expose leur nombre (`data-build-zones`). Un objet glissé ou tourné hors de
  toute zone continue de suivre le doigt, dessiné comme le fantôme de placement
  refusé de U1 (alpha 0,35, tirets rouges, sans cadre de sélection, poignée de
  rotation gardée) ; `placementGhost` le désigne et le canvas expose
  `data-placement-ghost="invalid"` et sa position. Au lâcher hors zone, l’objet
  revient à sa position de départ, sans entrée d’historique, avec un seul
  message de refus pour le geste ; un déplacement accepté efface un refus
  précédent. L’ancien rendu d’un déplacement refusé (alpha 0,5, contour rouge
  plein, `invalidPlacementId`) est supprimé. Tests
  `build-zone-highlight.test.ts`, `placement-ghost.test.ts`,
  `board-renderer.test.ts` (« objet déplacé hors zone (U13) »), `App.test.tsx`
  et parcours tactile `e2e/build-zones.spec.ts` (pixels de la zone, refus
  unique, objet revenu, déplacement accepté ; captures
  `test-results/build-zones/{zone,hors-zone,refus}-{390x844,844x390,1440x900}.png`).
  **Détails visuels à réévaluer en fenêtre fraîche.**
- Balle cible sans surcharge (R1, remplace le rendu U7, ADR 0006 amendée) :
  sprites rouges pour la cible et bleus pour les autres, sans anneau ajouté au
  repos, au zoom ni en simulation. Une balle sélectionnée n’est plus encadrée
  d’un rectangle ; son nom et son panneau portent la sélection. Les autres
  objets gardent un contour explicitement bleu, sans couleur Canvas héritée.
  Avec plusieurs balles, la boîte « Objectif » dit « Seule la balle rouge
  compte. ». Les contours de placement et « À placer » sont conservés.
  Tests renderer, App et E2E sur pixels réels. Neuf captures inspectées :
  `test-results/goal-ball/{repos,selection,simulation}-{390x844,844x390,1440x900}.png` ;
  détails visuels à réévaluer en fenêtre fraîche.
- Aide du niveau 1 (U8) : sur le premier niveau de la campagne, jamais
  résolu, une carte brève (liseré jaune, ampoule, bouton « Masquer l’aide »)
  dit d’abord « Touche « Lancer » pour voir la machine tourner. », puis, de
  retour en construction après un lancer, « Prends un objet dans le
  catalogue, pose-le sur le plateau, puis touche « Lancer ». ». Elle se loge
  dans l’emplacement réservé `.status-slot` (sous le cadrage en portrait,
  dock de droite en paysage, rail droit en grand format) : jamais sur le
  plateau ni sur la barre d’actions, et elle ne le redimensionne pas. Elle se
  tait pendant la simulation et disparaît pour toujours au premier toucher
  de « Masquer l’aide » ou à la première commande validée sur le plateau
  (préférence `firstLevelHintDone`), ainsi qu’une fois le niveau résolu.
  `offersFirstLevelHint` et `firstLevelHintStep`
  (`src/app/first-level-hint.ts`, purs), `FirstLevelHint` (`src/ui/`),
  `useFirstLevelHint` (`PlayLevelPage.tsx`). Tests `first-level-hint.test.ts`,
  `indexed-db-preferences-contracts.test.ts`,
  `LevelExportDialog.test.tsx`, `App.test.tsx` et parcours
  `e2e/first-level-hint.spec.ts` (toucher, rechargement, boîtes disjointes du
  plateau et des boutons ; captures
  `test-results/first-level-hint/{lancer,tiroir}-{390x844,844x390,1440x900}.png`).
  **Détails visuels à réévaluer en fenêtre fraîche.**
- Caméra pure `src/presentation/board-camera.ts` (ADR 0007) : ajustement
  `contain` à la scène, bornes de zoom, panoramique, pincement, boutons de
  cadrage, recadrage sur vrai redimensionnement seulement.
- Hit-test pur `src/presentation/board-hit-test.ts` (cible ≥ 44 px CSS). Sur le
  plateau : sélection au toucher/clic, désélection sur le vide, déplacement direct
  en une seule entrée d’historique, poignées de rotation des poutres et des
  leviers en atelier, annulation atomique sur `pointercancel` ou second doigt.
- Tiroir de propriétés compact (G2) : son scrim ne ferme le tiroir que pour
  une pression commencée sur lui (ou une activation au clavier). Le tiroir
  s’ouvre pendant le toucher qui sélectionne un objet ; le clic que le
  navigateur émet à la fin de ce toucher pouvait tomber sur le scrim tout juste
  monté et refermer aussitôt le tiroir.
- Chargeur des sprites : une requête en cours est partagée, un sprite prêt est
  conservé, et un échec est retenté au rendu suivant, jusqu’à trois tentatives par
  asset.
- Tiroir du mode joueur limité aux familles présentes dans l’inventaire du
  niveau ; il affiche la quantité restante et la taille de poutre. Une entrée à
  quantité zéro reste visible et désactivée. En mode auteur (atelier libre et
  création), le catalogue propose toutes les familles sauf la balle rouge et
  le panier de l’objectif, avec « Balle bleue » (U20) : il pose l’objet directement dans le
  niveau (commande `addAuthoredPlacement`), sans exiger ni consommer
  l’inventaire du joueur ; l’objet posé est verrouillé pour le joueur, comme
  tout objet de départ. La balle rouge et le panier de l’objectif sont
  uniques et déjà posés : le catalogue ne les propose pas (décision auteur du
  27 septembre 2026). Le canevas expose `data-red-balls` et `data-blue-balls`.
- En-tête de l’atelier (U23) : les titres « Éditeur de niveaux » et « Éditeur ·
  <titre> » ne sont plus rendus sur le plateau ; le sous-titre « Atelier » (V3 ; « Mode éditeur » avant) et les actions
  restent accessibles, le titre est celui du niveau édité (« Sans titre » s’il est vide). Le parcours E2E produit des captures en 390 × 844,
  844 × 390 et 1440 × 900.
- U26 : le niveau 1 en création garde son catalogue auteur complet ; une
  non-régression applicative couvre ce parcours (depuis M6 il n’a plus
  d’inventaire).
- PWA L28 : le build génère un manifeste installable et un service worker qui
  précache l’application et ses assets ; les routes de jeu, d’atelier et de
  « Mes niveaux » ont un repli hors ligne (motif testé dans
  `scripts/navigate-fallback-allowlist.ts`, V2c ; `/import` ajouté par V3). Le hook `usePwaUpdateStatus(phase)` expose une mise à jour en
  attente seulement pendant une phase sûre, hors simulation et manipulation.
- **U10 — invitations PWA** (2 octobre 2026, détails visuels à réévaluer en fenêtre fraîche) :
  une carte « Nouvelle version disponible. » avec « Mettre à jour » et « Plus
  tard » se montre en tête de l’accueil et, sur un plateau, dans l’emplacement
  réservé, en phase sûre et tant qu’aucune commande n’y a été validée (le
  rechargement ne perd rien) ; rien ne recharge sans le toucher. À l’accueil
  seulement, quand le navigateur émet `beforeinstallprompt`, une carte propose
  « Installer » (demande du navigateur) ou « Ne pas installer » ; un refus est
  retenu (`installInvitationDeclined`, préférences v1, ADR 0012 et 0011,
  amendements du 2 octobre 2026). Sans l’événement (iOS…), rien n’est montré.
  Décision pure `pwaInvitation`, port de service worker injectable
  (`RegisterServiceWorker`) ; E2E `e2e/pwa-invitation.spec.ts` sur le build
  réel (nouvelle version enregistrée sur la même portée, événement simulé).
- **U11 — paramètres** (2 octobre 2026, détails visuels à réévaluer en fenêtre fraîche) :
  `/settings` n’est plus vide. Le panneau « Pseudo » montre le pseudo retenu
  dans le champ « Pseudo retenu » (44 px de haut au moins). « Enregistrer le
  pseudo » le remplace, espaces de bord retirés ; un champ vide l’oublie.
  « Effacer le pseudo » l’oublie. Les autres préférences
  (`firstLevelHintDone`, `installInvitationDeclined`) sont gardées. Un statut
  discret (`role="status"`) dit « Pseudo enregistré. » ou « Pseudo effacé. ».
  Un pseudo refusé par `authorSchema` est dit sous le champ (`role="alert"`,
  `aria-invalid`) et désactive « Enregistrer le pseudo ». Le panneau
  « Progression de la campagne » donne « Niveaux résolus : N sur 5. » et
  « Remettre la progression à zéro ». Ce bouton ouvre une confirmation
  `Dialog` où « Annuler » est ciblé. Le texte dit la perte (niveaux résolus,
  records ; seul le niveau 1 reste ouvert) et ce qui est gardé (créations,
  niveaux reçus, pseudo, et la création « Modifier le niveau » d’un niveau
  qui redevient verrouillé). Depuis C2a, la confirmation mentionne aussi les
  solutions et constructions de campagne ; la progression et ces constructions
  sont effacées atomiquement. Un statut discret dit « Progression remise à zéro : seul le
  niveau 1 est ouvert. ». L’accueil, la liste des niveaux et les URL directes
  reflètent la campagne neuve, sans rechargement. Une erreur de stockage est
  dite dans la page, sans exception. Le libellé suit « Remettre à zéro » : le
  mot « Réinitialiser » n’est plus employé dans l’interface. Tests
  `indexed-db-progress-contracts.test.ts`, `remember-author.test.ts`,
  `indexed-db-preferences-contracts.test.ts`, `SettingsPage.test.tsx` et
  parcours tactile `e2e/settings.spec.ts` (390 × 844 et 844 × 390 ; captures
  `test-results/settings/{repos,pseudo-invalide,confirmation,statut}-{390x844,844x390,1440x900}.png`).
  **Détails visuels à réévaluer en fenêtre fraîche.**
- **U27 — icônes d’interface** : les pictogrammes d’action, de navigation, de cadrage, de catalogue, d’export et de résultat utilisent `lucide-react` (ADR 0014). Les libellés accessibles restent inchangés.
- **U6 — recommencer et remise à zéro de l’atelier** : pendant la simulation,
  une seule commande « Recommencer » est visible ; dans l’atelier, « Ràz atelier »
  est placé à gauche de « Lancer » (ex-« Tester ») et ouvre une confirmation qui décrit la perte,
  avec « Annuler » ciblé par défaut. En mode puzzle, le même contrôle devient
  « Recommencer le niveau » et restaure le document initial après confirmation.
  Dans les deux modes, la remise à zéro ferme les tiroirs et sélections ; après
  une victoire d’atelier, le résultat conserve uniquement « Retour à l’édition ».
- **U4 — bandeau de résultat de campagne** : après une victoire sur un niveau de
  la campagne, le bandeau affiche le palier obtenu par la tentative (Résolu,
  Élégant, Minimal, `data-level-tier`), le nombre d’objets posés compté au
  lancement, puis la révélation progressive de l’ADR 0010 calculée sur le
  meilleur résultat enregistré (« Tu penses pouvoir le faire avec N ? », puis
  « Record à battre : avec N objets. », rien après le palier Minimal ; « Nouveau record »
  sous le minimum connu). « Niveau suivant » ouvre le niveau suivant de la
  campagne s’il existe et est débloqué ; une seule commande « Recommencer ».
  L’atelier garde le bandeau simple ; les niveaux
  reçus ou partagés ont la boîte de victoire à palier « Résolu » seul (M10).
- **U4b — modale de victoire** (campagne) : « Bravo ! », paliers allumés ou
  estompés (le palier Résolu seul sans défi), « Niveau suivant », « Recommencer », « Voir la
  scène » ; bandeau réduit sous le plateau pour rouvrir le résultat.
- **U5 — liste des niveaux par chapitres** : `/levels` regroupe les niveaux par
  cinq chapitres : Les billes de service, Commandes à distance, Le vent,
  L'ordre et le temps et Grandes machines. La numérotation est continue ; un
  niveau verrouillé reste visible avec
  « Verrouillé » et un bouton « Lancer » désactivé ; un niveau résolu affiche
  son palier (icône et libellé, `data-level-tier`) recalculé depuis le meilleur
  résultat. « Modifier le niveau N » (U17, M11) est désactivé comme « Lancer »
  tant que le niveau est verrouillé ; l’URL directe d’un niveau verrouillé
  affiche « Ce niveau est encore verrouillé. » (U5b) ; sous `pnpm dev`,
  `unlockAllLevels` débloque tout.
- **Retouche visuelle de `/levels`** : un bandeau de campagne donne les
  dimensions du parcours, les chapitres sont séparés par des plaques numérotées
  et chaque carte porte son numéro, son état et son titre dans une hiérarchie
  plus nette. Le chrome bleu nuit, les panneaux crème, les accents jaunes et les
  boutons par intention reprennent la direction de l’artwork de référence sans
  dégradé ni faux relief. Les états verrouillés et les paliers restent explicites
  par le texte et l’icône, indépendamment de la couleur.
- **U14b — fils en équerre** : horizontal/vertical, un coude au plus.
- **U22/U25 — atelier créateur de puzzles** (ADR 0013) : réglage « Fixe / À
  placer » dans l’inspecteur de l’atelier (annulable, jamais sur la balle ni le
  panier de l’objectif, champ `toPlace` du document) ; le même réglage est
  disponible pour chaque fil connecté ; contour pointillé violet autour des
  objets à placer pendant la construction ; bouton d’en-tête « Jouer » (« Jouer
  le puzzle ») qui ouvre le puzzle en mode joueur sur une copie, avec « Retour à
  l’atelier » ; l’export (fichier et lien) produit le puzzle — décor fixe,
  inventaire des objets à placer regroupés, fils à placer en `wire`, `solution`
  de référence, zone = scène si l’atelier n’en a pas — après vérification par
  simulation à pas fixe (solution
  posée par les commandes du joueur : gagne ; décor seul : ne gagne pas ; au
  moins un objet à placer), sinon un message dit pourquoi. Un brouillon de
  campagne d’un niveau à solution se rouvre sous forme d’atelier.
- Panneau « Propriétés » (rail droit en grand format, tiroir compact sur petit
  écran) : longueur de poutre, cran de départ du levier, sens du convoyeur,
  rotation libre des poutres, limitée à ±135° pour les leviers, et par quarts
  de tour du ventilateur, de la barrière et du tremplin (boutons et poignée),
  états de départ du ventilateur et de la barrière, circuits du fil et
  **Délier**, suppression.
- Carte « Fil » du catalogue auteur (U15, atelier et créations) ; en mode
  joueur, carte « Fil » par entrée `wire` de l’inventaire, avec sa quantité,
  désactivée une fois épuisée ; le geste s’arrête au dernier fil (U21). Le
  joueur ne voit « Délier » que pour ses propres fils : toucher la carte, puis un levier ou un bouton, puis chaque appareil
  à commander (la source est sélectionnée, l’inspecteur compact reste fermé) ;
  le geste reste sur la source jusqu’à « Terminer les fils »
  (« Annuler le fil » avant le premier). Guidage et refus dans une carte
  au-dessus du plateau ; les refus viennent du domaine
  (`controlWireSourceIssue`, `controlWireTargetIssue`) et de la commande
  (`wire-already-connected`). Chaque fil passe par `connectControlWire`
  (annuler/rétablir). Le canevas expose `data-wires` (`source>cible`).
  L’ancien bouton « Relier à un appareil » du panneau est retiré. Vignette
  provisoire en SVG, en attendant un dessin de l’auteur.
- Fils de commande droits, sous les objets, translucides (presque effacés en
  simulation), lettres de circuit (`src/presentation/control-wires.ts`,
  `wire-renderer.ts`). Le rouge est réservé à la balle de l’objectif (U19) : la
  palette des circuits n’a ni rouge ni teinte voisine, la poignée du levier
  n’est plus rouge, et la balle du tiroir du joueur est bleue.
- Mise en page validée aux six formats du plan (D4) ; objectif dans une boîte de
  dialogue à la demande ; bandeau de résultat dans un emplacement réservé.

### Déploiement et mesure

- Déploiement GitHub Pages par `.github/workflows/deploy-pages.yml` (push sur
  `main` ou lancement manuel), sous le sous-chemin `/tinkerbolt/` (ADR 0008,
  amendement). Build vérifié localement sous ce sous-chemin : routes profondes,
  sprites et fonds chargés sans erreur.
- Page de mesure `/bench` (porte de l'ADR 0002) : scène dense de 31 corps
  dynamiques et 6 articulations, mesure de la physique seule (médiane, 95e
  centile, pire cas sur 1 200 pas) et `/bench/play` qui joue la scène sur le
  plateau avec un compteur d'images par seconde. Sur le PC de développement :
  95e centile 1,3 ms par pas, 60 images/s. Sur téléphone : voir ADR 0002
  § Résultat de la porte (Planck confirmé).

### Contenu

- **N2 — livrée (V1), cinq tutoriels de Bolt** : `tuto-1` à `tuto-5`, dans le chapitre
  « Premiers pas », remplacent les 17 esquisses. Titres et descriptions courts ;
  scènes 16 × 9 entièrement constructibles, décors verrouillés, pas de défi
  d’objets. Chaque solution de référence est rejouée avec les commandes du
  joueur et gagne avec la simulation actuelle ; le décor seul ne gagne pas.
- Copies des exports de `levels/`, dont le tutoriel 4 réexporté par l’auteur
  avec son fil à placer. Sources intactes. Seule correction de mécanique
  autorisée : ventilateur du tutoriel 3 initialement arrêté dans l’inventaire
  embarqué, pour que le bouton tenu par la masse le mette en marche. Le bouton
  reste pressé ; aucun changement de simulateur.
- Les anciennes esquisses sont conservées dans `test/fixtures/campaign-sketches/`
  pour les tests de gestes, d’export et de déterminisme : elles ne sont plus
  embarquées. La progression compte seulement les cinq identifiants actuels ;
  les anciennes victoires et créations locales restent stockées.
- `pnpm content:check` valide les six documents embarqués : cinq tutoriels
  et atelier. Les copies `src/content/levels/tuto-{1..5}.json`
  ne diffèrent de `levels/` que par id, titre, description, auteur et, pour le
  tutoriel 3, l’état initial du ventilateur (vérifié en V1).
- **Fiche de calibrage U28 supprimée (V7b)** : aucun dialogue ni bouton de
  calibrage, même sous `pnpm dev`. Le catalogue auteur reste complet et
  l'ouverture solution révélée d'une création neuve de campagne reste active
  en développement ; la version publiée ouvre sans révéler la solution.

## Dettes et limites explicites

### Phase « Mes niveaux »

- **Atelier libre sans message d’échec (M13).** Si l’enregistrement de la
  première modification échoue (quota, stockage indisponible), l’atelier
  continue sans changer d’URL et retente à la modification suivante. Depuis C2a,
  un message discret signale les modifications non enregistrées, puis disparaît
  à la prochaine sauvegarde réussie.
- **Partage pendant une simulation (M14).** La boîte d’export reste ouverte
  pendant qu’une machine tourne ; un export à ce moment produit bien le
  fichier et le lien, mais l’atelier refuse les commandes de titre, de
  pseudo et de description (refus `editing-unavailable-during-simulation`, signalé par le
  retour habituel de l’atelier) : la création garde son ancien titre. Non
  testé, cas jugé rare.
- **Niveau reçu (M10).** En 390 px, l’en-tête de `/my-levels/:id/play`
  (bouton « Mes niveaux », objectif, menu) ne laisse que « par <auteur> ·
  d’a… » de l’attribution, tronquée par une ellipse (accepté par le pilote
  en M11).
- **Autosauvegarde non limitée (L26, M13).** `DraftRepository` et son
  adaptateur Dexie stockent une création par identifiant dans `creations` ; les enveloppes
  versionnées sont validées, les documents passent par le codec de fichier
  L22, et les valeurs corrompues sont sauvegardées avant remplacement. La
  fonction pure `decideDraftAutosave` limite les essais d’enregistrement à une
  fois par seconde pendant l’édition et autorise un enregistrement immédiat au
  lancement d’un test ; elle n’est toujours pas reliée : chaque état engagé
  est enregistré, et une limitation sans enregistrement final perdrait la
  dernière modification (M13 ne l’a pas branchée).
- **Brouillons U17.** Aucun moyen de repartir du niveau d’origine une fois la
  création de campagne créée (la supprimer depuis « Mes niveaux » puis
  « Modifier le niveau » en recrée une). Une création `creation-<aléa>`
  remixée d’un niveau de campagne n’est pas verrouillée si la progression est
  ensuite remise à zéro : seul `<id>-brouillon` l’est (ADR 0015). Depuis U11,
  la remise à zéro se fait depuis `/settings`. La création `<id>-brouillon`
  d’un niveau qui redevient verrouillé reste gardée, mais elle est marquée
  « Verrouillé » dans « Mes niveaux » et ne s’ouvre plus avant que le niveau
  soit de nouveau débloqué (ADR 0011, amendement U11). Les
  créations de campagne créées avant M6 gardent leur solution posée et leur
  inventaire (ADR 0015) ; sous `pnpm dev`, une création neuve s’ouvre solution
  révélée (M11).
- **Mode auteur incomplet.** L’atelier ne permet pas encore de créer et gérer
  les commandes d’auteur de la scène, des zones, de l’inventaire et de
  l’objectif dans l’interface (seuls le titre, la description et le pseudo
  le sont, par la boîte d’export). Depuis U22, l’export remplace l’inventaire
  de l’atelier par les objets à placer.
- **Atelier U22/U25.** Revenir de « Jouer le puzzle » remonte l’atelier sur son
  dernier document, l’historique annuler/rétablir repart de là ; les fils à
  placer sont exportables et rouverts avec leur marquage.
- **Fils du joueur (U21).** Le joueur ne relie qu’avec les fils de
  l’inventaire du niveau ; les tutoriels 3 à 5 en proposent, et
  l’atelier ne permet pas d’ajouter une entrée « Fil » à l’inventaire (pas
  d’interface d’édition d’inventaire, voir « Mode auteur incomplet »).
- **Limite de la solution du joueur (M5, ADR 0015).** Elle ne retient pas le
  déplacement d’un objet du décor ; seul un fichier écrit à la main peut avoir
  un décor déplaçable.

### Interface

- **Sources de poutre.** Le rapport des sources de `art/assets/beam/` n'est pas
  celui de l'empreinte (8, 16 et 24 pour 1) : `beam-short` mesure 802 × 88 px
  opaques (rapport 9,1, écrasé de 12 % à l'export), `beam-medium` 1543 × 117
  (13,2, étiré de 21 %), `beam-big` 2171 × 136 (16,0, étiré de 50 % et coupé par
  les bords gauche et droit de son image : le bout arrondi de gauche manque, et
  le dessin est pincé). À redessiner par l'auteur, ou à exporter en neuf
  tranches (bouts conservés, milieu étiré) sur sa décision.
- **Sprites hors du script.** Relancer `art/build-sprites.py` en entier
  régénère `button-cap`, `lever-handle`, `second-ball-*` et les vignettes
  `button`, `lever` et `second-ball` avec des octets différents des PNG commités
  (sources ou script retouchés depuis leur export) : seuls les fichiers de
  poutre ont été remplacés en U12. À éclaircir avant toute régénération
  générale. Le script dépend de Pillow, numpy et pngquant, hors gate.
- **Inspecteur compact et sélection.** Quand l’inspecteur compact est fermé
  et qu’un objet reste sélectionné, toucher un autre objet ne le rouvre pas
  (il faut « Ouvrir les propriétés ») ; constaté pendant U21, préexistant.
- **Parcours « Modifier ».** La position actuelle du bouton sur la liste des
  niveaux est conservée provisoirement. Son éventuel déplacement vers un accès
  auteur plus discret sera réévalué séparément.
- **PWA L28.** `vite-plugin-pwa` 1.3.0 et Workbox 7.4.1 produisent le manifeste,
  les icônes provisoires, le précache (environ 10 Mio) et le service worker de
  production. Le test E2E confirme l’ouverture du niveau 1 après rechargement hors
  ligne. Les invitations visibles de mise à jour et d’installation sont livrées
  (U10). Limite : sur un plateau où une commande a été validée, la mise à jour
  n’est proposée qu’en revenant à l’accueil ou en ouvrant un autre plateau ; le
  rechargement effectif après « Mettre à jour » n’est vérifié que par le test
  applicatif (action injectée appelée), pas dans le navigateur.
- **Retest du Xiaomi après L2c.** Le vieux téléphone avait exigé un rechargement
  de `/bench/play`. Le chargeur retente maintenant un asset en échec lors des
  rendus suivants, au plus trois fois ; le comportement doit encore être vérifié
  sur cet appareil.

### Contenu et progression

- **Contenu de v1** : les cinq tutoriels de l’auteur sont intégrés et leurs
  solutions vérifiées (N2 terminée par V1). Les anciennes esquisses restent seulement des
  fixtures de test ; leur calibration n’est plus une dette de livraison.
- **Progression de campagne.** L19 calcule les paliers, records, indices et
  déblocages ; L20 persiste les records dans une enveloppe locale validée ; L21
  enregistre les victoires depuis le snapshot du lancement et expose le hook
  `useCampaignProgress()` sans ajout visuel. La demande de stockage persistant est
  faite une seule fois après la première victoire. Le codec L23 et la route
  `/shared` L24 sont livrés ; les niveaux partagés restent hors campagne et ne
  créent ni progression ni brouillon ; depuis M8, ils sont gardés comme
  niveaux reçus. La PWA L28 est livrée selon l’ADR 0012.
  Les tutoriels actuels ne portent aucun défi : les paliers restent réservés
  aux niveaux calibrés qui en définissent explicitement un.
- **Fichiers et partage.** L22 encode et décode les documents avec validation
  et migration ; L23 sérialise les fragments URL avec CRC-32 et décompression
  bornée ; L24 valide location.hash, puis ouvre le document en mode joueur ou
  affiche une erreur avec un lien vers la liste. L’import de fichier se fait
  depuis « Mes niveaux » et aboutit à un niveau reçu (M9).

### Tests et outillage

- Parcours Playwright desktop C3 corrigé : le test resélectionne la poutre
  restaurée après l’annulation de sa suppression, puis vérifie le canvas au pixel
  près. Les 30 tests desktop passent.
- **E2E du catalogue.** La transition de hauteur du tiroir pouvait encore
  recouvrir le plateau après sa fermeture logique ; les parcours U15 et niveau 9
  attendent désormais sa hauteur repliée avant le toucher suivant.
- **E2E sous surcharge (G2).** Les causes des flakes L17b et U15 sont
  corrigées (voir la dernière gate). Avec 16 workers sur 12 cœurs, U15 échoue
  encore 8 fois sur 100 sans lien avec ces causes : 6 dépassements du délai de
  30 s du test pendant les captures pleine page finales, et 2 dépassements de
  l’attente de 1 s de `waitForCatalogueToCollapse`. Non observé à 12 workers ni
  dans la gate.
- **E2E sous charge (M11).** La première gate après M11 a échoué une fois
  sur `layout.spec.ts` › « D4 — le scrim des propriétés… » (« Poutre
  moyenne » introuvable : le catalogue de l’atelier libre ne s’était pas
  ouvert au clic) ; 10 répétitions isolées passent (210/210) et la gate
  relancée passe. L’atelier libre n’est pas touché par M11.
- **Fichier d’essai de l’auteur.** `tmp/check-levels.ts` (ignoré par git) est
  lu par ESLint et fait échouer `pnpm lint` (« was not found by the project
  service ») ; les gates de M14b et M15 l’ont écarté du dépôt le temps de
  l’exécution, puis remis à l’identique.
- `format:check` ne couvre pas le Markdown.
- Le workflow `.github/workflows/check.yml` exécute la gate sur push et pull
  request avec Node 24, cache pnpm et Chromium Playwright. Son premier passage
  distant reste à vérifier au prochain push ; aucune matrice de téléphones
  physiques n’est définie.
- Un avertissement peer préexistant reste présent : `typescript-eslint@8.42.0`
  déclare TypeScript `<6`, alors que le dépôt utilise TypeScript 6.0.3. Il n’est
  pas lié aux pairs Workbox installés en L28.

## Dernière exécution de la gate

`pnpm check` après C3.1 (4 octobre 2026) : **passe** — typecheck, lint,
formatage, Knip, contenu (6 documents), 1215 tests Vitest (94 fichiers), build
(55 entrées de précache) et 89 E2E v1, aucun ignoré. Le fichier d’essai auteur
a été déplacé temporairement pour la gate puis restauré identique
(SHA-256 `1113625e…a92907`). Le validateur de construction ajoute un contrôle
de rotation fixe après une régression rouge repérée en revue.

`pnpm check` après T2 (3 octobre 2026) : **passe** — typecheck, lint,
formatage, Knip, contenu (6 documents), 1206 tests Vitest (90 fichiers), build
(55 entrées de précache) et 89 E2E v1, aucun ignoré. Le passage précédent
avait trouvé une course
dans N2 tuto-2 au clic sur un bouton de propriétés devenu absent ; le helper
attend désormais le panneau visible, sans changer les assertions métier.
Build puis rejeu isolé de tuto-2 : cinq réussites consécutives. Port 4319 ;
configuration Playwright (SHA-256 `9b03b7d8…754cb`) et fichier d’essai auteur
(SHA-256 `1113625e…a92907`) restaurés identiques. Validation visuelle C5 attendue.

`pnpm check` après C5 (3 octobre 2026) : **passe** — typecheck, lint,
formatage, Knip, contenu (6 documents), 1206 tests Vitest (90 fichiers), build
(55 entrées de précache) et 89 E2E v1, aucun ignoré. Premier passage : sept
attentes de tests antérieurs au délai échouent ; synchronisations corrigées
par l’agent de tests sans retrait d’assertion, puis gate entièrement verte.
Serveur local sur 4319, configuration Playwright restaurée identique
(SHA-256 `9b03b7d8…754cb`) et fichier d’essai auteur restauré identique
(SHA-256 `1113625e…a92907`). Validation visuelle C5 attendue.

`pnpm check` après C1 (3 octobre 2026) : **passe** — typecheck, lint,
formatage, Knip, contenu, 1201 tests Vitest (90 fichiers), build et 89 E2E
v1, aucun ignoré. Test ciblé du tutoriel 3 également vert. Serveur local sur
4319, configuration Playwright et fichier d’essai auteur restaurés identiques.

`pnpm check` après C0 (3 octobre 2026) : **passe** — typecheck, lint,
formatage, Knip, contenu, 1200 tests Vitest (90 fichiers), build et 89 E2E
v1, aucun ignoré. Serveur local isolé sur 4319. Configuration Playwright
restaurée identique (SHA-256 `9b03b7d8…754cb`) et fichier d’essai auteur
restauré identique (SHA-256 `1113625e…a92907`). Aucun changement d’écran.

`pnpm check` à la clôture de V9 (3 octobre 2026) : **passe** — typecheck,
lint, formatage, Knip, contenu (6 documents), 1200 tests Vitest (90 fichiers),
build (précache : 55 entrées, 2600,20 Kio) et **89 tests Playwright v1
réussis**, aucun ignoré. V9 ne change que la documentation ; le core est
validé par l'auteur, les détails visuels seront repris en fenêtre fraîche.
Gate sur le port isolé 4319 ; configuration restaurée identique (SHA-256
`9b03b7d8…754cb`) et fichier d'essai restauré identique (SHA-256
`1113625e…a92907`, mode 644).

`pnpm check` après V8 (3 octobre 2026) : **passe** — typecheck, lint,
formatage, Knip, contenu (6 documents embarqués), 1200 tests Vitest
(90 fichiers), build (précache : 55 entrées, 2600,20 Kio) et **89 tests
Playwright v1 réussis**, aucun ignoré. Le nouveau parcours complet et U6
passent dans la suite globale. Port isolé 4319, configuration restaurée
identique (SHA-256 `9b03b7d8…754cb`) ; fichier d'essai écarté puis restauré
identique (SHA-256 `1113625e…a92907`, mode 644). Seize captures desktop
conservées dans `tmp/v8/captures/` ; validation visuelle de l'auteur attendue.

Validation ciblée après le correctif U6 de V7b (3 octobre 2026) : `pnpm build`
passe, puis le seul test « U6 — remet l’atelier à zéro après confirmation au
tactile » passe sur `v1` (1 test). L'auteur demande cette relance ciblée puis
V8, sans nouvelle gate globale : exception consignée dans la feuille de route.
Fichier d'essai intact ; configuration Playwright temporairement sur 4319
puis restaurée identique (SHA-256 `9b03b7d8…754cb`).

`pnpm check` après l'implémentation de V7b (3 octobre 2026) : **échoue** sur
Playwright — 87 tests `v1` réussis, 1 échec dans `editor-interactions.spec.ts`
(U6, sélection ambiguë de « Atelier » pendant la navigation). Typecheck,
lint, Prettier, Knip, contenu (6 documents), Vitest (1200 tests, 90 fichiers)
et build (précache : 55 entrées, 2600,20 Kio) passent. La gate a été exécutée
hors sandbox et sur le port isolé 4319, le port 4173 étant occupé par une
autre application. Configuration Playwright restaurée à l'identique
(SHA-256 `9b03b7d8…754cb`) ; fichier d'essai restauré identique
(SHA-256 `1113625e…a92907`, mode 644). Captures V7b inspectées par l'agent
aux deux formats desktop, en dev et production ; validation de l'auteur
attendue. L'échec U6 est corrigé et son test relancé seul (voir ci-dessus).

`pnpm check` après T1 (2 octobre 2026) : passe — 1200 tests Vitest (90 fichiers), 88 tests
Playwright `v1` (0 ignoré), précache 55 entrées. `e2e/goal-ball.spec.ts` est stable en
isolation (5 exécutions sur 5) : `selectGoalBall` attend la feuille des propriétés avant de la
fermer. `tmp/check-levels.ts` écarté puis remis identique.

`pnpm check` après V7 (2 octobre 2026) : passe — typecheck, lint, formatage,
Knip, contenu (6 documents embarqués), 1200 tests Vitest (90 fichiers), build
(précache : 55 entrées, 2 606 Kio, contre 58 et 10 226 Kio avant) et 88 tests
Playwright du projet `v1` (0 ignoré). `tmp/check-levels.ts` écarté puis remis
identique. Captures de V7 : validation de l’auteur attendue.

`pnpm check` après V6 (2 octobre 2026) : passe — typecheck, lint, formatage,
Knip, contenu (6 documents embarqués), 1185 tests Vitest (89 fichiers), build et
87 tests Playwright du projet `v1` (0 ignoré). `tmp/check-levels.ts` écarté puis
remis identique. Captures de V6 : validation de l’auteur attendue.

`pnpm check` après V5 (2 octobre 2026) : passe — typecheck, lint, formatage,
Knip, contenu (6 documents embarqués), 1153 tests Vitest (87 fichiers), build et
87 tests Playwright du projet `v1` (0 ignoré). `tmp/check-levels.ts` écarté puis
remis identique. `LevelPreview` n'est utilisé que par ses tests jusqu'à V6 (Knip
le tolère).

`pnpm check` après V3 (2 octobre 2026) : passe — typecheck, lint, formatage,
Knip, contenu (6 documents embarqués), 1123 tests Vitest (84 fichiers), build et
87 tests Playwright du projet `v1` (0 ignoré). `tmp/check-levels.ts` écarté puis
remis identique. Captures de V3 : validation de l’auteur attendue.

`pnpm check` après V2c (2 octobre 2026) : passe — typecheck, lint, formatage,
Knip, contenu (6 documents embarqués), 1116 tests Vitest (84 fichiers), build et
87 tests Playwright du projet `v1` (0 ignoré). `tmp/check-levels.ts` écarté puis
remis identique.

`pnpm check` après V2b (2 octobre 2026) : passe — typecheck, lint, formatage,
Knip, contenu (6 documents embarqués), 1097 tests Vitest (83 fichiers), build et
86 tests Playwright du projet `v1` (0 ignoré). `tmp/check-levels.ts` écarté puis
remis identique. Captures de V2b : validation de l’auteur attendue.

`pnpm check` après V2a (2 octobre 2026) : passe — typecheck, lint, formatage,
Knip, contenu (6 documents embarqués), 1096 tests Vitest (83 fichiers), build et
86 tests Playwright du projet `v1` (0 ignoré). Une première exécution avait
échoué sur `smoke.spec.ts` « place au tactile puis annule le placement » (capture
du plateau avant pose ≠ après annulation) ; réussie 3 fois isolée puis à la gate
suivante : intermittence préexistante, sans lien avec la démo. `tmp/check-levels.ts`
écarté puis remis identique.

`pnpm check` après V1 (2 octobre 2026) : passe — typecheck, lint, formatage,
Knip, contenu (7 documents embarqués), 1096 tests Vitest (83 fichiers), build et
86 tests Playwright du projet `v1` (86 réussis, 0 ignoré). Aucune intermittence
de `layout.spec.ts` observée. Le fichier d’essai `tmp/check-levels.ts` a été
écarté puis remis identique. Captures E2E de N2 régénérées par la gate ; validation
visuelle de l’auteur attendue (non revalidées une à une, voir V9).

`pnpm check` après R1 (2 octobre 2026) : passe — typecheck, lint,
formatage, Knip, contenu (19 documents), 1090 tests Vitest (83 fichiers),
build et 78 tests Playwright mobile (77 réussis, 1 ignoré). Neuf captures
inspectées aux trois formats, validation de l’auteur attendue. Aucun test
supprimé ni ignoré pour ce changement ; les attentes U7 sont remplacées par
l’absence des surcharges refusées par l’auteur. Le fichier d’essai
`tmp/check-levels.ts` a été écarté puis remis identique. Gate de départ verte
avec sockets locaux et Chromium autorisés (le sandbox seul refuse le socket
local de `tsx`).

`pnpm check` après l’abandon et la désactivation U3 (2 octobre 2026) : passe —
typecheck, lint, formatage, Knip, contenu (19 documents), 1087 tests Vitest
(83 fichiers), build Vite/PWA et 78 tests Playwright `mobile` (77 réussis,
1 ignoré). Les sept tests des ombres conservées les activent explicitement ;
un huitième test et les trois nouveaux E2E vérifient leur absence par défaut.
L’E2E U1 d’origine passe sans adaptation de sa boîte ni de sa tolérance.
Douze captures du rendu sans ombres inspectées aux trois formats ; U3 est
abandonnée sur décision de l’auteur, sans validation visuelle en attente.
Pas d’intermittence D4 ni U15 observée. Le fichier d’essai de l’auteur
`tmp/check-levels.ts` a été écarté pour la gate puis remis identique (SHA-256
`1113625e…a92907`, mode 644).

`pnpm check` après U2 (2 octobre 2026) : passe — typecheck, lint,
formatage, Knip, contenu (19 documents), 1079 tests Vitest (83 fichiers),
build Vite/PWA et 75 tests Playwright `mobile` (74 réussis, 1 ignoré).
La première gate a révélé une assertion U7 de transparence remplacée par
une comparaison avec le fond et sa grille, et une pause tardive sous charge
(pas 65, balle à y = 6,845125, hors écran) ; le parcours contrôle désormais
400 ms simulées avec l’horloge Playwright. Il passe 6 fois sur 6 en répétition.
Les sept parcours ciblés U1/U2/U13 passent aussi. Captures U2 inspectées aux
trois formats ; validation de l’auteur attendue. `tmp/check-levels.ts`
écarté le temps des gates, puis remis identique (SHA-256 `1113625e…a92907`,
mode 644). La première tentative de gate de départ dans le sandbox était
refusée par l’ouverture du socket local de `tsx` ; les gates complètes ont
été exécutées avec l’autorisation de sockets locaux et de Chromium.

`pnpm check` après U11 (2 octobre 2026) : passe — typecheck, lint,
formatage, Knip, contenu (19 documents), 1073 tests Vitest (83 fichiers),
build Vite/PWA et 72 tests Playwright `mobile` (71 réussis, 1 ignoré). Une
première exécution s’était arrêtée au formatage (nouvel E2E pas encore passé
par Prettier), corrigé avant la gate verte. Pas d’intermittence D4 ni U15
observée. `tmp/check-levels.ts` écarté du dépôt le temps de la gate (ESLint le
refuse), puis remis à l’identique (SHA-256 `1113625e…a92907` et mode 644
vérifiés).

`pnpm check` après U10 (2 octobre 2026) : passe — typecheck, lint,
formatage, Knip, contenu (19 documents), 1049 tests Vitest (81 fichiers),
build Vite/PWA et 69 tests Playwright `mobile` (68 réussis, 1 ignoré). Une
première exécution s’était arrêtée à Knip (type exporté inutilisé), corrigé
avant la gate verte. Pas d’intermittence D4 ni U15 observée. Le fichier d’essai de
l’auteur `tmp/check-levels.ts` a été écarté du dépôt le temps de la gate
(ESLint le refuse), puis remis à l’identique (SHA-256 `1113625e…a92907` et
mode 644 vérifiés).

`pnpm check` après U8 (2 octobre 2026) : passe du premier coup —
typecheck, lint, formatage, Knip, contenu (19 documents), 1025 tests Vitest
(80 fichiers), build Vite/PWA et 65 tests Playwright `mobile` (64 réussis,
1 ignoré). Pas d’intermittence D4 ni U15 observée. `tmp/check-levels.ts`
écarté puis remis à l’identique.

`pnpm check` après U7 (2 octobre 2026) : passe du premier coup —
typecheck, lint, formatage, Knip, contenu (19 documents), 1009 tests Vitest
(79 fichiers), build Vite/PWA et 62 tests Playwright `mobile` (61 réussis,
1 ignoré). Pas d’intermittence D4 ni U15 observée. Le fichier d’essai de
l’auteur `tmp/check-levels.ts` a été écarté du dépôt le temps de la gate
(ESLint le refuse), puis remis à l’identique (SHA-256 `1113625e…a92907` et
mode 644 vérifiés).

`pnpm check` après U13 (2 octobre 2026) : passe du premier coup —
typecheck, lint, formatage, Knip, contenu (19 documents), 1002 tests Vitest
(79 fichiers), build Vite/PWA et 60 tests Playwright `mobile` (59 réussis,
1 ignoré). Pas d’intermittence D4 ni U15 observée. Le fichier d’essai de
l’auteur `tmp/check-levels.ts` a été écarté du dépôt le temps de la gate
(ESLint le refuse), puis remis à l’identique (SHA-256 `1113625e…a92907` et
mode 644 vérifiés).

`pnpm check` après U1 (2 octobre 2026) : passe — typecheck, lint,
formatage, Knip, contenu (19 documents), 994 tests Vitest (78 fichiers), build
Vite/PWA et 58 tests Playwright `mobile` (57 réussis, 1 ignoré). Une première
exécution s’était arrêtée à Knip (type `BoardAppearance` exporté sans
usage), corrigé avant la seconde. Pas d’intermittence D4 ni U15 observée. Le
fichier d’essai de l’auteur `tmp/check-levels.ts` a été écarté du dépôt le
temps de la gate (ESLint le refuse), puis remis à l’identique (SHA-256
`1113625e…a92907` et mode 644 vérifiés).

`pnpm check` après U12 (2 octobre 2026) : passe du premier coup —
typecheck, lint, formatage, Knip, contenu (19 documents), 982 tests Vitest
(77 fichiers), build Vite/PWA et 56 tests Playwright `mobile` (55 réussis,
1 ignoré). Le fichier d’essai de l’auteur `tmp/check-levels.ts` a été écarté du
dépôt le temps de la gate (ESLint le refuse), puis remis à l’identique
(SHA-256 `1113625e…a92907` et mode 644 vérifiés).

`pnpm check` après M15 (2 octobre 2026) : passe du premier coup —
typecheck, lint, formatage, Knip, contenu (19 documents), 975 tests Vitest
(77 fichiers), build Vite/PWA et 55 tests Playwright `mobile` (54 réussis,
1 ignoré). Tâche documentaire : aucun test ajouté. Le fichier d’essai de
l’auteur `tmp/check-levels.ts` a été écarté du dépôt le temps de la gate
(ESLint le refuse), puis remis à l’identique (SHA-256 et mode vérifiés).

`pnpm check` après M14b (2 octobre 2026) : passe du premier coup —
typecheck, lint, formatage, Knip, contenu (19 documents), 975 tests Vitest
(77 fichiers), build Vite/PWA et 55 tests Playwright `mobile` (54 réussis,
1 ignoré). Le fichier d’essai de l’auteur `tmp/check-levels.ts` a été
écarté du dépôt le temps de la gate (ESLint le refuse), puis remis à
l’identique.

`pnpm check` après M14 (1er octobre 2026) : passe du premier coup —
typecheck, lint, formatage, Knip, contenu (19 documents), 951 tests Vitest
(77 fichiers), build Vite/PWA et 54 tests Playwright `mobile` (53 réussis,
1 ignoré).

`pnpm check` après chacune des tâches M1 à M13 (1er octobre 2026) : passe
chaque fois — typecheck, lint, formatage, Knip, contenu (19 documents), build
Vite/PWA et Playwright `mobile` (un test ignoré à chaque fois). Tests Vitest
(fichiers) et tests Playwright `mobile` (réussis) : M1 750 (59) et 45 ; M2 755
(60) et 45 ; M3 790 (61) et 45 ; M4 807 (61) et 45 ; M4b 810 (61) et 45 ; M5
816 (63) et 45 ; M6 825 (65) et 45 ; M6b 825 (65) et 45 ; M7 831 (65) et 45 ;
M7b 833 (65) et 45 ; M8 842 (66) et 46 ; M9 866 (67) et 46 ; M10 880 (69) et
48 ; M11 899 (72) et 50 ; M12 907 (73) et 51 ; M13 921 (75) et 52. M12 et M13
passent du premier coup ; la première exécution de M11 avait échoué sur
l’intermittence D4 décrite dans les dettes.

`pnpm check` après G2 (1er octobre 2026) : passe — typecheck, lint,
formatage, Knip, contenu (19 documents), 737 tests Vitest (59 fichiers),
build Vite/PWA et 46 tests Playwright `mobile` (45 réussis, 1 ignoré). Les
deux flakes sont reproduits puis corrigés (`--repeat-each`, workers élevés) :
U15 échouait 20 fois sur 50 (12 workers), L17b 5 fois sur 100 (16 workers) ;
après correction, 0 sur 50 pour chacun à 12 workers et 0 sur 100 pour L17b à
16 workers. U15 : le clic qui suit le toucher de sélection tombait sur le scrim
du tiroir compact, ouvert pendant ce toucher, et le refermait (correction de
production, voir « Présentation et interface »). L17b : le geste partait de
l’empreinte du levier et le déplaçait au lieu de le tourner depuis la
poignée ; ses comparaisons de canvas, en pixels physiques, pouvaient dépasser
à elles seules le budget de 2 s de leur attente. Le test vise désormais la
poignée, compare en pixels CSS et attend que l’historique montre le second
quart de tour.

`pnpm check` après G1 (1er octobre 2026) : passe trois fois de suite —
typecheck, lint, formatage, Knip, contenu (19 documents), 734 tests Vitest
(58 fichiers), build Vite/PWA et 46 tests Playwright `mobile` (45 réussis,
1 ignoré). `src/app/BenchPage.test.tsx` y prend 348 à 573 ms pour ses 3 tests.
La cause du timeout intermittent était le premier test, qui simulait 1 200 pas
réels de la scène dense (2,8 à 3,8 s mesurés dans la suite complète) ; il
utilise désormais une session injectée (`createSession`). Les flakes E2E L17b
et U15 ne se sont pas manifestés sur ces trois exécutions (G2 reste ouverte).

`pnpm check` après l’import JSON (1er octobre 2026) : deux tentatives passent
typecheck, lint, formatage, Knip et validation des 19 niveaux ; chacune échoue
ensuite sur le timeout à 5 s du test préexistant
`src/app/BenchPage.test.tsx` (729 tests sur 730). Ce test passe seul (3/3).
`pnpm build` passe. La suite Playwright mobile séparée donne 43 réussites,
1 scénario ignoré et deux échecs intermittents préexistants (L17b et U15) ; les
deux passent lorsqu’ils sont rejoués seuls. Le nouveau test E2E d’import passe
dans la suite complète et isolément. Captures :
`test-results/import/import-{390x844,844x390,1440x900}.png`.

`pnpm check` après la landing d’accueil (1er octobre 2026) : passe — typecheck,
lint, formatage, Knip, validation des 19 documents, 713 tests Vitest, build
Vite/PWA et 44 tests Playwright mobiles réussis (1 scénario desktop ignoré).
Une première exécution complète a rencontré l’intermittence U15 déjà documentée ;
U15 passe en isolation, puis la gate complète relancée passe sans modification
du câblage. Les trois parcours de l’accueil couvrent les destinations, le retour
navigateur, la reprise de progression et les quatre formats de capture.
Captures inspectées : `test-results/home/accueil-{390x844,844x390,1440x900,320x568}.png`.
La validation visuelle de l’auteur reste attendue.

`pnpm check` après la retouche visuelle de `/levels` (27 septembre 2026) :
typecheck, lint, formatage, Knip et validation des 19 documents passent ; 705
tests Vitest sur 706 passent. Le seul échec est le timeout préexistant de
`src/app/BenchPage.test.tsx` à 5 s sous charge, laissé inchangé à la demande de
l’auteur ; ses 3 tests passent en isolation. Le build Vite/PWA passe séparément,
les 72 tests `App.test.tsx` passent et les 2 parcours Playwright mobiles de
`e2e/levels.spec.ts` passent. Captures de production :
`test-results/levels-page/levels-{390x844,844x390,1440x900}.png`.

`pnpm check` après N1 (27 septembre 2026) : passe — typecheck, lint, formatage, Knip, contenu (19 documents), 706 tests Vitest (55 fichiers), build Vite/PWA et 41 tests Playwright `mobile` réussis (1 test desktop ignoré par ce projet).

`pnpm check` après U26 et la réparation E2E du catalogue (27 septembre 2026) :
typecheck, lint, formatage, Knip, contenu, 797 tests Vitest (66 fichiers), build
et 56 tests Playwright `mobile` (55 réussis, 1 ignoré).

`pnpm check` après U5 (27 septembre 2026) : passe d’une traite — typecheck,
lint, formatage, Knip, contenu, 741 tests Vitest (62 fichiers), build et 55
tests Playwright `mobile` (54 réussis, 1 ignoré).

`pnpm check` après U4 (27 septembre 2026) : passe d’une traite — typecheck,
lint, formatage, Knip, contenu, 740 tests Vitest (62 fichiers), build et 54
tests Playwright `mobile` (53 réussis, 1 ignoré).

`pnpm check` après U21 (27 septembre 2026) : passe d’une traite au second
essai — typecheck, lint, formatage, Knip, contenu, 727 tests Vitest (61
fichiers), build et 51 tests Playwright `mobile` (50 réussis, 1 ignoré). Le
premier essai avait échoué sur l’E2E instable du niveau 9 (voir les dettes).

`pnpm check` après U6 (27 septembre 2026) : passe — 729 tests Vitest, build et
52 tests Playwright `mobile` (51 réussis, 1 ignoré).

Complément U6 : 730 tests Vitest, typecheck, lint, formatage, Knip, contenu et
build passent. La suite E2E mobile standard a rencontré des flakies préexistants
sur des inspecteurs de niveaux ; la relance Playwright en mode CI a terminé avec
53 tests (51 réussis, 1 flaky, 1 ignoré).

Exécution précédente :
`pnpm check` après U15 (27 septembre 2026) : passe d’une traite — typecheck,
lint, formatage, Knip, contenu, 704 tests Vitest (61 fichiers), build et 50
tests Playwright `mobile` (49 réussis, 1 ignoré).

Exécution antérieure :
`pnpm check` après U19, U20 et le délai des recherches du niveau 12
(27 septembre 2026) : passe d’une traite — typecheck, lint, formatage, Knip,
contenu, 693 tests Vitest (60 fichiers), build et 48 tests Playwright `mobile`
(47 réussis, 1 ignoré). Dans la suite complète, le produit croisé du niveau 12
a pris 4,6 s (délai 20 s) et la recherche à un objet 12,0 s (délai 60 s) ;
seuls, 2,1 s et 9,4 s. Les autres régressions de niveau restent sous 1 s.

Exécution précédente, après L28 :
`pnpm check` passe le 27 septembre 2026 après L28 : typecheck, lint,
formatage, Knip, contenu (14 niveaux embarqués), 637 tests Vitest (54 fichiers),
build avec manifeste et service worker PWA, puis 45 tests Playwright `mobile` (44
réussis, 1 ignoré car C3 est spécifique au projet desktop).
Une première exécution a eu un timeout intermittent sur le tiroir de propriétés du niveau 9 ; le test passe seul et la gate complète
relancée passe. Le parcours mobile L17b ouvre maintenant
l’inspecteur compact avant de
vérifier les propriétés du levier sélectionné. Les captures au repos sont
conservées sous `test-results/levels/` pour les niveaux 1 à 12, en portrait et
paysage ; les trois orientations du levier y sont aussi capturées. La première
gate L16 avait expiré sur le parcours tactile préexistant du niveau 5 ; ce parcours
passe isolément et dans la gate complète relancée sans modification.
`pnpm build && pnpm exec playwright test --project=desktop` passe également :
30 tests réussis, dont C3 (vérifié pendant L1). Les tests lourds de frontière de
couches et de banc dense conservent leur délai explicite de 30 s, sans assertion
affaiblie.
