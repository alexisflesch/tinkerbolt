# Feuille de route — reprise après la v1

Cette feuille est **la seule séquence active** : compléments desktop C0 à C10,
puis téléphone M0 à M4, puis Forge et Grist F0 à F3. Elle reprend les tâches
retenues du [plan préparatoire du 3 octobre](plan-implementation.03.10.26.md).
Le [todo de l’auteur](todo.03.10.26.md) reste intact ; il exprime la demande,
pas un second ordre d’exécution. L’état réellement livré reste dans `etat.md`.

## Point de reprise — 3 octobre 2026

La v1 est clôturée : V0 à V9, core validé par l’auteur et dernière gate verte
(1200 tests Vitest, 89 E2E). Son journal et ses règles de session sont conservés
plus bas dans **l’historique v1**. La mention « aucun nouveau travail d’interface
… dans la présente session » décrit cette ancienne session ; la demande actuelle
autorise la nouvelle reprise, sans rouvrir V0 à V9.

**C0 et C1 terminés, gate globale verte.** C1 est corrigé dans le commit
`6150c94` de l’autre agent de l’auteur, puis vérifié par l’orchestrateur.
C2 : [ADR 0017 proposée](decisions/0017-player-construction-and-async-storage.md),
trois arbitrages soumis à l’auteur. Les maquettes C4/C4a sont préparées,
captures desktop inspectées, validation attendue. C5 est implémenté
et vérifié (1206 tests Vitest, 89 E2E), validation visuelle attendue aux deux
formats desktop. L’audit C8 est préparé, Q6 et la décision de version restent
ouverts. Les contrats de reprise ne sont pas encore acceptés ;
l’amendement accepté des ADR 0011/0015 fixe seulement les
décisions de stockage et de reprise confirmées. Dexie et la reprise des
constructions ne sont pas encore livrés.

## Règles de la reprise active

- Lire `index.md`, cette feuille, puis la ligne de routage de la tâche. Les
  historiques ne se lisent que par entrée citée ; ne pas parcourir `docs/` en entier.
- Une tâche à la fois, dans l’ordre. **Un seul sous-agent actif à la fois**, sur
  instruction de l’auteur du 3 octobre 2026, puis revue et intégration avant
  le suivant. Codex Sol 6.1 conduit la reprise, réalise
  les choix UI/UX et relit les travaux délégués. Terra peut prendre le code ;
  Luna en effort `xhigh` les tâches simples. Astra est interdit.
- Respecter Red-Green-Refactor pour chaque comportement ou bug. Une tâche
  documentaire ou un audit n’exige pas de test artificiel.
- `pnpm check:fast` pendant le travail ; `pnpm check` avant clôture. Faire
  `pnpm build` avant un Playwright isolé. La session principale tient le journal,
  l’état livré et la dernière gate. Un commit par tâche après `pnpm check`,
  message en français à l’impératif avec son identifiant ; ne jamais pousser
  sans autorisation.
- Maquettes validées par l’auteur avant tout choix visuel. Fournir et inspecter
  les captures : 1440 × 900 et 1280 × 720 pour les compléments desktop ; formats
  portrait et paysage concernés pour v2. Garder « validation visuelle attendue »
  tant que l’auteur n’a pas validé un nouveau changement visible.
- Les compléments restent desktop d’abord. M0 ouvre l’étape téléphone ; les
  objectifs nouveaux restent en v4. Les versions produit ne désignent pas
  `LevelDocument.schemaVersion`.
- Consigner une décision dans son propriétaire avant le code. Ne pas commencer
  une famille sans contrat accepté, ni une implémentation visuelle sans maquette
  validée. Une tâche
  indépendante peut avancer lorsque l’arbitrage d’une autre reste ouvert.
- Le fichier d’essai de l’auteur `tmp/check-levels.ts` reste intact. S’il gêne
  la gate, l’écarter temporairement puis le remettre identique (règle de v1
  conservée). Une exécution Playwright isolée vide `test-results/` : conserver
  les captures à montrer ailleurs.

## Décisions confirmées pour cette reprise

- Trois tailles de poutre conservées, choisies par une icône sur le plateau ;
  pas de longueur libre. Maquette encore à valider (C4).
- Propriétés fermées par défaut sur ordinateur et téléphone, ouvertes par
  clic/toucher simple ; poser ou déplacer ne les ouvre pas. Contrat commun
  et maquettes à formaliser avant code dans C4a puis M0/M1.
- IndexedDB avec Dexie dès cette étape, ports et appels asynchrones. **Aucune
  reprise des anciennes données `localStorage`**, sur instruction explicite
  de l’auteur (application non en production). Les codecs d’import de niveaux
  et leurs migrations restent présents. Propriétaire : ADR 0011.
- Reprise automatique de la construction engagée avant simulation, avec
  « Recommencer » pour repartir de zéro ; ni simulation ni historique restaurés.
  Propriétaires : ADR 0011/0015 ; contrats détaillés à arrêter dans C2.
- Boutons de résultat et modale apparaissent ensemble, au délai actuel (C5).
- Splash une seule fois au démarrage de l’application, y compris par lien
  direct, avec barre de chargement et minimum de 1,2 s. « Créé par Alexis
  Flesch » en petit sous la barre, en bas ; maquette à valider (C6).
- Bolt sur l’accueil et la victoire ; expression, emplacement et taille à
  valider sur maquettes (C7).
- Proposition Grist entièrement dans TinkerBolt, avec consentement, licence
  et information sur le filtrage ; mécanisme d’envoi à vérifier en F1.

## Arbitrages encore ouverts

| ID  | Question                                                                                                  | Tâches dépendantes                      |
| --- | --------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Q6  | Contrat de chaque famille nouvelle et ordre confirmé après audit.                                         | C8, puis chaque C9a–d pour son contrat. |
| Q8  | Mécanisme de soumission disponible sur l’instance Grist de la Forge ; éventuel relais et son hébergement. | F1, puis F2.                            |

C2 doit également fixer l’identité et la compatibilité d’une construction
sauvegardée, son enveloppe, les états d’erreur et les opérations atomiques,
ainsi que le devenir des sauvegardes lors d’une source modifiée, suppression,
remise à zéro ou victoire. C0 ne tranche aucun de ces contrats. Les conseils
du plan préparatoire ne sont pas des décisions acceptées.

## Séquence active — compléments desktop

Ordre retenu : **compléments desktop → téléphone → Forge et Grist**.
Une tâche dont le périmètre est ouvert ne commence pas par du code spéculatif.
Les tâches indépendantes déjà définies restent réalisables pendant un arbitrage.
C0 est le préalable commun à toutes les tâches de ces compléments ; la table
précise leurs dépendances supplémentaires.

| Ordre | ID    | Livrable                                                                | Prérequis                                                       |
| ----- | ----- | ----------------------------------------------------------------------- | --------------------------------------------------------------- |
| 1     | C0    | Raccord avec les sources de vérité et démarrage de la nouvelle séquence | V1 clôturée (V9).                                               |
| 2     | C1    | Bug de placement reproduit, testé et corrigé                            | C0.                                                             |
| 3     | C2    | Contrats de reprise locale et de stockage asynchrone                    | Décisions de stockage et de reprise confirmées.                 |
| 4     | C2a   | Stockage IndexedDB avec Dexie, sans reprise de l’ancien stockage        | C2.                                                             |
| 5     | C3    | Conservation des constructions et vérification des brouillons           | C2a.                                                            |
| 6     | C4    | Icône de taille des poutres                                             | Décision des trois tailles ; maquette validée.                  |
| 7     | C4a   | Propriétés desktop ouvertes à la demande                                | C4 ; maquette validée.                                          |
| 8     | C5    | Résultat et modale de victoire synchronisés                             | C0.                                                             |
| 9     | C6    | Favicon, icônes PWA et splash                                           | C2a ; maquette validée.                                         |
| 10    | C7    | Bolt sur l’accueil et à la victoire                                     | C5 ; maquettes validées.                                        |
| 11    | C8    | Inventaire exact des assets et contrats des nouveaux objets             | C0.                                                             |
| 12–15 | C9a–d | Nouvelles familles, une à la fois                                       | C8 ; contrat de chaque famille accepté.                         |
| 16    | C10   | Recette des compléments desktop                                         | C1 à C9 livrés, ou reports explicitement décidés avec l’auteur. |
| 17    | M0    | Spécification et maquettes téléphone                                    | C10 ; décisions téléphone confirmées.                           |
| 18    | M1    | Séparation toucher simple / pose / déplacement                          | M0 ; C1 et C4a.                                                 |
| 19    | M2    | Interface portrait                                                      | M1.                                                             |
| 20    | M3    | Interface paysage                                                       | M2.                                                             |
| 21    | M4    | Recette téléphone et gate v2                                            | M1 à M3.                                                        |
| 22    | F0    | Dépôt et hébergement Forge opérationnels                                | M4 ; destination et stratégie de bascule définies.              |
| 23    | F1    | Contrat et prototype du parcours Grist                                  | F0 ; accès à l’instance et décision Q8.                         |
| 24    | F2    | Proposition d’un niveau depuis l’application                            | F1.                                                             |
| 25    | F3    | Récupération, modération et recette v3                                  | F2.                                                             |

### C0 — Raccorder ce plan à la reprise

- Relire `docs/index.md`, le point de reprise de `feuille-de-route.md` et
  `etat.md` après la recette v1 et les modifications documentaires en cours.
- Confirmer le classement par version et reporter les tâches retenues dans
  la feuille de route qui fera autorité ; mettre à jour `index.md` et
  `backlog.md` pour qu’un agent ait un seul ordre d’exécution.
- Consigner les décisions dans leurs propriétaires avant le code : ADR 0011
  et 0015 pour la reprise ; contrats de familles pour les nouveaux objets ;
  document d’interactions mobiles pour les gestes et la mise en page.
- La mention historique « dépôts IndexedDB » de T6 dans `backlog.md` ne décrit
  pas le code livré : l’ADR 0011 avait choisi `localStorage`. Au raccord,
  distinguer cet état initial du nouveau choix Dexie ; amender l’ADR 0011,
  l’ADR 0015 et `architecture.md` avant le code, avec l’exception explicite
  de non-migration décidée par l’auteur.
- **Sortie :** sources cohérentes et tâches autorisées clairement identifiées.

### C1 — Investiguer puis corriger le refus intermittent de placement

- Point de départ : poser un fil, choisir la masse, puis tenter de la poser.
  Vérifier aussi fil annulé, fil refusé, changements rapides de famille et
  autres objets, dans l’Atelier et un niveau avec inventaire.
- Relever l’état de l’outil actif et le motif exact du refus. La piste d’un
  état de câblage conservé est une hypothèse, pas un diagnostic acquis.
- Une fois le scénario reproduit, écrire un test rouge qui échoue pour cette
  raison, puis corriger la transition minimale. Un refus légitime doit garder
  son explication ; ne pas simplement masquer l’avertissement.
- **Sortie :** changer de carte active le bon outil, sans reliquat du précédent
  ni consommation d’inventaire sur une pose refusée ; régression automatisée.

### C2 — Définir le contrat de reprise locale

- Séparer la **création d’Atelier**, déjà autosauvegardée, de la
  **construction inachevée de joueur**, qui nécessite une persistance dédiée.
- Couvrir campagne et niveaux reçus, y compris ceux ouverts depuis `/shared`.
  La copie de jeu ne doit modifier ni le niveau source ni sa solution.
- Définir l’identité de la sauvegarde et sa compatibilité avec le niveau
  source : identifiant et empreinte/version du contenu, comportement si le
  niveau a changé, suppression du niveau reçu, remise à zéro et victoire.
- Conserver les objets et fils posés ainsi que la provenance nécessaire à la
  reconstruction exacte de l’inventaire ; ne pas stocker les corps physiques
  ni les positions transitoires de la simulation.
- Formaliser la reprise automatique décidée et le périmètre de « Recommencer ».
  Définir une enveloppe versionnée validée par Zod, derrière un repository.
- Définir les ports asynchrones, le schéma initial IndexedDB et les transactions
  nécessaires aux écritures liées, sans reprendre les anciennes données locales.
- **Sortie :** contrat accepté, cas d’erreur définis, ADR mises
  à jour. Les choix encore ouverts ne sont pas implicitement tranchés en code.

### C2a — Remplacer le stockage local par IndexedDB avec Dexie

- Documenter la dépendance Dexie, sa version retenue et les conséquences
  d’outillage selon l’ADR 0003. Installer la dépendance lors de cette tâche.
- Implémenter les repositories des créations, niveaux reçus, progression et
  préférences sur la nouvelle base. Adapter les ports, contextes et appels à
  l’asynchronisme, avec états de chargement et erreurs maîtrisés.
- La base démarre vide ; ne pas lire les anciennes clés `localStorage` pour
  les importer. Les fonctionnalités de progression restent présentes, mais
  aucun score ou état antérieur n’a besoin d’être conservé.
- Valider les données lues par Zod et les documents par les codecs existants.
  Utiliser les transactions pour les opérations qui doivent rester atomiques.
- Tester lecture/écriture/suppression, réouverture de la base, atomicité,
  données invalides, quota et base indisponible. Conserver les assertions de
  comportement des repositories en les adaptant au stockage retenu ; ne pas
  ajouter de tests de transfert depuis `localStorage`.
- **Sortie :** les fonctionnalités existantes utilisent Dexie, le jeu reste
  utilisable en cas d’échec du stockage, tests et `pnpm check` verts.

### C3 — Conserver et retrouver ce qui a été commencé

- Implémenter le contrat de C2 à partir des commandes validées de construction.
  Sauvegarder au fil du travail ; ne pas dépendre uniquement d’un événement
  de fermeture de page. Un geste non validé ne remplace pas le dernier état.
- Vérifier les brouillons existants : dernière pose, déplacement, rotation,
  propriété et métadonnée engagée retrouvés après navigation et rechargement.
  Corriger les lacunes constatées dans le mécanisme existant.
- Tester la reprise d’une construction de campagne et d’un niveau reçu,
  notamment après sortie pendant la simulation, avec objets et fils.
- Vérifier l’inventaire, « Recommencer », les sources modifiées, les données
  corrompues, le quota et le stockage indisponible.
