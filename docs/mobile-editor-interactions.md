# Interactions mobiles du plateau et de l'éditeur

Note du 2 octobre 2026 : ce document est la référence de la v2 (UI/UX téléphone).
La v1 est desktop d'abord (voir `AGENTS.md` § Mobile-first).

Statut : spécification fonctionnelle initiale. Les seuils marqués comme devant être
validés sur appareil restent provisoires ; ils ne doivent pas être dispersés dans
le code.

## Portée

Ce document définit le langage d'interaction commun à la résolution et à la
création de niveaux. Il ne fixe ni le style graphique, ni les animations, ni la
forme exacte des icônes. Un état fonctionnel doit toujours rester compréhensible
sans dépendre d'une couleur, d'une texture ou d'un effet sonore particulier.

Les deux modes utilisent le même plateau, les mêmes gestes et les mêmes commandes
de document. Ils diffèrent uniquement par leurs permissions et les panneaux
disponibles :

- en résolution, le joueur ne voit que son inventaire et ne modifie que les objets
  autorisés par le niveau ;
- en création, l'auteur accède au catalogue, aux propriétés du niveau, à
  l'inventaire, aux objectifs et aux permissions du futur joueur ;
- un aperçu « comme joueur » dans l'éditeur applique les permissions du mode
  résolution sans créer un second plateau.

La priorité initiale est la manipulation fiable de la balle, du panier, des trois
tailles de poutre et de la bascule. Aucune interaction n'anticipe les connexions,
les objets complexes ou un système de plugins.

## Principes d'interaction

- Toute action essentielle possède un contrôle visible. Le multi-touch, le double
  toucher et l'appui long peuvent améliorer le confort, mais ne sont jamais
  indispensables.
- Une action sur le document est soit validée en entier, soit ignorée en entier.
- Une manipulation continue ne produit qu'une commande dans l'historique.
- La navigation de la caméra, la sélection et l'ouverture d'un tiroir ne modifient
  pas le document et ne créent aucune entrée d'historique.
- Pendant la construction, les objets dynamiques ne sont pas simulés.
- Pendant une simulation, aucune modification du document n'est possible, même
  lorsque la simulation est en pause.
- Une action interdite explique immédiatement pourquoi elle est refusée.
- Les libellés, annonces accessibles et zones tactiles font partie du contrat ;
  ils ne sont pas reportés à la phase de direction artistique.

## Organisation de l'écran

Le plateau occupe tout l'espace restant après les contrôles indispensables. Les
overlays ne doivent pas masquer durablement la zone où l'utilisateur agit.

En phase de construction, l'interface comporte au minimum :

- un accès à l'objectif ou aux propriétés du niveau selon le mode ;
- une barre d'actions avec annuler, rétablir et tester ;
- un contrôle de cadrage donnant accès à zoom avant, zoom arrière et ajuster à la
  scène ;
- un tiroir d'objets ;
- une action accessible pour ouvrir les propriétés de l'objet sélectionné ; le
  panneau contextuel ne s'affiche que sur demande.

En simulation, le tiroir et les contrôles d'édition disparaissent ou sont
désactivés. Ils sont remplacés par pause ou reprendre et recommencer. Les
contrôles de caméra restent disponibles.

Quand le plateau compte plusieurs balles, la balle de l'objectif garde ses
sprites rouges et les autres leurs sprites bleus, sans anneau ajouté (ADR 0006,
amendement du 2 octobre 2026). L'objectif dit : « Seule la balle rouge compte. »
Une balle sélectionnée est identifiée par son nom et un signal visuel de
sélection ; son panneau contextuel ne s'ouvre qu'à la demande, sans cadre
rectangulaire autour du sprite.

Sur le niveau 1 de la campagne, tant qu'il n'est pas résolu, une aide brève
oriente le premier essai (U8) : « Touche « Lancer » pour voir la machine
tourner. », puis, de retour en construction après un lancer, « Prends un objet
dans le catalogue, pose-le sur le plateau, puis touche « Lancer ». ». Elle
occupe l'emplacement réservé au résultat et aux propriétés, jamais le plateau
ni la barre d'actions ; elle se tait pendant la simulation ; un toucher sur
« Masquer l'aide » ou la première pose la retire pour de bon (préférence
locale, ADR 0011).

Quand une nouvelle version de l’application attend (U10, ADR 0012), une carte
discrète « Nouvelle version disponible. » propose « Mettre à jour » et une
croix « Plus tard ». Sur le plateau, elle occupe le même emplacement réservé que
l’aide, se tait pendant la simulation et pendant un geste, et n’apparaît que
tant qu’aucune commande n’a été validée sur ce plateau (le rechargement ne doit
rien perdre) ; elle est aussi en tête de l’accueil. Rien ne recharge sans le
toucher « Mettre à jour ». Quand le navigateur permet l’installation
(`beforeinstallprompt`, Chrome sur Android), l’accueil seul montre « Installe
TinkerBolt pour le retrouver comme une application, même hors ligne. » avec
« Installer » et une croix « Ne pas installer » ; un refus est retenu
(préférence locale). Ailleurs, par exemple sur iOS, rien n’est montré.

