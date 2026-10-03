# ADR 0015 - « Mes niveaux » : niveaux reçus, créations et solution cachée

Statut : accepté ; stockage et reprise amendés le 3 octobre 2026 (cible C2–C3).

Date : 2026-10-01

## Contexte

L'auteur veut que le jeu fasse communauté : un joueur reçoit un niveau (lien
`/shared` ou fichier JSON), le joue, le modifie et le republie ; à terme, un
formulaire Grist de la forge edu recueille les propositions pour la campagne
officielle. Décisions de l'auteur du 1er octobre 2026 :

- tout niveau peut être ouvert dans l'atelier, résolu ou non : il n'y a aucun
  verrou « résoudre d'abord » ;
- l'atelier n'affiche pas la solution de l'auteur par défaut ; un bouton la
  révèle ;
- dans l'atelier, le catalogue est complet et illimité ; l'inventaire d'origine
  est jeté, sans affichage en lecture seule ;
- un niveau ouvert par lien est **toujours** enregistré ;
- une page « Mes niveaux » regroupe, en deux sections, les niveaux bricolés par
  le joueur et les niveaux reçus.

État de départ (code au 1er octobre 2026) :

- `/shared` joue une copie éphémère, rien n'est enregistré (ADR 0011) ;
- `/import` enregistre le document tel quel comme brouillon et l'ouvre dans
  l'éditeur, sans passer par `workshopFromPuzzle` : un puzzle importé n'a aucun
  objet « à placer » et ne peut pas être réexporté tel quel ;
- « Éditer le niveau » (U17) ouvre un niveau de campagne, **même verrouillé**,
  sous forme d'atelier, solution posée ; la fiche de calibrage U28 affiche aussi
  la solution ;
- `/editor` sans paramètre n'enregistre rien : un niveau créé de zéro est perdu
  au rechargement ;
- aucune interface ne liste ni ne supprime les brouillons.

Pourquoi pas de verrou : la solution est en clair dans le fichier et le
fragment URL n'est qu'une compression (ADR 0011, 0013) ; un niveau reçu ne
compte dans aucune progression ; il n'y a ni classement ni serveur. Le seul
risque réel est le spoil involontaire : il est traité en cachant la solution,
pas en interdisant l'édition.

## Décision

### Deux natures de niveaux

**Niveau reçu.** Un document arrivé par lien ou par fichier. Il est **figé** :
le joueur le joue, le partage à nouveau, le supprime, jamais il ne le modifie.

**Création.** Un document de forme atelier (ADR 0013) que le joueur modifie :
partie de zéro, remix d'un niveau reçu ou variante d'un niveau de campagne.
« Modifier » un niveau reçu ou de campagne ne le touche pas : cela crée (ou
rouvre) une création.

### Stockage local

Le contrat suivant décrit le stockage livré dans la v1, désormais remplacé
pour la reprise active par l’amendement du 3 octobre ci-dessous. Le stockage
v1 est `localStorage` derrière des ports de `src/application/`, avec les
règles de l'ADR 0011 (enveloppe versionnée validée par Zod, document de niveau
par le codec de fichier, sauvegarde `tinkerbolt:backup:<clé>` avant d'écraser
une valeur illisible, erreurs de quota en résultat, jamais en exception).

**Niveaux reçus** : index `tinkerbolt:received`, une entrée par
`tinkerbolt:received:<id>`, enveloppe `{ kind: "received-level", version: 1, data }` :

```ts
data: {
  id: string;                 // `recu-<empreinte>`
  document: LevelDocument;    // tel que reçu, forme puzzle
  origin: 'link' | 'file';
  receivedAt: string;         // ISO 8601, horloge injectée
  solved: boolean;
  bestObjectCount?: number;   // même définition que l'ADR 0010
  playerSolution?: Solution;  // dernière tentative gagnante, forme `solution` de l'ADR 0013
}
```

**Créations** : les brouillons L26 existants deviennent les créations. Clés
inchangées (`tinkerbolt:drafts`, `tinkerbolt:draft:<id>`). L'enveloppe passe en
`version: 2` :

```ts
data: {
  document: LevelDocument;    // forme atelier
  source?: LevelDocument;     // niveau d'origine, forme puzzle, copie intégrale
  updatedAt: string;          // ISO 8601, horloge injectée
}
```

