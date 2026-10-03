# Choix du modèle et de l’effort

Utiliser les identifiants effectivement disponibles dans la session. Ne pas
supposer qu’un ancien modèle Terra est encore accessible. Ces choix sont ceux
du projet, pas des mesures de prix ou de performances.

| Travail | Modèle | Effort de départ |
| --- | --- | --- |
| UI, mise en page, interactions, rendu visible | `gpt-6.1-sol` | `medium` |
| Logique applicative ou tests de comportement courants | `gpt-6-sol` ou `gpt-6.1-sol` disponible | `medium` |
| Documentation, renommage ou adaptation mécanique bornée | `gpt-6-luna` | `xhigh`, conformément à AGENTS.md |
| Persistance complexe, migration, atomicité, physique ou invariants transversaux | `gpt-6-sol` ou `gpt-6.1-sol` disponible | `high` |

- `gpt-6-astra` est interdit. Aucun sous-agent ne délègue à son tour.
- Choisir un modèle capable dès le départ ; ne pas provoquer une tentative
  insuffisante en baissant systématiquement l’effort.
- Réserver `xhigh` sur Sol à une difficulté démontrée. `max` et `ultra` ne sont
  pas des choix par défaut. La taille du diff ne suffit pas à augmenter l’effort.
- Sur échec, fournir à l’agent actuel le message utile et préciser le contrat.
  Changer d’effort ou de modèle seulement si le diagnostic le justifie.
- Si le même blocage persiste après deux tentatives de correction, revoir le
  découpage ou l’hypothèse avant de continuer les essais.