En portrait sur téléphone, le catalogue est un tiroir bas avec au moins deux
positions : replié et ouvert. En paysage, l'hypothèse initiale est un tiroir
latéral afin de conserver la hauteur du plateau. Le contenu, l'ordre de focus et
les actions restent identiques dans les deux orientations.

Les barres respectent les safe areas du système. Un contrôle essentiel ne doit pas
être placé sous une encoche, un indicateur d'accueil ou une zone réservée aux
gestes du navigateur.

**À valider sur appareil :** hauteur des positions du tiroir, choix du côté en
paysage, espace réel laissé au plateau avec une police agrandie et accessibilité
des actions principales au pouce.

## Navigation du plateau

### Panoramique

- Glisser avec un doigt depuis une zone vide déplace la caméra.
- Glisser depuis un objet manipulable déplace cet objet et non la caméra.
- Glisser depuis un objet non manipulable sélectionne l'objet mais ne déplace ni
  l'objet ni la caméra. Un retour explique la restriction.
- La caméra reste bornée de sorte qu'une partie utile du monde ne puisse pas être
  perdue sans moyen visible de la retrouver.
- Le bouton « Ajuster à la scène » restaure toujours un cadrage utilisable.

Il n'y a pas d'auto-pan au bord de l'écran dans l'interaction initiale. Pour
déplacer un objet sur une longue distance, l'utilisateur cadre ou dézoome d'abord,
puis le déplace. Ce choix doit être réouvert si les tests montrent qu'il rend la
création pénible.

### Zoom

- Pincer avec deux doigts zoome autour du point situé entre les doigts et permet
  simultanément de translater la caméra.
- Les boutons zoom avant, zoom arrière et ajuster à la scène offrent une
  alternative complète au pincement.
- Le zoom a des bornes communes aux deux modes. Elles garantissent que les objets
  restent manipulables au maximum et que le niveau reste retrouvable au minimum.
- La taille des poignées et des contrôles tactiles reste exprimée en pixels CSS ;
  elle ne diminue pas avec le zoom du monde.

Si un second doigt touche le plateau pendant un déplacement ou une rotation en
cours, la manipulation d'objet est annulée et revient à son état de départ. Les
deux doigts contrôlent alors la caméra. Aucune commande n'est ajoutée.

Le navigateur ne doit pas faire défiler ou zoomer la page lorsqu'un geste a
commencé dans le plateau. Les zones DOM hors plateau conservent leur comportement
de défilement normal.

**À valider sur appareil :** seuil distinguant toucher et glisser, vitesse du
panoramique, courbe de zoom, bornes de zoom et comportement de l'annulation lors
de l'ajout du second doigt, notamment sous iOS Safari.

## Sélection et panneau contextuel

- Toucher un objet le sélectionne.
- Commencer à glisser un objet manipulable peut le sélectionner et le déplacer en
  un seul geste.
- Toucher une zone vide sans glisser désélectionne l'objet courant.
- Un seul objet visible est sélectionné à la fois dans le périmètre initial.
- La sélection est signalée par au moins deux moyens parmi contour, poignées,
  libellé et panneau contextuel ; la couleur seule ne suffit pas.
- Les composants internes d'une bascule ne sont jamais sélectionnables. La
  bascule est une seule cible.
- Si plusieurs objets occupent la zone touchée, la priorité de hit-test est
  déterministe. Une action visible « Autres objets ici » donne accès à la liste
  des candidats ; des touchers répétés ou un appui long ne sont pas l'unique moyen
  de les atteindre.

Le panneau contextuel affiche le nom accessible de l'objet, les actions permises
et l'état verrouillé éventuel. En résolution, il peut proposer retirer pour un
objet issu de l'inventaire. En création, il propose au minimum supprimer,
dupliquer lorsque permis, et les propriétés exposées par la famille.

### Amendement C4a — dissocier sélection et ouverture des propriétés

Décision auteur du 4 octobre 2026, applicable dès C4a sur desktop et réutilisée
par M1 au toucher : l'identifiant de l'objet sélectionné et la visibilité du
panneau sont deux états distincts.

- Une nouvelle session commence sans objet sélectionné et avec les propriétés
  fermées, en résolution comme en création. Sur desktop, les deux formats
  gardent le panneau fermé jusqu'à une action explicite.
- Un clic ou toucher simple sélectionne l'objet et ouvre ses propriétés après
  le relâchement. Une commande clavier équivalente reste disponible.
- Poser, déplacer, tourner ou redimensionner sélectionne l'objet concerné sans
  ouvrir les propriétés. Un clic synthétique après un drag n'est pas un clic
  simple et ne les ouvre pas. Un geste interrompu ne les ouvre pas non plus.
