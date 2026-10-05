# Nouvelle campagne — descriptifs de niveaux

Esquisses **à peu près**, prêtes à générer en JSON puis à ajuster dans l'éditeur.
Ces propositions ne décrivent pas la campagne actuelle de sept tutoriels ; les
constats du bilan portent sur les anciens prototypes. Les schémas, familles et
contraintes du code courant priment sur leurs exemples.
Positions en unités du monde, `y` vers le bas, scène `(0,0)`–`(L,H)`. Toutes les
valeurs sont indicatives (« ≈ »). Seules les familles existantes sont utilisées.
Règles de conception : [conception-niveaux.md](conception-niveaux.md).

Conventions : 🔴 balle rouge (objectif), 🔵 balle bleue (pièce de machine).
« Trappe » = barrière horizontale ; ouverte, elle n'a plus de collision.
« Cuvette » = deux poutres courtes en V qui gardent une balle sur un bouton.
Tout objet du décor est verrouillé ; les fils du décor sont fixes.

## 1. Bilan

**Pourquoi les 12 niveaux actuels ennuient.**

- Rien ne se passe sans le joueur : pas de machine à comprendre, seulement un
  trou à combler. La solution se voit avant de toucher à quoi que ce soit.
- Un inventaire = la solution exacte (souvent 1 objet). Aucun choix, aucun leurre.
- Chaque niveau n'enseigne qu'une règle, montrée frontalement, sans surprise.
- Le temps ne compte jamais ; aucun objet n'agit sur un autre à distance.

**Principes retenus (docs de travail, Astra, Canary).**

- Une machine de 4 à 8 étapes déjà là, cassée en 2 à 4 endroits.
- La rouge est livrée par la machine ; les 🔵 travaillent pour elle.
- Un seul « aha » par niveau, les autres étapes réemploient du connu.
- Détourner un objet : poutre-écran, barrière-pont, tremplin-butoir, masse-rideau.
- Au moins un moment (convoyeur-horloge, ordre de deux événements), gardé par un
  juge binaire (bouton, levier), jamais une fenêtre au pixel.
- Des leurres plausibles, de la même famille que la solution, qui font perdre de
  façon lisible (tremplin « ascenseur », masse qui écrase, poutre qui coupe le vent).

## 2. Campagne proposée (18 niveaux)

Courbe d'introduction : balle bleue, bouton, trappe (1) → tremplin (2) →
bascule, masse (3) → levier, convoyeur (4) → fils posés par le joueur (5) →
une commande, deux effets (6) → ventilateur (7-10) → ordre et temps (11-15) →
grandes machines (16-18).

Tailles de scène : 8 × 5,5 (chapitres 1-3), 10 × 6,5 (chapitre 4),
12 × 7,5 (chapitre 5). À valider sur téléphone.

---

### Chapitre 1 — Les billes de service (8 × 5,5)

#### 1. La bille de service ★

- **Aha** : la rouge ne bouge pas seule, c'est la bleue qui doit aller lui ouvrir.
- **Décor** : 🔴 sur une trappe (≈ (6,5 ; 1,6)), trappe (6,5 ; 2,0). Panier
  (6,8 ; 4,9) sous la trappe mais décalé : entre les deux, poutre courte inclinée
  (≈ (6,2 ; 3,6), 15°) qui s'arrête trop tôt. 🔵 en haut à gauche (0,8 ; 0,8) sur
  une poutre moyenne inclinée (≈ (2 ; 1,3), 15°). Bouton (3,5 ; 4,9) au fond d'une
  cuvette. Fil bouton → trappe.
- **Inventaire** : 2 poutres courtes, 1 tremplin.
- **Solution** : une poutre qui ramène la 🔵 de la fin de sa pente vers la
  cuvette ; une poutre qui prolonge la glissière de la 🔴 vers le panier.
- **Pas trivial** : il faut suivre le fil pour comprendre qui ouvre quoi ; le
  tremplin (leurre) sous la 🔵 la fait rebondir par-dessus la cuvette.
- **Difficulté** : 1/5.

#### 2. Par-dessus le mur ★

- **Aha** : le tremplin ne fait pas monter plus haut, mais il **renvoie** : une
  chute devient un saut.
- **Décor** : étagère (poutre moyenne, ≈ (2 ; 2,0)) où attend la 🔴 derrière une
  trappe verticale (≈ (0,9 ; 1,6)) reliée à un bouton que la 🔵 atteint seule
  (réemploi du niveau 1). Mur : poutre moyenne verticale à x ≈ 5, du sol
  (y ≈ 5,4) jusqu'à y ≈ 3,0. Panier derrière le mur (6,8 ; 4,9). Sol : poutre
  longue (≈ (3 ; 5,4)).
