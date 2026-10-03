# Carte de lecture du dépôt

Ce fichier est le point d'entrée des agents. Il ne contient aucune règle : il dit
**quel document fait autorité sur quoi**, et **quoi lire pour quel type de tâche**.

Un agent ne lit jamais `docs/` en entier. Il commence ici, puis lit
`feuille-de-route.md` pour une reprise d’implémentation, et `AGENTS.md` ; il suit
ensuite exactement la ligne de routage qui correspond à sa tâche.

L'état réellement livré et les dettes sont dans `etat.md`. Le découpage en
tranches est dans `backlog.md`. **Le travail restant, tâche par tâche et dans
l'ordre, est dans `feuille-de-route.md`** : c’est la **seule séquence active**
après la clôture V0–V9, compléments desktop C0–C10, téléphone M0–M4,
Forge/Grist F0–F3. Son journal v1 est conservé comme historique. Le
`plan-implementation.03.10.26.md` conserve la préparation de cette séquence,
sans faire autorité sur son ordre ou ses contrats ; `todo.03.10.26.md` est la
demande de l’auteur, conservée intacte. Ce sont des sources de contexte ciblées,
pas d’autres feuilles de route actives.
`audit-assets-c8.md` est le relevé préparatoire des assets et raccords pour C8 :
il n’accepte aucun contrat de famille ni ordre C9 et ne constitue pas une ADR.
`feuille-de-route-mes-niveaux.md` (journal G1 à N2) et `feuille-de-route-luna.md`
(journal L1 à U29) sont les historiques des reprises précédentes ; on n'y lit que
l'entrée citée. `plan-remise-en-jeu.md` est l'historique de la remise en jeu
(phases A à F) ; on n'y lit que la section qu'une tâche cite. `docs/archives/`
contient des propositions d'idées, pas des décisions : on ne les lit pas pour
implémenter.

## Autorité

Une information a un seul propriétaire. En cas de divergence, le propriétaire
gagne et l'autre document doit être corrigé, pas arbitré au cas par cas.

