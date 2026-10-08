# EXPEDITION 2028 — V0.7.1

Cette version poursuit la nouvelle architecture graphique : la bibliothèque n'est plus une image de fond. Le sol est répété à partir d'une tuile, les murs sont des modules et les principaux éléments de décor sont des PNG indépendants avec transparence.

## Lancer

Ouvrir `index.html` via GitHub Pages.

## Contrôles

- ZQSD / flèches : déplacement
- E : interaction
- Entrée / Espace : avancer dans les dialogues
- Mobile : joystick + bouton A

## Architecture graphique

`assets/environment/floor_wood_diag.png` = sol modulaire.

`assets/environment_v071/wallpanel.png` = module de mur.

`assets/sprites_v071/` = mobilier et décoration isolés.

Les personnages restent des sprites indépendants.

## Important

Cette V0.7.1 est un prototype de rendu. Les assets extraits de la planche pixel-art servent à valider la composition, l'échelle et le depth sorting ; certains éléments décoratifs devront encore être régénérés individuellement pour obtenir des PNG parfaitement propres.
