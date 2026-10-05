# Procédure de release

`package.json` est la source de vérité de la version ; `CHANGELOG.md` contient
les notes destinées aux joueurs et créateurs de niveaux. La politique SemVer est
décidée dans l’[ADR 0003](decisions/0003-project-bootstrap.md#version-de-lapplication-et-releases).

La commande `pnpm release X.Y.Z` prépare une version stable, valide que le numéro
est supérieur à la version courante, déplace les notes de « Non publié » vers une
section datée et conserve la référence initiale `0.1.0`. Elle exécute ensuite
`pnpm check`, crée un commit limité à `package.json` et `CHANGELOG.md`, crée le tag
annoté `vX.Y.Z` et pousse atomiquement `main` et ce tag vers `origin`.
Le workflow « Release GitHub » crée ensuite la GitHub Release avec les notes du
changelog de ce tag. Cette dernière étape est asynchrone ; le succès de la commande
locale confirme le push, et le succès du workflow confirme la GitHub Release.

Avant une vraie release, être sur `main` avec un arbre Git propre, avoir configuré
`origin` vers un dépôt GitHub et disposer de l’authentification Git habituelle
(clé SSH ou identifiants HTTPS) permettant de pousser vers ce dépôt. Aucun `gh`
ni `gh auth login` n’est requis sur la machine locale. Le workflow utilise le
jeton automatique de GitHub Actions ; aucun secret personnel n’est à configurer.
Le préflight vérifie aussi l’absence du tag local et distant et
teste le push atomique sans modifier le dépôt distant. L’aperçu
`pnpm release X.Y.Z --dry-run` n’appelle ni GitHub CLI, ni le réseau, ni aucune
opération de mutation ; il fonctionne sans authentification.

Si `pnpm check` échoue, la commande restaure exactement `package.json` et
`CHANGELOG.md` et retire leur éventuel staging. Après création du commit, les
références locales ne sont pas annulées automatiquement. En cas d’échec du push,
vérifier `git ls-remote --heads --tags origin main vX.Y.Z` avant de relancer le
push atomique indiqué par la commande. Si le push a réussi mais pas la GitHub
Release, ne pas supprimer le commit ou le tag : ouvrir l’onglet Actions du dépôt,
puis relancer le job échoué du workflow « Release GitHub ». Une release déjà
créée est conservée lors d’une reprise. Ne pas relancer `pnpm release` avec
le même numéro : la version et le tag sont déjà préparés.

Le déploiement de `main` continue à chaque push. Le panneau « À propos » affiche
la version du build et le SHA court du commit (avec `-dirty` si le checkout avait
des changements locaux). Les sources sans métadonnées Git affichent `local`.