| Document                                                       | ~lignes | Fait autorité sur                                                                                                      |
| -------------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------- |
| `AGENTS.md`                                                    | 103     | règles applicables à tout changement, invariants non négociables                                                       |
| `docs/backlog.md`                                              | 138     | découpage des tranches, dépendances, tranche courante                                                                  |
| `docs/cahier-des-charges.md`                                   | 436     | vision produit, périmètre, hors-périmètre                                                                              |
| `docs/etat.md`                                                 | 849     | ce qui est livré, les dettes, la dernière gate                                                                         |
| `docs/feuille-de-route.md`                                     | —       | seule séquence active C/M/F, ordre et journal ; historique v1 clôturé                                                  |
| `docs/plan-implementation.03.10.26.md`                         | —       | préparation du 3 octobre, décisions confirmées et avis ; tâches reprises dans la feuille de route                      |
| `docs/todo.03.10.26.md`                                        | —       | demande de l’auteur du 3 octobre, conservée intacte                                                                    |
| `docs/feuille-de-route-mes-niveaux.md`                         | 3034    | historique de la phase « Mes niveaux » (journal G1 à N2)                                                               |
| `docs/feuille-de-route-luna.md`                                | 2633    | historique de la reprise précédente (journal L1 à U29)                                                                 |
| `docs/plan-remise-en-jeu.md`                                   | 1208    | historique A–F ; spécifications détaillées de C1, C2, D3                                                               |
| `docs/architecture.md`                                         | 223     | couches, dépendances, états distincts, modèle d'objet                                                                  |
| `docs/qualite.md`                                              | 149     | stratégie de test, niveaux de test, gates                                                                              |
| `docs/catalogue-initial.md`                                    | 239     | contrats des onze familles d'objets                                                                                    |
| `docs/tinkerbolt_control_wires_v1.md`                          | 125     | spécification fonctionnelle des fils de commande                                                                       |
| `docs/mobile-editor-interactions.md`                           | 595     | gestes, états d'interface, scénarios tactiles (v2 : hors v1)                                                           |
| `docs/levels/nouveaux-niveaux.md`                              | —       | campagne esquissée : 18 propositions, niveau 15 différé                                                                |
| `docs/levels/conception-niveaux.md`                            | 156     | concevoir un niveau : règles du jeu, objets, physique, méthode                                                         |
| `docs/decisions/0001-product-foundations.md`                   | 33      | fondations produit (accepté)                                                                                           |
| `docs/decisions/0002-physics-engine-selection.md`              | 126     | choix du moteur physique, Planck.js (accepté)                                                                          |
| `docs/decisions/0003-project-bootstrap.md`                     | 309     | outillage, scripts, gates, politique de dépendances (accepté)                                                          |
| `docs/decisions/0004-level-document-v1.md`                     | 103     | contrat `LevelDocument` v1 (accepté ; v2 : ADR 0007, code)                                                             |
| `docs/decisions/0005-construction-attempt.md`                  | 51      | provenance éphémère d'une tentative (accepté)                                                                          |
| `docs/decisions/0006-board-renderer.md`                        | 101     | renderer du plateau et pipeline de sprites (accepté)                                                                   |
| `docs/decisions/0007-world-scale-and-camera.md`                | 269     | repère du monde, scène, caméra, échelle des sprites (accepté)                                                          |
| `docs/decisions/0008-client-side-routing.md`                   | 99      | routage côté client, schéma d'URL (accepté)                                                                            |
| `docs/decisions/0009-control-wires.md`                         | 90      | fils de commande : modèle, rendu, câblage (accepté, amendé)                                                            |
| `docs/decisions/0010-object-challenge-and-progression.md`      | 92      | défi d'objets ✅/⭐/🏆, ouverture des niveaux (accepté)                                                                |
| `docs/decisions/0011-local-storage-and-url-sharing.md`         | —       | IndexedDB/Dexie asynchrone, sans reprise `localStorage` ; codecs et partage URL (accepté, amendé C0)                   |
| `docs/decisions/0012-pwa-service-worker.md`                    | 47      | PWA, service worker, mises à jour (accepté)                                                                            |
| `docs/decisions/0013-puzzle-workshop-solution.md`              | 95      | objets à placer, solution de référence, export vérifié (accepté)                                                       |
| `docs/decisions/0014-icon-library.md`                          | —       | bibliothèque d’icônes de l’interface (accepté)                                                                         |
| `docs/decisions/0015-mes-niveaux.md`                           | —       | « Mes niveaux », niveaux reçus, créations, solution cachée ; reprise automatique avant simulation (accepté, amendé C0) |
| `docs/decisions/0016-attribution-licence-niveaux.md`           | 95      | auteur, sources, licence CC BY 4.0 des niveaux (accepté)                                                               |
| `docs/decisions/0017-player-construction-and-async-storage.md` | —       | contrat détaillé de stockage/reprise C2 (**accepté** ; stockage C2a livré, reprise C3 à venir)                               |
| `LICENSE`                                                      | 661     | conditions de licence du code du logiciel (GNU AGPL-3.0-or-later)                                                      |

Sources de vérité exécutables, prioritaires sur toute prose :

| Sujet                  | Fichier                                                |
| ---------------------- | ------------------------------------------------------ |
| Schéma de niveau       | `src/domain/level-document.ts`                         |
| Registre des familles  | `src/domain/object-family-registry.ts`                 |
| Commandes de tentative | `src/application/construction/construction-attempt.ts` |
| Historique undo/redo   | `src/application/history/history.ts`                   |
| Frontières de couches  | `src/architecture/layer-boundaries.test.ts`            |
| Scripts et gates       | `package.json`                                         |
| Niveaux embarqués      | `src/content/levels/*.json`                            |
| Géométrie des familles | `src/domain/family-geometry.ts`                        |
| Export des sprites     | `art/build-sprites.py`                                 |

## Routage par tâche

Colonne « lire » = lecture obligatoire et suffisante. Ne pas élargir sans raison
écrite dans le rapport.

