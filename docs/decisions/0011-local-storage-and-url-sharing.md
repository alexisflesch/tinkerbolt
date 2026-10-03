# ADR 0011 - Persistance locale et partage par URL

Statut : accepté ; choix de stockage amendé le 3 octobre 2026 (cible C2–C3).

Date : 2026-09-26

## Contexte

`architecture.md` prévoyait IndexedDB pour les brouillons, la progression et les
préférences, et un codec de fragment URL « avec version, algorithme, taille
attendue et checksum ». Le cahier des charges laissait ouvert l'adaptateur
IndexedDB et les paramètres du codec. La progression de l'ADR 0010 a besoin d'un
stockage ; le partage de niveaux créés en a besoin d'un format.

## Décision

### `localStorage`, derrière des ports

Décision initiale, livrée dans la v1 : la persistance locale utilise
`localStorage`. Elle est remplacée pour la reprise active par l’amendement
du 3 octobre ci-dessous ; `etat.md` décrit l’adaptateur effectivement livré.

- Les volumes sont petits : une progression tient en quelques kilo-octets, un
  niveau en quelques kilo-octets (plafond du codec : 256 Kio). Quelques dizaines
  de brouillons tiennent dans le quota habituel de 5 Mo.
- L'API est synchrone, testable avec un faux `Storage` en mémoire, sans
  dépendance (`fake-indexeddb` aurait été nécessaire).
- Les ports de `src/application/` (`ProgressRepository`, `DraftRepository`,
  `PreferencesRepository`) gardent la décision réversible : un adaptateur
  IndexedDB pourra les implémenter sans toucher au domaine.

Règles :

- clés préfixées `tinkerbolt:` (`tinkerbolt:progress`, `tinkerbolt:preferences`,
  `tinkerbolt:drafts` pour l'index, `tinkerbolt:draft:<id>` par brouillon) ;
- chaque valeur est une enveloppe JSON `{ "kind": "...", "version": 1, "data": ... }`
  validée par Zod à la lecture ; les documents de niveau d'un brouillon passent
  par le codec de fichier (migrations incluses) ;
- une valeur illisible ou invalide n'est **jamais écrasée silencieusement** : elle
  est copiée sous `tinkerbolt:backup:<clé>` avant la première écriture, et la
  lecture renvoie un état vide accompagné d'un avertissement ;
- une erreur de quota ou un stockage indisponible (navigation privée, stockage
  bloqué) est un résultat d'erreur, jamais une exception qui remonte à l'écran ;
  le jeu reste jouable sans persistance ;
- `navigator.storage.persist()` est demandé une fois après la première réussite
  d'un niveau, sans bloquer si refusé.

### Codec de fichier de niveau

`src/infrastructure/level-file/` : texte JSON indenté de 2 espaces, plafond de
256 Kio **avant** parsing, `JSON.parse` protégé, migrations v1 → v2 puis schéma
courant, codes d'erreur stables (`too-large`, `invalid-json`,
`unsupported-version`, `invalid-document`). C'est l'unique entrée et sortie JSON
d'un niveau, pour l'import/export comme pour les brouillons et le partage.

### Partage par fragment URL

Forme : `/shared#level=<charge>`, avec

```text
<charge> = 1.<crc32>.<taille>.<données>
```

- `1` : version du format de charge (le seul algorithme de v1 est `deflate-raw`) ;
- `<crc32>` : CRC-32 (polynôme IEEE) des octets UTF-8 du JSON, 8 chiffres hexa
  minuscules ;
- `<taille>` : longueur en octets du JSON, décimale ;
- `<données>` : `deflate-raw` du JSON (`CompressionStream`, natif, sans
  dépendance), encodé en base64url sans remplissage.

Le JSON est la sortie du codec de fichier. Le CRC-32 est une détection de
corruption, pas une signature : il n'apporte aucune authenticité.

Décodage, dans cet ordre, chaque étape ayant son code d'erreur :

1. charge ≤ 16 384 caractères, sinon `too-large` ;
2. forme `1.x.y.z` et version `1`, sinon `unsupported-version` ;
3. `<taille>` ≤ 262 144 (256 Kio), sinon `too-large` ;
4. base64url valide, sinon `invalid-encoding` ;
5. décompression en flux **interrompue dès que** le total dépasse `<taille>`,
   puis total égal à `<taille>`, sinon `size-mismatch` ;
6. CRC-32 égal, sinon `checksum-mismatch` ;
7. codec de fichier (validation et migrations).

Le fragment n'est jamais envoyé au serveur. Un niveau partagé s'ouvre en mode
joueur comme niveau éphémère : il n'entre pas dans la campagne, ne compte pas
dans la progression, et n'écrase ni ne crée de brouillon sans action explicite
de l'utilisateur. Un fragment invalide affiche une erreur et n'altère rien.

