# Carte de lecture du dépôt

Lire ce fichier avant tout autre document. Pour une implémentation, lire ensuite
le point de reprise, les règles et la tâche utile dans `feuille-de-route.md`,
puis `AGENTS.md`. Suivre le routage ci-dessous ; ne pas lire tout `docs/`.

## Autorité

Le code, les schémas et les tests exécutables priment sur la prose. Une
information a un seul propriétaire : corriger les autres documents en cas de
divergence, sans compromis silencieux. Une ADR proposée n’est pas une décision.

| Source | Autorité |
| --- | --- |
| `AGENTS.md` | Règles de développement et invariants du dépôt. |
| `docs/cahier-des-charges.md` | Vision, périmètre et intentions produit. |
| `docs/architecture.md` | Couches, dépendances, état applicatif et frontières. |
| `docs/backlog.md` | Étapes et dépendances entre tranches. |
| `docs/feuille-de-route.md` | Seul ordre actif, contrats des tâches à venir et journal courant. |
| `docs/etat.md` | État réellement livré, limites et dernière gate. |
| `docs/qualite.md` | Stratégie de tests, déterminisme et gates. |
| `docs/catalogue-initial.md` | Contrats des familles d’objets. |
| `docs/tinkerbolt_control_wires_v1.md` | Spécification fonctionnelle des fils. |
| `docs/mobile-editor-interactions.md` | Interactions tactiles ; à amender en M0 avant la nouvelle UI v2. |
| `docs/levels/conception-niveaux.md` | Guide de création d’un niveau ; les valeurs viennent du code. |
| `CHANGELOG.md` | Notes des versions et changements non publiés. |
| `docs/release-process.md` | Procédure opérationnelle des releases ; politique : ADR 0003. |
| `LICENSE` et licences de `public/fonts/` | Conditions applicables au code et aux polices. |

Les idées de `docs/levels/` (`idees-niveaux.md`, `idee-prototype-aiguillage.md`,
`nouveaux-niveaux.md`, `propositions-evolution-astra.md`) sont des propositions
non validées, pas une campagne livrée ni des contrats. La maquette
`docs/maquettes/identite/` reste une référence visuelle pour C7d ; les captures
et maquettes des lots clos ont été supprimées. Les propositions d’évolution
Gemini, Astra et Canary restent dans `docs/archives/` pour mémoire et réflexion
future, sans faire autorité sur l’implémentation. Les anciens plans, todos et
journaux sont consultables dans Git avant le commit de nettoyage du 5 octobre
2026, et ne doivent pas être remis dans la séquence active.

### Décisions techniques

| ADR | Sujet |
| --- | --- |
| `docs/decisions/0001-product-foundations.md` | fondations produit (accepté) |
| `docs/decisions/0002-physics-engine-selection.md` | choix du moteur physique, Planck.js (accepté) |
| `docs/decisions/0003-project-bootstrap.md` | outillage, scripts, gates, politique de dépendances, versions et releases (accepté) |
| `docs/decisions/0004-level-document-v1.md` | contrat `LevelDocument` v1 (accepté ; v2 : ADR 0007, code) |
| `docs/decisions/0005-construction-attempt.md` | provenance éphémère d'une tentative (accepté) |
| `docs/decisions/0006-board-renderer.md` | renderer du plateau et pipeline de sprites (accepté) |
| `docs/decisions/0007-world-scale-and-camera.md` | repère du monde, scène, caméra, échelle des sprites (accepté) |
| `docs/decisions/0008-client-side-routing.md` | routage côté client, schéma d'URL (accepté) |
| `docs/decisions/0009-control-wires.md` | fils de commande : modèle, rendu, câblage et minuteur en série (accepté, amendé) |
| `docs/decisions/0010-object-challenge-and-progression.md` | défi d'objets ✅/⭐/🏆, ouverture des niveaux (accepté) |
| `docs/decisions/0011-local-storage-and-url-sharing.md` | IndexedDB/Dexie asynchrone, sans reprise `localStorage` ; codecs et partage URL (accepté, amendé C0) |
| `docs/decisions/0012-pwa-service-worker.md` | PWA, service worker, mises à jour (accepté) |
| `docs/decisions/0013-puzzle-workshop-solution.md` | objets à placer, solution de référence, export vérifié (accepté) |
| `docs/decisions/0014-icon-library.md` | bibliothèque d’icônes de l’interface (accepté) |
| `docs/decisions/0015-mes-niveaux.md` | « Mes niveaux », niveaux reçus, créations, solution cachée ; reprise automatique avant simulation (accepté, amendé C0) |
| `docs/decisions/0016-attribution-licence-niveaux.md` | auteur, sources, licence CC BY 4.0 des niveaux (accepté) |
| `docs/decisions/0017-player-construction-and-async-storage.md` | contrat détaillé de stockage/reprise C2 (**accepté** ; C2a/C3 livrés) |
| `docs/decisions/0018-level-document-v3.md` | passage accepté au format de niveau v3 et migrations des documents persistés |
| `docs/decisions/0019-c9-object-contracts.md` | contrats C9 et ordre acceptés ; constantes physiques à équilibrer pendant l’intégration |

