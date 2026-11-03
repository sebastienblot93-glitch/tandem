# TANDEM — plateforme coopérative aux flèches

Deux joueurs, un parcours qui ne se termine **qu'à deux**. Pas de souris : uniquement les flèches du clavier.
Les joueurs n'ont **aucun pouvoir** : marcher (← →) et sauter (↑). Tout le jeu vient de la façon dont on se sert
de l'autre (monter sur sa tête, relayer, tenir une plaque) et du **timing des sauts**, de plus en plus serré.

## Lancer

1. Installer **Node.js** (version LTS) depuis https://nodejs.org — `npm` est fourni avec. Fermer puis rouvrir l'invite de commandes.
2. Dans le dossier du jeu :

```bash
npm install     # installe « ws » (seule dépendance)
npm start       # http://localhost:3000
```

- **Souris ou clavier pour les menus** : « Créer une salle », « Rejoindre », « Jouer en local », choix du niveau (clic sur
  les aperçus, les pastilles ou la grande vignette). Au clavier : ↑ ↓ choisir, → valider, ← / ↓ retour.
- **En jeu, clavier uniquement** : ← → marcher, ↑ sauter. **Z Q D** (ou **W A D** sur un clavier QWERTY) font exactement la même chose.
  - **Retour au dernier drapeau** : maintenir ↓ (ou S) environ une demi-seconde, puis relâcher. Sans drapeau validé, retour au départ. Ce n'est pas une chute (le compteur ☠ ne bouge pas). En local, chacun a sa touche (↓ pour les flèches, S pour Z Q D) ; le bouton « Drapeau » de la barre du haut ramène les deux joueurs.
  - **Pause** : Échap ou P, le bouton « II », ou maintenir ↓ plus longtemps (1,7 s) pour rester jouable aux flèches seules.
  - **Retour au choix des niveaux** : bouton « Niveaux » de la barre du haut (un 2e clic confirme), ou le menu pause. En ligne, le partenaire est prévenu.
