# EXPEDITION 2028 — dossier `aventure/`

Première pièce jouable : **la bibliothèque** (quête « La page manquante »).
Phaser 4.2.1 est copié dans le dossier (`phaser.min.js`) : pas de CDN, pas de build Node.

## Lancer le jeu

- **GitHub Pages** : `https://<ton-compte>.github.io/<ton-dépôt>/aventure/`
- **En local** : ne pas double-cliquer sur `index.html` (le navigateur refuse de charger les JSON).
  Ouvre un terminal dans ce dossier, lance `python -m http.server 8000`, puis va sur
  `http://localhost:8000/`.
- **Mode mise au point** : ajoute `?debug` à l'adresse (`…/aventure/?debug`). Il affiche les zones
  de collision (vert), les zones où l'on peut marcher (bleu), les coordonnées du joueur et du
  pointeur, et la liste des sprites introuvables. Un clic écrit aussi les coordonnées dans la
  console du navigateur : pratique pour déplacer un meuble.

## Architecture des dossiers

```
aventure/
├── index.html            page du jeu
├── style.css             interface (HUD, joystick, dialogues)
├── phaser.min.js         moteur (Phaser 4.2.1)
├── js/
│   ├── main.js           démarrage : charge les JSON et lance Phaser
│   ├── room.js           la scène : construit la pièce, collisions, lumières, dialogues
│   └── controls.js       joystick virtuel, bouton « Agir », clavier
├── data/
│   ├── bibliotheque.json la pièce (sols, objets, personnages, lumières, dialogues)
│   └── assets.json       liste « nom du sprite -> chemin du fichier » (généré)
├── tools/
│   └── make_assets_json.py   régénère data/assets.json
└── assets/               TOUS LES PNG TRANSPARENTS, rangés par catégorie
    ├── floor/            tuiles de sol (floor_chevron_01, floor_wood_01…)
    ├── walls/            murs, coins, muret, porte           (planche 1)
    ├── bookcases/        bibliothèques                       (lot 1 + planche 2)
    ├── architecture/     cheminées, piliers, fenêtres, arche (lot 1 + planche 2)
    ├── seating/          fauteuils, chaises, tabourets, pouf (lot 1 + planche 2)
    ├── furniture/        tables, bureaux, commodes           (lot 1 + planche 3)
    ├── lighting/         lampes, lanternes, bougeoirs        (lot 1 + planche 3)
    ├── props/            globe, échelle, coffres, livres…    (lot 1 + planche 3)
    ├── wall_decor/       tableaux et cartes                  (lot 1 + planche 3)
    ├── rugs/             tapis                               (lot 1 + planche 4)
    ├── plants/           plantes et lierres                  (lot 1)
    └── characters/       joueur, PNJ, Ti Chat                (à venir)
```

**Règle d'or : le nom du fichier (sans `.png`) est le nom du sprite dans le JSON.**
Deux fichiers ne doivent pas avoir le même nom, même dans deux dossiers différents.

### Où déposer tes assets

Les dossiers des zips portent déjà les bons noms : il suffit de **copier leur contenu dans
`aventure/assets/`** en gardant les sous-dossiers.

| Zip                             | Va dans                                                        |
|---------------------------------|----------------------------------------------------------------|
| `expedition_sprites.zip` (lot 1)| `assets/` (dossiers architecture, bookcases, floor, furniture, lighting, plants, props, rugs, seating, wall_decor) |
| `planche1_walls.zip`            | `assets/walls/`                                                |
| `planche2_cotes.zip`            | `assets/bookcases/`, `assets/architecture/`, `assets/seating/` |
| `planche3_accessoires.zip`      | `assets/props/`, `assets/furniture/`, `assets/lighting/`, `assets/wall_decor/` |
| `planche4_tapis.zip`            | `assets/rugs/`                                                 |

Cas particuliers : `floor/floor_chevron_01.png` (sol en chevrons, 64×64) et
`characters/cat_01.png`, `cat_02.png` ne viennent d'aucun zip de planche : ils sont déjà fournis.

### Ajouter un nouveau sprite

1. Dépose le PNG dans le bon dossier de `assets/`.
2. Lance `python tools/make_assets_json.py` (ou ajoute à la main une ligne dans `data/assets.json`).
3. Utilise son nom dans `data/bibliotheque.json`.

Tant qu'un PNG est absent, la scène affiche un rectangle étiqueté à sa place : le jeu reste jouable.

## Modifier la pièce (`data/bibliotheque.json`)

Aucun besoin de toucher au code pour déplacer un meuble ou changer un dialogue.

- **Position** : `x`, `y` = le point au SOL du sprite (milieu du bord bas). Plus `y` est grand,
  plus l'objet est devant (tri de profondeur par Y).
- **Taille** : la table `assetScale` donne l'échelle de chaque sprite (les planches de ChatGPT
  sont plus grandes que le premier lot). Un champ `"scale"` dans un objet la multiplie.
- **`layer`** : `"wall"` (mur de fond), `"walldecor"` (accroché au mur), `"floor"` (tapis posé
  au sol, on marche dessus). Sans `layer` : objet normal, avec ombre et collision.
- **`sortY`** : pour un objet posé SUR un meuble (lampe, livres), donne la valeur de `y` du meuble
  (+1) pour qu'il soit dessiné devant lui. Il devient automatiquement traversable.
