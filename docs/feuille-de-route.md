# Feuille de route active

Cette feuille fait seule autorité sur l’ordre du travail restant. L’état livré et
les dettes sont dans `etat.md`, les contrats techniques dans les ADR. Les anciens
journaux, plans préparatoires et todos ont été consolidés le 5 octobre 2026 ; leur
historique reste accessible dans Git, avant le commit de nettoyage.

## Point de reprise — 5 octobre 2026

Le core desktop v1 est validé par l’auteur. Les compléments C0–C9, les reprises
visuelles C4/C6, l’identité de l’accueil et des pages, les Paramètres, les sept
tutoriels et le stockage IndexedDB sont implémentés. Cela ne clôture pas C10 :
la recette visuelle de l’auteur reste attendue. C7d reste à faire.

Le lot indépendant commande de release → nettoyage documentaire → vérifications
est livré. La publication `0.2.0` attend une connexion GitHub ; elle ne rouvre
pas les anciens lots produit. `art/` est conservé intégralement.

## Règles de la reprise active

- Lire `index.md`, cette reprise et la tâche concernée, puis `AGENTS.md`.
  Suivre le routage ; ne pas charger les anciens journaux depuis Git pour coder.
- Une tâche et un propriétaire d’écriture à la fois. Un seul sous-agent actif,
  sans délégation imbriquée ; le même agent fait tests, code et corrections.
  L’orchestrateur reste responsable et peut réaliser les corrections locales.
- Sol 6.1 conduit la reprise et prend l’UI. Luna `xhigh` convient au mécanique ;
  choisir les autres modèles autorisés selon la difficulté. Astra est interdit.
- Red-Green-Refactor pour tout comportement ou bug. Tests ciblés au fil du
  travail, `pnpm check:fast` pour élargir, `pnpm check` avant clôture.
  Lire les scripts dans `package.json`. Build avant tout Playwright isolé.
- Décision dans son propriétaire avant code. Pas de nouvelle dépendance
  structurante sans décision ni d’interface nouvelle sans maquette acceptée.
- Un commit par lot validé, en français à l’impératif avec identifiant.
  Ne pousser que dans le périmètre de publication autorisé par l’auteur.
- Fournir et inspecter les captures concernées : 1440 × 900 et 1280 × 720
  pour desktop ; portrait/paysage pour v2. Garder « validation visuelle
  attendue » jusqu’à l’accord de l’auteur. Une recette différée ne vaut pas
  validation et ne rouvre pas les comportements déjà autorisés.
- Desktop d’abord jusqu’à M0. Les jalons produit v1/v2/v3 ne sont pas des
  numéros SemVer ni `LevelDocument.schemaVersion`.
- Préserver `tmp/check-levels.ts`, le fichier d’essai de l’auteur.
  Stocker les captures à conserver hors de `test-results/`, vidé par Playwright.
- Le journal de cette feuille contient les nouveaux lots, pas le récit du
  bootstrap. Consigner résultat, gate, commit, reports et prochaine étape ;
  laisser un résumé utile pour la reprise d’une autre session.

## Ordre restant

| Ordre | Lot | Dépendance et sortie |
| --- | --- | --- |
| 1 | C7d — Recherche et filtres de Mes niveaux | Identité C7c implémentée ; recherche et filtres testés. |
| 2 | C10 — Recette desktop | C7d et compléments ; validation visuelle auteur et gate. |
| 3 | M0–M4 — Téléphone et tablette | C10 ; gestes et maquettes acceptés, interfaces et recette. |
| 4 | F0–F3 — Forge et Grist | M4 ; migration d’hébergement et soumission vérifiée. |
| Réserve | Nouveaux objectifs (v4) | Contrats et migrations à décider ; pas de code anticipé. |

## Compléments desktop

### C7d — Recherche et filtre de Mes niveaux

- Sous le titre, recherche sur le titre et filtre « Tous / Créations / Reçus »
  sur une seule ligne à toutes les largeurs, suivant
  `maquettes/identite/mes-niveaux.html` et `niveaux.css`.
- Pas de tri : écarté par l’auteur le 5 octobre, à rouvrir seulement si utile.
- Tâche confiée à Luna par l’auteur ; tests et implémentation dans le même lot.

### C10 — Recette des compléments desktop

- Les reprises C4/C6 et de l’identité sont implémentées ; ne pas refaire ces
  lots sur la seule base des anciens todos. Valider leur état réel à l’œil.