- Toucher une zone vide désélectionne l'objet et ferme ses propriétés. La
  visibilité déjà choisie reste inchangée pendant un geste d'objet ; le geste
  lui-même ne commande jamais l'ouverture.
- Une liste accessible « Objets sur le plateau » permet au clavier de choisir
  un objet et d'ouvrir ses propriétés. Lorsque le panneau est fermé, le bouton
  « Ouvrir les propriétés » reste visible et activable au clavier. Chaque
  présentation du panneau fournit une action de fermeture.
- M1 vérifie ces mêmes règles sur téléphone, y compris le relâchement tactile,
  les drags et les clics synthétiques du navigateur. Il n'ajoute pas une règle
  mobile différente.

Supprimer ou retirer est une commande annulable. Retirer un objet placé depuis
l'inventaire restitue atomiquement la quantité correspondante. Une confirmation
modale n'est pas requise pour une action immédiatement annulable ; l'interface
annonce l'action et rend « Annuler » accessible.

## Déplacement d'un objet

1. Le contact commence sur la surface ou la zone tactile élargie de l'objet.
2. Avant le seuil de glissement, l'action reste un toucher de sélection.
3. Après le seuil, une projection temporaire suit le doigt sans modifier le
   `LevelDocument`.
4. Le relâchement dans une position valide produit une seule commande de
   déplacement.
5. Le relâchement dans une position invalide restaure exactement la transformée de
   départ, explique l'erreur et ne modifie pas l'historique.
6. `pointercancel`, la perte de focus, un changement d'orientation ou l'arrivée
   d'un second pointeur annule de la même façon la projection temporaire.

Hors de toute zone de construction, la projection continue de suivre le doigt :
l'objet est dessiné comme le fantôme de placement refusé (plus pâle, entouré de
tirets rouges, sans cadre de sélection ; la poignée de rotation reste). Rien n'est
annoncé pendant le geste ; au relâchement hors zone, l'objet revient à sa
position de départ et un seul message de refus est affiché pour tout le geste.
Un geste accepté efface le message d'un refus précédent. Une rotation qui fait
sortir l'empreinte de la zone suit la même règle.

En résolution, pendant la construction, les zones de construction qui
restreignent la pose sont dessinées sur le plateau (teinte bleue légère, contour
en tirets), toutes quand il y en a plusieurs ; aucune quand une zone couvre la
scène entière, ni en création, ni pendant la simulation.

La validité tient compte des permissions et de la zone de construction. Le simple
chevauchement de deux formes physiques n'est pas déclaré invalide par ce document :
si une règle de niveau doit l'interdire, elle devra être explicite et testée.

Il n'y a pas de snapping de position obligatoire au départ. Une grille ne sera
ajoutée qu'après avoir observé un besoin réel.

## Rotation

- Un objet rotatable sélectionné affiche une poignée de rotation explicite,
  séparée de sa zone de déplacement.
- Glisser cette poignée affiche une prévisualisation ; le relâchement valide une
  seule commande de rotation.
- Deux boutons accessibles, rotation négative et rotation positive, fournissent
  une alternative au geste et appliquent le pas courant.
- En résolution, une poutre utilise le snapping configuré pour le jeu.
- En création, l'auteur peut choisir snapping ou angle libre. Le mode courant est
  visible dans le panneau contextuel.
- Le panier n'affiche pas de rotation tant qu'un besoin de niveau ne l'a pas
  rendue disponible.
- La bascule tourne selon sa simulation interne, mais l'ensemble n'a pas de
  commande de rotation dans le catalogue initial.

Une rotation invalide ou annulée revient à l'angle de départ sans entrée
d'historique. Les angles de snapping et la taille ou distance de la poignée sont
des constantes centralisées.

**À valider sur appareil :** pas de snapping, hystérésis autour d'un angle,
distance de la poignée, précision du mode libre et facilité d'utilisation avec le
doigt qui masque partiellement l'objet.

## Tiroir d'objets et placement

Le tiroir est un composant commun avec un contenu déterminé par la session :

- en résolution, il montre uniquement les entrées disponibles et leur quantité ;
- en création, il montre le catalogue autorisé et donne accès à la configuration
  de l'inventaire du futur joueur ;
- la recherche filtre sur le nom et les synonymes accessibles ;
- « Tous », « Récents » et les catégories fournies par les métadonnées du
  catalogue peuvent filtrer la liste ; les filtres sans utilité pour le petit
  inventaire d'un niveau sont masqués ;
- la recherche, les filtres et le défilement du tiroir ne déplacent jamais le
  plateau.

Le placement principal ne repose pas sur un glisser depuis le tiroir :

1. toucher une entrée active le mode placement ;
2. le tiroir se replie suffisamment pour rendre le plateau accessible ;
3. toucher ou toucher-glisser dans le plateau positionne une prévisualisation ;
4. relâcher dans une position valide crée l'objet, le sélectionne et décompte
   l'inventaire dans une seule commande ;