- **Collision** : `"fp": [largeur, hauteur]` règle l'empreinte au sol, `"solid": false` la supprime.
- **`walkable`** : rectangles où le joueur peut marcher (à ajuster avec `?debug`).
- **`lights`** : halos chauds (`x`, `y`, `r` rayon, `a` intensité, `"flicker": true` pour vaciller).
- **`talk`** : dialogues. Chaque entrée peut avoir `needs` / `not` (conditions sur la quête),
  `sets` (drapeau activé à la fin) et `who` (nom affiché).
- **`npcs`** : personnages. Tant que `assets/characters/<clé>.png` n'existe pas, un petit
  personnage provisoire est dessiné.

## Éditeur de pièce (placer les objets toi-même)

Ouvre `index.html?edit` (sur ordinateur ou téléphone). Tu vois la pièce avec tous les assets en palette :

- **Ajouter** : touche une vignette, l'objet apparaît au centre de la vue.
- **Déplacer** : glisse l'objet. Retouche au même endroit pour sélectionner l'objet en dessous.
- **Redimensionner** : tire sur les 4 poignées blanches aux coins de l'objet sélectionné (proportions conservées, le coin opposé reste fixe), ou tape directement le pourcentage dans le champ « Taille ».
- **Régler** : taille, miroir, devant/derrière, couche, collision, ombre (panneau).
- **Vue** : glisse dans le vide (ou bouton ✋), molette ou pincement pour zoomer, ⌂ pour tout voir.
- **Marche / Sol** : modes pour dessiner les zones où le joueur peut aller et les zones de parquet.
- **Clavier** : flèches (Maj = 10 px), Suppr, D dupliquer, F miroir, [ ] devant/derrière, + − taille, Ctrl+Z / Ctrl+Y.
- **Brouillon** : enregistré automatiquement dans ton navigateur. « ▶ Tester » joue ton brouillon
  (`?brouillon`), « Original » l'efface.
- **Publier** : « Exporter » donne le JSON ; colle-le dans `data/bibliotheque.json` et pousse.

## Dessus de mur (`assets/walls/wall_top_*`)

Pièces de bois vues de dessus, comme si on avait retiré le plafond : segments droits (`h_long`,
`h_short`, `v_long`, `v_short`), coins (`corner_nw/ne/sw/se`), jonctions (`t_down/up/left/right`,
`cross`) et bouts fermés (`end_w/e/n/s`). Elles sont générées par code et se raccordent bout à bout
(épaisseur 16 px dans la pièce). Pour les poser : grille 8 dans l'éditeur. Pour changer l'épaisseur
ou la teinte : `python tools/make_wall_tops.py 80` puis `python tools/make_assets_json.py`.

## Mobile

**Plein écran** : sur Android, le premier toucher passe en plein écran et verrouille le paysage. Sur iPhone, Safari ne permet pas de masquer sa barre : il faut installer le jeu sur l'écran d'accueil (Partager → « Sur l'écran d'accueil »). Il s'ouvre alors sans aucune barre (`manifest.webmanifest`, `icons/`).

En portrait sur un appareil tactile, un écran « Tourne ton téléphone » met le jeu en pause (`js/orientation.js`) ; il disparaît tout seul en paysage. Pour le voir sur ordinateur : `index.html?forceportrait`. L'éditeur (`?edit`) n'est pas concerné.

Le jeu occupe tout l'écran et s'adapte : sur ordinateur et téléphone en paysage on voit toute la
pièce ; en portrait la caméra suit le joueur. Le joystick et le bouton « Agir » apparaissent
seulement sur écran tactile. Au clavier : flèches ou WASD pour bouger, Espace / Entrée / E pour agir.

Poids actuel : environ 4 Mo d'images pour la pièce + 1,4 Mo pour Phaser. Si besoin, on pourra
réduire les PNG à leur taille d'affichage.

## Personnages animés

Thomas (`thomas_01`), Cécile (`cecile_01`) et TiChat (`tichat_01`) sont des personnages animés.

- `assets/sheets/<nom>.png` : feuille de sprites, 4 images par rangée. Rangées : 0 face, 1 dos, 2 gauche, 3 droite (TiChat : face, droite, gauche).
- `assets/characters/<nom>.png` : aperçu fixe, c'est ce que l'éditeur montre dans la palette.
- `data/characters.json` : taille d'une case, rangées, nombre d'images par rangée (`counts`), vitesse de marche. Les clés sont celles des aperçus.
- Dans la pièce : un PNJ s'écrit `{"id": "thomas", "key": "thomas_01", "face": "down", …}` (`face` : `down`, `up`, `left`, `right`). Il se tourne vers le joueur quand on lui parle. Un personnage posé depuis l'éditeur a un réglage « Regard ».
- Promenade : `"wander": 80` (rayon en pixels) fait marcher un personnage autour de sa place (TiChat). Il s'arrête quand le joueur s'approche ou lui parle ; `"wanderSpeed"` règle sa vitesse. Mets `"solid": false` pour qu'il ne bloque pas le joueur.
- Le joueur : pour lui donner un personnage animé, mets `"key": "thomas_01"` (ou une autre clé de `characters.json`) dans `"player"`. Sans clé, il reste une silhouette provisoire.
- Nouveau personnage : ajoute la feuille dans `assets/sheets/`, l'aperçu dans `assets/characters/`, une entrée dans `data/characters.json` et `python tools/make_assets_json.py`.