- Rejouer fil direct et contrôleur → minuteur → dispositif (un fil logique,
  deux segments, transitions retardées), reprise locale, poutres, victoire
  et familles nouvelles dans un niveau partagé.
- Vérifier accueil, splash, icônes, Paramètres et résultat à 1440 × 900 et
  1280 × 720 ; fournir une recette actuelle, pas les captures du bootstrap.
- Demande conservée du todo du 5 octobre : examiner la poignée de taille en
  résolution quand la taille est fixée par l’inventaire ; la masquer si aucune
  action n’est possible. Vérifier le comportement avant toute correction.
- La proposition d’une scène maximale où l’on pose partout n’est pas un
  changement de contrat accepté. Discuter scène, zones et compréhension du
  cadrage avec l’auteur ; ne pas modifier le format sans décision et tests.
- **Sortie :** gate verte et validation de l’auteur, ou reports explicites.

## Séquence active — téléphone (v2)

### M0 — Fixer les interactions et valider les maquettes

- Priorité : **poser → tourner/ajuster → lancer**, avec un plateau dégagé.
  Annuler, supprimer/retirer, caméra et propriétés restent accessibles.
- Reporter les décisions confirmées dans `mobile-editor-interactions.md` :
  la sélection et l’ouverture des propriétés deviennent deux états distincts.
  Remplacer les passages qui feraient ouvrir le panneau à la pose ou au drag.
- Faire des maquettes portrait et paysage avec les vrais sprites ; vérifier
  aussi un niveau comportant plusieurs commandes et un fil de commande.
- Proposer également la tablette en portrait et paysage ; ne pas décider
  seul de sa disposition. Rendre visible le tiroir d’objets au premier lancement,
  et discuter un mini-tutoriel avec Bolt avec l’auteur.
- Réévaluer l’encombrement de l’inspecteur, des commandes caméra et des blocs
  horizontaux ; la liste des objets desktop a déjà été retirée.
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

## Arbitrage ouvert

**Q8 :** mécanisme de soumission réellement disponible sur l’instance Grist de
la Forge, éventuel relais et hébergement. F1 le fixe avant F2.

## Journal des lots de maintenance

### OUT1 — Changelog et versionnement — livré — `9f4ec8f`

Version de `package.json`, changelog français, `release:check` et version/SHA
à propos. Rouge initial du contrôle absent, puis tests verts. Gate du 5 octobre :
1 395 tests Vitest et 103 E2E v1. Captures inspectées dans
`tmp/versioning/captures/` ; validation visuelle auteur attendue.

### OUT2 — Automatiser les releases — livré — `1c4b698` — 5 octobre 2026

Luna `xhigh` ajoute `pnpm release X.Y.Z` et `--dry-run`, sans dépendance.
Tests rouges : module de release absent et `tmp/` non ignoré par ESLint, puis
verts. La commande prépare version et notes, lance `check`, crée commit/tag,
pousse atomiquement `main` et tag, puis crée la GitHub Release. Préconditions
avant mutation ; restauration avant commit et diagnostics de reprise après.
`check:fast` : 1 406 tests verts ; formatage, Knip, contrôle et aperçu verts.
Le scratch de l’auteur est inchangé et `tmp/` est exclu du lint/formatage.
Gate intégrée finale : 1 406 Vitest, huit documents, build et 103 E2E v1.

### OUT3 — Nettoyer la documentation — livré — 5 octobre 2026

Nettoyage demandé par l’auteur après OUT2, avant publication de `0.2.0`.
131 fichiers (environ 51,5 Mio) : anciens journaux, plans, todos, progression
de prototype et maquettes/captures des lots clos retirés après consolidation
de leurs demandes ouvertes.
ADR, guides, idées de niveaux et maquette d’identité utile à C7d conservés.
Les propositions Gemini/Astra/Canary ont été rétablies à l’identique à la
demande de l’auteur et restent pour mémoire. L’état, l’index et la feuille
sont raccourcis ; exemples obsolètes corrigés et références raccordées.
`art/` : 91 fichiers et permissions identiques au manifeste avant nettoyage.
La publication nécessite une connexion GitHub, absente dans cet environnement.
Gate finale verte : `/tmp/tinkerbolt-release-cleanup-check.log`. Aucun lien
Markdown local cassé ; dix fichiers TS/TSX ne diffèrent que par les commentaires,
avec JavaScript émis identique. Aperçu réel de `0.2.0` vert, notes prêtes ;
aucun tag ni push avant la connexion GitHub.
