# Feuille de route active

Cette feuille fait seule autorité sur l’ordre du travail restant. L’état livré et
les dettes sont dans `etat.md`, les contrats techniques dans les ADR. Les anciens
journaux, plans préparatoires et todos ont été consolidés le 5 octobre 2026 ; leur
historique reste accessible dans Git, avant le commit de nettoyage.

## Point de reprise — 5 octobre 2026

Le core desktop v1 est validé par l’auteur. Les compléments C0–C9, les reprises
visuelles C4/C6, l’identité de l’accueil et des pages, les Paramètres, les sept
tutoriels et le stockage IndexedDB sont implémentés. Cela ne clôture pas C10 :
la recette visuelle de l’auteur reste attendue. C7d reste à faire.

Le lot indépendant commande de release → nettoyage documentaire → vérifications
est livré. La publication `0.2.0` attend le push depuis la machine de l’auteur ; elle ne rouvre
pas les anciens lots produit. `art/` est conservé intégralement.

## Règles de la reprise active

- Lire `index.md`, cette reprise et la tâche concernée, puis `AGENTS.md`.
  Suivre le routage ; ne pas charger les anciens journaux depuis Git pour coder.
- Une tâche et un propriétaire d’écriture à la fois. Un seul sous-agent actif,
  sans délégation imbriquée ; le même agent fait tests, code et corrections.
  L’orchestrateur reste responsable et peut réaliser les corrections locales.
- Sol 6.1 conduit la reprise et prend l’UI. Luna `xhigh` convient au mécanique ;
  choisir les autres modèles autorisés selon la difficulté. Astra est interdit.
- Red-Green-Refactor pour tout comportement ou bug. Tests ciblés au fil du
  travail, `pnpm check:fast` pour élargir, `pnpm check` avant clôture.
  Lire les scripts dans `package.json`. Build avant tout Playwright isolé.
- Décision dans son propriétaire avant code. Pas de nouvelle dépendance
  structurante sans décision ni d’interface nouvelle sans maquette acceptée.
- Un commit par lot validé, en français à l’impératif avec identifiant.
  Ne pousser que dans le périmètre de publication autorisé par l’auteur.
- Fournir et inspecter les captures concernées : 1440 × 900 et 1280 × 720
  pour desktop ; portrait/paysage pour v2. Garder « validation visuelle
  attendue » jusqu’à l’accord de l’auteur. Une recette différée ne vaut pas
  validation et ne rouvre pas les comportements déjà autorisés.
- Desktop d’abord jusqu’à M0. Les jalons produit v1/v2/v3 ne sont pas des
  numéros SemVer ni `LevelDocument.schemaVersion`.
- Préserver `tmp/check-levels.ts`, le fichier d’essai de l’auteur.
  Stocker les captures à conserver hors de `test-results/`, vidé par Playwright.
- Le journal de cette feuille contient les nouveaux lots, pas le récit du
  bootstrap. Consigner résultat, gate, commit, reports et prochaine étape ;
  laisser un résumé utile pour la reprise d’une autre session.

## Ordre restant

Demande directe de l’auteur du 6 octobre 2026, avant C7d : corriger le sens
après rotation et remplacer la démo par `levels/demo-landing-remix.json` (CONV1),
puis créer et intégrer un convoyeur sans pieds (CONV2). Visuel du kit validé
par l’auteur. Intégration des flèches et roues animées, contour de capsule et
entraînement périphérique réalisés ; captures intégrées pour la recette finale.

Demande directe de l’auteur du 6 octobre 2026, avant C7d : harmoniser
Paramètres avec l’identité de l’application, y ajouter import/export de la
progression et redresser les textes de l’accueil. Implémentation UI4 ci-dessous ;
validation visuelle auteur attendue.

Demande directe de l’auteur du 5 octobre 2026, avant la reprise de C7d :
rapprocher les cartes communes de niveaux de `art/campaign/campaign-v2.png`.
Papier irrégulier et ombré, très faible inclinaison dans les deux sens,
épingle ou scotch des assets fournis ; position, orientation et dimensions du
scotch variées, stables par identifiant de niveau. Fournir les deux captures
desktop ; validation visuelle de l’auteur attendue.

Complément demandé dans la même session : reprise visuelle de `/my-levels`
selon `art/my-levels/ref.png` et les assets voisins (panneaux papier et bleu,
icônes, sous-titres, actions sur deux lignes). L’auteur confirme « reprise
visuelle seulement » : C7d reste séparé. À sa demande complémentaire, réussite
et échec d’un import JSON se signalent par un toast temporaire et refermable ;
« Jouer quand même » reste disponible si le niveau n’a pas pu être gardé.
Précision de l’auteur : garder exactement le style commun des cartes de la
campagne (papier, inclinaison, fixations), et utiliser les deux backgrounds
fournis pour les blocs, sans variante de carte propre à Mes niveaux.