5. annuler ou revenir au tiroir quitte le mode sans consommer l'inventaire.

Une entrée dont la quantité est nulle reste identifiable mais ne peut pas activer
le placement. Le motif du refus est annoncé. Si une position invalide est choisie
pour un nouvel objet, le mode placement reste actif pour permettre une nouvelle
tentative ; une action annuler explicite demeure visible.

Le glisser direct d'une carte du tiroir vers le plateau est hors du comportement
requis initial. Il pourra être ajouté comme raccourci sans remplacer le parcours
ci-dessus.

### Tailles de poutre

La poutre reste une seule famille avec une propriété de taille énumérée. Courte,
moyenne et longue sont présentées comme trois variantes clairement nommées et
visuellement comparables :

- en résolution, chaque taille autorisée est une entrée d'inventaire distincte
  avec sa propre quantité ;
- en création, choisir poutre demande de choisir l'un des trois presets avant le
  placement ;
- changer la taille d'une poutre existante, lorsque le mode le permet, remplace la
  propriété énumérée par une commande atomique ;
- aucune poignée de redimensionnement continu n'est affichée.

### Fil de commande

En création seulement, le tiroir porte une carte **Fil** (jamais en
résolution : le joueur ne câble rien). Le geste suit le placement, sans survol,
clic droit ni clavier :

1. toucher la carte **Fil** replie le tiroir et désélectionne l'objet courant ;
   un guidage au-dessus du plateau dit « Touchez un levier ou un bouton » ;
2. toucher la source, qui est sélectionnée sans ouvrir l'inspecteur compact ;
   le guidage devient « Touchez l'appareil à commander » ;
3. toucher un convoyeur, un ventilateur ou une barrière crée le fil par une
   commande annulable ;
4. le geste reste sur la même source, pour qu'elle commande d'autres appareils
   d'affilée, jusqu'à **Terminer les fils** ; avant le premier fil, la même
   commande s'appelle **Annuler le fil**.

Un refus (source qui ne commande rien, bouton vers un convoyeur, appareil déjà
commandé) s'affiche dans le guidage, avec la règle du domaine, et le geste
reste à la même étape. Toucher le plateau vide ne quitte pas le geste : un
doigt déplace la vue, deux doigts zooment. Choisir une autre carte ou lancer le
test quitte le geste. Un fil se délie depuis le panneau « Propriétés » de sa
source ou de son appareil (**Délier**).

## Objets verrouillés et permissions

Chaque placement et chaque entrée d'inventaire persistante déclare les trois
permissions `move`, `rotate` et `remove`. En résolution, un objet dont les trois
sont `false` est présenté comme « Verrouillé par ce niveau », tout en restant
sélectionnable afin que son rôle soit compréhensible. Une permission absente
n'existe pas dans le format v1 : elle est toujours explicitement vraie ou fausse.

En résolution :

- il n'affiche aucune poignée correspondant à une action interdite ;
- un glisser est refusé lorsque `move` est `false` et ne devient pas
  silencieusement un panoramique ;
- le panneau indique l'état verrouillé lorsque les trois permissions sont fausses,
  ou les actions particulières indisponibles dans les autres cas ;
- une tentative de modification produit un retour bref, visible et annoncé aux
  technologies d'assistance.

Dans l'éditeur de création, le triplet de permissions persistant définit les
actions du futur joueur. Il n'empêche pas l'auteur de modifier l'objet. Le mode
d'aperçu « comme joueur » applique en revanche ces permissions, sans introduire un
second mécanisme de verrouillage propre à l'outil d'auteur.

Des restrictions comme déplacement autorisé mais rotation interdite suivent la même
règle : seules les poignées permises sont visibles et les commandes sont refusées
par la couche application, pas seulement par l'UI.

## Annuler et rétablir

- Annuler et rétablir restent visibles en construction et indiquent leur état
  indisponible sans disparaître.
- Placement, retrait, suppression, duplication, déplacement, rotation et
  modification d'une propriété produisent chacun une commande atomique.
- Un glisser de deux secondes ne produit qu'une entrée.
- Une commande annulée peut être rétablie. Une nouvelle commande après annulation
  vide la branche de rétablissement.
- Une commande refusée ou une projection annulée n'apparaît jamais dans
  l'historique.
- Annuler un placement restaure aussi l'inventaire ; rétablir le redécompte.
- Le lancement, la pause, le cadrage et le reset de simulation ne font pas partie
  de l'historique du document.

Pendant une simulation, annuler et rétablir sont inaccessibles. Recommencer
revient en construction avec l'historique exactement tel qu'il était avant le
test.

## Lancer, mettre en pause et recommencer

