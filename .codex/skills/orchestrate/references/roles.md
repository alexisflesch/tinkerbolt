# Périmètres possibles

Ces exemples aident à borner un lot ; ils ne constituent pas une chaîne de
rôles obligatoires. Un agent peut couvrir plusieurs couches pour livrer un
comportement complet, tests inclus. Les lectures viennent de `docs/index.md`.

| Lot | Périmètre possible | Références à cibler |
| --- | --- | --- |
| Domaine et commandes | `src/domain/`, `src/application/`, tests | Contrat du document, commandes, historique |
| Persistance et reprise | Ports, `src/infrastructure/`, cas d’usage, tests | ADR de stockage/reprise, architecture du stockage |
| Simulation | `src/simulation/`, `test/conformance/` | Port physique, pas fixe, déterminisme, famille concernée |
| Interface | `src/presentation/`, `src/ui/`, `src/app/`, tests | Contrat d’interaction et de rendu de la tâche |
| Contenu | Niveau concerné et solution de référence | Conception des niveaux, schéma et catalogue |
| Parcours | `e2e/` et raccords nécessaires | Qualité ; desktop v1, téléphone seulement pour une tâche v2 |
| Revue ponctuelle | Lecture seule, diff et preuves ciblés | Invariants et contrat concernés |

Ne pas lancer un lecteur de spécification ou un auteur de tests séparé pour un
lot courant. Une revue cherche un risque concret ; elle ne refait pas le travail
de l’implémenteur ni l’ensemble de la lecture documentaire.