Suite demandée : reprendre uniquement le catalogue du plateau selon
`art/refs/playground-v2.png` ; ne pas changer le reste de l’atelier. L’auteur
demande le visuel, les catégories repliables et la recherche. Les catégories
restent ouvertes initialement ; rechercher affiche aussi les objets des groupes
repliés. La recette visuelle globale est différée à la fin à sa demande.
Dernière précision de l’auteur : le fond du catalogue doit être jaune papier,
comme la référence, et le design doit être validé avant de lancer la gate complète.
Derniers ajustements demandés : une courte animation d’ouverture/fermeture des
catégories et, en portrait sur smartphone, des tiroirs horizontaux avec une petite
poignée illustrée verticale, de même hauteur que les cartes, suivie des cartes,
selon la capture fournie. Animation CSS,
sans nouvelle dépendance ; la préférence de réduction des animations est respectée.

| Ordre | Lot | Dépendance et sortie |
| --- | --- | --- |
| 1 | C7d — Recherche et filtres de Mes niveaux | Identité C7c implémentée ; recherche et filtres testés. |
| 2 | C10 — Recette desktop | C7d et compléments ; validation visuelle auteur et gate. |
| 3 | M0–M4 — Téléphone et tablette | C10 ; gestes et maquettes acceptés, interfaces et recette. |
| 4 | F0–F3 — Forge et Grist | M4 ; migration d’hébergement et soumission vérifiée. |
| Réserve | Nouveaux objectifs (v4) | Contrats et migrations à décider ; pas de code anticipé. |

## Compléments desktop

### C7d — Recherche et filtre de Mes niveaux

- Sous le titre, recherche sur le titre et filtre « Tous / Créations / Reçus »
  sur une seule ligne à toutes les largeurs, suivant
  `maquettes/identite/mes-niveaux.html` et `niveaux.css`.
- Pas de tri : écarté par l’auteur le 5 octobre, à rouvrir seulement si utile.
- Tâche confiée à Luna par l’auteur ; tests et implémentation dans le même lot.

### C10 — Recette des compléments desktop

- Les reprises C4/C6 et de l’identité sont implémentées ; ne pas refaire ces
  lots sur la seule base des anciens todos. Valider leur état réel à l’œil.
- Rejouer fil direct et contrôleur → minuteur → dispositif (un fil logique,
  deux segments, transitions retardées), reprise locale, poutres, victoire
  et familles nouvelles dans un niveau partagé.
- Vérifier accueil, splash, icônes, Paramètres et résultat à 1440 × 900 et
  1280 × 720 ; fournir une recette actuelle, pas les captures du bootstrap.
- Demande conservée du todo du 5 octobre : examiner la poignée de taille en
  résolution quand la taille est fixée par l’inventaire ; la masquer si aucune
  action n’est possible. Vérifier le comportement avant toute correction.
- La proposition d’une scène maximale où l’on pose partout n’est pas un
  changement de contrat accepté. Discuter scène, zones et compréhension du
  cadrage avec l’auteur ; ne pas modifier le format sans décision et tests.
- **Sortie :** gate verte et validation de l’auteur, ou reports explicites.

## Séquence active — téléphone (v2)

### M0 — Fixer les interactions et valider les maquettes

- Priorité : **poser → tourner/ajuster → lancer**, avec un plateau dégagé.
  Annuler, supprimer/retirer, caméra et propriétés restent accessibles.
- Reporter les décisions confirmées dans `mobile-editor-interactions.md` :
  la sélection et l’ouverture des propriétés deviennent deux états distincts.
  Remplacer les passages qui feraient ouvrir le panneau à la pose ou au drag.
- Faire des maquettes portrait et paysage avec les vrais sprites ; vérifier
  aussi un niveau comportant plusieurs commandes et un fil de commande.
- Proposer également la tablette en portrait et paysage ; ne pas décider
  seul de sa disposition. Rendre visible le tiroir d’objets au premier lancement,
  et discuter un mini-tutoriel avec Bolt avec l’auteur.
- Réévaluer l’encombrement de l’inspecteur, des commandes caméra et des blocs
  horizontaux ; la liste des objets desktop a déjà été retirée.
- **Sortie :** gestes et maquettes acceptés avant l’implémentation de la mise
  en page.

### M1 — Ouvrir les propriétés uniquement sur toucher simple

- Une pose sélectionne l’objet et laisse le tiroir fermé. Un déplacement ou
  une manipulation de poignée laisse aussi le tiroir fermé.
- Un toucher simple sur un objet ouvre ses propriétés ; le relâchement d’un
  drag ne doit pas être interprété comme ce toucher, y compris via un clic
  synthétique. Garder une alternative accessible au geste.
- Réutiliser la séparation sélection/ouverture introduite pour desktop en C4a,
  et compléter les comportements spécifiques au toucher.