| Tâche                                          | Lire                                                                                                                                                                                   | Écrire dans                                                    |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Raccord de reprise C0                          | Point de reprise de `feuille-de-route.md`, `etat.md` § Arrêt et reprise / Stockage / Dettes, `backlog.md`, plan du 3 octobre, ADR 0011/0015, `architecture.md` § Stockage et partage   | feuille de route, index, backlog, ADR concernées, architecture |
| Format de niveau, schéma Zod, migration        | ADR 0004, ADR 0007 § Scène d'un niveau, ADR 0013, ADR 0016, `architecture.md` § Enveloppe de niveau, `level-document.ts`                                                               | `src/domain/`                                                  |
| Commande, historique, undo/redo, tentative     | ADR 0005, `architecture.md` § Commandes et historique                                                                                                                                  | `src/application/`                                             |
| Nouvelle famille d'objet                       | `catalogue-initial.md`, `architecture.md` § Modèle d'objet, ADR 0004                                                                                                                   | `src/domain/`, `src/simulation/`                               |
| Audit des assets C8                            | `feuille-de-route.md` § C8/C9, `audit-assets-c8.md` (préparatoire), `catalogue-initial.md`, `architecture.md` § Modèle d’objet, ADR 0004 ; ADR 0007 § Scène pour le conflit de version | `docs/audit-assets-c8.md`                                      |
| Port physique, boucle à pas fixe, déterminisme | ADR 0002, `qualite.md` § Déterminisme, `architecture.md` § Simulation                                                                                                                  | `src/simulation/`, `test/conformance/`                         |
| Conformité physique, arbitrage moteur          | ADR 0002, `catalogue-initial.md` § Tests contractuels                                                                                                                                  | `test/conformance/`                                            |
| Rendu du plateau, cadrage, projection          | ADR 0007, ADR 0006, `architecture.md` § Rendu et interface                                                                                                                             | `src/presentation/`                                            |
| Assets, sprites, export depuis `art/`          | ADR 0007 § Amendement du 25 septembre 2026, `art/build-sprites.py`                                                                                                                     | `art/`, `public/assets/`                                       |
| Fils de commande, levier, convoyeur            | ADR 0009, `tinkerbolt_control_wires_v1.md`, `catalogue-initial.md` § Levier, § Convoyeur                                                                                               | `src/domain/`, `src/presentation/`                             |
| Interface tactile, tiroir, gestes (v2)         | `mobile-editor-interactions.md`, `cahier-des-charges.md` § Interaction mobile                                                                                                          | `src/ui/`, `src/app/`                                          |
| Routage, navigation, schéma d'URL              | ADR 0008                                                                                                                                                                               | `src/app/`                                                     |
| Conception d'un nouveau niveau                 | `levels/conception-niveaux.md` (se suffit à lui-même)                                                                                                                                  | `src/content/levels/`                                          |
| Contenu d'un niveau                            | Tâche explicite dans `feuille-de-route.md`, `levels/nouveaux-niveaux.md`, ADR 0007 § Scène d'un niveau (aucune extension de campagne prévue en C/M/F)                                  | `src/content/levels/`                                          |
| Parcours end-to-end (v1 : desktop)             | `qualite.md` § Tests end-to-end ; `mobile-editor-interactions.md` § Scénarios d'acceptation (parcours, v2 pour les gestes)                                                             | `e2e/`                                                         |
| Contrat de reprise et stockage asynchrone C2   | ADR 0011/0015 amendées C0, ADR 0005, ADR 0017 (acceptée), `architecture.md` § Stockage et partage                                                                                      | ADR 0017 et renvois ciblés                                     |
| Stockage, import/export, codec URL             | ADR 0011, ADR 0015, ADR 0017 (acceptée ; stockage C2a livré, reprise C3 à venir), `architecture.md` § Stockage et partage                                                                            | `src/infrastructure/`, `src/application/`                      |
| Défi d'objets, progression de campagne         | ADR 0010, ADR 0011 § Amendement du 3 octobre 2026 (stockage cible ; `etat.md` pour l’implémentation livrée)                                                                            | `src/application/progression/`, `src/content/`                 |
| PWA, service worker                            | ADR 0012, ADR 0003                                                                                                                                                                     | racine, `src/app/`                                             |
| Outillage, script, configuration, CI           | ADR 0003, `package.json`                                                                                                                                                               | racine                                                         |
| Licence du logiciel                            | `LICENSE`, `README.md`, `package.json`                                                                                                                                                 | racine                                                         |
| Décision structurante, nouvelle ADR            | `cahier-des-charges.md` § Décisions ouvertes, ADR concernée                                                                                                                            | `docs/decisions/`                                              |

## Règles de lecture

- `cahier-des-charges.md` n'est jamais la source d'un contrat technique : il
  renvoie vers l'ADR ou le code qui fait autorité. Le lire pour comprendre
  l'intention, pas pour implémenter.
- Une ADR au statut `proposé` décrit une méthode, pas une décision. Ne pas
  l'appliquer comme un fait acquis.
- Un exemple narratif qui contredit un schéma exécutable est un bug de
  documentation : le signaler, ne pas coder d'après lui.