- **Sortie :** navigation et rechargement retrouvent la construction conservée ;
  un échec de sauvegarde est compréhensible et garde la session utilisable.

### C4 — Choisir la taille d’une poutre depuis le plateau

- Ajouter une icône explicite, comparable à l’accès à la rotation, qui permet
  de choisir courte, moyenne ou longue. Valider sa forme sur une maquette.
- Respecter les permissions du mode et les tailles de l’inventaire : l’icône
  n’accorde pas gratuitement une taille absente d’un niveau.
- Le choix produit une seule commande annulable ; une taille déjà choisie
  ne crée pas une modification inutile. Préserver l’accès clavier et tactile.
- **Sortie :** taille modifiable sans ouvrir l’inspecteur lorsque c’est permis ;
  schéma et trois tailles conservés, comportement et annulation testés.

### C4a — Ouvrir les propriétés desktop à la demande

- Séparer sélection de l’objet et ouverture des propriétés. Le panneau est
  fermé par défaut ; poser, déplacer ou utiliser une poignée ne l’ouvre pas.
- Un clic simple ouvre les propriétés, avec une commande accessible équivalente
  au clavier. Le clic consécutif à un drag ne doit pas ouvrir le panneau.
- Valider sur maquette l’espace restitué au plateau et le panneau temporaire ;
  garder toutes les propriétés et actions auteur accessibles.
- Formaliser le contrat commun sélection/ouverture dans le document de
  référence avant le code. M1 complète sa vérification au toucher en v2.
- **Sortie :** absence de panneau permanent aux deux formats desktop, réglages
  accessibles, tests de clic, pose, drag et annulation, captures validées.

### C5 — Synchroniser les actions et la modale de victoire

- Utiliser le même moment d’apparition pour les boutons de résultat et la
  modale : conserver le délai actuel, sans changer le temps de la simulation.
- Garder le comportement immédiat existant avec réduction des animations.
- Fermer la modale doit laisser les actions disponibles. Rejouer, changer de
  niveau ou annuler le résultat doit annuler toute apparition différée obsolète.
- **Sortie :** aucune action de victoire visible en avance ; tests du délai,
  de la fermeture et de la nouvelle tentative, capture du résultat.

### C6 — Installer les icônes et l’écran de démarrage

- Utiliser les sources de `art/icons-splash_screen/` pour le favicon et les
  icônes installables, avec les formats et marges nécessaires au manifeste.
- Faire une maquette du splash à partir de l’asset fourni. Placer la barre
  et « Créé par Alexis Flesch » selon la demande, sans recadrage illisible.
- Fermer le splash quand **l’application est prête et les 1,2 s écoulées**.
  Ne pas afficher une application encore inutilisable au terme du seul délai.
  Prévoir un état d’erreur si le chargement nécessaire échoue.
- Vérifier démarrage par lien direct, base d’hébergement, installation PWA et
  hors ligne. Le splash dessiné par l’application est distinct de l’écran de
  lancement éventuellement fourni par le système.
- **Sortie :** assets locaux intégrés au build/cache, durée et chargement testés,
  icônes et splash validés à l’œil aux formats concernés.

### C7 — Intégrer Bolt

- Choisir les expressions parmi les assets existants et valider les maquettes
  de l’accueil et de la victoire avec l’auteur.
- Intégrer Bolt sans réduire la lisibilité des actions ; réutiliser le résultat
  de C5. Une illustration décorative ne doit pas répéter le texte au lecteur
  d’écran ; une information apportée par l’image doit rester accessible.
- **Sortie :** accueil et victoire avec Bolt, captures validées par l’auteur.

### C8 — Auditer les objets restant à intégrer

Comparer sources `art/`, exports `public/assets/`, registre, rendu, simulation
et catalogue. Distinguer variantes d’une famille existante et nouvelles familles.

| Sources repérées                                      | Famille candidate            | Contrat à définir avant le code                                                             |
| ----------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------- |
| `art/assets/boxes/wooden-box.png`, `metallic-box.png` | Caisse, variantes bois/métal | Corps, dimensions, masse et matériau ; sens fonctionnel de la variante métal.               |
| `art/assets/electro-magnet/`                          | Électroaimant                | Objets attirés, portée et force, état initial, commande et représentation de l’activité.    |
| `art/assets/piston/`                                  | Piston                       | Ancrage, course, vitesse/force, commande, collisions et retour à l’état initial.            |
| `art/assets/timer/`                                   | Minuteur                     | Déclenchement, durée, signal de sortie, répétition éventuelle et reset ; temps simulé fixe. |

- L’auteur valide les contrats et l’ordre d’intégration. Une image seule ne
  suffit pas à inventer un comportement physique.
- **Sortie :** liste exhaustive rapprochée du code, contrats acceptés et tâches
  C9 dimensionnées. Tout objet différé est nommé avec la décision de report.

### C9a à C9d — Intégrer une famille complète à la fois

Ordre proposé : **C9a caisses → C9b électroaimant → C9c piston → C9d minuteur**.
L’audit C8 relève les dépendances à trancher, notamment métal/aimant et
commande/minuteur ; les dessins ne confirment aucun comportement ni cet ordre.

Pour chacune :

- Écrire les tests de comportement attendus, les faire échouer, puis ajouter
  schéma, définition, géométrie, simulation, rendu, exports de sprites,
  miniature et outils d’édition.
- Fournir inventaire, propriétés permises, sérialisation, import/export,
  solution de référence et intégration aux fils lorsque le contrat le demande.
- Tester les documents de niveau existants et les nouveaux ; privilégier
  l’ajout compatible d’une famille. Aucune reprise de l’ancien stockage local.
- Vérifier une scène de test jouable sans ajouter les nouveaux objectifs de v4
  ni étendre la campagne sans tâche dédiée.
- **Sortie :** famille effectivement utilisable dans l’Atelier et un puzzle,
  contrat physique testé, gate verte et captures validées.

### C10 — Recette des compléments desktop

- Rejouer placement fil → objet, reprise locale, modification de poutre,
  victoire et utilisation des nouveaux objets dans un niveau partagé.
- Vérifier accueil, splash, icônes et résultat aux deux formats desktop.
- **Sortie :** `pnpm check` vert, validation visuelle de l’auteur, `etat.md`
  et journal à jour. Les éventuels reports sont explicites.

## Séquence active — téléphone (v2)

### M0 — Fixer les interactions et valider les maquettes

- Priorité : **poser → tourner/ajuster → lancer**, avec un plateau dégagé.
  Annuler, supprimer/retirer, caméra et propriétés restent accessibles.
- Reporter les décisions confirmées dans `mobile-editor-interactions.md` :
  la sélection et l’ouverture des propriétés deviennent deux états distincts.
  Remplacer les passages qui feraient ouvrir le panneau à la pose ou au drag.
- Faire des maquettes portrait et paysage avec les vrais sprites ; vérifier
  aussi un niveau comportant plusieurs commandes et un fil de commande.
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

## Journal de la reprise active

Une entrée par tâche : résultat, décisions, tests rouges pertinents, gate,
captures et validation de l’auteur. Les reports et blocages sont explicites.

### C0 — Raccord des sources — fait — 3 octobre 2026

- La séquence C/M/F retenue est reprise dans cette feuille, seule source de
  l’ordre d’exécution ; index et backlog raccordés. Le plan conserve son rôle
  de préparation, le todo de l’auteur est inchangé.
- Conflits signalés et résolus avant code : interdiction UI de l’ancienne
  session v1 rendue historique ; ancien choix `localStorage` remplacé dans
  les ADR 0011/0015 et l’architecture par la cible Dexie asynchrone ; T5/N2
  et la mention IndexedDB de T6 corrigés dans le backlog.
- Décisions confirmées : aucune reprise depuis `localStorage`, reprise
  automatique du document engagé avant simulation, sans état physique ni
  historique. Les contrats techniques de C2 et des nouvelles familles,
  les maquettes et les décisions Forge/Grist restent à valider.
- Aucun code modifié ; aucun test artificiel. Revue du diff par la session
  principale, journal v1 préservé et liens locaux vérifiés.
- `pnpm check` vert : typecheck, lint, formatage, Knip, contenu,
  1200 tests Vitest et 89 E2E v1. Preview local sur 4319 ; configuration
  Playwright et fichier d’essai remis à l’identique après la gate.

### C1 — Refus de pose après câblage — fait — `6150c94`

- Correction réalisée et commitée par l’autre agent de l’auteur, puis reprise
  sur instruction de l’auteur. Dans `tuto-3`, la solution cachée réserve
  `placement-3` au ventilateur ; la masse réutilisait cet id après le fil,
  donnant un document invalide. Le générateur de pose réserve désormais aussi
  les `placementId` de la solution.
- La régression `App.test.tsx` « ne réutilise pas pour la masse l’identifiant
  que la solution donne au ventilateur (tuto-3) » vérifie ventilateur → fil →
  masse, aperçu valide, absence de refus et décrément unique de l’inventaire.
  Vérification ciblée de l’orchestrateur : 1 test réussi.
- Le diagnostic préalable utilisait un autre niveau et n’avait pas reproduit
  la collision ; aucune correction spéculative n’en est issue.
- `pnpm check` après intégration de ce commit : vert, 1201 tests Vitest et
  89 E2E v1. Fichier d’essai auteur et configuration Playwright restaurés
  identiques. Aucun restylage ni changement de contenu des niveaux.

### C2 — Contrat de reprise — proposé, validation de l’auteur attendue

- Sol 6.1 `high` a préparé le contrat, relu puis intégré par l’orchestrateur :
  [ADR 0017](decisions/0017-player-construction-and-async-storage.md), statut
  **proposé**, avec renvois ADR 0005/0011/0015 et index. Aucun code, dépendance
  ou changement du stockage livré.
- La construction reprend document **et provenance**, avec validation stricte
  des relations source/stock/décor et un codec de tentative distinct du codec
  de niveau. Identité/empreinte, files d’écriture et méthodes atomiques restent
  décrites dans cette proposition ; aucune nouvelle API Dexie n’est livrée.
- Trois propositions soumises à l’auteur : conserver après victoire ; garder
  les constructions sous les nouveaux verrous après remise à zéro de progression ;
  sauvegarder en secours une construction incompatible puis ouvrir la nouvelle
  source avec avertissement. Aucune acceptation déduite du silence.
- Format Markdown, neuf liens locaux et diff vérifiés. C2 reste partiel :
  **C2a et C3 attendent l’acceptation du contrat**. L’exception au codec normal
  et la provenance persistable sont documentées avant toute implémentation.

### C4 / C4a — Maquettes desktop — proposées, validation visuelle attendue

- Sol 6.1 `medium` a préparé la [maquette interactive](maquettes/complements-desktop/c4-c4a.html)
  et son CSS : sélection après pose, menu de taille en résolution, propriétés
  en création et propriétés d’un objet verrouillé. Aucun code de l’application.
- Icône proposée ↔ près de la rotation, cible de 44 px ; tailles nommées et
  proportionnelles. En résolution, proposition d’échange avec le stock : taille
  courante conservée, alternative absente désactivée avec explication. Le panneau
  droit est temporaire, sans voile ; pose ou glissement ne l’ouvre pas.
- Premier contrôle visuel : menu débordant à 1280 × 720 et fermeture peu
  contrastée. Agent corrigé : menu borné au plateau, défilement de secours,
  fermeture blanche sur bleu. Nouvelles captures et contrôle navigateur des
  ressources locaux sans erreur, format HTML/CSS et syntaxe JS vérifiés.
- Police des captures : le Chromium de recette refuse le chargement CSS de
  Nunito au premier écran, comme dans V7. Captures reprises avec les mêmes
  octets locaux chargés par `FontFace` dans le script de recette ; maquette
  inchangée. Les textes sont visibles dans les huit captures finales.
- Huit captures dans `tmp/c4/captures/`, aux formats 1440 × 900 et 1280 × 720,
  inspectées par l’orchestrateur. **Validation de l’auteur attendue avant C4/C4a**.
  Le contrat normatif de séparation sélection/ouverture doit aussi être amendé
  avant le code ; aucun geste téléphone nouveau n’est livré.

### C5 — Synchroniser résultat et modale — implémenté, validation visuelle attendue

- Tests rouges confiés à Luna `xhigh`, production à un autre agent Sol 6.1
  `medium`, puis revue et intégration par l’orchestrateur. Après la reprise,
  un seul sous-agent actif à la fois, conformément à la demande de l’auteur.
- Rouge observé : les boutons du résultat reçu sont présents avant le délai
  de 600 ms. Cinq tests ajoutés couvrent 0/599/600 ms, fermeture avec actions
  conservées, animations réduites, disparition puis nouvelle victoire et
  annulation lors de la navigation. Le parcours auteur garde son résultat
  immédiat et ne reçoit pas de modale de victoire joueur.
- Le hook de victoire rend les actions disponibles au même instant que la
  modale, avec le délai existant et aucun délai sous animations réduites.
  Fermer la modale ne retire pas les actions. La simulation et le style
  ne sont pas modifiés.
- Première gate : sept tests préexistants cliquaient immédiatement « Voir le
  résultat ». Leurs échecs sont reproduits par l’agent de tests, puis leurs
  synchronisations attendent la modale automatique, la ferment et la rouvrent.
  Assertions de palier, remix, score et données conservées ; aucun test affaibli,
  supprimé ou ignoré. Les quatre suites ciblées passent (117 tests).
- Gate intégrée `pnpm check` verte : typecheck, lint, formatage, Knip, contenu
  (6 documents), 1206 tests Vitest (90 fichiers), build (55 entrées de précache)
  et 89 E2E v1, aucun ignoré. Port isolé 4319 ; configuration Playwright et
  fichier d’essai auteur restaurés identiques.
- Captures du build dans `tmp/c5/captures/` : `avant-actions-`, `modale-` et
  `actions-apres-fermeture-`, chacune en 1440 × 900 et 1280 × 720. Vérification
  navigateur du délai et du maintien des actions ; captures inspectées par
  l’orchestrateur. **Validation visuelle de l’auteur attendue**, C5 n’est pas
  déclaré entièrement terminé.

### T2 — Stabiliser les propriétés du tutoriel 2 — fait, test seul