### Sources exécutables

| Sujet | Source |
| --- | --- |
| Schéma et migrations de niveau | `src/domain/level-document.ts` |
| Registre des familles | `src/domain/object-family-registry.ts` |
| Géométrie | `src/domain/family-geometry.ts` |
| Commandes de tentative | `src/application/construction/construction-attempt.ts` |
| Undo/redo | `src/application/history/history.ts` |
| Frontières de couches | `src/architecture/layer-boundaries.test.ts` |
| Scripts et dépendances | `package.json`, `pnpm-lock.yaml` |
| Campagne livrée | `src/content/levels/*.json`, `src/content/embedded-levels.ts` |
| Sources auteur des tutoriels | `levels/` |
| Export des sprites | `art/build-sprites.py` |

## Routage par tâche

Lire les sections utiles des documents nommés. Une inspection supplémentaire
nécessaire à l’audit ou au nettoyage est expliquée dans le rapport de lot.

| Tâche | Lire | Écrire |
| --- | --- | --- |
| Format persistant, schéma et migration | ADR 0004/0007/0013/0016/0018 ; architecture § Enveloppe de niveau ; schéma exécutable | `src/domain/`, codecs, tests de migration |
| Commandes, historique et tentative | ADR 0005 ; architecture § Commandes et historique | `src/application/` |
| Famille d’objet | Catalogue ; architecture § Modèle d’objet ; ADR 0004/0018/0019 | Domaine, simulation, édition et tests |
| Physique, pas fixe et conformité | ADR 0002 ; qualité § Déterminisme ; architecture § Simulation ; catalogue § Tests contractuels | `src/simulation/`, `test/conformance/` |
| Plateau, caméra et projection | ADR 0006/0007 ; architecture § Rendu et interface | `src/presentation/` |
| Sprites et assets | ADR 0007 § Amendement sprites ; scripts d’export concernés | `art/`, `public/assets/` (sauf protection explicite de l’auteur) |
| Fils et appareils | ADR 0009/0019 ; spécification des fils ; catalogue | Domaine, simulation et présentation |
| Interfaces tactiles | Tâche M0–M4 ; interactions mobiles ; cahier des charges § Interaction mobile | `src/ui/`, `src/app/` |
| UI desktop et recherche | Tâche C7d/C10 ; maquette d’identité utile | `src/ui/`, `src/app/` |
| Navigation et URL | ADR 0008 | `src/app/` |
| Nouveau niveau | Guide de conception, qui se suffit ; tâche active s’il s’agit d’intégration à la campagne | `src/content/levels/` |
| E2E | Qualité § Tests end-to-end ; contrat du parcours | `e2e/` |
| Stockage, reprise, import/export et partage | ADR 0011/0015/0017/0018 ; architecture § Stockage et partage | Infrastructure, application et codecs |
| Défi et progression | ADR 0010/0011 ; état livré | Application et contenu |
| PWA | ADR 0012/0003 | Configuration et application |
| Outillage, CI et releases | ADR 0003 ; `package.json` ; procédure de release ; changelog ; README | Racine, `scripts/`, documentation |
| Décision structurante | Intention produit et ADR concernée | `docs/decisions/` |
| Nettoyage documentaire | Cette carte ; état, roadmap et références des fichiers concernés ; préserver les demandes encore ouvertes | Documentation et commentaires de référence |
| Licence | `LICENSE`, README et `package.json` | Racine |