- Respecter le parcours particulier des fils et les objets verrouillés.
- **Sortie :** tests de pose, toucher, drag, annulation du pointeur et sélection
  d’un autre objet ; aucun tiroir ouvert involontairement.

### M2 — Libérer le plateau en portrait

- Catalogue dans un tiroir repliable ; propriétés fermées par défaut selon M1.
- Retirer de l’affichage permanent les informations secondaires selon la
  maquette, avec des accès visibles pour les retrouver.
- Garder « Lancer » facilement accessible et tester le cycle complet d’édition,
  de simulation et de retour à la construction.
- **Sortie :** parcours utilisable à 390 × 844 et petit format 320 × 568,
  sans contrôle essentiel masqué ni défilement de page involontaire.

### M3 — Libérer la hauteur en paysage

- Catalogue visible sur le côté, comme sur ordinateur, suivant la maquette.
  Propriétés dans un tiroir ouvert à la demande.
- Déplacer les blocs horizontaux supérieurs vers les zones latérales
  disponibles ; ne pas simplement réduire tous les contrôles.
- Respecter les safe areas et les cibles tactiles. Le passage portrait/paysage
  conserve le travail engagé et annule proprement un geste en cours.
- **Sortie :** parcours à 844 × 390 et petit paysage, plateau réellement
  utilisable, pas de recouvrement des actions essentielles.

### M4 — Recette téléphone

- Tester campagne, niveau reçu et Atelier : pose, rotation, taille, câblage,
  propriétés, undo/redo, simulation, reprise et changement d’orientation.
- Vérifier sur appareils réels disponibles et fournir les captures portrait et
  paysage ; conserver les parcours desktop.
- Rendre les parcours téléphone critiques obligatoires dans la gate v2,
  avec mise à jour de `qualite.md` et de la décision d’outillage concernée.
- **Sortie :** gate desktop et téléphone verte, validation de l’auteur,
  journal et état livré à jour.

## Séquence active — Forge et Grist (v3)

### F0 — Déplacer le dépôt et l’hébergement

- Confirmer Forge, dépôt cible, hébergement, URL publique, CI, sauvegarde de
  l’historique Git et stratégie de transition. Ne pas supposer un fournisseur.
- Adapter build, base d’URL, routes, assets, manifeste, service worker et CI
  à l’hébergement retenu ; vérifier les accès directs aux pages et le hors ligne.
- Définir le devenir des anciens liens partagés. Un changement d’origine
  donnera un stockage local distinct ; conformément au choix de l’auteur,
  aucun parcours de transfert des anciennes données locales n’est prévu.
- **Sortie :** dépôt et application vérifiés sur la Forge, liens et bascule
  documentés ; bascule effective selon l’autorisation de publication donnée
  pour cette future tâche.

### F1 — Définir et prototyper la collecte Grist

- Vérifier les capacités et limites de l’instance de la Forge, puis fixer Q8.
  Prototyper l’envoi depuis TinkerBolt avec URL de niveau complète, pseudo,
  description et consentement explicite. La licence reste celle de l’ADR 0016 :
  **CC BY 4.0**. Documenter le point d’entrée et, si nécessaire, le relais.
- Proposition de données : URL, titre, pseudo, description, consentement,
  date de soumission, état de modération et notes internes. Les métadonnées
  sont déjà présentes dans le niveau ; les colonnes servent au tri du mainteneur.
- Garder les soumissions et notes hors d’un catalogue public. Afficher avant
  l’envoi qu’une proposition sera examinée, qu’elle n’est pas automatiquement
  publiée et que le joueur doit faire attention au contenu partagé.
- Envoyer l’URL complète, fragment compris, comme une valeur ; tester aussi
  la plus longue URL acceptée par le codec. Définir validation, taille maximale,
  contrôle du consentement et comportement en cas d’échec ou de nouvel essai.
- **Sortie :** prototype vérifié, table et parcours retenus, textes validés.

### F2 — Proposer sa création depuis l’application

- Ajouter « Proposer ce niveau » à l’endroit retenu du partage/export, en
  réutilisant l’export puzzle vérifié et le codec URL existants.
- Présenter la licence et une case non cochée par défaut. Aucun envoi sans
  action explicite et consentement ; conserver pseudo et description du niveau.
- Le formulaire et les états « envoi en cours », réussite et erreur restent
  dans TinkerBolt. Afficher la réussite après confirmation réelle de réception ;
  prévoir un nouvel essai sans double envoi involontaire.
- **Sortie :** parcours complet testé dans l’application : refus sans
  consentement, soumission réussie et erreur ; aucune perte de la création locale.

### F3 — Récupérer et examiner les propositions

- Documenter le parcours du mainteneur depuis son environnement de travail :
  retrouver les propositions, ouvrir/tester le niveau, filtrer le contenu,
  marquer accepté/refusé. L’intégration à la campagne reste une action distincte.
- Réutiliser les codecs, migrations et validations du jeu pour les données
  récupérées ; afficher pseudo et description comme du texte brut.
