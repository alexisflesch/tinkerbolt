# ADR 0017 — Construction de joueur et stockage asynchrone

Statut : **proposé — C2, validation de l’auteur attendue**

Date : 2026-10-03

## Contexte et statut

Les amendements C0 des [ADR 0011](0011-local-storage-and-url-sharing.md) et
[0015](0015-mes-niveaux.md) acceptent IndexedDB avec Dexie, les ports
asynchrones, une base neuve sans reprise de `localStorage` et la reprise
automatique de la construction engagée avant simulation. Ces décisions sont
acquises. Le présent contrat détaille leur mise en œuvre ; il ne constate
aucune livraison et reste proposé jusqu’à validation. La
[feuille de route](../feuille-de-route.md) porte l’ordre C2 → C2a → C3.

Trois arbitrages produit restent explicitement ouverts :

| Situation                       | Proposition soumise à l’auteur                                                                  | Conséquence                                                                                     |
| ------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Victoire                        | Garder la construction d’avant lancement.                                                       | La rouvrir permet de l’améliorer ; « Recommencer » seul repart de zéro.                         |
| Remise à zéro de la progression | Garder les constructions campagne, soumises aux verrous recalculés.                             | Une construction d’un niveau redevenu verrouillé attend son déblocage ; la confirmation le dit. |
| Source modifiée                 | Conserver l’ancienne construction en secours, puis partir du nouveau niveau avec avertissement. | Aucune conversion heuristique ni reprise incompatible.                                          |

Le silence de l’auteur n’accepte aucune proposition. C2a/C3 ne commencent
pas sur la base de ce document au statut proposé.

## Identité et compatibilité proposées

Une construction est attachée à `{ scope: 'campaign' | 'received', levelId,
sourceFingerprint }`. Une seule ligne courante existe pour la clé
`[scope, levelId]`. En campagne, `levelId` est l’id embarqué ; pour un reçu,
il est l’id local `recu-…`, distinct de `document.id`.

`sourceFingerprint` est le SHA-256 complet, 64 chiffres hexadécimaux
minuscules, des octets UTF-8 de `encodeLevelFile(source)` après validation
et migration de la source. Le niveau entier est couvert : changer même le
titre rend la construction incompatible. L’identité des reçus conserve les
16 chiffres actuels de l’ADR 0015. Une réception doublonnée compare aussi
les documents canoniques ; une collision d’identité renvoie
`identity-collision`, sans écraser la source existante.

`/shared` reçoit le document avant la recherche de construction ; il reprend
la même clé que `/my-levels/:id/play`. Si le reçu ne peut être conservé, le
jeu continue en mémoire sans construction persistée orpheline. Une empreinte
indisponible désactive la reprise dédiée avec explication, sans CRC de repli.
Les essais joueur d’Atelier et `/bench` restent hors de cette reprise.

Les créations gardent leur autosauvegarde distincte, leur id et leur copie
`source` éventuelle. Supprimer ou corriger cette source ne touche pas la
création. Il n’y a pas de deuxième autosauvegarde du même brouillon.

## Enveloppe et codec de construction proposés

```ts
interface PlayerConstructionEnvelope {
  kind: 'player-construction';
  version: 1;
  data: {
    scope: 'campaign' | 'received';
    levelId: string;
    sourceFingerprint: string;
    updatedAt: string;
    attempt: {
      document: LevelDocument;
      provenance: Record<string, string>;
    };
  };
}
```

L’enveloppe et ses objets sont stricts et validés par Zod. Ids : règle
actuelle du domaine, 1 à 128 caractères, lettres minuscules/chiffres/tirets ;
id reçu : `^recu-[0-9a-f]{16}$` ; empreinte : `^[0-9a-f]{64}$` ; date : ISO
8601 issue d’une horloge injectée. La provenance est bornée par les maxima
d’objets et de fils du schéma existant, avec ids validés en clés et valeurs.
La clé IndexedDB et les colonnes d’index doivent correspondre à l’enveloppe.

