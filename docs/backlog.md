# Découpage des tranches

Ce fichier fait autorité sur le découpage en étapes et leurs dépendances.
La **seule séquence active**, tâche par tâche, est dans `feuille-de-route.md` ;
ce fichier ne crée pas un deuxième ordre d’exécution. L’état livré et les dettes
courantes sont constatés par `etat.md`.

Chaque tranche est verticale, commence par ses tests observables et se termine par
`pnpm check`. Une tranche n'est pas déclarée terminée par l'agent qui l'a écrite.

## Reprise après la clôture v1 — 3 octobre 2026

| Étape               | Tranche            | Dépendances et sortie                                                                                                                                                                                                                                                      |
| ------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Compléments desktop | C0 à C10           | V9 clôturée. C0 raccorde les sources ; C1 placement ; C2 contrats ; C2a Dexie asynchrone sans reprise `localStorage` ; C3 conservation ; C4/C4a poutres et propriétés ; C5 victoire ; C6 icônes/splash ; C7 Bolt ; C8 audit ; C9 familles acceptées ; C10 recette desktop. |
| v2 téléphone        | M0 à M4            | C10. Contrat de gestes et maquettes validés, sélection/ouverture distinctes, portrait et paysage, recette et gate téléphone.                                                                                                                                               |
| v3 Forge/Grist      | F0 à F3            | M4. Destination et bascule définies, mécanisme d’envoi vérifié, proposition dans TinkerBolt, modération et recette.                                                                                                                                                        |
| v4 réserve          | Objectifs nouveaux | Décision et contrat séparés ; aucune implémentation anticipée en C/M/F.                                                                                                                                                                                                    |

Les dépendances de chaque tâche sont dans la feuille de route. Les contrats
des nouvelles familles et la soumission Grist restent ouverts. C2 est accepté,
C2a est livré ; C3 est la tâche courante ; les maquettes C4/C4a ont été examinées
et leurs positions corrigées sur instruction de l’auteur. Les autres maquettes
restent à valider. C0 ne constate ni remplacement du stockage ni livraison UI.

## Tranches fondatrices — état livré à la clôture v1

| Tranche | État                                                                                                  |
| ------- | ----------------------------------------------------------------------------------------------------- |
| T1      | ✅ Planck retenu après mesures sur téléphone (ADR 0002)                                               |
| T2      | ✅                                                                                                    |
| T3      | ✅ fantôme et fond suivant la caméra livrés ; ombres abandonnées (U3)                                 |
| T4a     | ✅                                                                                                    |
| T4b     | ✅ sélection, déplacement direct, poignée de rotation, propriétés                                     |
| T5      | ✅ cinq tutoriels livrés et vérifiés en V1/N2 ; recette v1 clôturée (V9)                              |
| T6      | ✅ progression, partage et PWA livrés ; stockage remplacé par Dexie asynchrone en C2a |

Les descriptions T1 à T6 ci-dessous sont l’historique du découpage initial,
pas des tâches actives. La v1 V0–V9 est clôturée. L’ordre courant C/M/F est
exclusivement dans `feuille-de-route.md`.

## Convention

- **Dépend de** : tranches qui doivent être intégrées avant de démarrer.
- **Parallèle avec** : tranches sans intersection de fichiers, délégables en même
  temps dans des worktrees distincts.
- **Sortie** : l'artefact vérifiable, pas une intention.
- **Difficulté** : repère du découpage initial ; les rôles actuels sont dans
  `AGENTS.md` et la feuille de route (Sol 6.1 pour l’UI/UX, Astra interdit).

---

## T1 — Validation de Planck et suite de conformité

Dépend de : rien. Parallèle avec : T4a.
Écrit dans : `test/conformance/`.
Difficulté : haute sur les deux scènes de validation, moyenne sur le reste.

Le moteur est tranché par l'ADR 0002 : Planck.js, décidé avant mesure. Cette
tranche ne choisit donc plus, elle vérifie et outille.

**Porte de validation, à faire en premier.** Les scènes 6 (création, reset et
destruction répétés) et 7 (scène dense au budget maximal provisoire), mesurées
sur Planck **et** sur Rapier pour rester comparables. Ce sont les deux seules
mesures comparatives. Un échec de l'une rouvre l'ADR 0002 ; le reste de la
tranche s'arrête tant que la porte n'est pas franchie.