- **Sortie :** une proposition de test récupérée et examinée de bout en bout,
  droits d’accès vérifiés, recette v3 et journal terminés.

## Réserve v4 — sans implémentation anticipée

Les nouveaux objectifs restent en v4. À cette étape, prévoir une décision
séparée sur leur modèle, leur combinaison, leur évaluation au pas fixe, leurs
outils auteur et la compatibilité des niveaux existants. Exemples conservés du
todo : balle à l’écran pendant 15 s, deux balles dans deux paniers, caisse à
déplacer. Aucun de ces exemples n’est déjà un contrat technique.

## Arbitrage ouvert

**Q8 :** mécanisme de soumission réellement disponible sur l’instance Grist de
la Forge, éventuel relais et hébergement. F1 le fixe avant F2.

## Journal des lots de maintenance

### TEST2 — Stabiliser les délais des tests — 6 octobre 2026 — livré

Trois tests échouaient sous charge à cause de délais trop serrés : deux
parcours applicatifs dépassaient les 5 s par défaut et l’attente du stockage
dans le fixture s’arrêtait après 1 s. Les assertions sont inchangées ; ces
parcours ont un délai de 15 s et l’attente partagée du chargement, 4 s. Les
trois cas ciblés passent ensemble.
Gate finale : `pnpm check` verte — 2 202 tests Vitest dans 123 fichiers, build
et 121 E2E v1. Aucun comportement produit modifié.

### CONV2 — Intégrer le convoyeur sans pieds — 6 octobre 2026 — livré, recette intégrée attendue

Visuel du kit `art/assets/conveyor/v2/` validé par l’auteur, puis remplacement
demandé dans le jeu et l’éditeur. Sources originales conservées. Export ciblé
`art/build-conveyor-sprites.py`, réutilisé par le script global : même largeur
monde 3, hauteur proportionnelle 0,532075, tous les PNG sous 60 Ko. Deux instances
du même sprite de roue ; pivots et angles issus du déplacement simulé de la
courroie. Le caoutchouc reste fixe, les repères périphériques sont facultatifs.

Contrat accepté consigné dans le catalogue et l’ADR 0007 avant code : capsule
solide sans pieds (rectangle et deux cercles), vitesse de surface tangentielle
constante autour du contour, sens opposés sur les deux faces et vitesse nulle
à l’arrêt. Aucun changement du format de niveau ni des permissions d’édition.

Red-Green : ancien sens de surface remis sur la nouvelle géométrie pour la
régression finale, 302 cas rouges ; nouvelle logique, 576 cas verts couvrant
les 24 angles par pas de 15°, deux sens et 12 zones (faces, jonctions, arcs).
Contact vérifié à chaque pas. Sur les arcs, comparaison avec une caisse témoin
sur courroie arrêtée : isole la propulsion de la gravité et de la rotation de
la caisse, sans supposer une adhésion. Les faces vérifient aussi le mouvement
absolu. 96 cas de rendu couvrent les deux pivots, tous les angles et les offsets
positifs, négatifs et nuls. Dimensions et budgets des sprites vérifiés.

Les assertions de roulement gardent leurs seuils : fixture réalignée sur la
même hauteur de contact avec la nouvelle épaisseur. L’ancien export d’accueil,
retiré du jeu, dépendait du dessous entraînant dans le même sens que le dessus ;
son scénario de pistons utilise un sens adapté dans une copie de test seulement.
Exports originaux de la démo inchangés ; le remix actif fonctionne tel quel pendant 30 s et
se réinitialise sans modifier son document. La première gate a révélé une
régression du tutoriel 5, sans affaiblir le test de victoire : recalage du seul
convoyeur de −0,02 en x et −0,04 en y, dans la source auteur et la copie embarquée.
Même solution et mêmes objets joueur ; les sept solutions de campagne gagnent.

Captures intégrées inspectées dans `tmp/conveyor-integration/`, à 1440 × 900 et
1280 × 720 : accueil et jeu à 0°, 15° et 180°. Animation et pause vérifiées dans
Chromium, sans erreur navigateur. Signalement d’inversion des chevrons levé
par l’auteur : convoyeur retourné à 180°, directions locales confirmées.
`pnpm check` vert : **2 202 tests Vitest dans 123 fichiers**, neuf documents,
build et **121 E2E v1**, dont victoire du tutoriel 5. Captures de l’Atelier et de
cette victoire également inspectées aux deux formats. Log :
`/tmp/tinkerbolt-conveyor-integration-check.log`. Commit local CONV2, aucun push. Recette auteur du rendu intégré attendue, visuel source accepté.

### CONV1 — Sens du convoyeur et remix de l’accueil — 6 octobre 2026 — validation visuelle attendue