Le **codec de fichier normal** reste l’unique codec de niveaux sources,
créations et échange, avec ses migrations. Il valide le stock initial via
`levelDocumentSchema`. Le **codec de construction dédié** valide le document
consommé via `levelDocumentAttemptSchema`, puis les relations à la source
courante décrites ci-dessous. Il ne passe jamais directement ce document
consommé à `encodeLevelFile` : les quantités restantes peuvent invalider le
défi et des fils posés peuvent aussi être décrits dans la solution cachée.
Aucun contrat de niveau, schéma source ou validateur existant n’est affaibli.

Le validateur pur de reprise vérifie, en plus de l’enveloppe :

1. Identité et empreinte égales à celles demandées ; même id de document,
   métadonnées, objectif, scène, zones, défi et solution que la source. Aucun
   marquage auteur `toPlace` en résolution.
2. Inventaire identique à la source pour ids, types, propriétés et permissions.
   Pour chaque entrée, `restant + nombre d’éléments provenant de cette entrée
= quantité source`. Aucune entrée omise ou inventée ; quantités entières
   non négatives.
3. Chaque provenance désigne exactement un objet ou fil présent, ajouté par
   le joueur, et une entrée source existante. Un objet correspond à la
   définition de cette entrée ; un fil correspond à une entrée `wire`.
   Aucune clé pendante, ambiguë ou attachée au décor.
4. Tout objet/fil supplémentaire possède une provenance ; ses ids évitent
   ceux du décor et les collisions objet/fil parmi les ajouts. La provenance
   n’est jamais déduite d’une ressemblance de propriétés.
5. Tout objet du décor demeure présent, même définition et permissions ;
   seules ses transforms autorisées peuvent changer. Un **décor déplaçable
   reste sans provenance**, avec sa position réellement engagée. Les fils
   fixes restent identiques. Les ajouts et transforms modifiées respectent
   permissions, rotations et empreinte complète dans les zones ; un décor
   initial inchangé n’est pas rejeté pour sa seule position hors zone.
6. Réutiliser les règles de commandes et du schéma pour géométrie, connexions,
   objectif et solution. Reconstituer le stock initial pour contrôler défi
   et solution, avec le traitement actuel des fils également présents dans
   la solution ; retenir ensuite le stock restant pour jouer. Le mécanisme
   `acceptCandidate` seul ne suffit pas : il ignore certaines provenances
   incorrectes au lieu de les rejeter.

Le codec retourne une tentative immuable validée. La reprise appelle
`createEditorSession('resolution', attempt)`, avec historique neuf, phase
construction et aucune manipulation, sélection ou simulation. Elle ne passe
pas par `createConstructionAttempt(document)`, qui viderait la provenance.
Ni historique, outil, caméra, panneaux, temps, positions physiques ou handles
ne sont persistés. La provenance reste hors du `LevelDocument` partageable,
conformément à l’[ADR 0005](0005-construction-attempt.md).

## Base initiale proposée

Base `tinkerbolt`, version Dexie 1. Les enveloppes logiques existantes gardent
leur forme : `draft` v2, `received-level` v1, `progress` v1, `preferences` v1.
Leurs règles Zod et codecs restent applicables, sans lecture de l’ancien
stockage. Toute future incompatibilité de cette nouvelle base exigera une
migration testée ; les migrations de **fichiers de niveaux** restent présentes.

| Table                 | Clé primaire               | Index        | Valeur                                          |
| --------------------- | -------------------------- | ------------ | ----------------------------------------------- |
| `creations`           | `id`                       | `updatedAt`  | id, date et enveloppe `draft` v2                |
| `receivedLevels`      | `id`                       | `receivedAt` | id, date et enveloppe `received-level` v1       |
| `progress`            | `id`, singleton `campaign` | aucun        | enveloppe `progress` v1                         |
| `preferences`         | `id`, singleton `player`   | aucun        | enveloppe `preferences` v1                      |
| `playerConstructions` | `[scope+levelId]`          | `scope`      | scope, id et enveloppe de construction v1       |
| `backups`             | auto-incrémentée           | aucun        | table, clé source, raison, date et valeur brute |