- La gate finale de préparation documentaire a trouvé une course préexistante
  dans N2 tuto-2 : `isVisible()` observe « Ouvrir les propriétés », puis le
  `tap()` attend 30 s alors que l’effet de sélection a déjà ouvert la feuille
  et retiré ce bouton. Le snapshot montre « Propriétés de Poutre » ouverte.
  Échec avant simulation et victoire ; aucun nouveau bug de production.
- Correctif confié à Luna `xhigh`, relu par l’orchestrateur : attendre la région
  des propriétés après chaque pose, comme dans T1, puis garder les rotations
  et la fermeture existantes. Aucun délai, retry, seuil, viewport ou assertion
  métier changé ; aucun code de production modifié.
- Typecheck E2E, ESLint et Prettier ciblés passent. Root a exécuté `pnpm build`
  puis le seul tuto-2 cinq fois de suite : **5 réussites**. Nouvelle gate
  complète : **1206 tests Vitest et 89 E2E v1 réussis**, aucun ignoré.
- Configuration Playwright et fichier d’essai auteur restaurés identiques.
  Ce helper reflète l’ouverture automatique actuellement livrée ; C4a/M1
  devront adapter le parcours lors du changement de comportement prévu.

### C8 — Audit des assets — partiel, contrats Q6 et ordre attendus

- Audit et documentation confiés à Luna `xhigh`, puis relus par l’orchestrateur.
  [Relevé préparatoire](audit-assets-c8.md) : 17 groupes d’assets, onze familles
  raccordées via douze groupes (balle bleue = variante), quatre groupes candidats
  non intégrés et Bolt, mascotte relevant de C7. Les exports utilisent
  `public/assets/sprites/`. Aucun code ou asset modifié.
- Dimensions des dix PNG candidats mesurées et images consultées ; sources,
  exports, schéma, registre, géométrie, renderer, simulation et catalogue
  rapprochés. Contrôle Markdown, chemins référencés et whitespace sans erreur.
- Caisses, électroaimant, piston et minuteur attendent leurs contrats acceptés
  et l’ordre confirmé. Métal attiré et minuteur source de commande ne sont pas
  déduits des dessins. Aucune famille C9 n’est commencée.
- Conflit remonté avant code : ADR 0004 exige version et migration pour une
  nouvelle famille ; C9 privilégie l’ajout compatible. Le contrat d’évolution
  du schéma v2 doit être explicité dans sa décision propriétaire avant C9.
  C8 reste **partiel**, aucun report de famille présumé accepté.

## Historique v1 — clôturé, aucune tâche active V0 à V9

Le contenu qui suit conserve les décisions, tâches et journal de la session v1.
Ses indications de reprise, d’interdiction UI et d’attente visuelle décrivent
cette session clôturée ; elles ne remplacent pas la séquence active ci-dessus.

### Feuille de route v1 — document historique

Rédigée le 2 octobre 2026 avec l'auteur. Remplace la feuille de route de la
phase « Mes niveaux », archivée dans `feuille-de-route-mes-niveaux.md` (journal
G1 à N2) : on n'y lit que l'entrée qu'une tâche cite.

Destinataire : l'agent d'implémentation (Codex, Sol 6.1). Amendement de l'auteur
du 3 octobre 2026 : **Sol 6.1 remplace Opus pour le raisonnement et l'UI/UX ;
Terra remplace Sonnet pour l'écriture de code, ou Luna en effort `xhigh` pour
les tâches simples. Astra est interdit.** Ces équivalences s'appliquent aux
mentions Opus/Sonnet des tâches restantes ; les journaux historiques restent
inchangés. Il délègue chaque tâche à un sous-agent neuf et reste responsable
du résultat : il relit le diff, regarde les captures, lance la gate et tient
le journal.

## Point de reprise (3 octobre 2026)

**Feuille de route v1 terminée** : V0 à V9, dont V7b (fiche de calibrage
retirée, révélation dev conservée) et V8 (parcours beta-testeur couvert).
V9 est clôturée par l'auteur le 3 octobre 2026 : le core de l'application
fonctionne et constitue le résultat validé pour cette reprise. Gate V9
verte : 1200 tests Vitest et 89 E2E. Dernier commit : voir `git log`.
Rien n'est poussé.

**Suite décidée par l'auteur** : reprendre les retouches et réévaluer les
détails visuels avec lui dans une nouvelle fenêtre. Les anciennes mentions
« validation visuelle attendue » du journal sont historiques ; elles ne
laissent aucune tâche ouverte dans cette feuille de route. Aucun nouveau
travail d'interface n'est à commencer dans la présente session.

**Dossier de recette conservé** : `tmp/v9/recette.html` et
`tmp/v9/textes.md`, 136 captures aux deux formats desktop. Les maquettes V4
et la police Nunito ont été validées auparavant ; les détails visuels seront
réévalués lors de la prochaine reprise.

**Réponses de l'auteur à garder** :

- Le crayon d'un niveau de campagne ouvre la solution révélée et la fiche de
  calibrage **seulement sous `pnpm dev`** (`DevelopmentModeContext`) ; la
  version publiée ne les montre pas. La révélation en dev reste ; la fiche de
  calibrage disparaît (V7b).
- Une création tirée d'un tutoriel et modifiée a son icône « Jouer » grisée
  (`puzzleFromWorkshop` : `no-object-to-place`, aucun objet « à placer »).
  L'auteur juge ce comportement normal : pas de correctif sur la carte. V8
  vérifie seulement qu'un joueur comprend comment rendre sa création jouable
  depuis l'Atelier (marquer des objets « à placer », solution vérifiée à
  l'export) et remonte à l'auteur avant d'agir.
- Pas de quota à gaspiller : une tâche à la fois, rapport court, l'auteur
  tranche le goût.

**Déploiement** : GitHub Pages au push sur `main`
(`.github/workflows/deploy-pages.yml`, base `/<dépôt>/`). Vérifié à la pause :
la police est bien réécrite sous la base. Pousser revient à l'auteur.

## Objectif de la v1

Un jeu **propre** qui fonctionne sur **desktop**, avec les cinq tutoriels de
l'auteur, qui donne envie à des beta-testeurs de jouer, puis de créer et
d'envoyer leurs niveaux. L'interface doit être jolie et évidente : importer,
exporter et remixer un niveau sans se demander quoi faire.

**Hors v1** — ne rien commencer de ce qui suit, même si une ancienne note le
propose :

- l'UI/UX téléphone (portrait/paysage, quoi afficher et quand) : c'est
  l'objet de la v2 ;
- de nouveaux niveaux, objectifs autres que « balle dans le panier », zones de
  construction restreintes, inspecteur compact, A1 à A3, ombres (U3) ;
- les sprites de poutre (U12) et la couleur du capuchon du bouton : l'auteur
  n'y voit pas de problème.

## Décisions prises avec l'auteur (2 octobre 2026)

1. **Desktop d'abord.** La règle mobile-first d'`AGENTS.md` est suspendue pour
   la v1. On ne casse pas sciemment ce qui marche au téléphone, mais on n'y
   passe pas de temps.
2. **Pas de bordure, pas de mur.** Le décor continue au-delà de la scène sans
   démarcation visible. La balle perd en sortant par le bas ou les côtés (marge
   de 2 unités inchangée) ; **sortir par le haut ne fait plus perdre**, la
   gravité la ramène. Aucun mur physique.
3. **Lexique unique** : **Accueil · Campagne · Atelier · Mes niveaux ·
   Paramètres**. « Démonstration », « Liste des niveaux », « Atelier de
   construction » et « Mode éditeur » disparaissent. Tutoiement partout.
4. **La démo est supprimée** (route, page, contenu, tests, entrées de menu).
5. **Cartes de niveau** : un aperçu réel du plateau (même rendu que le jeu),
   grisé si le niveau est verrouillé. Les actions secondaires deviennent des
   icônes avec libellé accessible ; « Modifier » est gardé sur **tous** les
   niveaux, y compris ceux de la campagne, pour inviter au remix.
6. **Maquettes avant code** pour tout ce qui relève du goût (V4) : aucun agent
   n'implémente un écran restylé sans maquette validée par l'auteur.
7. **Clôture fonctionnelle de la v1** (3 octobre 2026) : l'auteur demande de
   noter V9 comme faite. Sa priorité pour cette reprise est que le core de
   l'application fonctionne ; les détails visuels seront réévalués avec lui
   dans une nouvelle fenêtre.

## 1. Règles de travail

Les règles d'`AGENTS.md` s'appliquent. Compléments propres à la v1 :

- **Une tâche à la fois, dans l'ordre.** Un commit par tâche (code, tests,
  journal, `etat.md`), message en français à l'impératif avec l'identifiant :
  `feat(ui): renvoie le logo vers l'accueil (V3)`. Ne jamais pousser.
- **Gate** : `pnpm check` avant chaque commit. `pnpm check:fast` pendant le
  travail.
  Exception autorisée par l'auteur le 3 octobre 2026 pour V7b : après la gate
  complète (1200 tests Vitest et 87/88 E2E), corriger la synchronisation du
  test U6, relancer uniquement celui-ci, puis passer à V8 sans nouvelle gate
  globale. Cette exception ne s'étend pas aux tâches suivantes.
- **Captures** d'un changement visible : 1440 × 900 et 1280 × 720, inspectées
  par l'agent, citées dans le journal. L'auteur valide ; la tâche reste
  « validation visuelle attendue » dans `etat.md` jusque-là.
- **Fichier d'essai de l'auteur** : `tmp/check-levels.ts` fait échouer ESLint.
  Ne pas le modifier : le déplacer hors du dépôt le temps de la gate puis le
  remettre identique (SHA-256 `1113625e…`, mode 644).
- **Playwright** : une exécution isolée vide `test-results/`. Ne pas en lancer
  juste avant de demander une validation visuelle ; `pnpm check` régénère tout.
- **Specs au format téléphone** : beaucoup de parcours E2E fixent encore leur
  viewport à 390 × 844 (ou autre format téléphone) et tournent dans la gate
  `v1`. Si une tâche v1 change l'interface et casse une telle spec, passer la
  spec en 1440 × 900 (même parcours, mêmes assertions) ; ne pas retoucher la
  mise en page téléphone pour la faire passer. Une spec qui n'a de sens qu'au
  téléphone est étiquetée `@mobile`. Noter chaque cas dans le journal.
- **S'arrêter et écrire « bloqué »** si deux tentatives échouent au même
  endroit, si une décision manque ou si deux sources se contredisent. Ne
  jamais laisser `main` avec une gate rouge.
- **Ne pas faire sans tâche** : toucher aux constantes physiques, au schéma
  `LevelDocument`, aux enveloppes de stockage, au contenu des niveaux ; ajouter
  une dépendance ; affaiblir ou supprimer un test. Réécrire un test dont la
  tâche remplace le comportement est permis : le nommer dans le journal.

## 2. Tâches, dans l'ordre

Difficulté : ● simple, ●● moyenne, ●●● délicate.

### V0 — Cadre de la v1 ●● (Sonnet)

- `AGENTS.md` § Mobile-first : la remplacer par « v1 : desktop d'abord ; la
  règle mobile-first revient en v2 » (décision 1), en gardant l'interdiction de
  rendre une action essentielle dépendante du seul survol ou clic droit.
- `docs/index.md` : pointer vers cette feuille de route et
  `feuille-de-route-mes-niveaux.md` (historique) ; retirer de la carte les
  documents de propositions (`propositions-*.md`,
  `proposition-evolutions-canary.md`) en les déplaçant dans
  `docs/archives/` : ce sont des idées, pas des décisions.
- **Gate desktop** : ajouter un projet Playwright `v1` (Desktop Chrome,
  1440 × 900, `hasTouch: true` pour que les specs existantes fondées sur `tap`
  restent valides) et faire pointer `test:e2e:critical` dessus. Le projet
  `mobile` reste, lançable à la main, hors gate. Les specs qui testent
  intrinsèquement un format téléphone (`layout.spec.ts` portrait/paysage…) sont
  étiquetées `@mobile` et exclues du projet `v1` par `grepInvert`, pas
  supprimées. Lister dans le journal chaque spec exclue et pourquoi.
- Échec d'une spec sur `v1` pour une autre raison qu'un format téléphone :
  la corriger si le correctif est dans le test (sélecteur, viewport), sinon la
  noter « bloqué » et s'arrêter.
- Fini quand : `pnpm check` vert sur le projet `v1`.

### V1 — Finir l'intégration des tutoriels (N2) ●● (Sonnet)

Le contenu est déjà dans `src/content/levels/tuto-{1..5}.json` et commité
(`3157419`) ; seule la vérification manque. Journal N2 dans
`feuille-de-route-mes-niveaux.md`.

- Corriger Knip sur `sketchChapters` (`test/fixtures/sketch-campaign.ts`,
  utilisé par des imports dynamiques dans les mocks) sans désactiver la règle.
- `pnpm check` complet vert ; vérifier que les copies embarquées ne diffèrent
  des sources de `levels/` que par l'id, le titre, la description, l'auteur et
  l'état du ventilateur du tutoriel 3 (autorisé).
- Corriger `src/app/level-export.test.ts` (« Niveau 4 embarqué introuvable ») :
  il dépend d'une ancienne esquisse ; le faire porter sur les fixtures
  d'esquisses ou sur un tutoriel, sans affaiblir ce qu'il vérifie.
- Après : V0.

### V2 — Nettoyage ●● (Sonnet)

Trois commits distincts :

- **V2a Supprimer la démo** : route `/demo` (elle retombe sur le repli
  `/levels`), `DemoPage.tsx`, `demo.json`, carte de l'accueil, entrée de
  menu, motif `demo` du repli PWA, tests associés. Garder `/bench` (outil
  interne, hors menu).