Le calcul de vitesse de surface ignorait la rotation : la caisse partait dans
le mauvais sens à 180° et les bandes verticales n’entraînaient presque rien.
Test rouge sur six des huit orientations/sens initiaux ; projection de l’axe
local sur la tangente du contact, puis vert. À la demande de l’auteur, la
régression couvre les 24 angles de pose de 0° à 345° par pas de 15°, dans les
deux sens (48 cas), avec maintien du contact et conservation du document.

La copie embarquée de la démo reprend exactement `levels/demo-landing-remix.json`.
Rouge puis vert sur l’export actif ; les deux pistons sont observés pendant
30 secondes sur l’original et le remix, sans résultat de partie, avec reset.
L’original reste une fixture de projection de solution ; l’export remix de
l’auteur est conservé. Aucun changement des faces actives : après avis sur
une courroie périphérique, l’auteur décidera entre celle-ci et une seule face.
Le faux commentaire annonçant un dessous inerte est corrigé, la limite consignée.

Captures du convoyeur retourné et de l’accueil mis à jour inspectées dans
`tmp/conveyor-rotation/`, à 1440 × 900 et 1280 × 720. Gate finale `pnpm check`
verte : 1 566 tests Vitest dans 123 fichiers, neuf documents, build et
121 E2E v1. Log : `/tmp/tinkerbolt-conveyor-remix-check.log`.
Validation visuelle auteur attendue. Aucun commit ni push à ce stade.
Prochaine étape dans ce périmètre : décision auteur sur la courroie ou la
face unique, puis correction du contour physique en accord avec l’asset.
Cette suite est réalisée dans CONV2 ci-dessus.

### UI4 — Paramètres et netteté de l’accueil — 6 octobre 2026 — validation visuelle attendue

Demande directe de l’auteur, avant C7d. Paramètres utilise les textures papier
et plan bleu des panneaux de Mes niveaux, en deux colonnes desktop, avec un
bloc À propos commun. La feuille d’accueil est redressée ; le contenu n’est
plus sous une transformation de rotation.

Import/export de progression : fichier JSON `progress` v1 (résolutions et
records, sans constructions, créations ni préférences), validation Zod partagée
avec IndexedDB et limite 256 Kio avant parsing. L’import fusionne atomiquement
les résultats en conservant les meilleurs records, attend les écritures précédentes
et actualise la campagne seulement après succès. Aucun changement de format ni
migration ; contrat dans l’amendement de l’ADR 0011. Les autres tables restent
intactes. Erreurs de fichier, lecture et stockage affichées sans faux succès.

Rouge puis vert : codec absent, méthode de fusion absente, boutons absents et
rotation héritée du titre. Tests du codec, de la lecture, du repository et du
contexte (refus, ordre victoire/import/reset), E2E export → reset → réimport,
fusion, conservation du pseudo, refus de fichiers et déblocages après rechargement.
Luna `xhigh` a adapté les repositories simulés des anciens tests et couvert le
refus des clés réservées sans modifier les assertions existantes.

Captures après disparition du splash, inspectées à 1440 × 900 et 1280 × 720 :
`tmp/settings-home/settings-*.png` et `home-*.png`. Validation visuelle auteur
attendue. Gate finale `pnpm check` verte : 1 516 tests Vitest dans 122 fichiers,
contrôles statiques/contenu, build et 121 E2E v1. Le sélecteur de jauge des nouveaux
E2E utilise son nom accessible et attend la fin du splash ; les assertions de
conservation des records restent inchangées. Log :
`/tmp/tinkerbolt-settings-check.log`. Aucun commit ni push ; C7d reste séparé.

### TEST1 — Stabiliser la gate Playwright standard — 6 octobre 2026 — livré

L’auteur a signalé cinq E2E rouges avec `pnpm check` : trois comparaisons de
l’en-tête et deux recherches du catalogue. Reproduction avec
`@playwright/test` 1.55.0 et son Chromium 140 : `fill()` laissait la recherche
vide ; l’en-tête prenait ses dimensions de repli avant le chargement tardif de
Nunito sur Paramètres. Le navigateur 151 du contournement temporaire faisait
passer les huit tests ciblés, mais ne réparait pas la commande standard.

Mise à jour de l’outil de test existant en 1.63.0, épinglé dans `package.json`
et `pnpm-lock.yaml`, avec Chromium 153 installé comme en CI. Les tests et le
code produit n’ont pas été modifiés : la recherche garde une vraie saisie
Playwright, et les assertions d’alignement restent actives.

Tests ciblés : huit E2E verts. Gate finale : `pnpm check` sans configuration
supplémentaire, **1503 tests Vitest dans 119 fichiers**, build et **118 E2E v1**
verts. Aucun commit ni push ; la validation visuelle des lots UI concernés reste
attendue.

### MACH1 — Exporter et jouer une « Machine » — 6 octobre 2026 — livré, validation visuelle attendue