Pas d’index de liste séparé : les tables représentent leurs enregistrements.
La table de constructions est déclarée en C2a ; ses appels de reprise sont
livrés en C3. Les colonnes de tri sont validées avec leur enveloppe avant
usage. La valeur brute de secours reste opaque, `unknown`, hors du domaine.

Une donnée invalide est déplacée vers `backups` et retirée de la table active
**dans la même transaction**, avec avertissement `invalid-data-backed-up`.
Si la sauvegarde de secours échoue, la ligne originale demeure et la lecture
renvoie une erreur. Même règle avant tout remplacement. Aucun écrasement de
secours ni suppression pour libérer du quota. Une version d’enveloppe future
inconnue reste en place et renvoie `unsupported-version` ; elle ne devient
pas un état vide réinscriptible. Le traitement d’une empreinte source modifiée
reste soumis au troisième arbitrage ci-dessus.

## Ports et transactions proposés

Tous les appels des quatre repositories existants deviennent
`Promise<Résultat>`, y compris `list`, `load`, `save`, `delete` et `clear`.
Les erreurs attendues restent des résultats discriminés. Les contextes et
appelants prennent en charge chargement, annulation des lectures devenues
obsolètes et erreurs. Le domaine et la simulation ne dépendent d’aucune API
de stockage ; aucune table ou transaction Dexie n’est exposée à l’application.

Le port d’application ajouté est `PlayerConstructionRepository` :

- `load(source)` → tentative validée ou `null`, avertissement éventuel, ou erreur ;
- `save(source, attempt)` → réussite ou erreur ;
- `delete(source)` → réussite ou erreur.

Toutes sont asynchrones. `source` porte scope, id local, empreinte et niveau
source validé pour le contrôle relationnel. Une sauvegarde reçue relit son
parent dans la transaction et vérifie qu’il est présent et identique ; aucune
écriture tardive ne recrée un reçu supprimé. Empreintes et préparation des
payloads sont calculées avant transaction ; aucun `await` externe à IndexedDB
n’est requis à l’intérieur de celle-ci.

Les méthodes atomiques restent dans les repositories concernés :

| Port / opération                        | Périmètre atomique                                                                                                |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `DraftRepository.save`                  | document, copie source et date dans une ligne ; secours si nécessaire                                             |
| `DraftRepository.create`                | insertion exclusive d’une création libre ; collision signalée et retentée avec aléa injecté                       |
| `ReceivedLevelRepository.receive`       | création ou rafraîchissement après relecture ; doublon garde origine, record, victoire et solution                |
| `ReceivedLevelRepository.recordVictory` | relire parent, fusionner meilleur compte et inscrire dernière solution gagnante ; parent absent = aucune écriture |
| `ReceivedLevelRepository.delete`        | supprimer reçu et construction `[received,id]` ensemble ; créations indépendantes                                 |
| `ProgressRepository.recordVictory`      | relire progression puis fusionner résultat/record de campagne                                                     |
| `PreferencesRepository.patch`           | relire puis changer uniquement les champs fournis ; `author: null` efface le pseudo, champs omis conservés        |
| `PlayerConstructionRepository.save`     | ligne entière, validation, présence/source du parent reçu vérifiées ensemble                                      |
| `PlayerConstructionRepository.delete`   | construction ciblée seulement, après barrière des écritures anciennes                                             |
| `ProgressRepository.clear`              | progression seule selon arbitrage proposé ; autres tables conservées                                              |

Les méthodes de victoire reçoivent les données dérivées de l’instantané de
lancement par les fonctions pures actuelles, avec identité source attendue.
La vérification du parent utilise la source canonique préparée avant la
transaction. Deux `await` séparés sur `load` puis `save` ne sont pas une
opération atomique : les usages de fusion doivent employer les méthodes
ci-dessus. Les écritures de paramètres ne peuvent perdre un autre champ,
et une réception répétée ne peut effacer une victoire concurrente.

Selon l’arbitrage proposé, une victoire conserve la construction ; elle ne
requiert donc pas sa suppression dans la transaction de record. Si l’auteur
choisit son effacement, record et suppression devront être atomiques.

## Déclenchement, reprise et erreurs proposés