Migration v1 → v2 : `document` repris, `source` absent, `updatedAt` à
l'instant de la migration ; la migration est écrite à la première lecture, au
mieux (un échec d'écriture n'empêche pas la lecture, la suivante retente), si
bien que la date reste stable. Les brouillons existants ont déjà leur solution
posée : ils restent ainsi. Tests de l'ancienne et de la nouvelle enveloppe
(AGENTS.md).

`source` vit dans l'enveloppe, **jamais dans le `LevelDocument`** : la règle de
l'ADR 0013 « un document qui porte une `solution` n'a aucun objet `toPlace` »
reste vraie. `source` est une copie, pas une référence : supprimer le niveau
reçu ou corriger le niveau de campagne ne casse pas la création.

Identifiants : `recu-<empreinte>` pour un niveau reçu ; `<id>-brouillon` pour
la création d'un niveau de campagne (règle U17 conservée : une par niveau,
rouverte telle quelle) ; `creation-<aléa>` sinon, aléa injecté.

### Empreinte et doublons

L'empreinte d'un niveau reçu est le SHA-256 (`crypto.subtle`, natif, sans
dépendance) des octets UTF-8 du texte produit par le codec de fichier, tronqué à
16 chiffres hexadécimaux (64 bits). Elle sert d'identifiant : recevoir deux fois
le même document, par lien puis par fichier, ne crée qu'une entrée, et ne
réinitialise ni `solved`, ni le record, ni la solution du joueur. Le recevoir à
nouveau met seulement à jour `receivedAt`, pour le remettre en tête des niveaux
reçus ; `origin` reste celle de la première réception. Le CRC-32 du
fragment URL n'est pas réutilisé : sur 32 bits, une collision ferait passer un
niveau différent pour un doublon et le perdrait.

### Réception

- `/shared` décode le fragment (ADR 0011), puis **enregistre toujours** le
  niveau avant de le jouer. Un lien invalide n'enregistre rien.
- L'import de fichier, depuis « Mes niveaux », passe par le codec de fichier
  puis par la même réception, avec `origin: 'file'`. Il n'ouvre plus l'éditeur :
  le niveau arrive dans la section des niveaux reçus.
- Un document qui porte un objet ou un fil `toPlace` est refusé à la réception,
  avec un message (« Ce fichier est un atelier, pas un niveau à jouer »).
  L'échange entre joueurs se fait en forme puzzle, celle que produit l'export.
- Un échec de stockage (quota, stockage bloqué) n'empêche jamais de jouer : un
  message discret dit que le niveau n'a pas été gardé. Aucun niveau n'est
  supprimé automatiquement pour faire de la place.

### Victoire sur un niveau reçu

Une victoire met à jour l'entrée : `solved: true`, `bestObjectCount` si le
nombre d'objets est meilleur, `playerSolution` remplacée par la tentative
gagnante (instantané pris au lancement, comme la progression de campagne L21).
La solution du joueur est dérivée de la provenance de la tentative
(ADR 0005) : poses issues de l'inventaire et fils du joueur. Un niveau reçu
n'affiche que ✅, comme un puzzle exporté (U24). Il n'entre jamais dans la
progression de campagne (ADR 0010).

### Ouvrir dans l'atelier

Une fonction pure de `src/application/` construit la création à partir d'un
niveau puzzle (reçu ou de campagne) :

- le décor (objets et fils fixes) est repris ;
- `solution`, `inventory` et `challenge` sont retirés : l'inventaire d'origine
  est jeté, le catalogue auteur complet sert à poser (U20) et l'export dérive
  l'inventaire des objets « à placer » (ADR 0013) ;
- si une solution de joueur est fournie, ses poses et ses fils sont ajoutés,
  marqués `toPlace`, comme le fait `workshopFromPuzzle` pour une solution
  d'auteur ;
- `source` reçoit le niveau d'origine intact ;
- les métadonnées suivent l'ADR 0016 (titre, auteur, sources).

Points d'entrée :

| Depuis                                 | Solution posée dans l'atelier                |
| -------------------------------------- | -------------------------------------------- |
| « Remixer » après une victoire         | celle de la tentative gagnante               |
| « Modifier » un niveau reçu résolu     | `playerSolution` enregistrée                 |
| « Modifier » un niveau reçu non résolu | aucune                                       |
| « Modifier » un niveau de campagne     | aucune (la progression ne garde pas de pose) |
| « Nouveau niveau »                     | aucune, atelier libre                        |