Vocabulaire (décision de l'auteur, 26 septembre 2026) :

- **Recommencer** : quitter la simulation et retrouver exactement la construction
  d'avant le lancement. Rien n'est perdu, donc aucune confirmation. Une seule
  commande « Recommencer » est visible à un instant donné, même quand le panneau
  de résultat est affiché.
- **Remettre à zéro** : effacer la construction pour revenir au document de départ
  (niveau ou atelier vide). C'est destructif : l'action exige toujours une boîte
  de dialogue de confirmation qui dit ce qui sera perdu, avec « Annuler » comme
  action par défaut. Elle n'apparaît jamais à côté de « Recommencer » ni dans les
  contrôles de simulation.
- En résolution, pendant la construction d’un puzzle, ce reset destructif est
  présenté sous le libellé « Recommencer le niveau ». Il ne doit pas être confondu
  avec « Recommencer » après le lancement, qui conserve la construction d’avant test.
- Le mot « Réinitialiser » n'est plus employé dans l'interface.
- **Lancer** (décision de l'auteur, 1er octobre 2026, ex-« Tester ») : démarre la
  simulation de la machine. Dans l'atelier, **Essayer en joueur** (ex-« Jouer »)
  ouvre le puzzle tel que le joueur le verra, objets à placer dans le tiroir. Les
  deux libellés doivent se distinguer sans essai.

Les phases forment l'automate suivant :

```text
construction --lancer--> simulation en cours
simulation en cours --pause--> simulation en pause
simulation en pause --reprendre--> simulation en cours
simulation en cours ou en pause --recommencer--> construction
simulation en cours --objectif atteint--> resultat
resultat --recommencer--> construction
```

Lancer valide d'abord le document. Une erreur bloquante empêche le lancement,
ouvre le panneau pertinent et place le focus sur la première erreur. Un
avertissement non bloquant permet le test.

Au lancement, la simulation est créée depuis un snapshot du document. Le tiroir
se ferme, la sélection d'édition est conservée dans `EditorSession` mais ses
poignées disparaissent. Pause fige seulement la simulation : elle ne permet pas de
modifier un objet. Recommencer détruit l'état physique et restitue exactement la
construction précédant le lancement, y compris transformées et inventaire.

Quand l'objectif est atteint, la physique se fige et un panneau de résultat est
annoncé. En campagne il propose au minimum niveau suivant et réessayer. En création
il propose retour à l'édition. Examiner la scène reste possible avec les contrôles
de caméra, sans rendre les objets éditables.

## États de session

`EditorSession` porte les informations éphémères nécessaires à l'interface sans les
sérialiser dans le niveau :

- mode `resolution` ou `creation` ;
- phase `construction`, `running`, `paused` ou `result` ;
- objet sélectionné, outil de placement et projection temporaire éventuelle ;
- ouverture du tiroir, filtre, recherche et panneau contextuel ;
- caméra en unités du monde et zoom ;
- historique undo/redo ;
- statut du brouillon `unchanged`, `dirty`, `saving` ou `save-error` ;
- référence au snapshot utilisé par la simulation courante.

Une seule manipulation modale peut être active à la fois : placement, déplacement,
rotation, navigation multi-touch ou dialogue. Entrer dans une autre manipulation
annule proprement la projection non validée de la précédente.

En création, toute commande valide marque le brouillon comme modifié puis déclenche
l'autosauvegarde. Un échec ne supprime ni le brouillon en mémoire ni l'historique ;
il reste visible jusqu'à réussite ou action de l'utilisateur. En résolution, la
source de campagne n'est jamais modifiée : la construction de la tentative réside
dans la session.

Quitter une session de création avec un échec de sauvegarde requiert une
confirmation explicite. Un changement d'orientation, une mise en arrière-plan ou
une installation de mise à jour ne constitue pas une sortie volontaire et doit
préserver le brouillon.

## Erreurs et retours utilisateur

Un retour d'erreur combine, selon le contexte :

- un marqueur proche de l'objet ou du champ concerné ;
- un message bref dans une zone stable qui ne masque pas l'action ;
- une annonce `aria-live` adaptée, sans répétition à chaque mouvement ;
- une action concrète telle que annuler, réessayer ou ouvrir le champ fautif.

La couleur, le son et la vibration ne sont jamais les seuls signaux. Une vibration
légère peut accompagner un snapping ou un refus sur les appareils compatibles,
mais elle est optionnelle et respecte les préférences de l'utilisateur.

Les erreurs attendues incluent au minimum : action interdite, position hors zone,
inventaire épuisé, document invalide, échec de sauvegarde et impossibilité de
charger une session. Les erreurs d'import et de partage sont traitées en dehors du
plateau et ne remplacent jamais le brouillon courant.

## Accessibilité tactile et alternatives

- Toute cible tactile interactive mesure au moins 44 x 44 pixels CSS, quitte à
  posséder une zone de hit-test plus grande que sa représentation.
- Deux cibles distinctes sont espacées suffisamment pour limiter les activations
  accidentelles ; les poignées ne se superposent pas aux contrôles du système.
- Aucune action essentielle ne dépend d'un appui long, d'un geste rapide, du hover,
  du clic droit ou de plusieurs doigts.
- Les boutons de zoom, les boutons de rotation et les contrôles de position du
  panneau contextuel offrent des alternatives aux gestes. Les contrôles de
  position permettent au minimum un déplacement par pas dans quatre directions.
- Les contrôles DOM ont un nom accessible, un état et un ordre de focus stables.
- Le panneau contextuel et une liste DOM de la scène permettent de sélectionner un
  objet sans devoir viser son rendu dans le canvas.
- Les changements de sélection, les refus, le lancement, la pause, le reset et la
  réussite sont annoncés sans annoncer chaque image de simulation.
- L'interface reste utilisable avec une taille de texte augmentée et ne bloque pas
  le zoom d'accessibilité du navigateur hors du plateau.
- `prefers-reduced-motion` supprime les transitions non indispensables ; aucune
  information ne dépend d'une animation.
- Les raccourcis clavier et la souris sont des améliorations, jamais la seule voie
  vers une commande.

Les dimensions physiques d'une cible tactile varient selon la densité et le
navigateur. Le minimum CSS doit donc être vérifié par des essais humains, et pas
seulement par une assertion de style.

## Portrait, paysage et changements de viewport

- Les deux orientations prennent en charge toutes les fonctions de résolution et
  de création.
- Changer d'orientation conserve document, historique, sélection, phase et centre
  de caméra en coordonnées du monde.
- Une manipulation tactile en cours est annulée avant le recalcul du layout.
- Le nouveau cadrage garde si possible l'objet sélectionné visible ; « Ajuster à
  la scène » offre toujours une issue.
- Le tiroir peut changer de bord et de taille sans perdre recherche, filtre ou
  choix de variante.
- L'apparition du clavier virtuel pour la recherche ou une propriété ne doit ni
  déplacer un objet ni redimensionner définitivement le canvas.

**À valider sur appareil :** rotation avec clavier virtuel ouvert, changements de
viewport liés aux barres d'adresse mobiles, préservation du centre de caméra et
ergonomie du tiroir latéral sur un téléphone court en paysage.

## Scénarios d'acceptation

Les scénarios critiques sont automatisés au niveau le plus bas pertinent puis
rejoués dans un navigateur avec au moins un viewport de téléphone. Ceux marqués
`APPAREIL` exigent aussi une vérification sur un téléphone physique de la matrice
supportée.

1. **Sélection et déplacement.** Étant donné une poutre déplaçable, quand le joueur
   la touche puis la glisse vers une position valide, alors elle est sélectionnée,
   sa position est modifiée et une seule commande apparaît dans l'historique.
2. **Panoramique sans mutation.** Quand le joueur glisse depuis une zone vide,
   alors seule la caméra se déplace et le document ainsi que l'historique restent
   identiques.
3. **Conflit multi-touch.** Étant donné un déplacement d'objet non relâché, quand un
   second doigt touche le plateau, alors l'objet revient à sa position initiale,
   aucune commande n'est créée et les deux doigts naviguent dans la caméra.
4. **Alternative au pincement.** Étant donné un utilisateur n'employant qu'un
   doigt, quand il utilise zoom avant, zoom arrière et ajuster à la scène, alors il
   peut atteindre le même domaine de cadrage qu'avec le pincement.
5. **Placement depuis le tiroir.** Étant donné une poutre courte disponible en
   quantité un, quand le joueur la choisit puis la place, alors une poutre avec la
   propriété `short` est créée, sélectionnée, et la quantité devient zéro dans la
   même commande.
6. **Placement invalide.** Quand le joueur relâche un nouvel objet hors de la zone
   de construction, alors aucun placement n'est créé, l'inventaire ne change pas,
   le mode placement reste actif et la raison est annoncée.
7. **Tailles de poutre.** Étant donné les trois tailles autorisées, quand le joueur
   filtre ou parcourt le tiroir, alors courte, moyenne et longue restent une seule
   famille mais ont des quantités et des choix distincts.
8. **Rotation.** Quand une poignée de rotation est glissée à travers plusieurs
   angles de snapping puis relâchée, alors seul l'angle final produit une commande ;
   annuler restaure exactement l'angle initial.
9. **Objet verrouillé.** Étant donné une poutre dont `move`, `rotate` et `remove`
   sont tous à `false` en résolution, quand le joueur tente de la glisser, alors
   elle est sélectionnée mais ne bouge pas, la caméra ne bouge pas, aucune commande
   n'est créée et la restriction est annoncée.
10. **Permissions d'auteur.** Étant donné le même document ouvert en création,
    quand l'auteur sélectionne cet objet, alors il peut le modifier et changer le
    triplet de permissions ; l'aperçu comme joueur applique ensuite ces
    restrictions.
11. **Undo, redo et inventaire.** Après placement puis déplacement d'une poutre,
    deux annulations restaurent d'abord sa position puis la retirent en rendant la
    quantité ; deux rétablissements reproduisent les deux actions.
12. **Snapshot de test.** Étant donné une construction modifiée, quand la simulation
    est lancée puis réinitialisée après mouvement de la balle et de la bascule,
    alors le document, l'inventaire et l'historique correspondent exactement à
    l'instant précédant le lancement.
13. **Pause non éditable.** Quand la simulation est mise en pause, alors la
    physique cesse d'avancer mais aucun objet ni propriété ne devient éditable.
14. **Validation avant test.** Étant donné un niveau auteur invalide, quand tester
    est activé, alors aucune simulation n'est créée, la première erreur est visible
    et annoncée, et le brouillon reste intact.
15. **Résultat.** Quand la balle cible satisfait l'objectif du panier, alors la
    simulation entre en phase résultat une seule fois, annonce la réussite et offre
    les actions adaptées au mode.
16. **Changement d'orientation.** Étant donné une poutre sélectionnée et un tiroir
    filtré, quand le téléphone passe de portrait à paysage, alors la manipulation
    en cours est annulée, la sélection et le filtre sont conservés et la poutre
    reste retrouvable. `APPAREIL`
17. **Cibles tactiles.** Sur le plus petit viewport supporté, toutes les actions
    essentielles et poignées offrent une cible d'au moins 44 x 44 pixels CSS sans
    chevauchement bloquant. `APPAREIL`
18. **Interférences navigateur.** Panoramiquer, pincer, ouvrir le tiroir et utiliser
    une poignée près des bords ne déclenche ni scroll de page, ni retour système
    involontaire, ni perte de commande. `APPAREIL`
19. **Accessibilité sans geste complexe.** Avec les contrôles DOM uniquement, un
    utilisateur peut sélectionner une poutre dans la liste de scène, la déplacer
    par pas, la faire pivoter, ajuster le cadrage, tester, mettre en pause et
    réinitialiser.
20. **Échec d'autosauvegarde.** Quand une sauvegarde échoue après une commande de
    création, alors le brouillon et l'historique restent disponibles, l'erreur est
    persistante et quitter demande confirmation.
21. **Recevoir, jouer, remixer, partager.** Étant donné la page « Mes niveaux »
    (ADR 0015) et un fichier de niveau valide en forme puzzle, quand le joueur
    touche « Importer un fichier » et le choisit, alors il reste sur la page, un
    statut dit « « <titre> » est dans tes niveaux reçus. » et une carte apparaît
    dans « Niveaux reçus » avec « Pas encore résolu », la description et
    l'attribution (« par <auteur> », « d'après <titre> (par <auteur>) »), en
    texte brut. Recevoir à nouveau le même document, par fichier ou par lien, ne
    crée pas de seconde carte : il la remet en tête sans changer la résolution,
    le record ni la solution du joueur. Un atelier (objet ou fil « à placer »)
    est refusé avec un message, sans carte. Ensuite :
    - quand il touche « Jouer » sur la carte, alors `/my-levels/:id/play` ouvre
      le niveau en mode joueur, l'en-tête montre l'attribution et un bouton
      « Mes niveaux » ramène à la liste ; si le stockage a refusé l'écriture,
      l'import affiche une alerte et « Jouer quand même » joue sur place, avec le
      statut discret « Ce niveau n’a pas été gardé sur cet appareil. », sans
      rien enregistrer, victoire comprise ;
    - quand il pose ses objets et touche « Lancer » et que la machine gagne,
      alors la boîte « Bravo ! » n'offre que le palier « Résolu », avec
      « Recommencer », « Voir la scène » et « Remixer », sans « Niveau suivant »,
      et la carte devient « Résolu » avec le meilleur nombre d'objets ;
    - quand il touche « Remixer », alors une nouvelle création `creation-<aléa>`
      s'ouvre dans l'atelier (`/editor?draft=<id>`), titrée « <titre> (remix) »,
      sans `author`, avec le niveau d'origine dans `basedOn`, et la tentative
      gagnante posée en objets « à placer » ; le niveau reçu n'est pas modifié ;
      glisser un de ces objets au doigt produit une seule entrée d'historique,
      enregistrée dans la création ;
    - quand il touche « Exporter le niveau », alors la boîte vérifie le puzzle
      (« Puzzle vérifié ») et propose « Nom du niveau », « Description
      (facultatif) » et « Pseudo (facultatif) » (aide « Un pseudo, pas ton vrai
      nom »), avec la mention de licence CC BY 4.0 (ADR 0016) ; un pseudo refusé
      par le schéma est dit sous le champ (`role="alert"`) et désactive
      « Télécharger le fichier » et « Copier le lien de partage » ; sinon le
      fichier et le lien portent le nom, la description et le pseudo saisis,
      espaces de bord retirés, un champ vidé retirant la valeur, `basedOn`
      transmis tel quel ; le pseudo est retenu et préremplit l'export suivant,
      même après rechargement ; avec le clavier virtuel ouvert (390 × 508), le
      champ saisi et « Télécharger le fichier » restent visibles ;
    - toutes ces actions s'achèvent au toucher, sans survol ni clic droit, et
      leurs cibles mesurent au moins 44 x 44 pixels CSS. `APPAREIL` pour le
      clavier virtuel.
22. **Révéler la solution de l'auteur.** Étant donné l'atelier d'une création
    dont la `source` porte une solution (par exemple un remix de niveau reçu), en
    phase de construction, quand le joueur ouvre le menu d'en-tête, alors
    « Révéler la solution de l’auteur » y est la première entrée, avec une cible
    d'au moins 44 pixels de haut, et le menu reste contenu dans l'écran et
    défile en paysage sur téléphone (844 × 390). Quand il la touche, alors une
    boîte de confirmation s'ouvre avec « Annuler » comme action par défaut ;
    « Annuler » la ferme sans rien changer. Quand il touche « Révéler la
    solution », alors les poses et les fils de la solution de l'auteur sont
    ajoutés au plateau, marqués « à placer », sans rien retirer de ce qui s'y
    trouve ; la commande ne crée qu'une entrée d'historique, qu'un seul
    « Annuler » de la barre d'actions retire, et la création est enregistrée
    comme toute modification. Si un fil ne peut pas être posé (une de ses
    extrémités n'existe plus, ou il viserait un appareil déjà commandé), il est
    ignoré et un statut discret (`role="status"`, masquable d'un toucher) dit
    « 1 fil de la solution de l’auteur n’a pas pu être posé. » ou « N fils de la
    solution de l’auteur n’ont pas pu être posés. » ; la révélation n'est jamais
    refusée en bloc. L'entrée est absente de l'atelier libre, d'une création sans
    `source` ou dont la `source` n'a pas de solution, hors de la phase de
    construction et en « Essayer en joueur ». La boîte de confirmation est voulue
    par l'ADR 0015, bien que la commande soit annulable.
23. **Paramètres (U11).** Étant donné la page `/settings`, le champ « Pseudo
    retenu » montre le pseudo gardé sur l'appareil (ADR 0016 § Pseudo).
    « Enregistrer le pseudo » le remplace : les espaces de bord sont retirés,
    et un champ vide l'oublie. « Effacer le pseudo » l'oublie. Dans les deux
    cas, un statut discret (`role="status"`) dit « Pseudo enregistré. » ou
    « Pseudo effacé. », et les autres préférences sont gardées. Un pseudo
    refusé par le schéma est dit sous le champ (`role="alert"`) et désactive
    « Enregistrer le pseudo ». « Remettre la progression à zéro » ouvre une
    boîte de confirmation où « Annuler » est l'action par défaut. Elle dit ce
    qui sera perdu : les niveaux résolus et leurs records. Seul le niveau 1
    reste ouvert. Les créations, les niveaux reçus et le pseudo sont
    conservés. Une création « Modifier le niveau » d'un niveau qui redevient
    verrouillé ne s'ouvre plus avant qu'il soit de nouveau débloqué.
    « Annuler » ne change rien. « Remettre à zéro » efface la progression, et
    elle seule. Un statut discret dit « Progression remise à zéro : seul le
    niveau 1 est ouvert. », et la liste des niveaux est de nouveau verrouillée
    après le niveau 1, sans rechargement. Une erreur de stockage est dite dans
    la page (« … La progression n'a pas été effacée. », « … Ton pseudo n'a pas
    été enregistré. »). Elle ne lève jamais d'exception. Les champs et les
    boutons mesurent au moins 44 pixels CSS. La page défile en 844 × 390. Le
    libellé suit le vocabulaire « Remettre à zéro » : le mot « Réinitialiser »
    n'est pas employé.

## Décisions à mesurer avant gel de l'interface

Ces choix doivent être prototypés avec le vrai renderer, mais sans engager de
direction artistique :

- seuils toucher/glisser et tolérance aux petits tremblements ;
- positions et tailles du tiroir en portrait et en paysage ;
- taille, distance et placement de la poignée de rotation ;
- pas de rotation et hystérésis du snapping ;
- bornes, vitesse et recentrage du zoom ;
- nécessité éventuelle d'un auto-pan pendant un long déplacement ;
- densité maximale de la barre d'actions sur le plus petit écran ;
- comportement près des gestes système et des safe areas ;
- utilité réelle d'un retour haptique ;
- confort des alternatives par boutons avec les réglages de police et de zoom
  d'accessibilité.

Chaque résultat retenu doit devenir une constante nommée, un scénario automatisé
lorsque possible et une entrée dans la matrice de tests sur appareils. Une
observation graphique ne doit pas modifier le contrat de commande, le modèle du
niveau ou la séparation entre document et session.