Demande directe de l’auteur ; contrat dans l’ADR 0020 (réécrit le 6 octobre :
« Machine » veut dire « rien à poser », l’objectif reste possible).
Implémentation déléguée à un sous-agent Sonnet, tests puis code, dans le même lot.

Livré : `goal` et ses deux identifiants facultatifs en v3 (un `goal` sans
identifiant est refusé ; v1 et v2 inchangés), `hasCompleteGoal`, `isMachine` et
`completeGoalOf` dans le domaine, aucune migration. Catalogue d’auteur : « Balle
rouge » et « Panier », un exemplaire au plus (carte désactivée une fois posé),
posés et retirés par des commandes annulables qui tiennent `goal` à jour ;
l’interdiction de supprimer la balle cible et le panier ne vaut plus que pour le
joueur. Retirer l’un des deux vide aussi l’inventaire, la solution et le défi
du document, qui exigent un objectif complet (l’inventaire d’un atelier n’est
jamais montré, l’annulation le rend). Export : `machineFromWorkshop` (objectif
conservé), boîte « Exporter » à deux types « Défi » / « Machine » (boutons radio
natifs), « Défi » désactivé avec sa raison, dont une raison dédiée « objectif
incomplet », et phrase d’aide. Réception par lien ou fichier inchangée ; carte
« Machine » sur « Mes niveaux », sans « Pas encore résolu » quand l’objectif
manque. Jeu : sans objectif complet, la simulation n’évalue ni victoire ni échec
et s’arrête à la durée maximale (`hasReachedTimeLimit`, `isWatchedRunOver`) ;
« Objectif » absent ; « Remixer » dans la barre d’une machine reçue (réutilise
`useRemix`). La validation de contenu exige un objectif complet des niveaux de
campagne. `MachineScene` n’est plus qu’un `Pick` du document.

Préalable repris (CARTES1) : tests des cartes (`LevelCard`, `CampaignDraftEditing`,
`EditAndRemix`), badge « Jouable » testé dans `MyLevelsPage`, E2E adaptés par
l’aide `e2e/card-menu.ts` (`levels`, `my-levels`, `remix`, `beta-journey`,
`campaign-draft`, `construction-persistence`). Seul changement de style : le
papier des cartes 3n+1 n’avait pas de rotation, `transform: rotate(var(--card-tilt))`
ajouté à `.level-card::before`, comme le dit déjà le commentaire du CSS.

Gate standard finale, après TEST1 : `pnpm check` verte — 1503 tests Vitest dans
119 fichiers, build et 118 E2E v1. Les huit E2E `app-header.spec.ts` et
`catalogue.spec.ts`, dont la recherche, passent avec le Chromium fourni par
Playwright 1.63.0.
Limites : le choix Défi/Machine au clavier repose sur les boutons radio natifs
(non simulé en jsdom) ; la boîte d’export entre de justesse (5 px de marge) dans
le viewport 390 × 508 clavier ouvert ; machine à objectif complet : le jeu
reste celui d’aujourd’hui, avec « Remixer » en plus ; pas d’outil pour redésigner
une balle déjà posée comme balle rouge, hors des cartes du catalogue.

### CARTES1 — Cartes de niveau sans rangée de boutons — 6 octobre 2026 — validation visuelle attendue

Demandes directes de l’auteur, sans maquette à sa demande. Netteté : seul le
papier de la carte penche (±0,8° au plus), le contenu reste droit. Actions : la
vignette est l’action principale (« Modifier » une création, « Jouer » un niveau
reçu ou de campagne) ; toutes les autres sont dans un menu « ⋯ » à côté du
titre (créations : Jouer, Partager, Dupliquer, Supprimer ; reçus : Modifier,
Partager, Supprimer ; campagne : Modifier dans l’Atelier). Plus de bouton jaune
ni de boutons-icônes. Une création qui donne un puzzle porte le badge
« Jouable » sur sa vignette.

Tests repris dans MACH1 : `LevelCard.test.tsx` (pastilles `quick` retirées,
badge couvert), `CampaignDraftEditing.test.tsx` et `EditAndRemix.test.tsx`
(« Modifier le niveau N » dans le menu, via `cardAction`), badge « Jouable » testé
dans `MyLevelsPage.test.tsx`, E2E adaptés (`e2e/card-menu.ts`). Gate verte hors
les cinq E2E hors périmètre. Validation visuelle de l’auteur toujours attendue.

### UI3 — Machine animée de l’accueil — 6 octobre 2026 — validation visuelle attendue

Demande directe de l’auteur : intégrer `levels/demo-landing.json` selon son README,
avant la reprise de C7d. L’export auteur est conservé ; sa copie embarquée est
validée en v3. La solution est posée, puis objectif et bascule sont retirés d’une
projection éphémère. La campagne conserve sept tutoriels. Les deux balles bleues,
pistons et branchements tournent dans le moteur existant, sans issue de partie.
Le contrat de projection sans objectif est documenté dans `architecture.md` ;
aucune migration ni dépendance ajoutée.