**Puis la régression permanente.** Les scènes 1 à 5 et 8, écrites une fois contre
Planck seul. Sortie : suite de conformité verte, dépendance Rapier retirée du
dépôt, résultats des scènes 6 et 7 consignés dans l'ADR 0002.

Sous-tâches délégables : le protocole d'assertion commun d'abord, seul et
partagé ; ensuite une scène par agent. Les scènes 6 et 7 ne se délèguent pas en
même temps que les autres — elles conditionnent leur existence.

## T2 — Port physique, constantes des familles, boucle à pas fixe

Dépend de : T1. Parallèle avec : T4a.
Écrit dans : `src/simulation/`, `src/domain/`.
Difficulté : haute, pièges de déterminisme.

Port physique minimal dérivé des besoins des scènes de conformité, jamais de l'API
d'un candidat. Dimensions, masses, frictions et rebonds des familles
centralisés. Boucle à pas fixe sans horloge murale. Capteur de panier et évaluation
réelle de `goal.type === 'basket'`.

## T3 — Plateau Canvas 2D et niveau 1 jouable

Dépend de : T2.
Écrit dans : `src/presentation/`, `src/app/`.
Difficulté : moyenne.

Le renderer est tranché par l'ADR 0006 : Canvas 2D natif, sans bibliothèque. Il
n'y a plus de décision d'outil dans cette tranche.

Projection du niveau 1 « Laisser tomber » sur le plateau partagé, lancement,
reset exact, régression de simulation. Sortie : le niveau 1 est réellement
jouable.

Cette tranche porte aussi le pipeline d'assets, qui n'existe nulle part encore :
dimensions de référence des sprites, convention de nommage, chargement explicite
avant la première frame via `createImageBitmap`, mise à l'échelle par
`devicePixelRatio`. Les chemins de sprites appartiennent à la projection visuelle
de chaque famille, jamais au `LevelDocument`.

## T4a — Câblage tiroir ↔ tentative ↔ historique

Dépend de : rien (l'état applicatif existe déjà). Parallèle avec : T1, T2.
Écrit dans : `src/ui/`, `src/app/`.
Difficulté : moyenne.

Relier les cartes du bottom sheet à `ConstructionAttempt`, l'historique aux
boutons annuler/rétablir, et faire remonter les refus de commande en retour
utilisateur visible. Ne dépend pas de la physique : la scène peut rester non
simulée.

## T4b — Placement, déplacement, rotation au tactile

Dépend de : T3, T4a.
Écrit dans : `src/ui/`, `src/presentation/`, `e2e/`.
Difficulté : moyenne, forte densité de scénarios.

Gestes du plateau conformes à `mobile-editor-interactions.md`, y compris
l'annulation atomique sur `pointercancel`. Le niveau 2 est le premier parcours
d'inventaire complet.

## T5 — Niveaux 2 à 8

Dépend de : T4b, et des constantes physiques stabilisées par T2.
Écrit dans : `src/content/levels/`, `test/`.
Difficulté : basse par niveau, mais un niveau à la fois.

Un niveau par tranche, avec son JSON validé, sa solution de référence exécutable
et sa validation tactile. Ne pas écrire toute la campagne avant que les constantes
physiques soient figées.

## T6 — Mode auteur, persistance, partage, PWA

Dépend de : T4b.
Écrit dans : `src/ui/`, `src/infrastructure/`, `src/app/`.
Difficulté : moyenne à haute selon le sous-lot.

Sous-lots livrés : mode auteur sur le même plateau ; dépôts `localStorage`
(brouillons, progression, préférences, niveaux reçus, ADR 0011/0015 v1) ; import/export JSON ;
codec URL borné avec checksum ; service worker et stratégie de mise à jour
protégeant les brouillons.

La mention IndexedDB du découpage initial était une intention, pas l’adaptateur
livré. Le remplacement livré en C2a utilise IndexedDB/Dexie asynchrone, sans reprise
des anciennes données locales (amendements du 3 octobre des ADR 0011/0015).

---

## Dettes transverses du découpage initial — historique

Ces notes décrivent le début de T1–T6 ; elles ne sont pas un état actuel ni un
backlog actif. Les dettes réellement restantes sont dans `etat.md`.
Elles sont rattachables à la tâche qui les rencontre, jamais traitées en
refactoring isolé.

- Le test de zone utilise le centre du placement ; le confinement par forme
  complète est désormais possible (`family-geometry.ts`) : tâche L3.
- Aucune CI distante n'est configurée.
- Aucune matrice de téléphones physiques n'est validée.