- **Inventaire** : 1 tremplin, 1 poutre courte, 1 masse.
- **Solution** : tremplin au sol entre l'étagère et le mur, au point de chute ;
  la 🔴 rebondit en cloche par-dessus le mur.
- **Pas trivial** : la poutre courte ne franchit pas l'écart (≈ 3 u) ; posée
  en rampe montante, elle ne franchit pas le mur. La masse ne sert à rien
  (leurre qui écrase).
- **Difficulté** : 1/5. À régler : la hauteur du mur (≈ 0,8 u sous l'apogée).

#### 3. La balançoire ★★

- **Aha** : une chute à gauche fait monter à droite ; la masse ne pousse pas, elle
  **catapulte**.
- **Décor** : 🔴 au sol à droite (≈ (5,5 ; 4,5)) dans une cuvette basse. Panier
  sur un balcon en hauteur (6,8 ; 2,0). Masse posée sur une trappe en haut à
  gauche (≈ (2,5 ; 0,8)), trappe reliée à un bouton ; 🔵 qui roule vers ce
  bouton mais tombe à côté (pente trop courte).
- **Inventaire** : 1 bascule, 1 poutre courte, 1 tremplin.
- **Solution** : poutre pour guider la 🔵 sur le bouton ; bascule avec un bout
  sous la chute de la masse et l'autre sous la 🔴 (la 🔴 roule dessus depuis
  sa cuvette, ou la cuvette est déjà sur l'extrémité prévue).
- **Pas trivial** : l'orientation de la bascule compte (côté masse / côté 🔴) ;
  le tremplin sous la 🔴 immobile ne fait rien (< 1 m/s).
- **Difficulté** : 2/5. **À vérifier au banc** : portée de la catapulte ; la
  simplifier en posant la 🔴 directement sur la planche si besoin.

---

### Chapitre 2 — Commandes à distance (8 × 5,5)

#### 4. Retour à l'expéditeur ★★

- **Aha** : le tapis part dans le mauvais sens, et c'est normal : il faut
  l'**inverser**.
- **Décor** : convoyeur (4 ; 3,0) sens gauche, piloté par un levier cran gauche
  (≈ (6,8 ; 1,6)) ; 🔴 dessus, bloquée à gauche par une butée (poutre courte
  verticale ≈ (2,4 ; 2,6)). Panier en bas à droite (7 ; 4,9). 🔵 sur une rampe en
  haut à droite (≈ (5 ; 0,6)) qui passe du **mauvais** côté du levier.
- **Inventaire** : 2 poutres courtes, 1 tremplin, 1 masse.
- **Solution** : poutre qui fait arriver la 🔵 par la gauche du manche (levier →
  droite, tapis → droite) ; tremplin ou poutre en bout de tapis vers le panier.
- **Pas trivial** : la masse posée sur le levier l'écrase au cran droit… mais
  bouche aussi la sortie de la 🔵 ou le chemin (leurre à calibrer) ; une longue
  rampe directe est impossible (la 🔴 est coincée derrière la butée).
- **Difficulté** : 2/5.

#### 5. L'électricien ★★

- **Aha** : c'est le joueur qui câble ; le bouton tout près de la 🔴 est un piège.
- **Décor** : 🔴 sur une trappe (≈ (1,5 ; 1,4)) au-dessus d'un convoyeur arrêté
  (≈ (3 ; 3,2)) qui mène au panier (7 ; 4,9). Levier (≈ (5,5 ; 2,0)) que la 🔵
  percute depuis la gauche. Bouton A sur le trajet de la 🔴 (la 🔴 ne fait que
  le traverser). Bouton B au fond d'une cuvette où la 🔵 finit sa course. Aucun
  fil posé.
- **Inventaire** : 2 fils, 1 poutre courte.
- **Solution** : levier → convoyeur, bouton B → trappe (ou levier → trappe
  aussi) ; poutre pour mener la 🔵 au levier puis à la cuvette.
- **Pas trivial** : un bouton ne commande pas un convoyeur ; bouton A → trappe
  est impossible à déclencher (la 🔴 est dessus) ; il faut penser à l'ordre :
  tapis en marche avant l'ouverture.
- **Difficulté** : 2/5.

#### 6. La porte de trop ★★★

- **Aha** : la même commande ouvre deux trappes ; la 🔵 libérée devient un
  **encombrant** qu'il faut ranger.
- **Décor** : levier (≈ (1,5 ; 2,2)) relié à deux trappes : T1 sous la 🔴
  (≈ (4 ; 1,0)), T2 sous une 🔵 B (≈ (5 ; 1,0)). Les deux tombent vers la même
  zone ; tremplin fixe au sol (≈ (5 ; 5,0)) qui renvoie vers le panier
  (7,2 ; 3,8). Poche latérale fixe (≈ (6,5 ; 5,0)). 🔵 A roule vers le levier.
- **Inventaire** : 2 poutres courtes, 1 poutre moyenne, 1 masse.
- **Solution** : guider A sur le levier ; déflecteur incliné sous T2 qui envoie
  B dans la poche ; réception de la 🔴 après le rebond.
- **Pas trivial** : sans déflecteur, B arrive sur le tremplin juste avant la 🔴
  et la percute. La poutre moyenne en « toit » protège aussi la 🔴 du rebond :
  à éviter. La masse sur le levier marche, mais écrase la trajectoire de A.
- **Difficulté** : 3/5.

---

### Chapitre 3 — Le vent (8 × 5,5)

#### 7. Service à l'étage ★★

- **Aha** : toucher le bouton ne suffit pas, il faut lui laisser un **gardien**.
- **Décor** : 🔴 au rez-de-chaussée, roule dans un puits (≈ x 3,5). Ventilateur
  au fond du puits, vers le haut (≈ (3,5 ; 5,0)), relié à un bouton
  (≈ (6,5 ; 4,9)) posé à plat, sans cuvette. Panier sur un balcon
  (≈ (5,5 ; 2,6)). 🔵 qui descend une piste vers le bouton.
- **Inventaire** : 2 poutres courtes, 1 tremplin.
- **Solution** : une poutre verticale comme butée derrière le bouton (la 🔵
  s'y arrête) ; une poutre inclinée à la hauteur de lévitation qui recueille
  la 🔴 vers le balcon.
- **Pas trivial** : sans butée, la 🔵 passe, la 🔴 monte puis retombe ; la
  poutre de sortie posée trop bas fait écran au vent ; le tremplin ne fait pas
  monter.
- **Difficulté** : 2/5.

#### 8. Le courant d'air ★★

- **Aha** : la poutre décisive ne touche jamais la 🔴 : elle **coupe le vent**.
- **Décor** : 🔴 libérée par une trappe (levier touché par une 🔵). Pente fixe
  puis passage horizontal (≈ y 3,5, x 2 → 5). Ventilateur allumé, soufflant
  vers le haut sous le passage (≈ (3,5 ; 5,0)) : il soulève la 🔴 hors du
  passage. Tremplin fixe au bout, panier (7 ; 3,0).
- **Inventaire** : 1 poutre courte, 1 poutre moyenne, 1 masse.
- **Solution** : poutre courte horizontale entre la bouche et le passage (plus
  bas que le passage), qui abrite le trajet ; ou la masse posée sur la bouche.
- **Pas trivial** : l'instinct est de mettre un toit au-dessus du passage (inutile)
  ou de construire un pont avec la poutre moyenne, qui coupe aussi… le rebond du
  tremplin. La masse fonctionne : c'est la solution ⭐ alternative.
- **Difficulté** : 2/5.

#### 9. Lever le rideau ★★★

- **Aha** : le ventilateur tourne depuis le début ; c'est son souffle qui est
  bouché. Il faut **enlever** un écran.
- **Décor** : ventilateur horizontal allumé, à gauche (≈ (1 ; 3,0)), soufflant
  vers la droite. 🔴 sur un rebord (≈ (3 ; 3,0)). Entre les deux, une masse posée
  sur une trappe (≈ (2 ; 2,9)) : rideau. Trappe reliée à un levier que la 🔵
  percute. À droite, tremplin fixe et panier (7 ; 4,0).
- **Inventaire** : 2 poutres courtes, 1 poutre moyenne, 1 ventilateur (éteint,
  leurre).
- **Solution** : guider la 🔵 au levier ; poser une poutre inclinée sous la
  trappe pour évacuer la masse **hors du cône** ; réception finale de la 🔴.
- **Pas trivial** : sans évacuation, la masse tombe et reste devant la bouche
  (rideau toujours là, plus bas). Le ventilateur de l'inventaire est éteint et
  n'a pas de fil.
- **Difficulté** : 3/5.

#### 10. Le paravent de balles ★★★

- **Aha** : une balle abrite celle qui est derrière elle ; pour que la 🔴 parte,
  la 🔵 doit s'en aller **d'abord**.
- **Décor** : couloir horizontal (≈ y 2,5) avec, collées, une 🔵 côté
  ventilateur et la 🔴 derrière. Ventilateur allumé à gauche (≈ (0,8 ; 2,3)).
  Sous la 🔵 (pas sous la 🔴) une trappe (≈ (2 ; 2,8)) reliée à un bouton en bas
  à droite (≈ (6 ; 4,9)). Panier en hauteur à droite (7 ; 2,2), plus bas que le
  couloir de peu.
- **Inventaire** : 2 poutres courtes, 1 tremplin, 1 poutre moyenne.
- **Solution** : sous la trappe, poutres qui mènent la 🔵 tombée jusqu'au bouton
  (elle doit le garder) ; le vent atteint enfin la 🔴 et la pousse au panier.
- **Pas trivial** : on croit qu'il faut un plus gros vent ; la 🔵 qui tombe doit
  elle-même aller maintenir sa propre trappe ouverte (boucle). Une poutre posée
  trop haut coupe le vent.
- **Difficulté** : 3/5. À vérifier : le vent ne doit pas pousser la 🔴 tant que
  la 🔵 est devant (écran par la 🔵).

---

### Chapitre 4 — L'ordre et le temps (10 × 6,5)

#### 11. Après vous ★★★

- **Aha** : le détour de la 🔵 B sert à **attendre** que la 🔴 soit montée.
- **Décor** : ascenseur à air : ventilateur vertical (≈ (3 ; 6,0)) relié à un
  bouton gardé par 🔵 A (chemin cassé). La 🔴 monte vers un palier (≈ (3,8 ;
  3,6)) fermé par une trappe (≈ (4,8 ; 3,8)). 🔵 B sur un convoyeur de 3 u
  (≈ (7 ; 1,5)), levier → convoyeur déjà câblé et actionné au départ ; au bout,
  B tombe vers un bouton relié à la trappe du palier. Panier (8,8 ; 6,0).
- **Inventaire** : 3 poutres courtes, 1 tremplin, 1 masse.
- **Solution** : guider A sur son bouton ; recueillir la 🔴 au sommet vers le
  palier ; relier la sortie du convoyeur au bouton de B ; B maintient la trappe.
- **Pas trivial** : un raccourci pour B (poutre qui saute le convoyeur) ouvre
  la trappe avant l'arrivée de la 🔴, qui la traverse et tombe dans le vide.
  La masse posée sur le bouton de la trappe fait la même erreur.
- **Difficulté** : 3/5.

#### 12. Treize secondes ★★★

- **Aha** : une seule masse pour deux besoins ; la 🔵 peut faire le travail
  « léger » (basculer le levier), la masse le travail « lourd » (tenir le bouton).
- **Décor** : 🔴 tombe sur un convoyeur arrêté (≈ (3 ; 2,5)) commandé par un
  levier au centre (≈ (1 ; 3,6)). Au bout, un goulet fermé par une trappe
  (≈ (5 ; 3,2)) reliée à un bouton (≈ (8 ; 5,9)). Panier en contrebas (6 ; 6,0).
  🔵 immobile sur une étagère au-dessus du levier, retenue par une petite marche.
  Leurre fixe : un bouton non câblé sous le goulet.
- **Inventaire** : 1 masse, 1 poutre courte, 1 convoyeur (sens droite).
- **Solution** : poutre qui déloge la 🔵 vers le levier (ou pente sous elle) ;
  masse lâchée sur le bouton câblé.
- **Pas trivial** : l'instinct met la masse sur le levier (tapis OK, trappe
  fermée). Le convoyeur de l'inventaire marche, mais sa durée fait dépasser 20 s
  si on l'enchaîne (leurre de chrono à calibrer).
- **Difficulté** : 3/5.

#### 13. Une seule main ★★★★

- **Aha** : la machine **défait** elle-même ce qu'elle a fait ; il faut bloquer le
  levier dans son cran.
- **Décor** : un levier (≈ (5 ; 3,0)) relié à un convoyeur (≈ (7 ; 4,5)) et à un
  ventilateur. 🔵 1 le bascule à droite (tapis → droite, vent actif) ; 🔵 2,
  plus tard (par un convoyeur-horloge fixe), arrive de l'autre côté et le
  renvoie au centre (tout s'arrête). La 🔴 a besoin des deux effets pendant
  ≈ 6 s. Panier (9 ; 3,5).
- **Inventaire** : 2 poutres courtes, 1 masse, 1 tremplin.
- **Solution** : poutre posée en butée contre le manche (côté droit) : 🔵 2
  rebondit dessus au lieu de ramener le levier ; une poutre pour la sortie.
- **Pas trivial** : on cherche à « aider » la chaîne, pas à l'empêcher ; la masse
  sur le levier l'écrase et gêne la 🔵 1 (à régler pour qu'elle bloque le passage
  du tapis).
- **Difficulté** : 4/5.

#### 14. L'aiguillage ★★★★

- **Aha** : poser la masse sur le bouton libère la 🔴 **trop tôt** ; l'ordre
  compte : le deuxième tapis doit tourner avant l'ouverture.
- **Décor** : repris de [idee-prototype-aiguillage.md](idee-prototype-aiguillage.md),
  réduit à 10 × 6,5. 🔵 1 → levier L1 → convoyeur C1 porte 🔵 2 (2 s) → 🔵 2
  bascule L2 (C2 passe de gauche à droite) → 🔵 2 s'arrête sur le bouton P1 →
  trappe → 🔴 sur C2 → panier.
- **Inventaire** : 3 poutres courtes, 1 poutre moyenne, 1 tremplin, 1 masse.
- **Solution** : les trois poutres aux trois cassures du prototype.
- **Pas trivial** : raccourci tentant avec la masse ; deux leviers à lire.
- **Difficulté** : 4/5.

#### 15. Prenez votre temps ★★★★

- **Aha** : cette fois, il faut que le bouton soit **relâché** : il ouvre le
  départ et, en même temps, le pont.
- **Décor** : un bouton (≈ (2 ; 3,0)) relié à T1 (départ de la 🔴) et T2 (pont
  sur un trou, ≈ (7 ; 4,0)). La 🔴 libérée part sur un convoyeur de détour
  (fixe, ≈ 3 s). 🔵 lâchée sur le bouton ; à côté, une pente qui l'en fera
  partir si on la guide. Panier après le pont (9 ; 3,6).
- **Inventaire** : 2 poutres courtes, 1 masse.
- **Solution** : poutre qui fait rouler la 🔵 sur le bouton puis l'en évacue
  (pression brève) ; poutre de réception de la 🔴 après le pont.
- **Pas trivial** : la leçon du niveau 7 (garder le bouton) fait perdre ; la
  masse sur le bouton aussi.
- **Difficulté** : 4/5. **Risque** : pression « assez longue mais pas trop » ;
  si c'est au pixel, reporter au retardateur.

---

### Chapitre 5 — Grandes machines (12 × 7,5)

#### 16. Le sonneur ★★★★

- **Aha** : la bascule sert à envoyer un **signal** en hauteur : la 🔵 lancée
  va basculer un levier hors d'atteinte.
- **Décor** : masse sur un convoyeur-horloge en haut à gauche (≈ (2 ; 1,0)),
  levier déjà actionné. Elle tombe en bout de tapis. Bascule fixe (≈ (4 ; 6,0))
  avec la 🔵 sur le bout droit. Levier perché (≈ (6 ; 2,0)) relié à la trappe
  de la 🔴 (≈ (10 ; 1,5)). 🔴 libérée → pente → panier (11 ; 7,0). Ventilateur
  fixe allumé dans le trajet de la 🔵 (leurre fixe qui la dévie).
- **Inventaire** : 2 poutres courtes, 1 poutre moyenne, 1 tremplin.
- **Solution** : poutre qui guide la masse sur le bout gauche de la bascule ;
  écran devant le ventilateur (ou déflecteur) pour que la 🔵 atteigne le
  levier ; réception de la 🔴.
- **Pas trivial** : trois phénomènes enchaînés (horloge, catapulte, vent) ; le
  tremplin sous la 🔵 ne la lance pas.
- **Difficulté** : 4/5. À vérifier : portée et reproductibilité de la catapulte.

#### 17. Deux souffles ★★★★★

- **Aha** : le premier vent monte, le second pousse ; il faut qu'ils se succèdent.
- **Décor** : ventilateur vertical V1 (≈ (3 ; 7,2)) relié à un bouton que la 🔵 1
  doit garder. La 🔴 lévite à ≈ 1,5 u au-dessus. Ventilateur horizontal V2
  (≈ (1,5 ; 5,5)) relié à un levier qu'une 🔵 2 bascule après un
  convoyeur-horloge. Balcon et panier à droite (≈ (6 ; 5,5)).
- **Inventaire** : 3 poutres courtes, 1 ventilateur (allumé, quarts de tour),
  1 tremplin, 1 masse.
- **Solution** : gardien de bouton pour V1 ; relier la sortie du convoyeur au
  levier de V2 ; un rail court qui guide la 🔴 poussée jusqu'au balcon.
- **Pas trivial** : si V2 part trop tôt, la 🔴 n'est pas encore en l'air ; le
  ventilateur de l'inventaire posé « en renfort » coupe ou dévie le premier
  souffle.
- **Difficulté** : 5/5.

#### 18. La grande machine ★★★★★

- **Aha** : tout ce qui a été appris, une seule chaîne, quatre cassures.
- **Décor** : 🔵 1 → levier → convoyeur-horloge portant la masse → masse sur
  bascule → 🔵 2 catapultée sur un bouton en cuvette → trappe → 🔴 → souffle
  vertical (bouton gardé) → sortie latérale → tremplin fixe → panier.
  Scène pleine, étapes réparties de gauche à droite, haut en bas.
- **Inventaire** : 4 poutres (2 courtes, 1 moyenne, 1 longue), 1 tremplin,
  1 masse, 1 fil.
- **Solution** : une réparation par tronçon, dont un fil (bouton gardé →
  ventilateur).
- **Pas trivial** : la longue poutre offre un raccourci apparent qui coupe le
  souffle ; la masse libre sur le bouton libère la 🔴 avant que le vent démarre.
- **Difficulté** : 5/5. À concevoir en dernier, après le banc des 17 autres.

---

## 3. Idées fortes qui exigent une mécanique nouvelle

| Idée (source)                                                                      | Coût estimé                                                          |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Plusieurs 🔴 / plusieurs paniers (idées 1, 5 ; Canary « deux livraisons »)         | Moyen : format v3 + migration + objectif multiple.                   |
| Retardateur / réveil (idée 7 ; Astra B2)                                           | Faible à moyen : nouvelle source de fil avec délai, pas de physique. |
| Boîte en bois (idée 4 ; Canary)                                                    | Faible : corps dynamique rectangulaire, sprite déjà dessiné.         |
| Masse de 1 kg (idées 8, 10)                                                        | Faible : une valeur de `weight` de plus.                             |
| Pivot décalé de la bascule (Canary, étape B)                                       | Faible : une propriété ; balance, bras, bélier.                      |
| Piston (idée 7)                                                                    | Moyen : cible de fil avec impulsion, nouveau collider mobile.        |
| Aiguillage basculant, clapet sens unique (Canary fiche 6 ; Astra trieur/portillon) | Moyen : pièce pivotante à deux états, réglage fin.                   |
| Goulotte courbe (conception § 5)                                                   | Moyen : collider concave, outils d'édition.                          |
| Capteur de passage « passer par la porte » (Canary 1.1)                            | Moyen : capteur + objectif ordonné.                                  |
| Objectif « tenir bon » (Canary fiche 3)                                            | Faible : nouveau type de victoire, zéro physique.                    |
| Bouton cible tenu 1 s, cloche frappée assez fort (idées 2, 6)                      | Moyen : objectifs non-panier, seuil de vitesse.                      |
| Dominos (idée 6 ; Astra B1)                                                        | Élevé : beaucoup de corps, stabilité, pose en série.                 |
| Poulie / contrepoids, chariot (idée 10 ; Canary)                                   | Élevé : contraintes + corde.                                         |
| Bougies et vent (idée 9)                                                           | Moyen : nouvelle cible, dépend du vent occulté (existant).           |

## 4. Questions pour l’auteur

Réponse par défaut appliquée tant que l’auteur n’a pas tranché.

1. Scènes plus grandes que 8 × 5,5 (10 × 6,5, 12 × 7,5) sur téléphone ?
   Défaut : oui, le zoom et le panoramique existent.
2. Fils dans l’inventaire du joueur dès le niveau 5 ? Défaut : oui (U21, U25).
3. Catapulte à bascule (niveaux 3 et 16) : la garder si elle est fiable au
   banc ? Défaut : oui ; `conception-niveaux.md` dit que seul le ventilateur
   fait monter plus haut que le départ, à amender si la catapulte est gardée.
4. Niveau 15 : le garder, ou le reporter à l’arrivée d’un retardateur ?
   Défaut : le reporter.