- Vérifier source et verrou avant reprise, puis attendre la lecture avant de
  monter la session. Un niveau neuf ne peut écraser une construction encore
  en cours de lecture ; une réponse d’une route quittée est ignorée.
- Écrire l’instantané complet de `session.history.state` après un engagement,
  undo/redo compris. Le callback actuel `onDocumentCommitted(document)` ne
  suffit pas à la reprise : C3 transmet la tentative complète avec provenance.
  Un aperçu de geste, refus ou changement de sélection n’écrit rien.
- Sérialiser les écritures par création/construction pour garder l’ordre des
  engagements. La première création libre adopte id et URL après insertion
  réussie, avec un seul premier enregistrement en cours. Ne pas brancher le
  limiteur d’une seconde existant en C2a/C3 : écrire chaque état engagé.
- Tenter la sauvegarde finale avant lancement et drainer la file lors d’une
  navigation interne. Un échec signalé laisse jouer/naviguer. La fermeture
  brutale peut interrompre une écriture en cours ; ne pas promettre un flush
  garanti via `beforeunload` ni dépendre uniquement de cet événement.
- Simulation, pause et résultat n’écrivent aucun état physique. Une défaite
  garde l’état avant lancement ; revenir à la construction le retrouve.
  Une victoire utilise `simulationSnapshot` pour score et solution gagnante.
  La limite de remix du décor déplaçable de l’ADR 0015 reste distincte : la
  reprise complète, elle, conserve ce décor.
- « Recommencer » annule geste et simulation, invalide les futures écritures
  de l’ancienne session et ordonne celles déjà lancées avant suppression de
  la construction. Il repart de la source intacte, sans restaurer solution
  d’auteur ni modifier progression, inventaire source ou niveau reçu.
  Une écriture tardive de cette instance ne peut ressusciter l’état supprimé.
  Si l’effacement échoue, jouer frais en mémoire reste possible mais un
  message indique que l’ancienne construction pourrait revenir.

Codes conservés : `storage-unavailable`, `quota-exceeded` et les erreurs de
validation des repositories. Codes ajoutés : `invalid-construction`,
`unsupported-version`, `source-changed`, `source-not-found`,
`identity-collision`, `fingerprint-unavailable`. Une base inaccessible ou
d’une version plus récente n’est jamais présentée comme vide. Un état
chargement précède les décisions de niveau introuvable, verrou et préférences.

Quota ou écriture impossible : jeu/édition continuent en mémoire, avec statut
indiquant que les modifications ne sont pas enregistrées, retiré après un
succès ultérieur. Aucun repli écrit dans `localStorage`. Suppression/reset
échoués n’affichent pas une fausse réussite. La demande de stockage persistant
après première victoire demeure, sans bloquer si refusée.

Ce contrat garantit l’ordre des écritures au sein d’une instance et les
transactions de données liées. Il n’impose pas de fusion de constructions
entre onglets, ni synchronisation distante.

## Critères de validation avant livraison

- **C2a** : CRUD et réouverture de base ; validations Zod et codecs ; insertions
  exclusives ; transactions de réception, préférences, records et suppression
  reçu/construction ; rollback, données invalides avec secours, versions
  inconnues, quota et base indisponible ; base neuve sans lecteur/transfert
  `localStorage`. Version et conséquences de Dexie documentées selon ADR 0003.
- **C3** : campagne et reçus, `/shared` compris ; dernière pose, déplacement,
  rotation, fil, retrait et undo/redo repris exactement ; source/solution
  intactes, quantités exactes, décor déplaçable sans provenance ; corruption
  relationnelle rejetée ; geste refusé/annulé sans écriture ; rechargement en
  simulation sans moteur/historique ; suppression, reset, victoire et source
  changée conformes aux arbitrages acceptés. Vérifier aussi les derniers
  engagements de propriétés et métadonnées d’Atelier.
- Red-Green-Refactor sur les comportements, gate globale et captures pour
  les nouveaux états visibles selon les règles du dépôt. Cette ADR seule
  n’exige aucun test artificiel ; elle n’est pas une implémentation.
