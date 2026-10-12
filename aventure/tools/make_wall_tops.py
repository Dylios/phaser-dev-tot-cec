#!/usr/bin/env python3
"""Fabrique les pièces « dessus de mur » (vue de dessus, comme si on avait retiré le plafond).

    python tools/make_wall_tops.py            # écrit assets/walls/wall_top_*.png
    python tools/make_wall_tops.py 64          # épaisseur du mur en pixels (défaut : 64)

Toutes les pièces ont la même épaisseur et le même veinage, donc elles se raccordent :
les extrémités « ouvertes » n'ont pas de contour. Puis relance tools/make_assets_json.py.
"""
import os, sys
import numpy as np
from PIL import Image

T = int(sys.argv[1]) if len(sys.argv) > 1 else 64      # épaisseur du mur
LONG, SHORT = 8 * T, 2 * T                              # longueurs des segments droits
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'walls')

# palette prélevée sur les assets existants (bois miel, contour presque noir)
OUTLINE = (13, 6, 8)
SHADE = (58, 28, 12)
WOOD = [(104, 51, 21), (122, 60, 14), (140, 72, 12), (156, 84, 16), (170, 100, 22)]
HILITE = (229, 161, 57)
HILITE2 = (247, 220, 110)
BORDER = max(3, T // 20)          # épaisseur du contour
BEVEL = max(3, T // 18)           # épaisseur du biseau clair / sombre
MARGIN = 3 * T                    # marge virtuelle pour les extrémités ouvertes
PX = max(2, T // 16)              # « gros pixel » du veinage


def grain(w, h, horizontal, seed):
    """Veinage de bois en gros pixels, orienté selon la longueur du bras."""
    rng = np.random.default_rng(seed)
    if not horizontal:
        return grain(h, w, True, seed).transpose(1, 0, 2)
    gh, gw = h // PX + 2, w // PX + 2
    rows = rng.integers(1, len(WOOD) - 1, size=(gh, 1)).astype(float)    # ton de chaque « fibre »
    low = rng.normal(size=(gh, gw // 28 + 3))
    xs = np.linspace(0, low.shape[1] - 1.001, gw)
    i = xs.astype(int); f = xs - i
    mod = low[:, i] * (1 - f) + low[:, i + 1] * f                      # variation lente le long de la fibre
    v = rows + mod * 0.8 + rng.normal(scale=0.18, size=(gh, gw))
    idx = np.clip(np.rint(v), 0, len(WOOD) - 1).astype(int)
    # fines rainures sombres
    groove = rng.random((gh, 1)) < 0.07
    idx = np.where(groove & (rng.random((gh, gw)) < 0.9), 0, idx)
    pal = np.array(WOOD, dtype=np.uint8)
    img = pal[idx]
    img = np.repeat(np.repeat(img, PX, axis=0), PX, axis=1)
    return img[:h, :w]


def shifted(m, dy, dx):
    """m décalé : résultat[y, x] = m[y - dy, x - dx] (hors image = False)."""
    out = np.zeros_like(m)
    H, W = m.shape
    ys = slice(max(dy, 0), H + min(dy, 0)); yd = slice(max(-dy, 0), H + min(-dy, 0))
    xs = slice(max(dx, 0), W + min(dx, 0)); xd = slice(max(-dx, 0), W + min(-dx, 0))
    out[ys, xs] = m[yd, xd]
    return out


def render(w, h, hbars, vbars, name, seed):
    """hbars / vbars : rectangles (x0, y0, x1, y1) dans le repère de la pièce.
    Un bras qui dépasse de l'image est « ouvert » : il continue sur la pièce voisine."""
    W, H = w + 2 * MARGIN, h + 2 * MARGIN
    mask = np.zeros((H, W), bool)
    hm = np.zeros((H, W), bool)
    for (x0, y0, x1, y1) in hbars + vbars:
        mask[y0 + MARGIN:y1 + MARGIN, x0 + MARGIN:x1 + MARGIN] = True
    for (x0, y0, x1, y1) in hbars:
        hm[y0 + MARGIN:y1 + MARGIN, x0 + MARGIN:x1 + MARGIN] = True

    tex_h = grain(W, H, True, seed)
    tex_v = grain(W, H, False, seed + 1)
    rgb = np.where(hm[..., None], tex_h, tex_v).astype(np.uint8)

    # biseau : clair en haut et à gauche, sombre en bas et à droite
    top = np.zeros_like(mask); left = np.zeros_like(mask)
    bot = np.zeros_like(mask); right = np.zeros_like(mask)
    outline = np.zeros_like(mask)
    for k in range(1, BORDER + BEVEL + 1):
        t = mask & ~shifted(mask, k, 0)      # pixel dont le voisin k au-dessus est vide
        l = mask & ~shifted(mask, 0, k)
        b = mask & ~shifted(mask, -k, 0)
        r = mask & ~shifted(mask, 0, -k)
        if k <= BORDER:
            outline |= t | l | b | r
        else:
            top |= t; left |= l; bot |= b; right |= r
    rgb[bot | right] = SHADE
    rgb[top | left] = HILITE
    # petit éclat sur le tout premier pixel du biseau clair
    spec = (mask & ~shifted(mask, BORDER + 1, 0)) & ~outline
    rgb[spec & top] = HILITE2
    rgb[outline] = OUTLINE

    a = (mask * 255).astype(np.uint8)
    rgba = np.dstack([rgb, a])[MARGIN:MARGIN + h, MARGIN:MARGIN + w]
    os.makedirs(OUT, exist_ok=True)
    Image.fromarray(rgba).save(os.path.join(OUT, name + '.png'))
    return name


def main():
    E = MARGIN            # « bout ouvert » : le bras dépasse de l'image
    made = []
    sd = [10]

    def add(*a):
        sd[0] += 2
        made.append(render(*a, sd[0]))

    # segments droits (ouverts aux deux bouts)
    add(LONG, T, [(-E, 0, LONG + E, T)], [], 'wall_top_h_long_01')
    add(SHORT, T, [(-E, 0, SHORT + E, T)], [], 'wall_top_h_short_01')
    add(T, LONG, [], [(0, -E, T, LONG + E)], 'wall_top_v_long_01')
    add(T, SHORT, [], [(0, -E, T, SHORT + E)], 'wall_top_v_short_01')

    # coins : le nom dit où est le coin ; les deux bras partent vers l'intérieur
    S = 2 * T
    add(S, S, [(0, 0, S + E, T)], [(0, 0, T, S + E)], 'wall_top_corner_nw_01')           # ┌
    add(S, S, [(-E, 0, S, T)], [(S - T, 0, S, S + E)], 'wall_top_corner_ne_01')          # ┐
    add(S, S, [(0, S - T, S + E, S)], [(0, -E, T, S)], 'wall_top_corner_sw_01')          # └
    add(S, S, [(-E, S - T, S, S)], [(S - T, -E, S, S)], 'wall_top_corner_se_01')         # ┘

    # croisements en T (le nom dit où part la branche) et en croix
    B = 3 * T
    add(B, S, [(-E, 0, B + E, T)], [(T, 0, 2 * T, S + E)], 'wall_top_t_down_01')         # ┬
    add(B, S, [(-E, S - T, B + E, S)], [(T, -E, 2 * T, S)], 'wall_top_t_up_01')          # ┴
    add(S, B, [(0, T, S + E, 2 * T)], [(0, -E, T, B + E)], 'wall_top_t_right_01')        # ├
    add(S, B, [(-E, T, S, 2 * T)], [(S - T, -E, S, B + E)], 'wall_top_t_left_01')        # ┤
    add(B, B, [(-E, T, B + E, 2 * T)], [(T, -E, 2 * T, B + E)], 'wall_top_cross_01')     # ┼

    # extrémités fermées (fin de mur, bord d'une ouverture)
    add(S, T, [(0, 0, S + E, T)], [], 'wall_top_end_w_01')
    add(S, T, [(-E, 0, S, T)], [], 'wall_top_end_e_01')
    add(T, S, [], [(0, 0, T, S + E)], 'wall_top_end_n_01')
    add(T, S, [], [(0, -E, T, S)], 'wall_top_end_s_01')
    print(len(made), 'pièces écrites dans', os.path.normpath(OUT), '(épaisseur', T, 'px)')


if __name__ == '__main__':
    main()