« Remixer » est proposé dans le résultat de victoire des niveaux de campagne et
des niveaux reçus. Pour la campagne, « Modifier » rouvre la création
`<id>-brouillon` si elle existe déjà, comme U17.

**Un niveau de campagne verrouillé n'est pas modifiable** (décision de l'auteur
du 1er octobre 2026 : la campagne a un ordre, ADR 0010). Le verrou est celui de
`isLevelUnlocked`, recalculé depuis la progression :

- sur `/levels`, « Modifier le niveau N » est désactivé tant que le niveau est
  verrouillé, comme « Lancer » (U5) ;
- `/editor?draft=<id>-brouillon` d'un niveau verrouillé, y compris une création
  enregistrée avant le verrou (progression réinitialisée), affiche « Ce niveau
  est encore verrouillé. » avec un lien vers `/levels`, sans ouvrir l'atelier ni
  modifier la création ;
- dans « Mes créations », la création d'un niveau verrouillé reste listée,
  marquée « Verrouillé », avec seulement l'action Supprimer ;
- sous `pnpm dev`, `unlockAllLevels` (U5b) lève aussi ce verrou.

Les niveaux reçus et les créations qui n'ont pas pour source un niveau de
campagne ne sont jamais verrouillés.

### Révéler la solution de l'auteur

Dans l'atelier d'une création dont la `source` porte une `solution`, une
commande « Révéler la solution de l'auteur » est disponible, dans un menu et non
en évidence, derrière une boîte de confirmation (« La solution de l'auteur sera
posée sur le plateau »). Elle **ajoute** les poses et les fils de la solution
d'origine, marqués `toPlace`, au document courant, sans rien retirer : c'est une
commande d'auteur annulable, une seule entrée d'historique. Identifiants
dédoublonnés ; un fil dont une extrémité n'existe plus (objet du décor supprimé
par le remixeur) n'est pas restauré, ni un fil qui viserait un appareil déjà
commandé ; un message discret (`role="status"`) dit combien de fils ont été ignorés. La
révélation n'est jamais refusée en bloc : une pose hors d'une scène réduite par
le remixeur agrandit la scène, comme une pose d'auteur (`addAuthoredPlacement`).

Sous `pnpm dev` (`import.meta.env.DEV`), la création d'un niveau de campagne
s'ouvre solution révélée, pour le calibrage par le mainteneur, comme
`unlockAllLevels` (U5b).

Amendement du 3 octobre 2026 (V7b, demande de l'auteur) : la fiche de calibrage
U28 et son bouton sont supprimés, y compris en développement. L'ouverture
solution révélée sous `pnpm dev` est conservée.

### Atelier libre

« Nouveau niveau » et `/editor` sans paramètre ouvrent l'atelier libre ; à la
**première modification engagée**, l'atelier est enregistré comme une création
`creation-<aléa>` et l'URL devient `/editor?draft=<id>` (remplacement, sans
nouvelle entrée d'historique du navigateur). Ouvrir l'atelier sans rien faire
ne crée pas d'entrée vide. Si cette première écriture échoue (quota, stockage
indisponible), l'atelier continue sans changer d'URL et réessaie à la
modification suivante.

### Page « Mes niveaux »

Route `/my-levels` (ADR 0008), dans le menu et sur l'accueil.

- Section **« Mes créations »** : créations triées par `updatedAt` décroissant ;
  actions Modifier, Jouer (« Jouer le puzzle » U22), Partager (boîte d'export
  U16, vérification ADR 0013 comprise), Dupliquer, Supprimer (confirmation).
  Bouton « Nouveau niveau ».
