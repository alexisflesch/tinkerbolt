# Plan d’implémentation après la recette v1 — 3 octobre 2026

Statut : **préparation raccordée à la reprise active le 3 octobre 2026**.
Les décisions confirmées ci-dessous sont retenues ; les arbitrages et maquettes
restent à valider dans leurs tâches.
Source : [todo du 3 octobre](todo.03.10.26.md), conservé tel quel.

La v1 actuelle est **clôturée (V9)**. C0 a reporté les tâches retenues dans
[la feuille de route](feuille-de-route.md), **seule séquence active** C/M/F.
Ce plan conserve le raisonnement préparatoire et ne fait pas autorité sur
l’ordre d’exécution ni sur les contrats : consulter la feuille et les ADR.
Le raccord C0 est relu et sa gate globale est verte ; son journal est dans
la feuille de route.
Les identifiants C, M et F désignent les tâches de ce plan ; les versions
ci-dessous désignent les étapes produit, pas `LevelDocument.schemaVersion`.

## 1. Périmètre et décisions

| Étape          | Périmètre                                                                                                                    |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Compléments v1 | Fiabilité du placement, reprise locale, taille des poutres, victoire, identité visuelle, objets encore absents du catalogue. |
| v2             | UI/UX téléphone, portrait et paysage, avec davantage de place pour le plateau.                                               |
| v3             | Déplacement du dépôt et de l’hébergement sur la Forge ; propositions de créations via le Grist de la Forge.                  |
| v4             | Nouveaux objectifs : balle visible pendant 15 s, deux balles dans deux paniers, déplacement d’une caisse, etc.               |

Le classement des compléments desktop en v1 est proposé à partir du todo.
Ils ne rouvrent pas les tâches de la recette actuelle. Ajouter une caisse au
catalogue et créer un objectif « déplacer la caisse » sont deux travaux distincts.

**Décisions confirmées avec l’auteur le 3 octobre 2026 :**

- **Poutres :** conserver les trois tailles actuelles, choisies par une icône
  sur le plateau. Pas de longueur libre par glissement.
- **Téléphone :** garder les propriétés dans un tiroir fermé par défaut.
  Poser ou déplacer un objet ne l’ouvre pas ; un toucher simple l’ouvre.
- **Ordinateur :** propriétés également fermées par défaut et ouvertes à la
  demande. Garder les réglages accessibles, sans panneau permanent.
- **Stockage :** passer à **IndexedDB avec Dexie dès cette étape**.
- **Anciennes données locales :** l’application n’étant pas en production,
  leur perte est acceptée. **Aucune migration depuis `localStorage`**, aucun
  transfert de progression, créations, niveaux reçus ou préférences à prévoir.
  Cette instruction explicite de l’auteur prime sur l’exigence générale de
  migration pour ce remplacement. Elle ne supprime pas les codecs existants
  d’import de fichiers de niveaux.
- **Reprise :** retrouver automatiquement la construction d’avant simulation,
  avec « Recommencer » pour repartir de zéro. Ne pas restaurer la simulation
  en cours ni l’historique annuler/rétablir.
- **Splash :** une seule fois au démarrage de l’application, y compris par
  lien direct ; pas à chaque navigation. Minimum de 1,2 seconde conservé.
- **Grist :** formulaire, consentement et envoi **dans TinkerBolt**.
  Le joueur n’est pas renvoyé vers un formulaire Grist externe.
- **Bolt :** retenir l’accueil et la victoire, avec une expression adaptée.
  Emplacement et taille à valider sur maquette.

**Demandes explicites du todo :**

- Le délai actuel de la modale de victoire convient ; les boutons de résultat
  doivent apparaître au même moment.
- Le splash comporte une barre de chargement et dure au moins **1,2 seconde**.
  « Créé par Alexis Flesch » apparaît en petit sous la barre, en bas de l’écran.
- Les propositions de niveaux passent par Grist en v3, avec explication de la
  licence, case à cocher et information sur le filtrage du contenu.

## 2. État vérifié avant planification

Ces constats décrivent le code lu le 3 octobre ; les revérifier à la reprise.

