# ADR 0018 — Passage à `LevelDocument v3` pour C9

Statut : acceptée par l’auteur — 4 octobre 2026

Date : 2026-10-04

## Contexte

L’[ADR 0004](0004-level-document-v1.md) demande une évolution versionnée et une
migration à l’ajout d’une famille. L’[ADR 0009](0009-control-wires.md) a ensuite
ajouté des familles en v2 sans migration, en s’appuyant sur l’absence de niveaux
persistés et partagés à l’époque. Ce contexte a changé : C2a/C3 stockent des
niveaux et des constructions dans IndexedDB, et les niveaux peuvent être
importés ou partagés. C9 ajoute les familles caisse, électroaimant, piston et
minuteur.

L’auteur a choisi le passage en v3 avec migration v2 → v3. Cette décision
résout le conflit entre ADR 0004 et le précédent historique d’ADR 0009.

## Décision

- Le format courant devient `LevelDocument v3`. Son schéma strict ajoute les
  types C9 nécessaires ; le schéma v2 reste strict et n’est pas élargi.
- La migration v1 → v2 existante est conservée. Une migration v2 → v3 est
  ajoutée ; les documents v1 passent par v2 avant d’arriver en v3.
- La migration v2 → v3 conserve le contenu v2 valide et change sa version. Les
  migrations valident leur entrée avec le schéma strict correspondant et leur
  résultat avec le schéma strict de sortie. Les nouvelles données sont
  sérialisées en v3 ; un document d’une version future reste refusé sans
  écraser sa valeur persistée.
- Les chemins persistants qui contiennent un niveau — créations, niveaux reçus
  et constructions C3 — migrent sans perdre leur contenu. Pour une construction
  enregistrée en v2, la migration distingue un simple changement de version
  d’une source réellement modifiée avant de mettre à jour son empreinte. Une
  différence de source conserve la règle `source-changed` de l’ADR 0017.
- Les tests de compatibilité couvrent les codecs et repositories v1, v2 et v3,
  ainsi que la reprise d’une construction C3 v2, son empreinte et la protection
  des enveloppes de version future.

## Conséquences

- `levelDocumentSchema`, le codec de fichier, les liens de partage, les
  repositories et le codec de construction exposent v3 comme version courante.
- L’union stricte v3 ajoute les familles au fil de C9, avec leurs propriétés,
  relations et migrations testées. Elle ne fait entrer aucune donnée de moteur
  physique ou de rendu dans le document.
- Le raisonnement d’ADR 0009 sur l’absence de persistance reste un historique,
  mais ne justifie plus l’ajout de nouvelles familles au v2.
- Une ancienne version du jeu ne peut pas interpréter un niveau v3 ; elle doit
  signaler la version future sans modifier la donnée.