- Section **« Niveaux reçus »** : triés par `receivedAt` décroissant ; état
  (✅ résolu ou non, meilleur nombre d'objets), auteur et sources (ADR 0016) ;
  actions Jouer, Modifier, Partager (le même document, sans vérification
  supplémentaire), Supprimer (confirmation). Bouton « Importer un fichier ».
- Un niveau reçu se joue sur `/my-levels/:id/play`.
- `/import` disparaît ; l'URL redirige vers `/my-levels`.
- Tout est utilisable au doigt sur 390 × 844 (AGENTS.md, Mobile-first).

## Conséquences

- ADR 0011 amendée : `/shared` enregistre toujours ; l'import de fichier
  aboutit à un niveau reçu et non plus à un brouillon ouvert dans l'éditeur.
- ADR 0008 amendée : `/my-levels`, `/my-levels/:id/play` ; `/import` redirige.
- ADR 0013 : la transformation puzzle → atelier n'est plus utilisée telle
  quelle pour ouvrir un niveau de campagne ; elle sert à la révélation.
- Le comportement U26 « le brouillon du niveau 1 conserve son inventaire » est
  remplacé : une création n'a plus d'inventaire. Le test correspondant est
  réécrit, avec la raison dans le journal.
- Le stockage croît avec chaque lien ouvert : quelques kilo-octets par niveau,
  quelques centaines de niveaux tiennent dans le quota habituel. La saturation
  est un message, jamais une suppression silencieuse.
- La création d'un niveau de campagne garde une copie du niveau : une
  correction ultérieure de la campagne ne se propage pas aux créations
  existantes, et c'est voulu.
- Limite connue (M5) : la solution du joueur ne retient pas le déplacement d'un
  objet du décor. L'atelier verrouille tout objet qu'il pose (U20) et la
  campagne verrouille son décor : seul un fichier écrit à la main peut avoir un
  décor déplaçable. Une telle victoire peut ne pas se rejouer après « Remixer » ;
  la vérification d'export (ADR 0013) le signale au remixeur.
- Hors de cette décision : synchronisation entre appareils, comptes, catalogue
  en ligne. Le transfert d'une création vers un autre appareil passe par
  l'export (puzzle), la réception, puis « Modifier » et « Révéler ».

## Amendement du 3 octobre 2026 — stockage et construction à reprendre (C0)

L’amendement de l’ADR 0011 fixe désormais **IndexedDB avec Dexie**, des ports et
appels asynchrones, et **aucune reprise des anciennes données `localStorage`**.
Les clés, sauvegardes de secours et migration de brouillons v1 → v2 décrites
ci-dessus sont l’historique de la v1 ; elles ne constituent pas un parcours de
transfert vers la nouvelle base. La validation Zod, les codecs de niveaux et
leurs migrations restent requis. Les natures « niveau reçu figé » et « création
modifiable », leurs identités et leur provenance restent applicables.

La reprise locale distingue deux données :

- **Création d’Atelier** : son document engagé est déjà autosauvegardé, avec sa
  `source` intacte lorsqu’elle existe. C2a adapte ce mécanisme à l’asynchronisme,
  C3 vérifie les dernières modifications et corrige les lacunes ; il ne crée pas
  une deuxième autosauvegarde parallèle des mêmes brouillons.
- **Construction inachevée de joueur** : une persistance dédiée retrouve
  automatiquement les objets et fils engagés avant simulation, avec la provenance
  nécessaire à l’inventaire. Elle couvre les niveaux de campagne et reçus,
  y compris ceux ouverts depuis `/shared`. Elle ne modifie ni le niveau source
  ni sa solution, et ne se confond pas avec progression ou `playerSolution`
  gagnante. La simulation en cours et l’historique ne sont jamais repris.

« Recommencer » permet au joueur de repartir de zéro. C2 doit fixer son
périmètre exact et le contrat de suppression de la sauvegarde, l’identité et
la compatibilité avec une source modifiée, le devenir à la victoire, après
suppression d’un niveau reçu ou remise à zéro, l’enveloppe Zod versionnée et
les transactions. Ces choix et les cas d’erreur restent ouverts ; aucune
structure narrative n’est un schéma exécutable accepté par défaut.

Les décisions sont acceptées avant code. Le stockage et la reprise sont à
implémenter en C2a/C3 ; `etat.md` reste le constat de ce qui est livré et la
[feuille de route](../feuille-de-route.md) la seule séquence active.

## Contrat de reprise proposé — C2

La [proposition ADR 0017](0017-player-construction-and-async-storage.md)
détaille identité, compatibilité source, enveloppe et provenance de la
construction, réception et suppression atomiques, autosauvegarde et erreurs.
Elle conserve la distinction entre création, reçu figé et construction ;
une reprise exacte conserve aussi un décor déplaçable sans le faire passer
pour un objet d’inventaire. **Statut proposé** : garder après victoire,
garder sous verrou après remise à zéro de progression et mettre en secours
une construction incompatible restent des arbitrages en attente. Aucun
stockage Dexie ni reprise n’est déclaré livré par ce renvoi.