- **V2b Pas de bordure, pas de perte par le haut** (décision 2). Test rouge
  dans `attempt-failure-evaluator.test.ts` : une balle au-dessus de la scène
  au-delà de la marge reste en jeu ; les trois autres côtés perdent toujours.
  Rendu (option A, choisie par l'auteur) : la bordure est peinte dans l'image
  `board-generic-v0.png` (cadre en bois, et image 3:2 étirée en 16:9). Ne plus
  dessiner d'image de fond : couleur parchemin unie (≈ `#f6ead3`) et grille du
  monde sur **tout** le viewport, sans aucune démarcation de la scène. Le
  chargement de l'image devient inutile (le retirer avec ses tests, ou le
  laisser inactif si d'autres usages existent : le dire). L'aperçu des niveaux
  (V5) utilisera le même rendu.
  Mettre à jour ADR 0007 (§ Scène) et le repère « Échec » d'`etat.md`.
  Captures : un niveau dézoomé, balle sortant par un côté.
- **V2c Repli hors ligne de `/my-levels`** : test rouge sur le motif
  `navigateFallbackAllowlist` de `vite.config.ts` (`/my-levels` et
  `/my-levels/<id>/play` servis hors ligne), puis correction.

### V3 — Navigation et vocabulaire ●● (Sonnet)

- Le bloc « TinkerBolt » de l'en-tête (`AppHeader`) est un lien vers `/`.
- Le bouton principal de l'accueil mène à `/levels` (plus au prochain niveau).
- Lexique (décision 3) appliqué au menu, à l'accueil, aux titres de page et à
  l'éditeur : le bandeau de l'éditeur affiche le titre du niveau et
  « Atelier », sans encadré. Mettre à jour les tests qui cherchent « Mode
  éditeur » ou « Liste des niveaux » (réécriture motivée, pas suppression).
- Ordre du menu : Accueil, Campagne, Atelier, Mes niveaux, Paramètres.
- `/import` (redirection vers `/my-levels`) est ajouté au repli hors ligne
  (`scripts/navigate-fallback-allowlist.ts`, test rouge d'abord ; relevé en
  V2c).
- Pas de restylage dans cette tâche : seulement liens et mots.

### V4 — Maquettes ●●● (Opus, session principale)

Maquettes HTML statiques dans `docs/maquettes/v1/`, avec les vrais sprites et
fonds de `public/assets/` et les captures de plateau existantes, aux deux
formats desktop. Montrées à l'auteur ; **aucune implémentation avant son
accord**. Direction : chaleureuse, artisanale, cohérente avec le décor de
l'atelier ; pas de flèches décoratives, pas de badges, pas d'accroches
creuses ; textes courts et concrets.

- Accueil : réécrire les textes ; une action principale (jouer → Campagne),
  puis Atelier et Mes niveaux ; progression discrète.
- Carte de niveau commune (campagne, mes créations, niveaux reçus) : aperçu,
  titre, auteur, état (verrouillé grisé, résolu avec palier), action
  principale « Jouer », actions secondaires en icônes (modifier, partager,
  dupliquer, supprimer selon la liste).
- Pages Campagne et Mes niveaux avec ces cartes ; bouton « Importer » dans le
  bandeau du haut de Mes niveaux.
- Bandeau de l'éditeur sans encadré « Mode éditeur ».
- Scrollbar : un style fin aux couleurs de l'atelier, pour toutes les zones
  qui défilent (catalogue, inspecteur, listes).
- Fini quand : l'auteur a validé ; les choix sont consignés dans le journal
  (et en ADR s'ils fixent une règle durable).

### V5 — Aperçu des niveaux ●●● (Sonnet, après V4)

- Fonction qui dessine un `LevelDocument` en image réduite avec le
  `BoardRenderer` existant (même fond, mêmes sprites, cadrage sur la scène,
  pas de simulation), mise en cache par empreinte du document. Tests : même
  document → même clé de cache ; documents différents → clés différentes ;
  rendu appelé hors de toute session d'édition.
- Dessin paresseux (cartes visibles seulement) pour ne pas bloquer la liste.

### V6 — Carte de niveau commune ●●● (Sonnet puis Opus, après V5)

- Composant unique `LevelCard` conforme à la maquette, utilisé par
  `LevelsPage` et `MyLevelsPage` ; extraire ce qui est dupliqué entre les deux
  pages (pas de refactoring sans rapport). Les tests existants des deux pages
  passent, réécrits seulement là où un libellé devient une icône (le nom
  accessible reste identique ou plus précis).
- Bouton « Importer » dans le bandeau de Mes niveaux.
- Étape A (Sonnet) : composant, factorisation, tests. Étape B (Opus) :
  ajustements visuels d'après la maquette, captures. Un seul commit.

### V7 — Accueil, éditeur, scrollbar ●● (Opus, après V4)

Implémenter les maquettes validées de l'accueil, du bandeau de l'éditeur et
de la scrollbar, et la police Nunito (journal V4). Captures aux deux formats.

- L'accueil n'utilise plus `board-workshop-day-v1.png` (la maquette montre un
  aperçu réel de niveau). Plus aucun fond de `public/assets/backgrounds/`
  n'étant utilisé, les exclure du précache du service worker (`globIgnores`,
  ≈ 7,8 Mo) ; laisser les fichiers en place (assets de l'auteur). Relevé en
  V2b.
- La grille de l'accueil passée à 3 colonnes en V2a disparaît avec la refonte.
- Relevé en V3, tranché par la décision 3 (tutoiement partout) : passer au
  tutoiement et à une formulation neutre souris/toucher les textes de
  `LevelExportDialog`, `ReceivedLevelShareDialog` et `level-export.ts`
  (« sélectionnez », « téléchargez », « touchez chaque objet », « gardez-les »).
  `BenchPlayPage` (outil interne) n'est pas concerné.
- Le titre de l'atelier libre (`workshop.json`, « Atelier de niveau ») devient
  « Nouveau niveau » : l'en-tête affichait « Atelier de niveau · Atelier ».
  Vérifier que les brouillons existants ne sont pas affectés (le titre d'une
  création enregistrée vient de son document, pas de `workshop.json`).

### V7b — Retirer la fiche de calibrage ● (Sonnet)

Demande de l'auteur : la fiche de calibrage (U28, `src/ui/CalibrationGuide.tsx`,
dialogue « Fiche de calibrage » ouvert par `BoardShell` via
`calibrationDocument`) servait à concevoir les niveaux et n'est plus utile.
La supprimer avec son bouton éventuel, ses tests et son CSS, sans toucher à la
révélation de la solution en mode dev. Grep `calibrat` dans `src/`, `e2e/`,
ADR 0015 et `etat.md`. Test rouge : en mode dev, ouvrir une création de
campagne n'affiche plus de dialogue de calibrage.

### V8 — Parcours beta-testeur ●●● (Opus)

Scénario E2E desktop de bout en bout : arriver sur l'accueil, jouer un
tutoriel, le modifier dans l'Atelier, l'exporter (fichier et lien), le
recevoir dans un autre contexte de navigateur, le jouer, le remixer. Chaque
hésitation constatée en le déroulant (bouton introuvable, mot ambigu, étape
inutile) est notée ; les corrections simples sont faites, les autres
remontées à l'auteur avant d'agir.

### V9 — Recette v1 ● (session principale)

Gate verte, captures de tous les écrans aux deux formats, relecture de tous
les textes visibles avec l'auteur, `etat.md` et README à jour. La v1 est
livrée quand l'auteur l'a validée.

Amendement de l'auteur du 3 octobre 2026 : **V9 est faite**, avec validation
centrée sur le fonctionnement du core. Les retouches et la réévaluation des
détails visuels sont reportées à une nouvelle fenêtre avec l'auteur.

## 3. Suite avec l'auteur

V9 clôturée sur instruction de l'auteur. Aucune validation restante ne bloque
la clôture de cette feuille de route. Les retouches et les détails visuels
seront réévalués dans une nouvelle fenêtre ; leur périmètre sera fixé avec
l'auteur à ce moment-là.

## 4. Journal

Une entrée par tâche, au format :

```
### <id> — <titre> — fait | partiel | bloqué — <commit>
- Tests rouges (ligne d'erreur utile), ce qui a été fait, captures, gate.
- Pour l'auteur : questions de goût ou décisions à prendre.
```

### V0 — Cadre de la v1 — fait — commitée avec la gate verte de V1 (2 octobre 2026)

- Fait : `AGENTS.md` § Mobile-first remplacée (v1 desktop d'abord, v2 mobile-first,
  interdiction du seul survol / clic droit conservée) ; `docs/index.md`
  (introduction, ligne `feuille-de-route-mes-niveaux.md`, notes « v2 » sur les
  lignes d'interface tactile et de parcours E2E) ; `mobile-editor-interactions.md`
  annoté « référence de la v2 » ; les trois documents de propositions déplacés
  avec `git mv` dans `docs/archives/` (liens relatifs de
  `propositions-gamification-astra.md` corrigés, chemins cités dans
  `feuille-de-route-luna.md` et `feuille-de-route-mes-niveaux.md` mis à jour) ;
  amendements datés du 2 octobre 2026 dans `docs/qualite.md` et l'ADR 0003.
- Gate : projet Playwright `v1` (Desktop Chrome, `channel: 'chromium'`, 1440 × 900,
  `hasTouch`, `grepInvert: /@mobile/`) ; `test:e2e:critical` pointe dessus. Le
  projet `mobile` reste, hors gate.
- Premier passage sur `v1` : 38 réussis, 3 échecs, **45 ignorés**. Les 45
  ignorés venaient de `test.skip(testInfo.project.name !== 'mobile', …)` (et de
  variantes `'desktop'`) : avec `v1` seul dans la gate, ces parcours (export, remix,
  Mes niveaux, partage, tutoriels, atelier…) auraient disparu en silence. Les
  conditions sont élargies à `v1` dans 21 fichiers de `e2e/` (aucun test supprimé
  ni ignoré en plus) ; ces specs fixent leur propre viewport (390 × 844…) et
  passent sur `v1` avec le même contenu d'assertions.
- Specs étiquetées `@mobile` : **aucune**. Toutes les specs de format téléphone
  (`layout.spec.ts` portrait/paysage, tiroirs, 320 × 568…) fixent leur propre
  viewport et passent sur `v1`; les exclure aurait réduit la couverture sans
  raison. `grepInvert` est en place pour les étiqueter en v2 ou plus tard.
- Tests corrigés (test seul, sans affaiblir ce qui est vérifié) :
  - `smoke.spec.ts` « lance depuis l'accueil le niveau 1 » (ex « …sur un écran
    mobile ») : cherchait « Ouvrir le catalogue », absent à 1440 × 900 où le
    catalogue est ancré ; le tiroir n'est ouvert que s'il existe.
  - `goal-ball.spec.ts` (deux tests R1) : comparaisons de pixels calibrées sur un
    écran dense (Pixel 5, ratio 2,75) ; à ratio 1 le bord doux du sprite écarte le
    coin échantillonné de 4 niveaux (seuil 3). `test.use({ deviceScaleFactor:
2.75 })` en tête du fichier, seuil inchangé.
- Aucun bug de production révélé sur desktop. Aucune intermittence de
  `layout.spec.ts` (D4, U15) observée sur 3 exécutions complètes de `v1`.
- Résultat : `pnpm exec playwright test --project=v1` (via
  `test:e2e:critical`) : 86 réussis, 0 ignoré (le projet `mobile` : 85 réussis,
  1 ignoré). Vitest : 1088 tests réussis, mais 1 fichier échoue
  (`src/app/level-export.test.ts`, « Niveau 4 embarqué introuvable », hérité de
  N2). Knip échoue sur `sketchChapters` (hérité de N2, tâche V1). Les autres
  étapes (typecheck, lint, formatage des fichiers suivis, contenu : 7 niveaux
  valides, build) passent. **Gate globale non verte pour des raisons étrangères à
  V0 : tâche non commitée**, à reprendre après V1 (voir `etat.md`).
- Pour l'auteur : la gate `v1` exécute encore les parcours en 390 × 844 ;
  c'est volontaire pour ne rien perdre, à reconsidérer en v2.

### V1 — Finir l'intégration des tutoriels (N2) — fait — commit V1 (2 octobre 2026)

- Tests rouges de départ : Knip `Unused exports (1) — sketchChapters
test/fixtures/sketch-campaign.ts:23:14` ; Vitest `src/app/level-export.test.ts`
  « Niveau 4 embarqué introuvable ».
- Knip : la configuration n'est pas en cause. Les mocks `vi.mock` de
  `App`, `CampaignDraftEditing`, `EditAndRemix` et `PuzzleWorkshop` utilisaient
  `const fixtures = await import(…)` puis `fixtures.sketchChapters` ; Knip suit
  les imports dynamiques déstructurés mais pas l'accès par membre sur un espace
  de noms. Correctif : `const { sketchChapters, sketchLevels } = await import(…)`
  (même comportement, aucune règle ni entrée Knip modifiée). Knip vert.
- `level-export.test.ts` : importe désormais `sketchLevels` depuis
  `test/fixtures/sketch-campaign` (comme `LevelExportDialog.test.tsx`), ce qui
  rétablit les niveaux 1 et 4 d'esquisse ; `embeddedWorkshopDocument` reste
  importé du contenu publié. Assertions inchangées. Suite Vitest complète :
  83 fichiers, 1096 tests, aucun autre reste de N2.
- Copies des tutoriels : comparées champ à champ aux sources de `levels/`
  (script jetable hors dépôt). Seules différences : id (tuto-1 : `free-workshop`
  → `tuto-1`), `metadata.title`, `metadata.description`, `metadata.author`
  (`Bolt`) et, pour le tutoriel 3, l'état du ventilateur de l'inventaire
  (`on` → `off`, autorisé). Aucune autre différence, `basedOn` identique.
- Gate `pnpm check` verte : 1096 tests Vitest, 7 documents de contenu, 86 tests
  Playwright `v1`, sans intermittence de `layout.spec.ts`. Code de production
  inchangé. `tmp/check-levels.ts` remis identique (sha256 `1113625e…`).
- Commits : V0 puis V1 séparés ; `docs/feuille-de-route.md` et `docs/etat.md`
  portent les deux tâches et sont dans le commit V1.

### V4 — Maquettes — fait, validé par l'auteur le 2 octobre 2026 — commit V4

- Maquettes statiques dans `docs/maquettes/v1/` (`accueil.html`, `campagne.html`,
  `mes-niveaux.html`, `atelier.html`, feuille `maquettes.css`), captures en
  1440 × 900 et 1280 × 720 dans `captures/`. Elles se servent en HTTP (la
  police ne se charge pas en `file://`) : `python3 -m http.server` à la racine.
  Les vignettes `img/tuto-*.png` sont de vraies captures du jeu, fond option A.
- **L'auteur a validé toute l'UI.** Ces maquettes font référence pour V5 à V7 ;
  les écarts d'implémentation se justifient dans le journal. Choix fixés :
  - **Police** : Nunito (OFL, variable), embarquée localement dans l'app
    (fichier de police dans `public/`, pas de dépendance npm, pas de police
    distante : PWA hors ligne). Licence OFL à citer dans le README.
  - **En-tête** : « TinkerBolt » lien vers `/` ; titre de page en texte simple
    centré, sans pastille ni sous-titre en capitales ; dans l'Atelier
    « <titre du niveau> · Atelier ».
  - **Accueil** : titre « Amène la balle jusqu'au panier. », texte « Poutres,
    tremplins, ventilateurs, leviers : place les pièces, lance la machine et
    regarde ce qui se passe. Raté ? Ajuste et relance. », bouton « Jouer » →
    `/levels`, lien « ou créer un niveau » → Atelier ; image : aperçu réel d'un
    tutoriel ; trois cartes Campagne (progression `n / 5` en barre),
    Atelier, Mes niveaux, illustrées par un sprite ; pied de page : licence
    CC BY 4.0 et « Paramètres ». Aucune flèche décorative, pastille,
    « carnet de bord » ni statistique.
  - **Carte de niveau** : aperçu 16:9 en haut avec numéro (campagne) et palier
    (Résolu / Élégant / Minimal, ou « Résolu · n objets » pour un niveau reçu) ;
    titre, ligne auteur/source (Mes niveaux), description sur deux lignes ;
    action principale verte + actions secondaires en icônes avec nom
    accessible et infobulle. Campagne : Jouer + Modifier. Créations :
    Modifier + Jouer, Partager, Dupliquer, Supprimer. Reçus : Jouer +
    Modifier, Partager, Supprimer. Verrouillé : aperçu grisé, badge
    « Verrouillé », actions désactivées. Pas de bandeau « Le carnet de
    l'atelier » ni de compteurs ; en-tête de chapitre « Chapitre 1 · Premiers
    pas » avec « n / 5 résolus ».
  - **Mes niveaux** : « Importer » et « Nouveau niveau » dans le bandeau du
    haut ; sections « Mes créations » et « Niveaux reçus » avec les mêmes
    cartes.
  - **Scrollbar** : fine, sable (`#d4c19c`, survol `#b99c69`), sans flèches,
    piste transparente, pour toutes les zones qui défilent.
- La maquette de l'Atelier ne couvre que le bandeau, le catalogue et la
  scrollbar : le reste de l'agencement de jeu et d'édition est reporté en v2.

### V2a — Supprimer la démo — fait — commit V2a (2 octobre 2026)

- Supprimés : route `/demo` (une URL `/demo` retombe sur `*` → `/levels`),
  `src/app/DemoPage.tsx`, `src/content/levels/demo.json`, `embeddedDemoDocument`,
  la carte « La démonstration » de l'accueil (la grille de l'accueil passe de 4 à
  3 colonnes à partir de 1100 px, sinon la quatrième restait vide : seul ajustement
  de mise en page, le reste de l'accueil est inchangé), l'entrée « Démonstration » du
  menu, le motif `demo` de `navigateFallbackAllowlist`. ADR 0008 amendée,
  `etat.md` corrigé (contenu : six documents embarqués). `/bench` est gardé.
- Test rouge (sur une copie propre de HEAD) : `App.test.tsx` « redirige /demo,
  route supprimée, vers la liste des niveaux (V2a) » — `AssertionError: expected
'/demo' to be '/levels'`.
- Tests qui disparaissent avec la démo : `App.test.tsx` « ouvre la démonstration
  sur /demo, en mode joueur sans rien à construire » (remplacé par le test de
  redirection ci-dessus, qui vérifie aussi l'absence de l'entrée de menu) ; les
  entrées « La démonstration » des parcours « ouvre chaque destination » de
  `HomePage.test.tsx` et `e2e/home.spec.ts` (les trois autres destinations restent
  vérifiées) ; `src/content/demo.test.ts` (la démo se résout seule) est devenu
  `test/conformance/self-solving-level.test.ts`, même assertion sur le niveau de test
  ci-dessous : il garde honnête le fichier que les E2E importent.
- Tests qui utilisaient la démo comme outil et sont conservés : la machine en chaîne
  est déplacée en fixture de test (`test/fixtures/self-solving-level.{json,ts}`,
  id `self-solving`, titre « Machine en chaîne », texte « Lancer » au lieu de
  « Tester »), jamais embarquée dans l'application. Elle remplace
  `embeddedDemoDocument` dans `level-outcome`, `level-fingerprint`,
  `level-file-codec` et `level-share-codec` (tests inchangés). Les E2E
  `received-play.spec.ts`, `my-levels.spec.ts` (import d'un niveau reçu) et
  `smoke.spec.ts` (bandeau de victoire sous le plateau, 320 × 568) la lisent ou
  l'importent via « Mes niveaux » ; le titre attendu devient « Machine en chaîne ».
- Tests réécrits (App.test.tsx), `/demo` étant remplacé par un niveau reçu qui se
  résout seul (`/my-levels/<id>/play`, dépôt de niveaux reçus injecté) : B1
  (bandeau après le plateau), B5 (emplacement de résultat unique), « ne persiste
  pas les victoires hors campagne » — assertions inchangées. U4/U4b (« ni bandeau
  ni modale de campagne hors campagne ») est réécrit : un niveau reçu montre
  légitimement une modale « Bravo ! » et le palier « Résolu » (M10, U24), ce que
  la démo ne faisait pas ; le test vérifie désormais l'absence de « Niveau suivant »
  et de palier de défi (palier `resolved` seul), et non plus l'absence de modale.
- Gate `pnpm check` verte : 1096 tests Vitest (83 fichiers), 6 documents de
  contenu, 86 tests Playwright `v1`. Première exécution : un échec intermittent
  de `smoke.spec.ts` « place au tactile puis annule le placement » (comparaison de
  deux captures du plateau), sans lien avec la démo ; trois exécutions isolées
  et la gate suivante passent.
- Pour l'auteur : la grille d'accueil à trois destinations (4 colonnes avant)
  sera redessinée par V7.

### V2b — Pas de bordure, pas de perte par le haut — fait, validation visuelle attendue — commit V2b (2 octobre 2026)

- Test rouge (domaine) : `attempt-failure-evaluator.test.ts` « ne perd jamais par
  le haut : la balle au-delà de la marge reste en jeu… (V2b) » — `expected {
status: 'failed', … } to deeply equal { status: 'pending', … }`. Correctif : le
  test `position.y < scene.min.y - marge` est retiré de `isOutOfScene` (gauche,
  droite et bas inchangés, marge de 2 unités). Une balle qui monte haut retombe
  ou atteint la limite de 20 s : voulu. Tests ajoutés : balle très haute reste en
  jeu ; balle très haute mais hors par un côté perd toujours.
- Test rouge (rendu) : `board-renderer.test.ts` « fond uni et grille sur tout le
  viewport (V2b) » — trois échecs, dont `expected [ fillRect…, fillRect… ] to
deeply equal [ fillRect [0, 0, 320, 240] ]` (le fond de scène était encore
  peint) et `expected [] to deeply equal [ moveTo [20, 0], lineTo [20, 240] ]`
  (grille absente quand la scène est hors du viewport).
- Rendu : `drawPaper` (couleur `#f6ead3` sur tout le viewport) puis `drawWorldGrid`
  (un mètre, sur **tout** le viewport, même atténuation au faible zoom) ; aucune
  image, aucune couleur hors scène, aucun trait de scène. `loadBackground`,
  `OUTSIDE_SCENE_COLOUR`, `SCENE_FALLBACK_COLOUR` et le décodage du fond de
  `BoardView` sont retirés. Les zones de construction (U13) sont inchangées.
- Tests supprimés avec le fond image (`board-renderer.test.ts`) : « projette le
  fond dans la scène… » (plus d'image à projeter), « attend le décodage du fond
  avant tout dessin » et « garde les objets et un fond uni si l'image de fond ne
  peut pas être chargée » (plus de chargement, donc plus d'échec de chargement).
  Réécrits : « peint tout le viewport hors scène avec une couleur unie avant le
  fond » (parchemin, sans image, un seul `fillRect`), « trace une grille d'un mètre
  limitée à la scène visible » (désormais sur tout le viewport, scène comprise ou
  non), « atténue la grille au faible zoom et ne la trace pas hors scène »
  (atténuation conservée ; « ne pas tracer hors scène » est précisément ce qui
  change : la grille se trace hors scène, test de panoramique ajouté). Le test
  `dessine chaque fil en équerre…` saute maintenant le trait de la grille ;
  `wire-renderer.test.ts` prend le parchemin `#f6ead3` comme couleur du plateau.
  `attempt-failure-evaluator.test.ts` « tolère la marge sur les quatre côtés »
  devient « … à gauche, à droite et en bas », le haut étant couvert par le nouveau
  test.
- E2E : `board-background.spec.ts` (U2) devient `board-paper.spec.ts` : même
  parcours (ajusté, zoom avant, panoramique tactile, ajuster), mêmes trois
  formats, mais la référence est le parchemin et la grille repeints hors écran
  (`e2e/board-paper.ts`) ; elle vérifie aussi des points juste à l'extérieur des
  quatre bords de la scène (rien ne marque la limite). Disparu avec l'image : la
  comparaison au PNG. `goal-ball.spec.ts` (R1), `build-zones.spec.ts` (U13) et
  `object-shadows.spec.ts` (U3) comparaient leurs pixels au PNG projeté : ils
  utilisent la même référence (assertions et seuils inchangés). Aucune spec de
  format téléphone modifiée.
- Documents : ADR 0007 amendée (rendu, rôle de la scène, perte) avec renvois dans
  § Scène et § Conséquences ; l'ADR 0006 ne décrit pas le fond du plateau, rien à
  y corriger ; `etat.md` (repère « Échec », fond et grille).
- **Précache PWA** : `workbox.globPatterns` inclut `png` : les quatre fonds de
  `public/assets/backgrounds/` sont précachés (`dist/sw.js`), dont
  `board-generic-v0.png` (1,7 Mo), désormais inutilisé, ainsi que
  `board-workshop-evening-v1.png` et `board-workshop-stone-v1.png` qui ne l'étaient
  déjà pas (seul `board-workshop-day-v1.png` sert, à l'accueil). Non modifié, à
  décider (voir ci-dessous).
- Captures (1440 × 900 et 1280 × 720, tutoriel 1 « Le petit pont ») dans
  `/tmp/claude-1000/-home-aflesch-tinkerbolt/6a643584-d9aa-4357-aedc-da10439fec33/scratchpad/v2b/` :
  `ajuste-*.png` (ajustement par défaut), `dezoome-*.png` (trois fois « Zoom
  arrière »), `sortie-bas-*.png` (tutoriel 1 lancé sans rien poser : la balle
  tombe sous la scène) et `sortie-cote-*.png` (niveau jetable : la balle roule
  au-delà du bord droit, vue dézoomée). Inspectées : parchemin uni, grille
  continue autour de la scène, aucune démarcation. La gate régénère en plus
  `test-results/board-paper/` (ajusté, zoom, panoramique aux trois formats).
- Gate `pnpm check` verte : 1097 tests Vitest (83 fichiers), 6 documents de
  contenu, 86 tests Playwright `v1`.
- Pour l'auteur : (1) le parchemin et la grille sont-ils à ton goût (couleur,
  intensité de la grille à fort zoom : 0,16 d'opacité) ? (2) Faut-il retirer les
  trois PNG inutilisés du précache (`globIgnores`) ? Le fichier générique pèse
  1,7 Mo.

### V2c — Repli hors ligne de `/my-levels` — fait — commit V2c (2 octobre 2026)

- Le motif de `navigateFallbackAllowlist` est extrait de `vite.config.ts` dans
  `scripts/navigate-fallback-allowlist.ts` (`createNavigateFallbackAllowlist(basePath)`,
  même construction, `routeBasePattern` échappé comme avant) ; `vitest.config.ts`
  inclut désormais `scripts/**/*.test.ts`. Le comportement des autres routes est
  inchangé (le motif généré dans `dist/sw.js` ne diffère que par `my-levels`).
- Tests rouges (module extrait à l'identique, avant correction) :
  `scripts/navigate-fallback-allowlist.test.ts` — « sert /my-levels hors ligne »,
  « sert /my-levels/ hors ligne », « sert /my-levels/recu-0123456789abcdef/play hors
  ligne » : `expected false to be true // Object.is equality` ; « respecte le
  sous-répertoire de déploiement » et « échappe les caractères spéciaux » échouent
  de même. `/demo` n'est déjà plus servie depuis V2a (test « ne sert pas /demo »
  vert dès l'extraction). E2E `pwa.spec.ts` « ouvre « Mes niveaux » hors ligne » :
  `page.reload: net::ERR_INTERNET_DISCONNECTED` sans le correctif, vert avec.
- Correctif : `my-levels(?:/.*)?` ajouté au motif. ADR 0012 amendée (liste des
  routes servies hors ligne), `etat.md` mis à jour.
- Hors périmètre, signalé : `/import` (redirige vers `/my-levels`) n'est pas dans
  le repli ; hors ligne, un ancien lien `/import` ne s'ouvrirait pas.
- Gate `pnpm check` verte : 1116 tests Vitest (84 fichiers), 6 documents de
  contenu, 87 tests Playwright `v1`.

### V3 — Navigation et vocabulaire — fait, validation visuelle attendue — commit V3 (2 octobre 2026)

- Tests rouges (avant le code) : `AppHeader.test.tsx` « fait de la marque
  « TinkerBolt » un lien vers l'accueil » (aucun lien nommé « TinkerBolt, accueil »)
  et « liste le menu dans l'ordre du lexique… » (`expected [ Array(5) ] to deeply
equal [ 'Accueil', 'Campagne', 'Atelier', 'Mes niveaux', 'Paramètres' ]`) ;
  `HomePage.test.tsx` (quatre tests : `Unable to find an accessible element with
the role "link" and name "Jouer"`) ; `navigate-fallback-allowlist.test.ts` « sert
  /import hors ligne » et « /import/ » (`expected false to be true`). Test ajouté
  après coup, vérifié rouge contre l'ancien `EditorPage.tsx` : `FreeWorkshopSaving`
  « affiche dans l'en-tête le titre du niveau édité, avec « Atelier » ».
- Fait : le bloc de marque est un `<Link to="/">` (`aria-label` « TinkerBolt, accueil »,
  le `<h1>` « TinkerBolt » reste dedans ; `color: inherit; text-decoration: none`
  pour que le rendu reste identique) ; menu dans l'ordre Accueil, Campagne,
  Atelier, Mes niveaux, Paramètres ; « Jouer » (accueil) mène à `/levels` (libellés
  « Commencer / Continuer à jouer », « Revisiter la campagne » supprimés, ligne
  « Niveau N · titre » sous le bouton conservée) ; `/import` dans le repli hors ligne.
  Sous-titres de l'écran de jeu : « Campagne » (niveau de campagne), « Mes
  niveaux » (niveau reçu ou partagé), « Atelier » (atelier et « Test joueur »).
  Atelier : le titre est celui du niveau en cours (suit les modifications), «
  Sans titre » s'il est vide ; l'ancien paramètre `title=""` de `Workshop` est retiré.
  Retours « Liste des niveaux » (niveau verrouillé, brouillon introuvable, partage
  invalide) devenus « Campagne » ; page d'erreur d'un niveau reçu : titre « Mes
  niveaux ». Aides au tutoiement et neutres à la souris comme au toucher :
  « Lance la machine avec « Lancer » pour la voir tourner. », « …puis lance la
  machine avec « Lancer ». », « Choisis un objet pour le placer. », guide des fils
  (« Choisis une commande ou l'appareil à relier »…), et deux messages vouvoyés
  (`use-editor-session`, `use-simulation-runner`). ADR 0008 amendée (V3), ADR 0012
  (liste des routes hors ligne), `etat.md`.
- Tests réécrits (même parcours, libellés nouveaux, aucun supprimé ni ignoré) :
  « Mode éditeur » → « Atelier » et « Mode joueur » → « Campagne » / « Mes niveaux »
  / « Atelier » (selon l'écran) dans `App`, `MyLevelsPage`, `PuzzleWorkshop`,
  `RevealAuthorSolution`, `CampaignDraftEditing`, `CampaignRemix`, `EditAndRemix`,
  `FreeWorkshopSaving` et les E2E `campaign-draft`, `export`, `free-workshop`,
  `levels`, `my-levels`, `puzzle-workshop`, `remix`, `reveal`, `share-attribution`,
  `shared`, `smoke`, `editor-interactions` ; boutons de menu « Liste des niveaux » /
  « Atelier de construction » → « Campagne » / « Atelier » (`App`, `SettingsPage`,
  `FreeWorkshopSaving`, E2E `layout`, `settings`, `remix`, `shared`, `smoke`,
  `editor-interactions`) ; là où le bouton « Retour à l'atelier » / « Mes niveaux »
  porte le même texte que le sous-titre, l'assertion cible `.level-mode`. Parcours
  « Commencer à jouer » : `App.test` « lance depuis l'accueil, par la campagne, le
  niveau 1 » (accueil → « Jouer » → `/levels` → « Lancer le niveau 1 »), E2E
  `smoke`, `home` (URL `/levels`, niveau 2 activé après une victoire) et
  `pwa-invitation` (même détour par la liste). Textes d'aide : `wiring-tool.test`,
  `App.test`, E2E `player-wires`, `editor-interactions`, `first-level-hint`.
  Aucune spec de format téléphone retouchée : toutes passent telles quelles sur `v1`.
- Captures 1440 × 900 (accueil, menu ouvert, atelier, tutoriel 1 en jeu) dans
  `/tmp/claude-1000/-home-aflesch-tinkerbolt/6a643584-d9aa-4357-aedc-da10439fec33/scratchpad/v3/`,
  inspectées : marque inchangée, menu dans le bon ordre, sous-titres « ATELIER » et
  « CAMPAGNE » (capitales par la feuille de style, inchangée), pas d'autre écart.
- Gate `pnpm check` verte : 1123 tests Vitest (84 fichiers), 6 documents de contenu,
  87 tests Playwright `v1`. Une première exécution avait échoué sur un seul test E2E
  (`puzzle-workshop`, sous-titre « Atelier » et bouton « Retour à l'atelier » : deux
  éléments) ; corrigé dans le test. `tmp/check-levels.ts` écarté puis remis identique.
- Pour l'auteur :
  - dans l'Atelier libre, le niveau s'appelle « Atelier de niveau » (titre du document
    `workshop.json`) : l'en-tête affiche donc « Atelier de niveau · ATELIER » ; à
    trancher avec V7 (« Sans titre » ? titre d'ouverture ?) ;
  - textes volontairement non touchés (boîte d'export / partage, outil interne) :
    `LevelExportDialog` et `ReceivedLevelShareDialog` (« sélectionnez le lien… »,
    « téléchargez le fichier »), `level-export.ts` (deux refus : « touchez chaque
    objet… », « gardez-les dans une zone de construction »), `BenchPlayPage`
    (« Appuyez sur Lancer… ») ;
  - la région accessible « Liste des niveaux » de la page Campagne (invisible) est
    gardée ; elle disparaîtra avec la refonte V6 ;
  - l'accueil (V7 le refait) garde « 1 chapitres à explorer » (pluriel fautif avec un
    seul chapitre) et la ligne « Niveau 1 · Le petit pont » sous « Jouer », qui ne
    correspond plus à la destination du bouton.

### V5 — Aperçu des niveaux — fait — commit V5 (2 octobre 2026)

- Architecture. `src/presentation/level-preview.ts` : `previewViewport` (caméra
  d'aperçu) et `renderLevelPreview({ document, cssWidth, cssHeight, devicePixelRatio,
canvas, context, spriteLoader })`, qui appelle `projectLevel` et
  `createBoardRenderer` sans second moteur de dessin (état initial, pas de
  simulation, `toPlaceIds` vidé : aucun contour, poignée ni sélection ; ni horloge ni
  aléatoire). `src/ui/board-canvas.ts` : l'adaptateur `CanvasRenderingContext2D` et le
  décodeur de sprites, extraits tels quels de `BoardView.tsx` (qui les importe) pour
  que le plateau et l'aperçu passent par le même code. `src/app/level-preview-cache.ts` :
  `createLevelPreviewCache` (injectable, testé) ; `src/app/level-preview-images.ts` :
  l'instance de l'application (canevas hors écran → PNG → object URL, un chargeur de
  sprites partagé, capacité 48) ; `src/app/LevelPreview.tsx` + `.level-preview` dans
  `styles.css`.
- Cadrage. La scène entière, centrée, sans marge ni plancher de zoom (celui de
  « Ajuster à la scène », 24 px/unité, ne tiendrait pas la scène dans une petite
  vignette). Si le ratio n'est pas 16:9, le parchemin et la grille continuent autour.
  L'aperçu est dessiné dans un repère logique fixe de 640 px de large, la densité de
  pixels absorbant l'écart : grille d'un pixel et proportions identiques à la maquette
  quelle que soit la taille de la carte. L'image mesure exactement taille CSS × densité.
- Cache. Clé = empreinte `levelFingerprint` + taille CSS arrondie + densité ; sans
  `crypto.subtle` (HTTP hors contexte sécurisé), le texte du fichier sert de clé. Deux
  documents égaux partagent l'entrée (et un dessin en cours) ; un document modifié en
  crée une. LRU par ré-insertion ; `acquire` rend une prise (`url`, `release`) : une URL
  affichée n'est jamais révoquée, le cache dépasse sa capacité tant que des images sont
  utilisées puis revient à la capacité à la libération. Un échec n'est pas mémorisé.
- Composant. `LevelPreview({ document, alt = '', cache? })` : cadre 16:9 (CSS) sur
  parchemin `#f6ead3` ; IntersectionObserver (marge 200 px) ; ne demande l'image qu'une
  fois la carte proche ; sans IntersectionObserver, dessine tout de suite ; libère la
  prise au changement de document et au démontage ; en cas d'échec le parchemin reste.
  Le gris du verrouillage est laissé au CSS de la carte (V6) ; `alt` vide = décoratif.
- Tests (Red-Green) : `level-preview.test.ts` (11, rouges d'abord par module absent ;
  le test « ni contour pointillé » vérifié rouge sans le `toPlaceIds: []` :
  `expected [...] to not include 'setLineDash'`), `level-preview-cache.test.ts` (11 ;
  la garde « une seule libération » vérifiée rouge en la retirant),
  `LevelPreview.test.tsx` (8 ; « ne dessine rien avant d'être visible » vérifié rouge
  avec un état initial visible). Les premiers jets de deux tests du cache supposaient
  une éviction par ancienneté sans tenir compte des prises ; corrigés (test seul).
  Aucun test existant modifié.
- Vérification visuelle (page de test et serveur de dev jetables, retirés) :
  `/tmp/claude-1000/-home-aflesch-tinkerbolt/6a643584-d9aa-4357-aedc-da10439fec33/scratchpad/v5/`
  (`tuto-1…5-1x.png`, `-2x.png`, `grille-*`, `autres-*`). Les cinq aperçus (640 × 360)
  ont le même contenu et le même cadrage que `docs/maquettes/v1/img/tuto-*.png` (écart
  de pixels : lissage des bords uniquement, 2 à 5 % de pixels). À 2x, l'image naturelle
  fait 640 × 360 pour 320 × 180 CSS : nette. Une carte hors de l'écran n'a pas d'image
  avant le défilement, puis en reçoit une.
- Knip : `LevelPreview` n'est utilisé que par son test, ce que Knip accepte (les
  fichiers de test sont des points d'entrée) ; aucun faux usage, aucun ignore. V6 le
  branche.
- Gate `pnpm check` verte : 1153 tests Vitest (87 fichiers), 6 documents de contenu,
  87 tests Playwright `v1`. `tmp/check-levels.ts` écarté puis remis identique.
- Pour V6 : passer `document` (et `alt` vide si le titre est dans la carte) ; poser
  `LevelPreview` dans le cadre `.thumb` ; griser par CSS (`filter`) la carte verrouillée ;
  le cadre prend la largeur de son parent, la hauteur vient du ratio. Le cache est
  global au module : les tests de pages qui monteront `LevelPreview` devront injecter
  `cache` ou simuler `levelPreviewImages` (jsdom n'a ni canevas ni `createImageBitmap` :
  l'aperçu y reste simplement sur le parchemin). Changer le titre d'un niveau change
  son empreinte, donc redessine l'aperçu (sans conséquence visuelle).

### V6 — Carte de niveau commune — fait (validation visuelle attendue) — commit V6 (2 octobre 2026)

Étape A (Sonnet : composant, factorisation, tests) puis étape B (Opus : finition d'après
la maquette, captures), un seul commit.

- Architecture. `src/app/LevelCard.tsx` (couche `app`, car il intègre `LevelPreview`) est
  la carte unique ; `src/app/LevelSection.tsx` factorise l'en-tête de section
  (titre `h2` qui nomme la région + compteur à droite) des chapitres de la campagne et
  des sections de « Mes niveaux ». `LevelsPage` et `MyLevelsPage` n'ont plus de carte,
  de statut ni d'attribution propres. API de `LevelCard` : `document`, `label?` (nom de
  la région, titre par défaut), `number?`, `tier?` (`resolved | elegant | minimal | null`),
  `objectCount?` (avec `resolved` : « Résolu · n objets »), `locked?`, `showAttribution?`
  (`attributionParts`, texte brut), `assistiveStatus?`, `primary?` et `actions` (chacune :
  `label`, `name?`, `icon`, `onSelect`, `disabled?`, `danger?`, `availableWhenLocked?`),
  `previewCache?` (tests). Verrouillé : classe `level-card-locked` (CSS `filter` sur l'aperçu),
  badge « Verrouillé » sur l'aperçu, toutes les actions désactivées sauf celle qui porte
  `availableWhenLocked` (supprimer la création d'un niveau verrouillé, ADR 0015).
- Tests rouges. `LevelCard.test.tsx` (22 tests, rouges d'abord : module absent). Pages,
  vérifiées rouges contre l'ancien `LevelsPage`/`MyLevelsPage` (11 échecs) : région « Campagne »
  introuvable (5, `App.test`), bouton « Importer » absent du bandeau (2), compteurs de section
  absents (2), `expected [ null ] to deeply equal [ 'Supprimer' ]` (création verrouillée),
  `Unable to find an element with the text: Résolu · 2 objets`.
- Campagne : plus de bandeau « Le carnet de l'atelier », de titre « Choisis ton prochain
  défi » ni de compteurs ; en-tête « Chapitre N · titre » avec « n / total résolus » (niveaux
  `resolved` du chapitre). La note « Mode développement : niveaux débloqués » est gardée.
  « Jouer » porte le nom accessible « Lancer le niveau N » (`aria-label`, inchangé à l’étape A, « Jouer le niveau N » à l’étape B) et l'icône
  crayon « Modifier le niveau N » (infobulle « Modifier dans l'Atelier »).
  **La région accessible « Liste des niveaux » est renommée « Campagne »** (lexique, décision 3).
  Le message d'échec de création du brouillon passe sous la grille du chapitre.
- Mes niveaux : « Importer » et « Nouveau niveau » sont dans le bandeau (`headerAction` d'`AppFrame`),
  l'`<input type=file>` caché avec eux. Sous 700 px, le libellé est masqué (CSS) et l'icône reste,
  nom accessible conservé (`aria-label`) : à 390 px le bouton du menu sortait de l'écran sinon.
  Création : principale « Modifier » ; icônes Jouer, Partager, Dupliquer, Supprimer. Reçu :
  principale « Jouer » ; icônes Modifier, Partager, Supprimer. Création verrouillée : seule
  l'icône Supprimer, active. États vides et notices conservés.
- « Pas encore résolu » (niveau reçu) : pas de badge (maquette) ; le texte est gardé en
  `visually-hidden` (lu par les lecteurs d'écran, et deux tests existants — `MyLevelsPage.test`,
  E2E `my-levels` et `received-play` — le cherchent). « Record : n objets » disparaît au
  profit du badge « Résolu · n objets ».
- Tests réécrits (là où un libellé visible devient une icône, ou où l'élément a disparu) :
  `App.test` : la région « Liste des niveaux » devient « Campagne » (4 tests) ; l'assertion du
  titre « Choisis ton prochain défi » devient son absence + celle de « Le carnet de l'atelier »
  et des compteurs (bandeau supprimé), et les compteurs « n / total résolus » y sont ajoutés.
  `MyLevelsPage.test` : « Nouveau niveau » / « Importer un fichier » (cherchés dans les sections)
  deviennent « Nouveau niveau » / « Importer » dans le bandeau ; « Résolu » + « Record : 2 objets »
  deviennent « Résolu · 2 objets » ; la création verrouillée lit les `aria-label` des boutons
  (leur texte est vide, ce sont des icônes) au lieu de `textContent`. E2E : `levels`, `home`
  (région « Campagne »), `my-levels` (bouton « Importer », hors section), `received-play`
  (« Résolu · 0 objet »). Aucun test supprimé ni ignoré ; aucune spec de format téléphone
  retouchée (les parcours à 390 × 844 passent tels quels).
- Tests ajoutés (pages) : bandeau de `Mes niveaux`, ouverture du sélecteur par « Importer »,
  compteurs des sections.
- CSS : `src/ui/styles.css` § U5/V6 réécrit (grille `auto-fill minmax(300px,1fr)`, carte, aperçu,
  surimpressions, actions, verrouillage). Supprimé comme mort : `.campaign-hero*`, `.campaign-stats*`,
  `.level-chapter*`, `.level-card-status*`, `.level-card .panel-*`, `.level-card::before`,
  `.level-list`, `.my-level-*`, `.my-levels-heading/-section`, `.level-card-action/-edit`.
- Captures d'étape (non validées) : `/tmp/claude-1000/-home-aflesch-tinkerbolt/6a643584-d9aa-4357-aedc-da10439fec33/scratchpad/v6/`
  (`campagne-` et `mes-niveaux-` en 1440 × 900, 1280 × 720 et 390 × 844).
- Étape B — décisions de la session principale :
  - **Nom accessible « Jouer le niveau N »** (au lieu de « Lancer le niveau N ») : il contient le
    libellé visible « Jouer » (WCAG 2.5.3). Réécriture mécanique des tests qui le cherchaient
    (`App.test`, `SettingsPage.test`, `LevelCard.test`, E2E `home`, `levels`, `settings`, `smoke`,
    `pwa-invitation`) ; aucun autre « Lancer » (simulation) touché. Rouge vérifié avant le
    changement de `LevelsPage` : 8 échecs `Unable to find an accessible element with the role
"button" and name "Jouer le niveau 1"`.
  - **« Modifié le … »** sous le titre d'une création : `src/app/modified-on.ts`
    (`modifiedOn(updatedAt, today)`, pur : jour — « 1er » pour le premier — et mois en toutes
    lettres, l'année seulement si elle n'est pas celle de `today`). `today` vient de l'horloge
    déjà injectée de `MyLevelsPage` (`systemClock`) ; `LevelCard` reçoit un texte (`meta`), sans
    lire l'horloge. Tests rouges : `modified-on.test.ts` (module absent), `LevelCard.test`
    (`Unable to find an element with the text: Modifié le 2 octobre`), `MyLevelsPage.test`
    (horloge simulée, `Modifié le 20 septembre` / `Modifié le 4 mars 2025`, rien sur un reçu).
  - **Aperçu cliquable** : un `<button>` transparent couvre l'aperçu et déclenche l'action
    principale, avec `tabIndex=-1` et `aria-hidden` : agrandissement de cible pour la souris,
    sans second arrêt de tabulation ni second bouton annoncé (le bouton nommé de la carte reste
    l'unique entrée clavier et lecteur d'écran). Les pastilles laissent passer le clic
    (`pointer-events: none`). Absent sans action principale, si elle est désactivée ou si la carte
    est verrouillée. Test rouge : `Aperçu cliquable introuvable.`
- Étape B — finition CSS (`styles.css` § V6), reprise de `maquettes.css` : survol de carte
  (−2 px, ombre `0 12px 28px`), neutralisé sur une carte verrouillée ; boutons de carte à 40 px
  (`--touch-target` global inchangé), bordure 1 px, 15 px ; bouton vert sans bordure, avec
  `box-shadow: inset 0 -3px 0 var(--go-edge)` et éclaircissement au survol ; icônes bordées,
  survol sable, Supprimer en rouge ; badge « Verrouillé » 14 px non coupé ; ligne d'auteur et de
  source sur une ligne (`par Mila · d’après La chaîne`), 13 px gras atténué, comme « Modifié le » ;
  en-têtes de section (marge haute 8 px, 18 px avant la grille) ; page `max-width` 1180 px avec
  marges 40 / 32 / 64 px dès 700 px ; états vides en encadré pointillé (`--night-800`, bordure
  `--night-line` en tirets, rayon 14 px). L'en-tête, l'accueil et l'éditeur ne sont pas touchés (V7).
- Captures finales (1440 × 900 et 1280 × 720, build servi par `vite preview`, progression
  et niveaux reçus injectés dans `localStorage`, créations faites par « Modifier » puis
  renommées et datées) :
  `/tmp/claude-1000/-home-aflesch-tinkerbolt/6a643584-d9aa-4357-aedc-da10439fec33/scratchpad/v6-final/`
  (`campagne-*`, `mes-niveaux-*`, `-full` pleine page, `vide-*` états vides,
  `survol-carte-1440.png`, `survol-supprimer-1440.png`). Comparées aux captures de
  `docs/maquettes/v1/captures/` : grille, cartes, aperçus, pastilles, boutons et en-têtes se
  superposent ; l'écart restant tient à la police (Nunito : V7) et à l'en-tête (V7).
- Écarts connus avec la maquette, hors police : aucun palier « Élégant » ni « Minimal » dans la
  campagne, les tutoriels n'ayant pas de défi (`challenge` absent, vérifié par
  `embedded-levels.test`) — la pastille est couverte par `LevelCard.test` et stylée comme la
  maquette ; la source s'écrit `d’après La chaîne`, sans guillemets (format ADR 0016) ; l'icône
  « Jouer » des créations issues d'un niveau de campagne est désactivée (pas d'objet « à placer »,
  comportement existant) ; les textes des états vides restent ceux de la page.
- Gate `pnpm check` verte : 1185 tests Vitest (89 fichiers), 87 tests Playwright `v1`.
  `tmp/check-levels.ts` écarté puis remis identique.
- Pour l'auteur : valider les captures de `v6-final/`.

### V7 — Accueil, éditeur, scrollbar, police — fait (validation visuelle attendue) — commit V7 (2 octobre 2026)

- Tests rouges (avant le code) : `HomePage.test.tsx` réécrit (maquette V4) — `Unable to find
an accessible element with the role "heading" and name "Amène la balle jusqu’au panier."`,
  `… role "img" and name "Aperçu du niveau « La chaîne »"`, `… role "link" and name
/^Campagne/u` ; `AppHeader.test.tsx` « Titre · Contexte » (5 tests : séparateur absent,
  `title` obligatoire) ; `FreeWorkshopSaving.test` et `embedded-levels.test` — `expected
{ title: 'Atelier de niveau' } to deeply equal { title: 'Nouveau niveau' }` ;
  `level-export.test` (« sélectionne… », « garde-les… »), `LevelExportDialog.test`
  (« Envoie le fichier… », « sélectionne le lien… »), `ReceivedLevelShareDialog.test`
  (lien à sélectionner, test ajouté) ; `scripts/precache-globs.test.ts` (module absent).
  Le test « garde à une création enregistrée le titre de son document, même l’ancien titre
  de l’atelier » est vert dès l’écriture : c’est la garde de non-régression demandée (un
  brouillon titré « Atelier de niveau » le reste après le renommage de `workshop.json`).
- **Police** : `docs/maquettes/v1/fonts/Nunito.ttf` (variable, 200–1000) convertie en
  `public/fonts/Nunito.woff2` avec fontTools déjà installé (277 → 99 Kio, aucun
  sous-ensemble : mêmes glyphes) ; `public/fonts/OFL.txt` (copyright du fichier + texte OFL
  1.1) ; `@font-face` local `font-display: swap` dans `styles.css`, `--font-ui` commence par
  `'Nunito'` ; README § Licence. Aucune dépendance, aucune police distante.
- **En-tête** : `AppHeader`/`AppFrame` acceptent un titre et un contexte facultatifs ;
  `<p class="level-label">` garde `.level-title`, puis un séparateur « · » `aria-hidden` et
  `.level-mode` (ou `.level-attribution` d’un niveau reçu). Sans titre (accueil), rien au
  centre. Fond `--night-950`, filet `--night-800`, 60 px en grand format (68 avant), marque
  28 px sans rotation, 22 px. Sous-titres descriptifs retirés là où la maquette n’en a pas :
  Campagne (« Sélection du niveau »), Mes niveaux (« Ta collection »), Paramètres
  (« Réglages de l’application »), Accueil (« À toi d’inventer »). Boutons de l’en-tête
  harmonisés avec la maquette (nuit, trait de 1 px ; vert avec liseré bas ; menu en
  simple contour ; cibles de 44 px gardées). Sous 700 px, le contexte passe sous le titre,
  sans séparateur (comme l’ancienne pastille, sans son cadre) : sur une ligne, à 390 px,
  « Nouveau niveau · Atelier » ne laissait voir que « · A » à côté de trois boutons.
  L’en-tête ne déborde pas (captures `niveau-390`, `atelier-390`). Un premier essai qui
  masquait le contexte au téléphone cassait dix specs à 390 × 844 qui le lisent
  (`campaign-draft`, `export`, `levels`, `shared`…) ; abandonné au profit de l’empilement,
  aucune spec n’a eu à changer de format.
- **Accueil** (`HomePage.tsx`, réécrit) : textes exacts du journal V4 ; aperçu réel du
  tutoriel 5 (`tuto-5`, sinon le dernier niveau) par `LevelPreview`, dans un cadre
  `role="img"` « Aperçu du niveau « La chaîne » » ; `<nav>` « Explorer TinkerBolt » à trois
  liens (Campagne avec `<progress>` « Progression de la campagne » et « n / 5 »,
  Atelier, Mes niveaux ; vignettes `basket`, `lever`, `springboard`) ; pied de page.
  Invitation PWA en tête (inchangée), note de stockage sous les cartes. Supprimés :
  illustration composée, kicker, faits, carnet de bord, statistiques, flèches, ligne
  « Niveau N · titre ». L’accueil n’utilise plus `board-workshop-day-v1.png`.
- **Précache** : `scripts/precache-globs.ts` (motifs + `globIgnores: ['assets/backgrounds/**']`,
  `woff2` ajouté), branché dans `vite.config.ts`, testé sur le contenu réel de `public/`
  (`path.matchesGlob`). Manifeste généré vérifié (`dist/sw.js` : `fonts/Nunito.woff2`
  présent, aucun `assets/backgrounds/`) et par un E2E (`pwa.spec.ts` lit `/sw.js`). Build :
  **58 entrées, 10 226 Kio avant (HEAD V6) ; 55 entrées, 2 606 Kio après**. Fichiers des
  fonds laissés en place. ADR 0012 amendée.
- **Scrollbar** : fine, pouce sable `#d4c19c` (survol `#b99c69`), sans flèches, piste
  transparente ; variante `--night-line` pour le menu. Chromium ignore les pseudo-éléments
  `-webkit-` dès qu’un `scrollbar-width`/`scrollbar-color` est posé (et garde alors ses
  flèches, comme sur la capture de maquette) : les propriétés standard sont réservées par
  `@supports not selector(::-webkit-scrollbar)` aux autres navigateurs.
- **Éditeur** : `workshop.json` « Atelier de niveau » → « Nouveau niveau » ; l’en-tête affiche
  « Nouveau niveau · Atelier ». Les créations gardent le titre de leur document.
- **Textes** au tutoiement, neutres souris/toucher : « Envoie le fichier ou le lien »,
  « sélectionne le lien ci-dessous », « télécharge le fichier » (export et partage d’un
  niveau reçu), « sélectionne chaque objet que le joueur devra poser, puis choisis
  « À placer » », « garde-les dans une zone de construction ».
- **CSS morte retirée** : tout l’ancien accueil (`.home-kicker`, `.home-facts`,
  `.home-invention*`, `.home-sprite*`, `.home-explore`, `.home-destination*`,
  `.home-utilities`, `.home-progress*`, `.home-stats`, `.home-footer`, grilles 700/1100 px),
  la pastille d’en-tête (bordure, fond, colonne, capitales jaunes de `.level-mode`) et ses
  variantes paysage.
- Tests réécrits : `HomePage.test.tsx` (tous ; mêmes intentions : destinations, progression,
  stockage, retour par le menu, sur la nouvelle page), `App.test` (titre de l’accueil, U10),
  `AppHeader.test` (sous-titres retirés des exemples), `FreeWorkshopSaving.test` (titre
  « Nouveau niveau »), `save-free-creation.test` et `embedded-levels.test` (métadonnées de
  l’atelier embarqué), textes de `level-export.test` et `LevelExportDialog.test` ; E2E
  `home.spec.ts` (même parcours : formats, images chargées, absence de débordement, cible
  « Jouer », destinations — Mes niveaux et « ou créer un niveau » ajoutés —, progression
  après rechargement ; la police est vérifiée déclarée et servie). Aucun test supprimé ni
  ignoré.
- Specs de format téléphone : aucune modifiée ni passée en 1440 × 900.
- Bac à sable : le Chromium de l’agent refuse toute police CSS distante (`NOTREACHED` dans
  `remote_font_face_source.cc`, la maquette elle-même s’y affiche sans Nunito), alors que
  la même police chargée par l’API `FontFace` s’affiche. Le script de captures charge donc
  Nunito par `FontFace` ; l’E2E vérifie la déclaration et le service du fichier, pas son
  état de chargement. À vérifier à l’œil dans un vrai navigateur.
- Captures (build + `vite preview` port 4317, progression 2/5 injectée, Chromium sans
  `--hide-scrollbars`) :
  `/tmp/claude-1000/-home-aflesch-tinkerbolt/6a643584-d9aa-4357-aedc-da10439fec33/scratchpad/v7/`
  (`accueil-`, `campagne-`, `mes-niveaux-`, `atelier-`, `niveau-` en 1440 et 1280 ;
  `accueil-390`, `atelier-390`, `niveau-390`). Comparées à `docs/maquettes/v1/captures/` :
  accueil superposable (hero, aperçu, cartes, pied de page) ; en-tête conforme ; catalogue
  de l’Atelier à 1280 × 720 avec sa scrollbar sable visible.
- Écarts restants avec la maquette : le catalogue de l’Atelier garde son bandeau
  « CATALOGUE / Objets disponibles » et ses cartes (hors V7, la maquette ne couvre que
  bandeau et scrollbar) ; les boutons de l’en-tête du plateau gardent leur pastille d’icône
  jaune (`objective-button`) ; les cibles de l’en-tête restent à 44 px (40 dans la
  maquette) ; dans les cartes de l’accueil, le texte suit directement le titre (la
  maquette le décale un peu sous « Mes niveaux »).
- Gate `pnpm check` verte : 1200 tests Vitest (90 fichiers), 6 documents de contenu,
  88 tests Playwright `v1` (0 ignoré), précache 55 entrées (2 606 Kio).
  `tmp/check-levels.ts` écarté puis remis identique. Un premier passage avait échoué sur
  les dix specs qui lisent le contexte à 390 px (voir « En-tête ») ; corrigé côté CSS.
- Pour l’auteur : valider les captures de `v7/` ; au téléphone, le contexte de l’en-tête
  s’empile sous le titre (v2 décidera).

### T1 — Stabiliser goal-ball en isolation — fait — commit T1 (2 octobre 2026)

- Symptôme : `pnpm build` puis `playwright test e2e/goal-ball.spec.ts --project=v1`
  échouait à chaque exécution isolée sur le test « R1 — captures… » : « `<div class="panel-body">`
  from `<div class="status-slot">` subtree intercepts pointer events » au clic sur « Lancer ».
- Cause (reproduite, instrumentée) : ce n'était ni l'aide du niveau 1 ni un panneau ancré,
  mais la **feuille des propriétés** de la balle, au **deuxième format** (844 × 390,
  disposition compacte). `selectGoalBall` touche la balle verrouillée, puis
  teste `close.isVisible()` _une seule fois, sans attendre_ : la feuille (panneau et scrim)
  n'est rendue que quelques instants après le toucher. Le test regardait avant, ne trouvait
  pas le bouton « Fermer les propriétés », ne fermait rien, et la feuille recouvrait « Lancer ».
  À 390 × 844 le rendu était assez rapide, à 1440 × 900 la disposition large n'a pas de
  feuille (rail sans bouton de fermeture) ; dans la suite complète, la course était gagnée
  par hasard. Aucun bug de production : la feuille est un recouvrement voulu (D4) que
  le joueur ferme avant de lancer.
- Correctif (test seul) : `selectGoalBall` attend d'abord la région « Propriétés de Balle »
  visible, puis ferme la feuille si la disposition en a une. Mêmes assertions, mêmes seuils
  de pixels, mêmes formats.
- Preuves : 5 exécutions isolées vertes (2 réussis chacune) ; `pnpm check` verte
  (1200 tests Vitest, 88 tests Playwright `v1`, précache 55 entrées).

### V7b — Retirer la fiche de calibrage — fait (validation visuelle attendue) — commit V7b (3 octobre 2026)

- Reprise autorisée par l'auteur avec Codex : Sol 6.1 pour le rôle Opus,
  Terra pour le rôle Sonnet, ou Luna `xhigh` pour les tâches simples ; Astra
  interdit. Consignes d'`AGENTS.md` et introduction de cette feuille mises à
  jour avant implémentation. Retrait du code délégué à Luna `xhigh`, diff
  relu par la session principale.
- Test rouge : `CampaignDraftEditing.test.tsx`, premier test réécrit pour V7b,
  `expect(element).not.toBeInTheDocument()` : le dialogue « Fiche de
  calibrage » est encore présent à l'ouverture d'une création en mode dev.
  Le test conserve le brouillon distinct, la source et la progression
  intactes ; il vérifie aussi les objets et les fils de la solution révélée.
- Supprimés : `CalibrationGuide.tsx`, son import, son dialogue et son état
  dans `BoardShell`, la prop `calibrationDocument` propagée depuis
  `EditorPage`, le bouton et le callback `onOpenCalibration` du catalogue,
  l'import `ClipboardList` et les styles `.calibration-*` / `.drawer-calibration`.
  La prop `campaignLevel` et la lecture de `DevelopmentModeContext` de
  `StoredDraftEditor`, devenues inutiles, sont retirées. `LevelsPage`,
  `openCampaignDraft` et le chemin de révélation restent inchangés.
- Commentaires actualisés : `App`, `main`, `DevelopmentModeContext` et le
  test E2E `campaign-draft` (ses assertions d'absence sont conservées).
  ADR 0015 § Révéler amendée et mentions du comportement livré dans
  `etat.md` corrigées ; le contexte historique de l'ADR est conservé.
- La recherche `calibrat` prescrite par la tâche manquait « calibrage » :
  recherche élargie à `calibr`. La première gate exécutée hors sandbox a
  révélé l'attente obsolète de `EditAndRemix.test.tsx` (« avec la fiche »).
  Ce test est réécrit pour l'absence du dialogue et du bouton, avec son
  assertion de solution révélée conservée. Aucun test supprimé ni ignoré.
- Tests ciblés verts : `CampaignDraftEditing`, `ObjectDrawer` et
  `campaign-draft` (23 tests), puis `EditAndRemix` (10 tests).
- Captures : `tmp/v7b/captures/atelier-{dev,production}-{1440x900,1280x720}.png`,
  prises sous `pnpm dev` et sur le build servi par `vite preview`, toutes
  inspectées par la session principale : plateau et catalogue dégagés,
  solution du tutoriel 5 révélée avec ses deux objets et ses deux fils en
  dev, cachée en production ; aucun dialogue ni bouton de fiche. Le script
  vérifie aussi la source et le rechargement sans modification du brouillon.
  La référence comparée est l'import compilé du niveau : Vite arrondit trois
  coordonnées du JSON brut d'un ULP, également dans le build antérieur à V7b ;
  aucun contenu ni réglage physique modifié.
- Gate : typecheck, lint, Prettier, Knip, contenu (6 documents), Vitest
  (1200 tests, 90 fichiers) et build (précache : 55 entrées, 2600,20 Kio)
  passent. Le passage dans le sandbox s'est arrêté sur le
  socket local de `tsx` (`EPERM`), comme lors des reprises précédentes ;
  la gate est exécutée hors sandbox. Le fichier d'essai de l'auteur est
  écarté temporairement et restauré identique à chaque passage.
- Première exécution Playwright interrompue : le port 4173 sert une autre
  application (« Nouveau profil » dans les snapshots), que `reuseExistingServer`
  a réutilisée. Nouvelle gate sur le port isolé 4319 : adaptation temporaire
  de l'URL et du port de preview, configuration restaurée identique ensuite.
  Aucun serveur tiers arrêté, aucune spec ou assertion modifiée.
- Résultat Playwright sur TinkerBolt : **87 réussis, 1 échec** —
  `editor-interactions.spec.ts`, U6 « remet l’atelier à zéro »,
  `openWorkshop`, ligne 13 : `getByText('Atelier', { exact: true })`
  trouve encore le bouton du menu et le titre de la carte d'accueil
  (`strict mode violation`) pendant la navigation. Le snapshot final
  montre bien l'Atelier : arrivée asynchrone. Arrêt et demande à l'auteur
  avant correction du test préexistant.
- L'auteur autorise le correctif U6 et demande de ne relancer que ce test
  avant V8. `openWorkshop` attend désormais l'URL `/editor` et la région
  « Plateau de jeu » visible avant l'assertion du texte « Atelier », gardée
  identique. Aucun délai arbitraire, aucune assertion retirée.
  `pnpm build`, puis `playwright test e2e/editor-interactions.spec.ts
  --project=v1 --grep 'U6 — remet l’atelier à zéro'` : **1 test réussi**.
  La première sélection, ancrée avec `^`, ne lançait aucun test (Playwright
  filtre le nom complet avec le fichier) ; sélection corrigée, vérifiée
  avec `--list` : un seul test. Gate globale non relancée, sur instruction
  explicite de l'auteur.
- Fichier d'essai restauré identique (SHA-256 `1113625e…a92907`, mode 644),
  configuration Playwright restaurée identique (SHA-256 `9b03b7d8…754cb`).
- Pour l'auteur : valider les captures V7b. Rien n'est poussé ; suite : V8.

### V8 — Parcours beta-testeur — fait (validation visuelle attendue) — commit V8 (3 octobre 2026)

- Scénario délégué à un nouveau sous-agent Sol 6.1, puis relu par la session
  principale. `e2e/beta-journey.spec.ts` part d'un navigateur vierge : accueil,
  résolution réelle du tutoriel 1, modification depuis la campagne, création
  d'un puzzle, export vérifié par fichier et lien, réception sur un autre
  appareil, résolution réelle et remix de la construction gagnante.
- Aucun brouillon ni progrès injecté. Les coordonnées de pose viennent du
  tutoriel embarqué, lu par le codec ; les actions passent par l'interface.
  Le fichier téléchargé est validé par `decodeLevelFile`, le lien par
  `decodeShareFragment` ; leurs documents sont identiques. Un troisième
  contexte vierge reçoit le lien en joueur avec la solution cachée.
  Une seconde réception garde la victoire et ne crée pas de doublon.
- Hésitations observées : dans l'atelier, le catalogue propose la poutre
  moyenne ; sa longueur se règle dans les propriétés. Le refus d'essayer ou
  d'exporter une création sans objets « À placer » indique explicitement
  comment la rendre jouable. Le scénario suit ces indications et vérifie
  l'export. Aucun correctif de production ni restylage nécessaire ; l'icône
  « Jouer » grisée reste conforme à la décision de l'auteur.
- Nouveau parcours de recette d'un comportement existant : aucun rouge
  artificiel ni changement de production. Au premier déroulement, le test
  cherchait un rôle `alert` pour l'explication d'« Essayer en joueur », rendue
  dans un paragraphe, et un bouton « Importer un fichier », nommé « Importer ».
  Locators corrigés d'après le DOM ; contenu attendu et parcours conservés.
- `pnpm build` puis scénario isolé : 1 test réussi. Typecheck, ESLint ciblé
  et Prettier passent. Gate globale `pnpm check` : typecheck, lint, formatage,
  Knip, contenu (6 documents), 1200 tests Vitest (90 fichiers), build
  (55 entrées de précache, 2600,20 Kio) et **89 tests Playwright v1 réussis**,
  aucun ignoré. U6 passe aussi dans cette gate.
- Gate sur le port isolé 4319 : configuration temporaire restaurée identique
  (SHA-256 `9b03b7d8…754cb`). Fichier d'essai de l'auteur écarté puis restauré
  identique (SHA-256 `1113625e…a92907`, mode 644).
- Seize captures durables dans `tmp/v8/captures/`, aux deux formats desktop :
  accueil, atelier sans solution, refus expliqué, atelier puzzle, export
  vérifié, réception fichier, remix gagnant, réception du lien en joueur.
  Inspectées par le sous-agent ; captures des refus, export, réception et
  remix relues par la session principale. Pas de débordement des dialogues ;
  défilement normal de l'accueil et de Mes niveaux en 1280 × 720.
- Pour l'auteur : captures et textes à valider dans V9. Rien n'est poussé.

### V9 — Recette v1 — fait (core validé par l'auteur) — commit V9 (3 octobre 2026)

- Dossier de recette préparé par la session principale :
  `tmp/v9/recette.html` (galerie avec choix du format), `tmp/v9/textes.md`
  (textes visibles, libellés accessibles, valeurs et choix des champs) et
  `tmp/v9/inventaire.md`. 68 états aux deux formats desktop, soit 136 captures.
- Pages principales, cinq tutoriels avant construction et après victoire,
  atelier, propriétés des onze familles, essai en joueur, import, réception,
  export, partage, remix, duplication, confirmations et principaux écrans
  d'erreur. Installation : événement navigateur simulé ; mise à jour : vrai
  service worker. Deux captures dev de V7b reprises dans le dossier.
- Parcours exécutés dans des navigateurs de recette isolés, via l'interface ;
  niveaux lus et export téléchargé validés par les codecs. Les cinq tutoriels
  et le niveau reçu sont réellement résolus. Captures de l'accueil et de
  Mes niveaux reprises en attendant leurs aperçus générés ; le script attend
  aussi la peinture des sprites. Aucun changement du logiciel pour ces captures.
- Relecture visuelle de préparation par la session principale : aucune sortie
  horizontale ni dialogue hors viewport. Points laissés à l'auteur : titres
  longs de confirmation et descriptions du catalogue abrégés par des points
  de suspension. Aucune retouche choisie sans son accord.
- README actualisé : fonctionnement du core de la v1 desktop validé, création
  de puzzle par « À placer », gate desktop et lancement mobile hors gate.
  Aucun comportement modifié, aucun test artificiel ajouté.
- Gate de clôture `pnpm check` verte : typecheck, lint, formatage, Knip,
  contenu (6 documents), 1200 tests Vitest (90 fichiers), build
  (55 entrées de précache, 2600,20 Kio), 89 E2E v1 réussis, aucun ignoré.
  Le code de production reste celui de V8. Port isolé 4319 ; configuration
  Playwright restaurée identique (SHA-256 `9b03b7d8…754cb`), fichier d'essai
  de l'auteur restauré identique (SHA-256 `1113625e…a92907`, mode 644).
  Clôture documentaire de V9 enregistrée localement ; aucun push.
- L'auteur avait repris les contrôles visuels ; il clôture ensuite explicitement
  V9 : « ce qui m'importe pour l'instant c'est que le core de l'app fonctionne ».
  Il prévoit de refaire les retouches avec l'agent dans une nouvelle fenêtre,
  où les détails visuels seront réévalués. Cette décision remplace l'attente
  de validation générale indiquée à la préparation de V9. Aucun travail
  visuel supplémentaire entrepris dans cette session.