Rouge : projection absente et ancien aperçu statique encore affiché. Vert :
projection, source inchangée, deux pistons actifs pendant trente secondes,
réinitialisation déterministe et aucun résultat. Cinq E2E accueil verts, dont
animation/pause/reprise, réduction des animations et suspension hors onglet visible.
Captures initiales et après quatre secondes inspectées à 1440 × 900 et 1280 × 720,
dans `tmp/home-machine/` ; accord visuel de l’auteur attendu.

Gate complète verte : 1503 tests Vitest dans 119 fichiers, build et 118 E2E v1
(configuration Chromium 151 de `/tmp/tinkerbolt-catalogue-preview.config.ts`).
Les captures initiales et après quatre secondes ont été inspectées à 1440 × 900
et 1280 × 720 dans `tmp/home-machine/` ; accord visuel de l’auteur attendu.
Aucun commit ni push ; prochaine étape : recette visuelle auteur.

### ATL1 — Reprise de l’Atelier et infos du niveau — 6 octobre 2026 — validation visuelle attendue

Demande directe de l’auteur : `/editor` ouvrait toujours un atelier vierge, d’où
des brouillons presque identiques tous nommés « Nouveau niveau », et le nom ne se
saisissait qu’à l’export. Décision dans l’ADR 0015 (amendement du 6 octobre),
ADR 0008 amendée ; maquettes acceptées par l’auteur avant code.

Livré : `/editor` nu rouvre la dernière création modifiée (hors création d’un
niveau de campagne verrouillé) en remplaçant l’URL ; `/editor?new` ouvre un
atelier vierge, cible de « Nouveau niveau » dans Mes niveaux. Dans la barre de
l’atelier, un crayon ouvre « Infos du niveau » (nom, description, rappel de
l’enregistrement automatique) et une icône « Nouveau niveau » ouvre une
confirmation qui propose de nommer le niveau encore sans titre ; elle est
inactive tant que rien n’est enregistré. Titre par défaut « Sans titre »,
atténué. Les créations existantes ne sont pas renommées.

Tests rouges puis verts : `last-editable-creation.test.ts` (4) et
`WorkshopResume.test.tsx` (7). Tests adaptés au nouveau contrat : titre par
défaut, « Nouveau niveau » vers `?new`, insertion libre démarrée sur `?new` ;
l’ancien test « le menu Atelier ouvre un atelier neuf » est remplacé par son
contraire dans `WorkshopResume.test.tsx`.

Gate : `pnpm check` non verte au moment du lot, pour une cause extérieure —
`src/app/home-hero.test.ts` et `HomePage.test.tsx`, modifiés par le travail en
cours sur la démo animée de l’accueil, cassent typecheck, lint et deux tests.
Hors ces deux fichiers, Vitest est vert ; relancer la gate après ce travail.
E2E v1 : 113 verts, 5 rouges sans lien avec le lot — `app-header.spec.ts`
(3, test non suivi du lot UI1) et `catalogue.spec.ts` (2) : le champ de
recherche du catalogue reste vide après saisie, défaut reproduit à l’identique
sur le commit `0724e46` sans ce lot.
Captures réelles à 1440 × 900, 1280 × 720 et 1024 × 700 dans
`tmp/atelier-infos/reel-*.png`. Défaut connu : à 1280 px le titre est tronqué
(« Sa… ») entre les deux groupes de boutons ; à arbitrer par l’auteur.

### UI1 — Factoriser la barre de navigation — 6 octobre 2026 — validation visuelle attendue

Demande directe de l’auteur : harmoniser les barres de `/settings` et
`/my-levels` avec les autres pages. Le composant `AppHeader` était déjà partagé ;
ses styles, auparavant dispersés dans `styles.css`, sont regroupés dans
`src/ui/AppHeader.css`. Les marges et la colonne d’actions propres à Paramètres
sont supprimées ; couleurs et police de l’en-tête sont explicites, indépendantes
du contenu de la page. Aucune nouvelle dépendance.

Test rouge sur le décalage du logo de Paramètres, puis quatre E2E verts comparant
logo, barre, navigation, liens et menu entre accueil, campagne, Mes niveaux,
Paramètres et Atelier (desktop). Captures inspectées dans `tmp/top-bar/` à
1440 × 900, 1280 × 720, 844 × 390 et 390 × 844 ; accord visuel de l’auteur attendu.
Chromium 151 utilisé via la configuration temporaire déjà disponible dans `/tmp/`
pour éviter les défauts du Chromium 140 documentés dans VIS1.

Gate complète verte : `pnpm check
--config=/tmp/tinkerbolt-catalogue-preview.config.ts` (configuration externe,
Chromium 151), **1 425 tests Vitest dans 114 fichiers**, huit documents, build et
**116 E2E v1**. Log : `/tmp/tinkerbolt-topbar-check.log`. Un fichier de test
préexistant mal formaté (`level-card-decoration.test.ts`) a reçu uniquement le
formatage Prettier requis par la gate. Aucun commit ni push ; prochaine étape :
validation visuelle de l’auteur. C7d reste séparé.