- **Mode entraînement** : bouton « Entraînement » (ou touche **T**) dans le choix des niveaux. Rien n'est enregistré, les chutes ne coûtent que 1/3 de seconde, et une barre d'outils apparaît en bas : **C** pose un point de retour (les deux joueurs doivent être au sol : vous y réapparaissez après chaque chute), **V** passe en ralenti (×½, ×¼ — marche aussi en ligne), **0** repart du début, **1 2 3…** repartent du n-ième drapeau dans l'ordre du niveau. Tout se fait aussi à la souris.
- **Couleurs** : menu « Couleurs des personnages » (titre) ou bouton « Couleurs » dans le choix des niveaux. 8 couleurs, deux joueurs ne peuvent pas avoir la même. En ligne, chacun choisit la sienne et l'autre la voit tout de suite. Le choix est mémorisé dans le navigateur.
- **En ligne** : l'hôte crée une salle et donne le code (4 lettres, ex. `KRTB`) à l'autre joueur, qui choisit « Rejoindre »
  (il tape les lettres au clavier, sans tenir compte des majuscules, ou clique sur le petit clavier à l'écran). L'hôte choisit et lance les niveaux.
- **Chat écrit** (en ligne, une fois le partenaire présent) : **Tab** ouvre la saisie (pendant une partie, **Entrée** aussi), **Entrée** envoie, **Échap** annule. Pendant la saisie les touches ne font pas bouger le personnage. Les messages (120 caractères max, couleur de l'auteur) s'affichent en petit, semi-transparents, en bas à droite, et s'effacent seuls après 8 s ; ils ne prennent jamais le focus des commandes. Le serveur nettoie le texte et limite la cadence (5 messages par 6 s).
- **En local** (même clavier) : joueur 1 = flèches ; joueur 2 = Z Q D.
- Déploiement (Render, etc.) : `npm install` puis `npm start` ; le port vient de la variable `PORT`.
  Le serveur sert aussi les fichiers du jeu. `GET /healthz` pour la supervision.

## Les règles du jeu

| Élément | Rôle |
|---|---|
| Joueurs solides l'un pour l'autre | on peut se porter (courte-échelle) ; le joueur du bas qui saute propulse celui du haut (saut en chaîne) |
| Plaque + grille (même couleur) | la grille reste ouverte tant que la plaque est tenue ; certaines se referment après un délai |
| **Marches fantômes** | des blocs qui n'existent QUE tant que la plaque est tenue : l'un tient, l'autre grimpe |
| **Cloche** | bloc que l'on frappe PAR-DESSOUS en sautant. Elle fait apparaître un pont, un escalier éphémère ou ouvre un mur pendant quelques secondes (barre de temps en haut) |
| **Tremplin** | propulse à 6 cases de haut (le saut en chaîne depuis un tremplin monte encore plus haut) |
| **Tapis roulants** | entraînent vers la gauche ou la droite tant qu'on est au sol |
| **Dalles de verre** | se fissurent peu après qu'on les a foulées, tombent, puis se reforment |
| **Portails** | vont par deux : on entre par l'un, on sort par l'autre |
| **Porte-plaque** | une porte posée sur une plaque : celui qui l'occupe ouvre une grille pour l'autre |
| Pierres pulsantes (jaunes / cyan) | apparaissent et disparaissent en alternance : il faut sauter en rythme |
| **Courants d'air** | emportent vers le haut tant que la plaque est tenue (ou que l'interrupteur est basculé) ; un courant sans plaque ni interrupteur souffle toujours |
| **Interrupteurs à bascule** | on les enfonce en marchant dessus : chaque passage change l'état du groupe (grilles, courants). Ne repassez pas dessus sans raison ! |
| **Pics rythmés** | sortent et rentrent en cadence, et clignotent juste avant de sortir ; deux phases (A / B) pour alterner |
| Pics | retour au dernier drapeau (ou au départ) |
| Drapeau | validé quand les deux joueurs l'ont touché ; devient le point de réapparition |
| Deux portes | chaque joueur dans une porte, en même temps → niveau réussi |

Un bloc mobile n'apparaît jamais sur un joueur. L'idée centrale : **un frappe, l'autre agit** (relais, attente au bord, rôles inversés).

## Niveaux (30, dix chapitres — de 30 à 235 cases de long)

1. **Duo** — Courte-échelle (mur de 3, fosse, mur de 4) · Verrous croisés (deux couloirs, grilles qui se referment) · Marches fantômes (escalier qui n'existe que si l'autre tient la plaque)
2. **Cloches** — Première cloche (relais de ponts) · Les sas (cloches qui ouvrent des murs) · Le clocher (tour de 30 cases, escaliers éphémères)
3. **Élan** — Tremplin (ressorts, saut en chaîne depuis le tremplin) · Pont de verre (dalles qui lâchent, navette)
4. **Cadence** — Chambre forte (portails, porte-plaque) · Pulsations (pierres à 4 cases d'écart) · Métronome (tapis, mur de 6 cases, pierres rapides, cloche)
5. **Souffle** (décor glacé) — Premier souffle (courant tenu par la plaque, courant de l'interrupteur) · Cloches d'altitude (cloches à 8 cases de haut) · Ascenseur (tour de trois étages)
6. **Mécanismes** (décor de ruines) — Allée des pics (tunnels trop bas, pics rythmés) · Prêts ? Partez ! (deux plaques éloignées à tenir ensemble, grilles qui se referment vite) · Chacun son couloir (deux couloirs superposés, interrupteurs croisés)
7. **Cosmos** (décor spatial) — Orbite (cloche à 9 cases : ressort + saut en chaîne, pont qui ne dure pas, tunnel de pics, fosse au ressort, second champ de pierres) · Funambules (long pont de verre, ressort vers un chemin suspendu au-dessus du vide, deux murs en chaîne) · Tandem (140×22 : ascension en trois étages — pierres, courant partagé, pics et tunnel rythmé, long pont de verre, ressort, dernières pierres)

8. **Précision** (décor de forge) — Pylônes (pylônes d'une case à 4–5 cases d'écart, deux plaques lointaines à tenir ensemble) · Lune (*gravité faible* : sauts de 7 cases, murs de 5–6 en chaîne avec tunnel, plaques lointaines) · Plomb (*gravité lourde* : 3 cases de vide au plus, mur à tunnel, escalier fantôme, cloche à 4 cases et pont de 250 ticks)
9. **Casse-têtes** (décor arcane) — Serrures (plaque + tunnel + escalier fantôme, sas à interrupteurs qui s'annulent, tapis à contresens au-dessus de fosses) · Relais (cloches en chaîne, portes éphémères, grand pont de 22 cases : celui qui sonne ne peut pas traverser, l'autre passe d'abord et sonne de l'autre rive) · Portails croisés (chambres closes : l'un tient la plaque, l'autre ouvre la trappe ; grande chambre à deux plaques éloignées) · Marée (tunnel d'une case où des tapis trop rapides ne s'inversent que si l'un tient la plaque, longue passerelle de dalles fragiles au-dessus des pics)
10. **Maîtrise** (décor de ciel) — Les quatre épreuves (pylônes, mur à tunnel, deux plaques lointaines, sas à interrupteurs) · Cordée (escalier fantôme, cloche haute et porte éphémère, fosse de 5 cases, plaques lointaines, pylônes) · Apothéose (portails, pylônes, grand pont, sas : le final)

Chaque niveau 21–30 dure **30 à 45 secondes** même pour les bots (marge des minuteries : minimum mesuré + 30 à 120 ticks). Un niveau peut avoir sa propre physique : `phys` (`gravity`, `jump`, `spring`, `speed`, `maxFall`).

Marges mesurées (ticks à 60 Hz) du saut en chaîne : corniche de 4 cases = 23 ticks, 5 = 19, 6 = 11, 7 = impossible.
Les plateformes « à sens unique » (`=`) existent dans le moteur mais aucun niveau ne les utilise pour l'instant. Un groupe ne peut pas mélanger plaques et interrupteurs, et un niveau compte 3 groupes au maximum.

## Architecture

```
server.js              serveur http statique + WebSocket, salles, boucle 60 Hz autoritaire
public/shared/sim.js   moteur déterministe (navigateur + serveur + tests), niveaux de taille variable
public/shared/levels.js les 30 niveaux (légende en tête de sim.js)
public/render.js       dessin canvas, personnages (ourson / chaton), caméra dynamique   public/audio.js  sons synthétisés
public/scenery.js      décors par chapitre : ciel, collines en parallaxe, ambiance animée, tuiles et accessoires
public/game.js         menus, mode local, mode en ligne
test/                  physique, solutions de chaque niveau jouées par deux « bots », garde-fous « pas jouable seul », test réseau
```

Tests : `npm test` (le test réseau a besoin du module `ws`, donc de `npm install`).
`node test/levels.test.js 29 --map` rejoue la solution du niveau 30 et affiche la carte.

## Créer un niveau

Dans `public/shared/levels.js`, ajouter un `make(chapitre, nom, indice, dessin, config, [largeur, hauteur])`.
Légende : `#` mur · `1`/`2` départs · `D` porte (2 portes exactement, non collées) · `^` pics · `F` drapeau ·
`a b c` plaques / `A B C` grilles / `X Y Z` marches fantômes · `u v w` cloches / `M N O` ponts (ou murs-portes) ·
`r` `s` pierres pulsantes · `x y z` interrupteurs à bascule · `P Q R` courants d'air · `e` `E` pics rythmés (phase A / B) · `T` tremplin · `<` `>` tapis · `f` dalle de verre · `=` sens unique · `k l m` portails (2 par lettre) · `G H I` porte + plaque.
Config : `latch` (délai de fermeture des grilles), `bell` (`{ 1: { dur: ticks, door: true|false } }`), `rhythm` (`period`, `on`),
`belt` (`speed`, `flip`), `rspike` (`period`, `on`), `frag` (`delay`, `restore`), `zoom` (zoom maximal de la caméra), `phys` (physique propre au niveau : `gravity`, `jump`, `spring`, `speed`, `maxFall`).
Repère : une cloche à 3 lignes au-dessus du sol se frappe seul ; à 4 lignes, il faut une courte-échelle.
Écrivez ensuite une solution dans `test/solutions.js` : si deux bots n'arrivent pas aux portes avec seulement ← → ↑, le niveau n'est pas bon.

## Mettre le jeu en ligne (Render)

1. Poussez ce dossier dans un dépôt GitHub.
2. Sur https://dashboard.render.com : **New + → Web Service**, connectez GitHub et choisissez le dépôt.
3. Réglages : *Runtime* Node, *Build Command* `npm install`, *Start Command* `npm start`, *Instance type* Free. (Le fichier `render.yaml` fait la même chose via **New + → Blueprint**.)
4. Render donne une adresse `https://tandem-xxxx.onrender.com` : c'est le lien à partager. Le serveur lit le port dans `PORT` et les WebSocket passent tels quels, rien d'autre à configurer.

Sur l'offre gratuite, le service s'endort après ~15 min sans visiteur et met ~30 s à se réveiller ; les salles en cours sont perdues quand il redémarre.

## Limites connues

- Pas de prédiction côté client : en ligne, on voit l'état renvoyé par le serveur. Correct sur un bon réseau,
  mais les enchaînements serrés (pierres rythmées, pics rythmés, mur de 6 cases) gagneraient à une prédiction locale.
- « Coop obligatoire » est garanti par la conception et par des garde-fous testés (`test/solo.test.js`),
  pas par une preuve automatique d'impossibilité en solo.
- La difficulté est calibrée avec des bots (marges mesurées en ticks), pas avec de vrais joueurs : à ajuster après vos essais.
