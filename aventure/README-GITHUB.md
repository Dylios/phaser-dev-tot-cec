# EXPEDITION 2028 — V0.6

Prototype visuel de la bibliothèque avec la nouvelle direction artistique pixel-art oblique.

## Installation
Copier le contenu de ce dossier dans `aventure/` sur GitHub Pages.

## Contrôles
- ZQSD / flèches : déplacement
- E : interaction
- Entrée / Espace : dialogue suivant
- Mobile : joystick + bouton A

## Note technique
V0.6 utilise provisoirement une composition de scène pixel-art comme couche visuelle principale afin de valider le rendu. Les personnages/interactions restent gérés par Phaser. L'étape suivante sera de découper définitivement le décor en assets PNG transparents (sol, murs, bibliothèques, meubles, objets) et de reconstruire la pièce avec un Tilemap.