### VIS1 — Cartes, Mes niveaux et catalogue — validation visuelle en cours — 5 octobre 2026

Cartes communes inclinées avec fixations stables par identifiant ; panneaux de
Mes niveaux utilisant les backgrounds de l’auteur ; imports réussis ou échoués
annoncés par toast. Catalogue jaune papier avec recherche et catégories repliables,
animation CSS de 180 ms ; poignées verticales de même hauteur que les cartes en
portrait sur smartphone. Les originaux d’`art/` et `tmp/check-levels.ts` sont préservés.

Dernière vérification ciblée : 17 tests du catalogue, typecheck et lint verts ;
quatre E2E du catalogue verts avec le Chromium 151 déjà installé. Chromium 140
refuse la saisie même dans un champ HTML isolé hors application ; la configuration
temporaire de preview est dans `/tmp/tinkerbolt-catalogue-preview.config.ts`, sans
changement d’outillage du dépôt. Captures inspectées : `tmp/catalogue/` aux formats
1440 × 900, 1280 × 720, 390 × 844 et 320 × 568. Les captures des autres pages restent
dans `tmp/campaign-cards/` et `tmp/my-levels/`.

La gate complète est différée à la demande explicite de l’auteur jusqu’à son
accord sur le design. Aucun commit ni push de ce lot ; prochain point : accord
visuel, puis gate finale et mise à jour de l’état livré.

### OUT1 — Changelog et versionnement — livré — `9f4ec8f`

Version de `package.json`, changelog français, `release:check` et version/SHA
à propos. Rouge initial du contrôle absent, puis tests verts. Gate du 5 octobre :
1 395 tests Vitest et 103 E2E v1. Captures inspectées dans
`tmp/versioning/captures/` ; validation visuelle auteur attendue.

### OUT2 — Automatiser les releases — livré — `1c4b698` — 5 octobre 2026

Luna `xhigh` ajoute `pnpm release X.Y.Z` et `--dry-run`, sans dépendance.
Tests rouges : module de release absent et `tmp/` non ignoré par ESLint, puis
verts. La commande prépare version et notes, lance `check`, crée commit/tag,
pousse atomiquement `main` et tag, puis crée la GitHub Release. Préconditions
avant mutation ; restauration avant commit et diagnostics de reprise après.
`check:fast` : 1 406 tests verts ; formatage, Knip, contrôle et aperçu verts.
Le scratch de l’auteur est inchangé et `tmp/` est exclu du lint/formatage.
Gate intégrée finale : 1 406 Vitest, huit documents, build et 103 E2E v1.

### OUT3 — Nettoyer la documentation — livré — 5 octobre 2026

Nettoyage demandé par l’auteur après OUT2, avant publication de `0.2.0`.
131 fichiers (environ 51,5 Mio) : anciens journaux, plans, todos, progression
de prototype et maquettes/captures des lots clos retirés après consolidation
de leurs demandes ouvertes.
ADR, guides, idées de niveaux et maquette d’identité utile à C7d conservés.
Les propositions Gemini/Astra/Canary ont été rétablies à l’identique à la
demande de l’auteur et restent pour mémoire. L’état, l’index et la feuille
sont raccourcis ; exemples obsolètes corrigés et références raccordées.
`art/` : 91 fichiers et permissions identiques au manifeste avant nettoyage.
La publication nécessite une connexion GitHub, absente dans cet environnement.
Gate finale verte : `/tmp/tinkerbolt-release-cleanup-check.log`. Aucun lien
Markdown local cassé ; dix fichiers TS/TSX ne diffèrent que par les commentaires,
avec JavaScript émis identique. Aperçu réel de `0.2.0` vert, notes prêtes ;
aucun tag ni push avant la connexion GitHub.


### OUT4 — Utiliser les identifiants Git pour les releases — livré — 5 octobre 2026

La connexion séparée à `gh` bloquait la commande malgré des identifiants Git
valides. ADR 0003 amendée : la commande utilise l’authentification du push ;
GitHub Actions crée la release après réception du tag, avec son jeton automatique.
Tests rouges : appel GitHub local encore présent et extraction des notes absente.
Tests verts : ordre gate/commit/tag/push, diagnostic de reprise du push,
notes limitées à la version taguée, refus des tags et sections incohérents.
Gate complète verte : 1 411 tests Vitest dans 112 fichiers, huit documents,
build et 103 E2E v1. Log : `/tmp/tinkerbolt-release-auth-check.log`.
Workflow validé localement (format YAML, syntaxe shell et extraction des notes) ;
son exécution distante sera confirmée au premier push de tag. Aucun push ni
publication pendant cette correction ; l’auteur peut relancer `pnpm release 0.2.0`.
