#!/usr/bin/env python3
"""Régénère data/assets.json : liste de tous les PNG trouvés dans assets/.

À lancer depuis le dossier aventure/ chaque fois que tu ajoutes un sprite :
    python tools/make_assets_json.py

Le nom du fichier (sans .png) devient la clé utilisée dans data/bibliotheque.json.
Deux fichiers ne doivent pas porter le même nom, même dans des dossiers différents.
"""
import json, os, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
ASSETS = os.path.join(ROOT, 'assets')
out, dupes = {}, []
for folder, dirs, files in os.walk(ASSETS):
    dirs[:] = [d for d in dirs if d != 'sheets']      # feuilles d'animation : listées dans data/characters.json
    for f in sorted(files):
        if not f.lower().endswith('.png'):
            continue
        key = f[:-4]
        rel = os.path.relpath(os.path.join(folder, f), ASSETS).replace(os.sep, '/')
        if key in out:
            dupes.append((key, out[key], rel))
        out[key] = rel

path = os.path.join(ROOT, 'data', 'assets.json')
with open(path, 'w', encoding='utf-8') as fh:
    json.dump(dict(sorted(out.items())), fh, ensure_ascii=False, indent=1)
print(len(out), 'sprites ->', os.path.normpath(path))
for k, a, b in dupes:
    print('ATTENTION doublon :', k, a, b, file=sys.stderr)
