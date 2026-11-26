#!/usr/bin/env python3
"""Construit la version autonome du prologue (save the date) dans un dossier.

Usage : python3 tools/build_prologue.py <dossier_de_sortie>
Le dossier reçoit : index.html, style.css, phaser.min.js, js/, data/, assets/, portraits/
(uniquement les fichiers réellement utilisés par la pièce « prologue »), chemins relatifs.
"""
import json, os, re, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.dirname(HERE)                      # .../aventure
OUT = os.path.abspath(sys.argv[1])
ROOM = 'prologue'

room = json.load(open(f'{SRC}/data/{ROOM}.json', encoding='utf-8'))
assets = json.load(open(f'{SRC}/data/assets.json', encoding='utf-8'))
chars = json.load(open(f'{SRC}/data/characters.json', encoding='utf-8'))
game = json.load(open(f'{SRC}/data/game.json', encoding='utf-8'))

# --- clés de textures utilisées (comme RoomScene.preload, sans les compagnons : absents du prologue)
keys = set()
for f in room.get('floors', []): keys.add(f['key'])
for o in room['objects']: keys.add(o['key'])
for n in room.get('npcs', []): n.get('key') and keys.add(n['key'])
if room.get('player', {}).get('key'): keys.add(room['player']['key'])

files = set()
pub_assets = {}
for k in sorted(keys):
    if k in assets:
        pub_assets[k] = assets[k]; files.add('assets/' + assets[k])
    else:
        print('! texture sans fichier :', k)
pub_chars = {}
for k in sorted(keys):
    if k in chars:
        pub_chars[k] = chars[k]; files.add('assets/' + chars[k]['sheet'])

# images citées dans la pièce (livre grimoire, etc.)
for s in re.findall(r'assets/[\w/\-\.]+\.(?:png|jpg|webp|svg)', json.dumps(room)):
    files.add(s)

# --- locuteurs : seulement ceux qui parlent dans la pièce
text = json.dumps(room, ensure_ascii=False)
speakers = {n: v for n, v in game.get('speakers', {}).items() if f'"who": "{n}"' in text}
pub_game = {'speakers': speakers, 'companions': [], 'fragments': [], 'quest': []}
for v in speakers.values():
    if v.get('portrait'): files.add(v['portrait'])

# --- écriture
if os.path.exists(OUT): shutil.rmtree(OUT)
os.makedirs(OUT + '/data'); os.makedirs(OUT + '/js')
def dump(name, obj): json.dump(obj, open(f'{OUT}/data/{name}', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
dump(ROOM + '.json', room); dump('assets.json', pub_assets); dump('characters.json', pub_chars); dump('game.json', pub_game)
for f in ('controls.js', 'room.js', 'orientation.js', 'main.js'): shutil.copy(f'{SRC}/js/{f}', f'{OUT}/js/{f}')
for f in ('style.css', 'phaser.min.js'): shutil.copy(f'{SRC}/{f}', f'{OUT}/{f}')
# --- page d'entrée : l'index du jeu, sans éditeur ni manifeste, avec les crochets du site
html = open(f'{SRC}/index.html', encoding='utf-8').read()
html = re.sub(r'<link rel="manifest"[^>]*>\n|<link rel="apple-touch-icon"[^>]*>\n|<meta name="apple-mobile[^>]*>\n|<meta name="mobile-web-app[^>]*>\n', '', html)
html = html.replace('<script src="js/editor.js"></script>\n', '')
html = html.replace('<title>EXPEDITION 2028</title>', '<title>Save the date \u2014 Le jeu</title>\n<meta name="robots" content="noindex, nofollow">\n<link rel="icon" href="/favicon.svg" type="image/svg+xml">')
hooks = '''<script>
/* Version « save the date » (le Worker du site fournit /api/…).
   - verrouille ?piece, ?edit, ?debug, ?flags ;
   - signale l'ouverture du grimoire ;
   - range la progression locale par personne (identifiant donné par /api/moi). */
window.EXP_PUBLIC = true;
window.EXP_PIECE = 'prologue';
window.EXP_HOOKS = { onGrimoire: function () { try { fetch('/api/save-the-date/grimoire', { method: 'POST', credentials: 'same-origin' }).catch(function () {}); } catch (e) {} } };
window.EXP_READY = Promise.race([
  fetch('/api/moi', { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; })
    .then(function (m) { if (m && m.moi) window.EXP_FLAGS_KEY = 'exp2028:std:' + m.moi; }),
  new Promise(function (ok) { setTimeout(ok, 2500); })
]).catch(function () {});
</script>
'''
html = html.replace('<script src="phaser.min.js"></script>', hooks + '<script src="phaser.min.js"></script>')
back = '<a id="retour" href="/save-the-date/">\u2190 Revenir au choix</a>\n'
html = html.replace('<div id="game"></div>', back + '<div id="game"></div>')
html = html.replace('</head>', '<style>#retour{position:fixed;top:max(10px,env(safe-area-inset-top));left:max(12px,env(safe-area-inset-left));z-index:5;font:italic 13px Georgia,"Times New Roman",serif;color:#e8dcc0;opacity:.72;text-decoration:none;text-shadow:0 1px 3px #000;padding:6px 8px}#retour:hover,#retour:focus{opacity:1;text-decoration:underline}</style>\n</head>')
open(f'{OUT}/index.html', 'w', encoding='utf-8').write(html)

total = 0
for f in sorted(files):
    if not os.path.exists(f'{SRC}/{f}'): print('! fichier manquant :', f); continue
    os.makedirs(os.path.dirname(f'{OUT}/{f}'), exist_ok=True)
    if os.path.basename(f).startswith('gauche_') and f.endswith('.png'):
        # illustrations des pages de gauche du livre : croquis sépia, 256 couleurs suffisent (poids /3)
        from PIL import Image
        Image.open(f'{SRC}/{f}').convert('RGB').quantize(256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.FLOYDSTEINBERG).save(f'{OUT}/{f}', optimize=True)
    else:
        shutil.copy(f'{SRC}/{f}', f'{OUT}/{f}')
    total += os.path.getsize(f'{OUT}/{f}')
print(f'{len(files)} fichiers, {total/1e6:.1f} Mo (hors phaser et code)')
