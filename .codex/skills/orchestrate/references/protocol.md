# Brief et rapport compacts

Un message natif suffit. Un fichier temporaire est utile pour un brief long ou
une exécution externe ; aucun format à sept sections n’est imposé.

## Brief

```text
Lot : <identifiant et résultat attendu>.
Écriture : <fichiers ou répertoires concernés>.
Lecture : docs/index.md, règles et tâche actives de la feuille de route,
AGENTS.md, puis <références et modules ciblés>.
Contraintes particulières : <ce que les sources ne suffisent pas à préciser>.
Validation : <tests et commandes concernés> ; Red-Green-Refactor si comportement.
Ne délègue pas. Préserve les changements de l’auteur. Pas de captures d’écran.
Rapport court : résultat, preuve rouge/verte, fichiers touchés et points ouverts.
```

L’agent peut élargir aux dépendances nécessaires du lot et le signale brièvement.
Il remonte une contradiction de contrat avant de l’implémenter. Un changement
important de périmètre est signalé avant le travail supplémentaire.

## Rapport

Quelques lignes : résultat, commandes exécutées et bilan, fichiers modifiés,
limites ou décisions nécessaires. Citer l’échec initial pertinent sans recopier
les logs. Une preuve manquante appelle une vérification ciblée par le même agent.

La gate globale est réalisée à la clôture par l’agent chargé de la livraison ;
elle n’est pas répétée par chaque rôle. Un test de parcours nécessaire peut être
lancé pendant le lot, avec `pnpm build` avant un Playwright isolé.
