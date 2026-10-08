# EXPEDITION 2028 — V0.5

Prototype de bibliothèque en 2D top-down oblique / 2.5D.

## Installation GitHub

Copier tout le contenu de ce dossier dans `aventure/`.

Le jeu utilise Phaser 4.2.1 depuis cdnjs :
`https://cdnjs.cloudflare.com/ajax/libs/phaser/4.2.1/phaser.min.js`

## Contrôles

- ZQSD / flèches : déplacement
- E : interaction
- Entrée / Espace : dialogue suivant
- Mobile : joystick + bouton A

## Architecture

- sol en tuiles
- murs et meubles comme sprites indépendants
- tri par profondeur via la position Y
- collisions invisibles associées aux meubles
- personnages séparés du décor