- Le stockage utilise **`localStorage`**, derrière des repositories, avec
  enveloppes versionnées, validation Zod, codecs et migrations. C’est le choix
  de [l’ADR 0011](decisions/0011-local-storage-and-url-sharing.md), confirmé par
  [l’ADR 0015](decisions/0015-mes-niveaux.md).
- Les créations d’Atelier sont déjà enregistrées à chaque document engagé.
  Un atelier neuf reçoit son identifiant au premier changement sauvegardé.
  Il faut tester la conservation existante et corriger ses éventuelles lacunes,
  plutôt que créer une deuxième autosauvegarde de brouillons.
- Les constructions de joueur en cours ne sont pas persistées. Les victoires,
  la progression et les solutions gagnantes des niveaux reçus ont déjà leurs
  mécanismes ; ils ne représentent pas un essai inachevé.
- `decideDraftAutosave` prévoit une limitation à une écriture par seconde mais
  n’est pas branchée. La brancher sans sauvegarde finale pourrait perdre la
  dernière modification ; cette dette est décrite dans `etat.md`.
- Les méthodes actuelles de `DraftRepository` sont **synchrones**. Passer à
  IndexedDB demandera d’adapter les ports et leurs appels à l’asynchronisme ;
  ce ne sera pas seulement le remplacement d’un adaptateur. Le domaine peut
  néanmoins rester indépendant du choix de stockage.
- Le délai de victoire est actuellement **600 ms**, ou immédiat avec
  `prefers-reduced-motion`, dans `src/app/use-victory-dialog.ts`.
- Des icônes PWA provisoires sont déjà déclarées dans `vite.config.ts`.
  Les sources définitives sont dans `art/icons-splash_screen/` ; Bolt dispose
  déjà de plusieurs expressions dans `art/assets/bolt/`.
- Le registre contient onze familles. Des illustrations supplémentaires
  existent pour les caisses, l’électroaimant, le piston et le minuteur ; leur
  présence dans `art/` ne définit pas encore leurs contrats de jeu.

## 3. Arbitrages ouverts et avis proposés

Les avis non encore arbitrés restent des recommandations. Les décisions
confirmées le 4 octobre pour C9 sont enregistrées dans les ADR 0018/0019 et
l’amendement de l’ADR 0009. Q6 est résolu ; les constantes physiques restantes
sont des réglages d’implémentation couverts par les scènes de test.

| ID  | Question                                                          | Avis proposé                                                                                                                                                | Bloque       |
| --- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| Q8  | Quel point d’entrée permettra l’envoi à Grist depuis TinkerBolt ? | Vérifier un mécanisme public de soumission officiellement supporté sur l’instance ; à défaut, prévoir un relais limité à l’envoi, avec secret côté serveur. | F1, puis F2. |

### Avis sur Dexie et IndexedDB