`/shared` étend le schéma d'URL de l'ADR 0008.

## Conséquences

- Conséquence initiale : `architecture.md` § Stockage et partage utilisait
  `localStorage` au lieu d'IndexedDB ; la cible est amendée le 3 octobre 2026.
- `CompressionStream` impose des navigateurs récents (Chrome 103, Firefox 113,
  Safari 16.4) : c'est déjà la cible de la PWA. Node 24 le fournit pour les tests.
- Le codec URL est asynchrone ; le codec de fichier reste synchrone.
- Un niveau de 3 Ko de JSON donne une charge d'environ 1 à 1,5 Ko : l'URL reste
  partageable par messagerie.

## Amendement du 1er octobre 2026 — import de fichier

La page `/import` lit les fichiers JSON avec le codec de fichier ci-dessus
(limite 256 Kio, migrations puis validation Zod). Un fichier valide est enregistré
comme un nouveau brouillon avec un identifiant généré par l’application, puis
ouvert dans l’éditeur. Un identifiant source ne peut donc pas écraser un brouillon
local existant. Les erreurs de lecture, de validation ou de stockage restent sur
la page d’import, en dehors du plateau ; elles ne modifient aucun brouillon.

## Amendement du 1er octobre 2026 — réception et « Mes niveaux » (ADR 0015)

Remplace l’amendement précédent et la phrase « n’écrase ni ne crée de brouillon
sans action explicite » de § Partage par fragment URL, à la demande de l’auteur :

- un lien `/shared` valide est **toujours** enregistré comme niveau reçu
  (`tinkerbolt:received:<id>`), avant d’être joué ; un lien invalide n’enregistre
  rien ;
- un fichier importé devient lui aussi un niveau reçu ; il n’ouvre plus
  l’éditeur et ne crée plus de brouillon ;
- un niveau reçu reste hors de la campagne et de sa progression ;
- l’enveloppe des brouillons passe en version 2 (champ `source`, `updatedAt`),
  avec migration depuis la version 1.

Le détail (empreinte, doublons, refus des documents `toPlace`, saturation du
stockage) est dans l’ADR 0015.

## Amendement du 2 octobre 2026 — aide du niveau 1 (U8)

`tinkerbolt:preferences` porte, à côté du pseudo (ADR 0016), un second champ
facultatif : `firstLevelHintDone: true`, écrit quand le joueur ferme l’aide du
niveau 1 ou pose son premier objet, pour qu’elle ne revienne pas. Ce n’est pas
une donnée personnelle ; seule la valeur `true` est enregistrée, toute autre
valeur rend l’enveloppe invalide (sauvegarde de secours, comme ci-dessus).

L’enveloppe reste en version 1 : le champ est facultatif, donc une valeur
écrite avant U8 (`{ author? }`) reste valide et se relit à l’identique, sans
migration (tests de l’adaptateur pour l’ancienne et la nouvelle forme). Une
écriture de l’un des deux champs conserve l’autre. Conséquence assumée : une
version de l’application antérieure à U8 (PWA en cache) lirait le nouveau champ
comme invalide, la sauvegarderait sous `tinkerbolt:backup:preferences` et
oublierait le pseudo.

## Amendement du 2 octobre 2026 — refus de l’installation (U10)

`tinkerbolt:preferences` porte un troisième champ facultatif,
`installInvitationDeclined: true`, écrit quand le joueur refuse l’invitation
d’installation (ADR 0012, amendement du même jour). Mêmes règles que
`firstLevelHintDone` : seule la valeur `true` est valide, l’enveloppe reste en
version 1 sans migration (tests de l’adaptateur pour l’ancienne et la nouvelle
forme), et toute écriture d’un champ conserve les autres. Même conséquence
assumée pour une version antérieure de l’application en cache.

## Amendement du 2 octobre 2026 — paramètres (U11)

- Le port `ProgressRepository` reçoit `clear()`, appelé par « Remettre la
  progression à zéro » de `/settings`. L’adaptateur `localStorage` retire la
  seule clé `tinkerbolt:progress`. Une valeur illisible est d’abord copiée sous
  `tinkerbolt:backup:progress`, comme avant toute écriture. Une sauvegarde de
  secours qui existe déjà n’est pas touchée. Un quota dépassé ou un stockage
  indisponible donne un résultat d’erreur, jamais une exception, et la
  progression affichée ne change alors pas. Les créations
  (`tinkerbolt:draft:*`), les niveaux reçus (`tinkerbolt:received*`) et les
  préférences ne sont pas touchés.
