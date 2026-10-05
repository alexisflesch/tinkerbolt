# Procédure de release

La version de l’application est celle de `package.json`. `CHANGELOG.md` décrit
les changements destinés aux joueurs et aux créateurs de niveaux ; il peut rester
vide lorsqu’un lot ne change pas leur expérience.

Pour publier une version :

1. Choisir le numéro selon la convention de l’[ADR 0003](decisions/0003-project-bootstrap.md#version-de-lapplication-et-releases).
2. Déplacer les notes de « Non publié » dans une section datée
   `## [X.Y.Z] - AAAA-MM-JJ`, puis laisser « Non publié » en place, quitte à ce
   qu’elle soit vide. Si la première publication porte la version `0.1.0`,
   transformer la référence `0.1.0` en section de release datée. Pour toute autre
   version, conserver cette référence initiale et ajouter la nouvelle section.
3. Mettre à jour `version` dans `package.json` avec le même numéro.
4. Lancer `pnpm release:check`, puis `pnpm check`.
5. Créer le commit de release, puis un tag Git annoté `vX.Y.Z` sur ce commit.
   Une GitHub Release peut reprendre les notes datées du changelog.

Le déploiement de `main` continue à chaque push. Le panneau « À propos » affiche
la version du build et le SHA court du commit (avec `-dirty` si le checkout avait
des changements locaux). Les sources sans métadonnées Git affichent `local`.