Dexie est une bibliothèque pour **IndexedDB**, pas une base dans `localStorage`.
IndexedDB apporte une API asynchrone et des transactions pour les données liées ;
`localStorage` est synchrone et peut gêner le rendu lors de grosses écritures.
Voir [la documentation Dexie](https://dexie.org/docs/Dexie.js) et
[MDN Web Storage](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API).

L’auteur a retenu **Dexie dès maintenant**, après discussion. C2 documente
les contrats et C2a remplace le stockage avant C3. Les ports et leurs appels
deviennent asynchrones. La nouvelle base démarre sans reprendre les anciennes
valeurs `localStorage` : aucun import automatique, double stockage, mécanisme
de transfert ou test de migration à ajouter. Le quota, l’ouverture de la base
et les données invalides restent des erreurs à traiter ; la perte acceptée de
l’ancien stockage ne justifie pas de perdre silencieusement de nouvelles données.

### Avis sur Grist

L’auteur a retenu un parcours **entièrement dans TinkerBolt**. Le formulaire
externe prérempli proposé pendant la discussion n’est donc pas la solution à
implémenter. Grist dispose de formulaires publics, mais cela ne garantit pas
une API publique permettant de soumettre depuis une interface personnalisée.
Voir [les formulaires Grist](https://support.getgrist.com/widget-form/).

F1 doit vérifier le mécanisme d’envoi disponible sur l’instance de la Forge.
Si l’API authentifiée est nécessaire, prévoir un relais qui garde la clé côté
serveur et n’expose que la création d’une proposition, sans accès public à la
table ni aux notes internes. **Ne pas embarquer la clé du mainteneur dans
l’application publique.** Voir
[l’authentification Grist](https://support.getgrist.com/rest-api/).
L’hébergement de ce relais est une décision à prendre en v3 ; on ne suppose
pas qu’un hébergement statique sait l’exécuter.

## 4. Séquence préparatoire — reportée dans la feuille de route

Ordre de préparation (historique) : **compléments desktop → téléphone → Forge et Grist**.
Une tâche dont le périmètre est ouvert ne commence pas par du code spéculatif.
Les tâches indépendantes déjà définies restent réalisables pendant un arbitrage.
C0 est le préalable commun à toutes les tâches de ces compléments ; la table
précise leurs dépendances supplémentaires.

| Ordre | ID    | Livrable                                                                | Prérequis                                                       |
| ----- | ----- | ----------------------------------------------------------------------- | --------------------------------------------------------------- |
| 1     | C0    | Raccord avec les sources de vérité et démarrage de la nouvelle séquence | V1 actuelle validée.                                            |
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

### C0 — Raccorder ce plan à la reprise (raccord documentaire préparé)

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

| Sources repérées                                      | Famille candidate                  | Contrat confirmé et détails restants                                                                                       |
| ----------------------------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `art/assets/boxes/wooden-box.png`, `metallic-box.png` | Famille `box`, matériau bois/métal | Géométrie commune 0,8 × 0,8 unité monde, masses 1/3 kg ; seule la métallique est attirée par l’électroaimant.             |
| `art/assets/electro-magnet/`                          | Électroaimant                      | Caisse métallique seule, bouton uniquement, état initial `on/off` (actif par défaut au catalogue), portée légèrement sous le ventilateur. |
| `art/assets/piston/`                                  | Piston                             | Position initiale fermée ; gabarit 1,248 × 0,643 unité, proche du ventilateur ; course de 0,414 unité à 18 unités/s, avec une balle lancée à plus de 20 unités/s et passant une scène verticale de 10 unités. Un appui bref termine la sortie ; maintien garde le piston sorti. |
| `art/assets/timer/`                                   | Minuteur                           | Inséré dans un fil unique, retarde chaque changement d’état ; 1–10 s réglables en Atelier, fixés par niveau en résolution. |

- Comportements et ordre confirmés par l’auteur, consignés dans l’[ADR 0019](decisions/0019-c9-object-contracts.md) ; version v3 et migrations dans l’[ADR 0018](decisions/0018-level-document-v3.md). Les valeurs physiques restent à équilibrer par famille.
- Une image seule ne suffit pas à inventer un comportement physique.
- **Sortie :** liste exhaustive rapprochée du code, contrats acceptés et tâches
  C9 dimensionnées. Tout objet différé est nommé avec la décision de report.

### C9a à C9d — Intégrer une famille complète à la fois

Ordre accepté par l’auteur : **C9a caisses → C9b électroaimant → C9c piston →
C9d minuteur**. Les contrats sont dans l’ADR 0019 ; le minuteur
en série complète l’ADR 0009.

Pour chacune :

- Écrire les tests de comportement attendus, les faire échouer, puis ajouter
  schéma, définition, géométrie, simulation, rendu, exports de sprites,
  miniature et outils d’édition.
- Fournir inventaire, propriétés permises, sérialisation, import/export,
  solution de référence et intégration aux fils lorsque le contrat le demande.
- Ajouter les familles dans le schéma v3, avec migrations strictes v1 → v2 → v3.
  Couvrir aussi les créations, niveaux reçus et constructions C3 v2, sans perdre
  les tentatives compatibles ni masquer une source modifiée. Voir ADR 0018.
  Aucune reprise de l’ancien stockage local.
- Vérifier une scène de test jouable sans ajouter les nouveaux objectifs de v4
  ni étendre la campagne sans tâche dédiée.
- **Sortie :** famille effectivement utilisable dans l’Atelier et un puzzle,
  contrat physique testé, gate verte et captures validées.

### C10 — Recette des compléments desktop

- Rejouer fil direct et liaison contrôleur → minuteur → dispositif (une unité
  de fil, deux segments, transitions retardées), reprise locale, modification
  de poutre, victoire et nouveaux objets dans un niveau partagé.
- Vérifier accueil, splash, icônes et résultat aux deux formats desktop.
- **Sortie :** `pnpm check` vert, validation visuelle de l’auteur, `etat.md`
  et journal à jour. Les éventuels reports sont explicites.

## 5. v2 — Téléphone

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

## 6. v3 — Forge et Grist

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

## 7. v4 — Réserve, sans implémentation anticipée

Les nouveaux objectifs restent en v4. À cette étape, prévoir une décision
séparée sur leur modèle, leur combinaison, leur évaluation au pas fixe, leurs
outils auteur et la compatibilité des niveaux existants. Exemples conservés du
todo : balle à l’écran pendant 15 s, deux balles dans deux paniers, caisse à
déplacer. Aucun de ces exemples n’est déjà un contrat technique.

## 8. Méthode et priorité de reprise — mise à jour du 4 octobre 2026

Les [règles de la reprise active](feuille-de-route.md#règles-de-la-reprise-active)
font autorité sur la méthode. Elles ont été allégées à la demande de l’auteur :
un agent à la fois réalise tests et code, les lectures et comptes rendus sont
ciblés, et la gate globale précède la clôture de chaque lot. Red-Green-Refactor
et les invariants restent applicables. Aucune capture ni vérification d’image
pendant l’implémentation actuelle ; la recette visuelle est différée.

Le 4 octobre, l’auteur a demandé de terminer C3 avant de changer l’ordre de la
suite ; **C3 est maintenant livré**. C8, C9a, C9b et C9c sont clôturés après
l’audit, les arbitrages et l’intégration des caisses, de l’électroaimant et du
piston. L’ordre prioritaire courant est **C9d → C7 → C6 → C4/C4a → C10**, comme
consigné dans la [feuille de route active](feuille-de-route.md). L’auteur a
confirmé l’ordre des familles, `box` avec variante matériau, le délai initial
du minuteur et ses règles ; voir les ADR 0018, 0019 et l’amendement de 0009.
Les constantes physiques des familles restantes sont équilibrées dans leurs tâches.
La feuille de route reste seule propriétaire de la séquence, des dépendances et
du journal.

Les critères visuels des sections préparatoires décrivent la recette finale,
avec le report ci-dessus. Le journal et les étapes réellement livrées restent
dans `feuille-de-route.md` et `etat.md` ; ce plan ne tient pas un second journal
d’implémentation.

## 9. Journal de préparation

### 3 octobre 2026 — Séquençage initial

- Todo réparti en compléments desktop, v2 téléphone, v3 Forge/Grist et réserve v4.
- Code de stockage, autosauvegarde, victoire, registre et sources d’assets
  consultés pour distinguer travaux nouveaux et vérification de l’existant.
- Trois tailles via une icône, tiroir téléphone fermé par défaut, Dexie dès
  cette étape et reprise automatique de la construction confirmés par l’auteur.
- L’auteur précise que l’application n’est pas en production et autorise la
  perte des données `localStorage` : toute migration locale retirée du plan.
  Les autres recommandations restent à discuter.
- Splash confirmé au démarrage uniquement ; parcours de proposition Grist
  entièrement dans TinkerBolt confirmé. Le mécanisme d’envoi reste à définir
  après vérification de l’instance de la Forge.
- Propriétés desktop fermées par défaut et Bolt sur l’accueil et à la victoire
  confirmés ; tâche C4a ajoutée pour le panneau desktop.
- Aucun code de l’application modifié. Todo source et documents de la reprise
  en cours laissés aux travaux documentaires parallèles.