- Le pseudo retenu se modifie et s’efface depuis `/settings`
  (`rememberAuthor`, `src/application/preferences/`). Les préférences sont
  relues, seul `author` est remplacé ou retiré, et tous les autres champs
  (`firstLevelHintDone`, `installInvitationDeclined`) sont réécrits tels quels.
  Rien n’est écrit si les préférences ne peuvent pas être lues. L’enveloppe
  reste en version 1, sans nouveau champ.
- Conséquence connue (ADR 0015) : après la remise à zéro, la création
  `<id>-brouillon` d’un niveau de campagne qui redevient verrouillé est gardée,
  mais elle est marquée « Verrouillé ». Elle ne s’ouvre plus avant que le
  niveau soit de nouveau débloqué. Une création `creation-<aléa>` remixée
  depuis ce niveau reste ouverte. La boîte de confirmation le dit.

## Amendement du 3 octobre 2026 — IndexedDB/Dexie et reprise locale (C0)

Décisions confirmées par l’auteur pour la reprise après la clôture v1 :

- Le stockage local passe à **IndexedDB avec Dexie** dès cette étape. Cette
  dépendance structurante est acceptée ; sa version et ses conséquences
  d’outillage sont documentées en C2a selon l’ADR 0003, avant installation.
- Les ports de repositories et leurs appels deviennent **asynchrones**.
  L’application prend en charge chargement et erreurs ; Dexie et IndexedDB
  restent dans `infrastructure`, sans dépendance du domaine ou de la simulation.
  Le passage ne consiste pas à échanger un adaptateur derrière les appels
  synchrones actuels.
- La nouvelle base démarre vide : **aucune migration ni reprise depuis les
  anciennes clés `localStorage`**, aucun double stockage ou mécanisme de
  transfert de progression, créations, niveaux reçus ou préférences. L’auteur
  autorise leur perte car l’application n’est pas en production. Cette exception
  porte sur ce remplacement ; elle ne retire ni les codecs et migrations de
  fichiers de niveaux, ni la règle de migration des futurs formats persistants.
- Les nouvelles données lues sont non fiables : enveloppes versionnées validées
  par Zod, documents de niveau par le codec de fichier. Les opérations liées
  utilisent les transactions définies en C2. Une donnée invalide est mise en
  secours puis supprimée dans la même transaction ; une construction valide
  devenue incompatible avec sa source est supprimée sans secours, selon l’ADR 0017. Les anciennes clés `tinkerbolt:backup:*` ne sont pas reprises dans
  IndexedDB.
- Quota, ouverture impossible et erreurs de lecture/écriture donnent un résultat
  maîtrisé et compréhensible. Le jeu reste utilisable sans persistance ; un
  échec n’est jamais présenté comme une sauvegarde réussie.
- Une construction de joueur est retrouvée **automatiquement** à la navigation
  ou au rechargement, dans son état engagé avant simulation. « Recommencer »
  permet de repartir de zéro. Aucun monde physique, état transitoire de simulation
  ou historique annuler/rétablir n’est restauré. Le niveau source et sa solution
  restent intacts. La création d’Atelier reste une persistance distincte (ADR 0015).

**Contrat C2 accepté avant code :** l’ADR 0017 fixe l’identité et la
compatibilité avec le niveau source, l’enveloppe versionnée, la provenance, le
schéma initial, les transactions et les erreurs. La construction est conservée
après victoire ; le reset efface atomiquement, après barrière des écritures
anciennes, toute la progression de campagne (solutions comprises) et toutes
les constructions `campaign`. Une empreinte source différente invalide la
construction sans secours et produit l’avertissement `source-changed`. Les
créations et les reçus restent indépendants du reset.

**Livraison :** C2 fixe ces contrats, C2a remplace le stockage existant, C3
implémente la reprise des constructions et vérifie les autosauvegardes d’Atelier.
La [feuille de route](../feuille-de-route.md) porte seule l’ordre d’exécution ;
cet amendement ne constate pas leur implémentation. Le codec de fichier, le
format du lien partagé et les comportements de réception restent applicables.

## Contrat asynchrone accepté — C2

L’[ADR 0017](0017-player-construction-and-async-storage.md)
décrit le schéma initial Dexie, les ports asynchrones, transactions et
erreurs de la nouvelle base, sans reprise des anciennes données. Elle
distingue les documents sources complets, toujours traités par le codec
de fichier, du document consommé d’une construction : celui-ci nécessite
un **codec de tentative dédié**, fondé sur `levelDocumentAttemptSchema`
et les relations à la source/provenance, sans affaiblir le schéma de niveau.
Le contrat C2 est accepté : la victoire conserve la construction ; le reset
efface atomiquement toute la progression de campagne, solutions comprises, et
toutes les constructions `campaign` ; une source modifiée invalide la
construction sans secours avec avertissement `source-changed`. Les créations
et les reçus restent indépendants du reset. Les décisions C0 ci-dessus restent
acceptées.
