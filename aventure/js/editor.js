/* Éditeur de pièce intégré — s'ouvre avec  index.html?edit
 *
 * - palette de tous les assets : on touche une vignette, l'objet apparaît au centre de la vue
 * - on déplace en glissant, on règle taille / miroir / profondeur / collision dans le panneau
 * - zones de marche et sols modifiables (modes « Marche » et « Sol »)
 * - brouillon enregistré automatiquement dans le navigateur (localStorage)
 * - « Exporter » donne le JSON à coller dans data/<pièce>.json
 */
(function () {
  'use strict';

  const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
  const CATS = {
    walls: 'Murs', bookcases: 'Bibliothèques', architecture: 'Architecture', seating: 'Assises',
    furniture: 'Meubles', lighting: 'Luminaires', props: 'Accessoires', wall_decor: 'Déco murale',
    rugs: 'Tapis', floor_decor: 'Sol (déco)', plants: 'Plantes', statues: 'Statues', characters: 'Personnages'
  };
  const LAYER_BY_CAT = { walls: 'wall', wall_decor: 'walldecor', rugs: 'floor', floor_decor: 'floor' };
  const BIG_CATS = { walls: 1, rugs: 1, architecture: 1, bookcases: 1 };
  const LAYERS = [
    ['object', 'Objet (trié selon Y)'], ['floor', 'Au sol (tapis)'],
    ['wall', 'Mur'], ['walldecor', 'Déco murale']
  ];
  const MODES = [['obj', 'Objets'], ['walk', 'Marche'], ['floor', 'Sol']];

  function h(tag, attrs) {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      if (k === 'class') e.className = attrs[k];
      else if (k === 'text') e.textContent = attrs[k];
      else if (k === 'html') e.innerHTML = attrs[k];
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), attrs[k]);
      else e.setAttribute(k, attrs[k]);
    }
    for (let i = 2; i < arguments.length; i++) {
      const c = arguments[i];
      if (c == null) continue;
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return e;
  }

  class Editor {
    constructor(scene) {
      this.s = scene;
      this.cam = scene.cameras.main;
      this.dpr = scene.dpr;
      const cfg = scene.cfg;
      cfg.assetScale = cfg.assetScale || {};
      cfg.walkable = cfg.walkable || [];
      cfg.floors = cfg.floors || [];
      cfg.lights = cfg.lights || [];
      cfg.npcs = cfg.npcs || [];

      this.sel = null;
      this.mode = 'obj';
      this.guides = true;
      this.snap = 0;
      this.lock = {};
      this.panTool = false;
      this.spaceDown = false;
      this.drag = null;
      this.pinch = null;
      this.undoStack = [];
      this.redoStack = [];
      this.cat = 'all';
      this.q = '';
      this.fields = {};

      document.body.classList.add('edit');
      this.g = scene.add.graphics().setDepth(99999);

      this.buildUI();
      this.bindInput();
      this.fit();
      this.undoStack.push(this.pretty());
      this.updateButtons();
      this.refreshCounts();
      this.renderInsp();
      this.setStatus(scene.fromDraft ? 'Brouillon restauré' : 'Version publiée chargée');
      scene.events.on('update', () => this.draw());
    }

    get cfg() { return this.s.cfg; }

    /* ===================== interface ===================== */
    buildUI() {
      const self = this;
      const panel = this.panel = h('div', { id: 'ed' });
      const collapsed = window.innerWidth < 760;
      if (collapsed) panel.classList.add('collapsed');

      // en-tête (toujours visible)
      this.selLabel = h('span', { class: 'ed-sel', text: '' });
      this.btnDup = h('button', { class: 'ed-mini', title: 'Dupliquer', text: '⧉', onclick: () => this.duplicate() });
      this.btnDel = h('button', { class: 'ed-mini', title: 'Supprimer', text: '🗑', onclick: () => this.remove() });
      const toggle = h('button', { class: 'ed-mini', id: 'ed-toggle', text: collapsed ? '▴' : '▾', onclick: () => {
        panel.classList.toggle('collapsed');
        toggle.textContent = panel.classList.contains('collapsed') ? '▴' : '▾';
      } });
      this.toggle = toggle;
      const head = h('div', { class: 'ed-head' },
        h('b', { text: 'Éditeur' }), this.selLabel, h('span', { class: 'ed-grow' }),
        this.btnDup, this.btnDel, toggle);
      panel.appendChild(head);

      const body = h('div', { class: 'ed-body' });
      panel.appendChild(body);

      // barre d'actions
      this.btnUndo = h('button', { text: '↶ Annuler', onclick: () => this.undo() });
      this.btnRedo = h('button', { text: '↷ Rétablir', onclick: () => this.redo() });
      body.appendChild(h('div', { class: 'ed-bar' },
        this.btnUndo, this.btnRedo,
        h('button', { class: 'ed-primary', text: 'Exporter', onclick: () => this.showExport() }),
        h('button', { text: 'Importer', onclick: () => this.showImport() }),
        h('button', { text: '▶ Tester', onclick: () => this.test() }),
        h('button', { text: 'Original', title: 'Effacer le brouillon et revenir à la version publiée', onclick: () => this.resetDraft() })
      ));
      this.status = h('div', { class: 'ed-status' });
      body.appendChild(this.status);

      // modes
      const modes = h('div', { class: 'ed-modes' });
      this.modeBtns = {};
      MODES.forEach(([id, label]) => {
        const b = h('button', { text: label, onclick: () => this.setMode(id) });
        this.modeBtns[id] = b; modes.appendChild(b);
      });
      body.appendChild(modes);
      this.modeBtns.obj.classList.add('on');

      // options
      const chk = (label, checked, fn) => {
        const i = h('input', { type: 'checkbox' });
        i.checked = checked;
        i.addEventListener('change', () => fn(i.checked));
        return h('label', { class: 'ed-chk' }, i, label);
      };
      const snapSel = h('select', { onchange: (e) => { this.snap = parseInt(e.target.value, 10) || 0; } },
        h('option', { value: '0', text: 'Libre' }), h('option', { value: '4', text: 'Grille 4' }),
        h('option', { value: '8', text: 'Grille 8' }), h('option', { value: '16', text: 'Grille 16' }));
      body.appendChild(h('div', { class: 'ed-opts' },
        chk('Repères', true, (v) => { this.guides = v; }),
        chk('🔒 Murs', false, (v) => { this.lock.wall = v; }),
        chk('🔒 Sols/tapis', false, (v) => { this.lock.floor = v; }),
        chk('🔒 Déco murale', false, (v) => { this.lock.walldecor = v; }),
        snapSel));

      // inspecteur
      this.insp = h('div', { id: 'ed-insp' });
      body.appendChild(this.insp);

      // palette
      const q = h('input', { type: 'search', placeholder: 'Chercher un asset…', oninput: (e) => { this.q = e.target.value.toLowerCase(); this.filterPalette(); } });
      const catSel = h('select', { onchange: (e) => { this.cat = e.target.value; this.filterPalette(); } },
        h('option', { value: 'all', text: 'Toutes les catégories' }));
      Object.keys(CATS).forEach((k) => catSel.appendChild(h('option', { value: k, text: CATS[k] })));
      this.palGrid = h('div', { class: 'ed-grid' });
      body.appendChild(h('div', { class: 'ed-pal' },
        h('div', { class: 'ed-pal-head' }, h('b', { text: 'Ajouter un asset' }), catSel, q),
        this.palGrid));
      this.buildPalette();

      document.body.appendChild(panel);

      // navigation flottante
      const nav = h('div', { id: 'ed-nav' },
        h('button', { text: '＋', title: 'Zoom avant', onclick: () => this.zoomCenter(1.25) }),
        h('button', { text: '－', title: 'Zoom arrière', onclick: () => this.zoomCenter(0.8) }),
        h('button', { text: '⌂', title: 'Tout voir', onclick: () => this.fit() }),
        this.panBtn = h('button', { text: '✋', title: 'Déplacer la vue au doigt', onclick: () => {
          this.panTool = !this.panTool; this.panBtn.classList.toggle('on', this.panTool);
        } }));
      document.body.appendChild(nav);
      this.coord = h('div', { id: 'ed-coord' });
      document.body.appendChild(this.coord);

      // fenêtre (export / import)
      this.modal = h('div', { id: 'ed-modal', hidden: '' });
      document.body.appendChild(this.modal);
    }

    buildPalette() {
      const map = this.s.assetMap;
      const keys = Object.keys(map).filter((k) => map[k].split('/')[0] !== 'floor').sort((a, b) => {
        const ca = map[a].split('/')[0], cb = map[b].split('/')[0];
        return ca === cb ? (a < b ? -1 : 1) : (ca < cb ? -1 : 1);
      });
      this.palItems = keys.map((k) => {
        const cat = map[k].split('/')[0];
        const badge = h('span', { class: 'ed-badge' });
        const el = h('button', { class: 'ed-item', title: k, onclick: () => this.addFromPalette(k) },
          h('img', { src: 'assets/' + map[k], loading: 'lazy', alt: k, draggable: 'false' }),
          h('span', { class: 'ed-name', text: k.replace(/_0?(\d+)$/, ' $1').replace(/_/g, ' ') }), badge);
        this.palGrid.appendChild(el);
        return { key: k, cat: cat, el: el, badge: badge };
      });
    }

    filterPalette() {
      this.palItems.forEach((it) => {
        const ok = (this.cat === 'all' || it.cat === this.cat) && (!this.q || it.key.indexOf(this.q) >= 0);
        it.el.style.display = ok ? '' : 'none';
      });
    }

    refreshCounts() {
      const n = {};
      this.cfg.objects.forEach((o) => { n[o.key] = (n[o.key] || 0) + 1; });
      this.palItems.forEach((it) => {
        const c = n[it.key] || 0;
        it.badge.textContent = c ? '×' + c : '';
        it.el.classList.toggle('used', !!c);
      });
    }

    setStatus(t) { this.status.textContent = t; }

    updateButtons() {
      this.btnUndo.disabled = this.undoStack.length < 2;
      this.btnRedo.disabled = !this.redoStack.length;
    }

    setMode(m) {
      this.mode = m;
      Object.keys(this.modeBtns).forEach((k) => this.modeBtns[k].classList.toggle('on', k === m));
      if (this.sel && this.sel.type !== m && !(m === 'obj' && ['obj', 'npc', 'player', 'light'].indexOf(this.sel.type) >= 0)) this.sel = null;
      this.renderInsp();
    }

    /* ===================== sauvegarde / historique ===================== */
    pretty() {
      const rep = (k, v) => (k.charAt(0) === '_' || k === 'rect') ? undefined : v;
      const clean = JSON.parse(JSON.stringify(this.cfg, rep));
      const out = [];
      Object.keys(clean).forEach((k) => {
        const v = clean[k];
        if (Array.isArray(v)) {
          out.push('  ' + JSON.stringify(k) + ': [\n' + v.map((it) => '    ' + JSON.stringify(it)).join(',\n') + '\n  ]');
        } else if (v && typeof v === 'object' && k === 'assetScale') {
          out.push('  "assetScale": {\n' + Object.keys(v).map((kk) => '    ' + JSON.stringify(kk) + ': ' + JSON.stringify(v[kk])).join(',\n') + '\n  }');
        } else out.push('  ' + JSON.stringify(k) + ': ' + JSON.stringify(v));
      });
      return '{\n' + out.join(',\n') + '\n}\n';
    }

    commit() {
      const p = this.pretty();
      if (p === this.undoStack[this.undoStack.length - 1]) return;
      this.undoStack.push(p);
      if (this.undoStack.length > 120) this.undoStack.shift();
      this.redoStack = [];
      this.save(p);
      this.updateButtons();
      this.refreshCounts();
    }

    save(p) {
      try {
        localStorage.setItem(window.__draftKey, p);
        const d = new Date();
        this.setStatus('Brouillon enregistré ✓ ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + ':' + String(d.getSeconds()).padStart(2, '0'));
      } catch (e) {
        this.setStatus('⚠ Enregistrement local impossible : pense à exporter');
      }
    }

    restore(str) {
      const next = JSON.parse(str);
      this.sel = null;
      this.s.clearWorld();
      this.s.cfg = next;
      next.assetScale = next.assetScale || {};
      next.walkable = next.walkable || [];
      next.floors = next.floors || [];
      next.lights = next.lights || [];
      next.npcs = next.npcs || [];
      this.s.buildWorld();
      this.renderInsp();
      this.refreshCounts();
      this.save(str);
      this.updateButtons();
    }

    undo() {
      if (this.undoStack.length < 2) return;
      this.redoStack.push(this.undoStack.pop());
      this.restore(this.undoStack[this.undoStack.length - 1]);
    }

    redo() {
      if (!this.redoStack.length) return;
      const p = this.redoStack.pop();
      this.undoStack.push(p);
      this.restore(p);
    }

    resetDraft() {
      if (!confirm('Effacer ton brouillon et revenir à la version publiée ?')) return;
      try { localStorage.removeItem(window.__draftKey); } catch (e) {}
      location.reload();
    }

    test() {
      this.save(this.pretty());
      location.href = '?piece=' + this.cfg.id + '&brouillon';
    }

    /* ===================== export / import ===================== */
    openModal(title, text, editable, buttons) {
      const m = this.modal;
      m.innerHTML = '';
      const ta = h('textarea', { spellcheck: 'false' });
      ta.value = text; ta.readOnly = !editable;
      const bar = h('div', { class: 'ed-bar' });
      buttons(ta).forEach((b) => bar.appendChild(b));
      bar.appendChild(h('button', { text: 'Fermer', onclick: () => { m.hidden = true; } }));
      m.appendChild(h('div', { class: 'ed-box' }, h('b', { text: title }), ta, bar));
      m.hidden = false;
      return ta;
    }

    showExport() {
      const text = this.pretty();
      this.save(text);
      const info = h('span', { class: 'ed-status' });
      this.openModal('Exporter la pièce', text, false, (ta) => [
        h('button', { class: 'ed-primary', text: 'Copier', onclick: () => {
          ta.select();
          let ok = false;
          try { ok = document.execCommand('copy'); } catch (e) {}
          if (!ok && navigator.clipboard) navigator.clipboard.writeText(text).then(() => {}, () => {});
          ta.blur();
          alert('Copié. Colle ce texte dans data/' + this.cfg.id + '.json (ou envoie-le moi).');
        } }),
        h('button', { text: 'Télécharger', onclick: () => {
          const a = h('a', { href: URL.createObjectURL(new Blob([text], { type: 'application/json' })), download: this.cfg.id + '.json' });
          document.body.appendChild(a); a.click(); a.remove();
        } }),
        info
      ]);
    }

    showImport() {
      this.openModal('Importer un JSON de pièce', '', true, (ta) => [
        h('button', { class: 'ed-primary', text: 'Appliquer', onclick: () => {
          try {
            const o = JSON.parse(ta.value);
            if (!o || !Array.isArray(o.objects)) throw new Error('JSON de pièce invalide (il manque « objects »)');
            this.restore(JSON.stringify(o));
            this.commit();
            this.modal.hidden = true;
          } catch (e) { alert('Import impossible : ' + e.message); }
        } })
      ]);
    }

    /* ===================== caméra ===================== */
    fit() {
      const r = this.panel.getBoundingClientRect();
      const vw = window.innerWidth, vh = window.innerHeight;
      let fw = vw, fh = vh;
      if (vw >= 760) fw = r.left; else fh = r.top;
      this.free = { w: fw, h: fh };
      const W = this.cfg.world.width, H = this.cfg.world.height;
      const z = Math.max(0.2, Math.min((fw - 24) / W, (fh - 24) / H));
      this.cam.setZoom(z * this.dpr);
      this.cam.centerOn(W / 2 + (vw / 2 - fw / 2) / z, H / 2 + (vh / 2 - fh / 2) / z);
    }

    zoomAt(sx, sy, f) {
      const cam = this.cam;
      const b = cam.getWorldPoint(sx, sy);
      const bx = b.x, by = b.y;
      cam.setZoom(clamp(cam.zoom * f, 0.2 * this.dpr, 8 * this.dpr));
      const a = cam.getWorldPoint(sx, sy);
      cam.scrollX += bx - a.x;
      cam.scrollY += by - a.y;
    }

    zoomCenter(f) {
      const fr = this.free || { w: window.innerWidth, h: window.innerHeight };
      this.zoomAt(fr.w / 2 * this.dpr, fr.h / 2 * this.dpr, f);
    }

    viewCenterWorld() {
      const fr = this.free || { w: window.innerWidth, h: window.innerHeight };
      const p = this.cam.getWorldPoint(fr.w / 2 * this.dpr, fr.h / 2 * this.dpr);
      return { x: p.x, y: p.y };
    }

    get u() { return this.dpr / this.cam.zoom; }   // unités du monde par pixel écran

    /* ===================== saisie ===================== */
    bindInput() {
      const inp = this.s.input;
      inp.addPointer(1);
      if (inp.mouse) inp.mouse.disableContextMenu();
      inp.on('pointerdown', (p) => this.onDown(p));
      inp.on('pointermove', (p) => this.onMove(p));
      inp.on('pointerup', (p) => this.onUp(p));
      inp.on('pointerupoutside', (p) => this.onUp(p));
      inp.on('wheel', (p, over, dx, dy) => this.zoomAt(p.x, p.y, dy < 0 ? 1.12 : 1 / 1.12));

      const typing = () => {
        const a = document.activeElement;
        return a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT') && a.type !== 'checkbox' && a.type !== 'range';
      };
      window.addEventListener('keydown', (e) => {
        if (typing()) return;
        if (e.code === 'Space') { this.spaceDown = true; e.preventDefault(); return; }
        const k = e.key, mod = e.ctrlKey || e.metaKey;
        if (mod && (k === 'z' || k === 'Z')) { e.preventDefault(); if (e.shiftKey) this.redo(); else this.undo(); return; }
        if (mod && (k === 'y' || k === 'Y')) { e.preventDefault(); this.redo(); return; }
        if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); this.remove(); return; }
        if (k === 'Escape') { this.select(null); return; }
        if (!this.sel) return;
        const st = e.shiftKey ? 10 : 1;
        if (k === 'ArrowLeft') { e.preventDefault(); this.nudge(-st, 0); }
        else if (k === 'ArrowRight') { e.preventDefault(); this.nudge(st, 0); }
        else if (k === 'ArrowUp') { e.preventDefault(); this.nudge(0, -st); }
        else if (k === 'ArrowDown') { e.preventDefault(); this.nudge(0, st); }
        else if (k === 'd' || k === 'D') this.duplicate();
        else if (k === 'f' || k === 'F') this.flip();
        else if (k === '[') this.depthStep(-6);
        else if (k === ']') this.depthStep(6);
        else if (k === '+' || k === '=') this.scaleStep(1.05);
        else if (k === '-') this.scaleStep(1 / 1.05);
      });
      window.addEventListener('keyup', (e) => { if (e.code === 'Space') this.spaceDown = false; });
    }

    onDown(p) {
      const inp = this.s.input;
      if (inp.pointer1.isDown && inp.pointer2.isDown) { this.drag = null; return; }
      if (p.rightButtonDown() || p.middleButtonDown() || this.panTool || this.spaceDown) {
        this.drag = { kind: 'pan' }; return;
      }
      const w = this.cam.getWorldPoint(p.x, p.y);
      const wx = w.x, wy = w.y;

      // poignées de coin d'une zone sélectionnée
      if (this.mode !== 'obj' && this.sel && this.sel.type === this.mode) {
        const c = this.cornerAt(this.sel.ref, wx, wy);
        if (c) { this.drag = { kind: 'corner', corner: c }; return; }
      }

      // poignées de redimensionnement d'un objet sélectionné (comme une image)
      if (this.mode === 'obj' && this.sel && this.sel.type === 'obj' && !this.lock[this.sel.ref.layer || 'object']) {
        const c = this.objCornerAt(this.sel.ref, wx, wy);
        if (c) {
          const o = this.sel.ref, im = o._img, dw = im.displayWidth, dh = im.displayHeight;
          const east = c.charAt(1) === 'e', south = c.charAt(0) === 's';
          const fx = east ? o.x - dw / 2 : o.x + dw / 2, fy = south ? o.y - dh : o.y;     // coin opposé, qui reste fixe
          this.drag = { kind: 'resize', c: c, east: east, south: south, fx: fx, fy: fy, dw: dw, dh: dh,
            s0: o.scale == null ? 1 : o.scale, y0: o.y, sy0: o.sortY };
          return;
        }
      }

      const hits = this.pickAt(wx, wy);
      if (!hits.length) { this.select(null); this.drag = { kind: 'pan' }; return; }
      const idx = this.sel ? hits.findIndex((x) => x.ref === this.sel.ref) : -1;
      const target = idx >= 0 ? hits[idx] : hits[0];
      this.select(target);
      this.drag = {
        kind: 'move', ox: wx - target.ref.x, oy: wy - target.ref.y, sx: p.x, sy: p.y,
        moved: false, hits: hits, idx: idx >= 0 ? idx : 0, was: idx >= 0
      };
    }

    onMove(p) {
      const inp = this.s.input;
      const w0 = this.cam.getWorldPoint(p.x, p.y);
      this.coord.textContent = Math.round(w0.x) + ', ' + Math.round(w0.y);

      if (inp.pointer1.isDown && inp.pointer2.isDown) {
        const a = inp.pointer1, b = inp.pointer2;
        const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        if (this.pinch) {
          this.zoomAt(mx, my, d / this.pinch.d);
          this.cam.scrollX -= (mx - this.pinch.mx) / this.cam.zoom;
          this.cam.scrollY -= (my - this.pinch.my) / this.cam.zoom;
        }
        this.pinch = { d: d, mx: mx, my: my };
        this.drag = null;
        return;
      }
      this.pinch = null;

      const d = this.drag;
      if (!d || !p.isDown) return;
      if (d.kind === 'pan') {
        this.cam.scrollX -= (p.x - p.prevPosition.x) / this.cam.zoom;
        this.cam.scrollY -= (p.y - p.prevPosition.y) / this.cam.zoom;
      } else if (d.kind === 'move') {
        if (!d.moved && Math.hypot(p.x - d.sx, p.y - d.sy) / this.dpr < 4) return;
        d.moved = true;
        this.moveTo(this.sel, this.sn(w0.x - d.ox), this.sn(w0.y - d.oy));
      } else if (d.kind === 'corner') {
        this.dragCorner(this.sel.ref, d.corner, this.sn(w0.x), this.sn(w0.y));
      } else if (d.kind === 'resize') {
        this.dragResize(d, w0.x, w0.y);
      }
    }

    onUp(p) {
      const d = this.drag;
      this.drag = null;
      this.pinch = null;
      if (!d) return;
      if (d.kind === 'move') {
        if (d.moved) this.commit();
        else if (d.was && d.hits.length > 1) this.select(d.hits[(d.idx + 1) % d.hits.length]);
      } else if (d.kind === 'corner' || d.kind === 'resize') this.commit();
    }

    sn(v) { return this.snap ? Math.round(v / this.snap) * this.snap : Math.round(v); }

    /* ---------- sélection par clic ---------- */
    hitSprite(img, wx, wy) {
      if (!img || !img.scene) return false;
      const dw = img.displayWidth, dh = img.displayHeight;
      const lx = wx - (img.x - dw * img.originX), ly = wy - (img.y - dh * img.originY);
      if (lx < 0 || ly < 0 || lx >= dw || ly >= dh) return false;
      try {
        const fw = img.frame.width, fh = img.frame.height;
        let u = Math.floor(lx / dw * fw);
        const v = Math.floor(ly / dh * fh);
        if (img.flipX) u = fw - 1 - u;
        const a = this.s.textures.getPixelAlpha(u, v, img.texture.key, img.frame.name);
        return a == null ? true : a > 24;
      } catch (e) { return true; }
    }

    pickAt(wx, wy) {
      const cfg = this.cfg, hits = [], u = this.u;
      if (this.mode === 'obj') {
        cfg.lights.forEach((L) => {
          if (Math.hypot(wx - L.x, wy - L.y) <= 14 * u) hits.push({ type: 'light', ref: L, depth: 1e6 });
        });
        cfg.objects.forEach((o) => {
          if (this.lock[o.layer || 'object']) return;
          if (this.hitSprite(o._img, wx, wy)) hits.push({ type: 'obj', ref: o, depth: o._img.depth });
        });
        cfg.npcs.forEach((n) => { if (this.hitSprite(n._img, wx, wy)) hits.push({ type: 'npc', ref: n, depth: n._img.depth }); });
        if (cfg.player && this.hitSprite(cfg.player._img, wx, wy)) hits.push({ type: 'player', ref: cfg.player, depth: cfg.player._img.depth });
        hits.sort((a, b) => b.depth - a.depth);
      } else {
        const list = this.mode === 'walk' ? cfg.walkable : cfg.floors;
        list.forEach((r) => {
          if (wx >= r.x && wx <= r.x + r.w && wy >= r.y && wy <= r.y + r.h) hits.push({ type: this.mode, ref: r, depth: -r.w * r.h });
        });
        hits.sort((a, b) => b.depth - a.depth);
      }
      return hits;
    }

    /* taille réelle (en pixels du monde) de l'image et du bloc de collision, mise à jour en direct */
    updDims(o) {
      const im = o._img;
      if (!im || !im.scene) return;
      let s = 'Image : ' + Math.round(im.displayWidth) + ' × ' + Math.round(im.displayHeight) + ' px';
      const rc = o.rect;
      if (rc && o.solid !== false) s += '  ·  Bloc : ' + Math.round(rc.w) + ' × ' + Math.round(rc.h) + ' px';
      if (this.dimEl.textContent !== s) this.dimEl.textContent = s;
      if (this.fpInputs && rc) {
        const ph = [String(Math.round(rc.w)), String(Math.round(rc.h))];
        this.fpInputs.forEach((i, k) => { if (i.placeholder !== 'auto ' + ph[k]) i.placeholder = 'auto ' + ph[k]; });
      }
    }

    /* poignées aux 4 coins de l'image d'un objet */
    objCorners(o) {
      const im = o._img;
      if (!im || !im.scene) return null;
      const dw = im.displayWidth, dh = im.displayHeight;
      return { nw: [o.x - dw / 2, o.y - dh], ne: [o.x + dw / 2, o.y - dh], sw: [o.x - dw / 2, o.y], se: [o.x + dw / 2, o.y] };
    }

    objCornerAt(o, wx, wy) {
      const cs = this.objCorners(o);
      if (!cs) return null;
      const t = 18 * this.u;
      let best = null, bd = 1e9;
      for (const k in cs) {
        const dd = Math.max(Math.abs(wx - cs[k][0]), Math.abs(wy - cs[k][1]));
        if (dd <= t && dd < bd) { best = k; bd = dd; }
      }
      return best;
    }

    dragResize(d, wx, wy) {
      const o = this.sel.ref;
      // le coin tiré suit le pointeur le long de la diagonale : l'image garde ses proportions
      const cx = d.east ? d.fx + d.dw : d.fx - d.dw, cy = d.south ? d.fy + d.dh : d.fy - d.dh;
      const vx = cx - d.fx, vy = cy - d.fy;
      let f = ((wx - d.fx) * vx + (wy - d.fy) * vy) / (vx * vx + vy * vy);
      f = clamp(f, 0.05 / d.s0, 10 / d.s0);
      const dw = d.dw * f, dh = d.dh * f;
      o.x = Math.round(d.east ? d.fx + dw / 2 : d.fx - dw / 2);
      o.y = Math.round(d.south ? d.fy + dh : d.fy);
      const s = Math.round(d.s0 * f * 1000) / 1000;
      if (Math.abs(s - 1) < 0.005) delete o.scale; else o.scale = s;
      if (d.sy0 != null) o.sortY = d.sy0 + (o.y - d.y0);
      this.rebuild(this.sel);
      this.syncInsp();
    }

    cornerAt(r, wx, wy) {
      const t = 16 * this.u;
      const cs = { nw: [r.x, r.y], ne: [r.x + r.w, r.y], sw: [r.x, r.y + r.h], se: [r.x + r.w, r.y + r.h] };
      for (const k in cs) if (Math.abs(wx - cs[k][0]) <= t && Math.abs(wy - cs[k][1]) <= t) return k;
      return null;
    }

    dragCorner(r, c, x, y) {
      let x0 = r.x, y0 = r.y, x1 = r.x + r.w, y1 = r.y + r.h;
      if (c.charAt(1) === 'w') x0 = x; else x1 = x;
      if (c.charAt(0) === 'n') y0 = y; else y1 = y;
      r.x = Math.min(x0, x1 - 8); r.y = Math.min(y0, y1 - 8);
      r.w = Math.max(8, x1 - r.x); r.h = Math.max(8, y1 - r.y);
      this.rebuild(this.sel);
      this.syncInsp();
    }

    /* ===================== opérations sur la sélection ===================== */
    select(s) {
      this.sel = s ? { type: s.type, ref: s.ref } : null;
      this.renderInsp();
    }

    rebuild(sel) {
      if (!sel) return;
      const s = this.s, r = sel.ref;
      if (sel.type === 'obj') { s.destroyEntity(r); s.addObject(r); }
      else if (sel.type === 'npc') { s.destroyEntity(r); s.addNpc(r); }
      else if (sel.type === 'player') { s.destroyEntity(r); s.addPlayer(); }
      else if (sel.type === 'light') { s.destroyEntity(r); s.addLight(r); }
      else if (sel.type === 'floor') { s.destroyEntity(r); s.addFloor(r); }
    }

    moveTo(sel, x, y) {
      const r = sel.ref;
      const dy = y - r.y;
      r.x = x; r.y = y;
      if (sel.type === 'obj' && r.sortY != null) r.sortY += dy;
      if (sel.type === 'npc' && r.sortY != null) r.sortY += dy;
      this.rebuild(sel);
      this.syncInsp();
    }

    nudge(dx, dy) {
      if (!this.sel) return;
      const r = this.sel.ref;
      this.moveTo(this.sel, r.x + dx, r.y + dy);
      this.commit();
    }

    flip() {
      if (!this.sel || this.sel.type !== 'obj') return;
      const o = this.sel.ref;
      if (o.flipX) delete o.flipX; else o.flipX = true;
      this.rebuild(this.sel); this.commit(); this.renderInsp();
    }

    depthStep(d) {
      if (!this.sel || this.sel.type !== 'obj') return;
      const o = this.sel.ref;
      if ((o.layer || 'object') === 'object') o.sortY = Math.round((o.sortY != null ? o.sortY : o.y) + d);
      else o.order = (o.order || 0) + (d > 0 ? 1 : -1);
      this.rebuild(this.sel); this.commit(); this.renderInsp();
    }

    scaleStep(f) {
      if (!this.sel || this.sel.type !== 'obj') return;
      const o = this.sel.ref;
      o.scale = Math.round(clamp((o.scale == null ? 1 : o.scale) * f, 0.1, 6) * 1000) / 1000;
      this.rebuild(this.sel); this.commit(); this.renderInsp();
    }

    remove() {
      if (!this.sel) return;
      const t = this.sel.type, r = this.sel.ref, cfg = this.cfg;
      const list = t === 'obj' ? cfg.objects : t === 'light' ? cfg.lights : t === 'walk' ? cfg.walkable : t === 'floor' ? cfg.floors : null;
      if (!list) return;       // pnj et joueur ne se suppriment pas
      this.s.destroyEntity(r);
      list.splice(list.indexOf(r), 1);
      this.sel = null;
      this.commit(); this.renderInsp();
    }

    duplicate() {
      if (!this.sel) return;
      const t = this.sel.type, r = this.sel.ref, cfg = this.cfg;
      let list = null;
      if (t === 'obj') list = cfg.objects; else if (t === 'light') list = cfg.lights;
      else if (t === 'walk') list = cfg.walkable; else if (t === 'floor') list = cfg.floors;
      if (!list) return;
      const c = JSON.parse(JSON.stringify(r, (k, v) => (k.charAt(0) === '_' || k === 'rect' || k === 'talk') ? undefined : v));
      c.x += 16; c.y += 16;
      if (c.sortY != null) c.sortY += 16;
      list.push(c);
      if (t === 'obj') this.s.addObject(c); else if (t === 'light') this.s.addLight(c); else if (t === 'floor') this.s.addFloor(c);
      this.select({ type: t, ref: c });
      this.commit();
    }

    autoScale(key) {
      const cat = (this.s.assetMap[key] || '').split('/')[0];
      const tex = this.s.textures.exists(key) ? this.s.textures.get(key).getSourceImage() : null;
      const mx = tex ? Math.max(tex.width, tex.height) : 100;
      const target = BIG_CATS[cat] ? 230 : 120;
      return Math.round(Math.min(1, target / mx) * 100) / 100;
    }

    addFromPalette(key) {
      const cfg = this.cfg;
      if (!cfg.assetScale[key]) cfg.assetScale[key] = this.autoScale(key);
      const cat = (this.s.assetMap[key] || '').split('/')[0];
      const c = this.viewCenterWorld();
      const o = { key: key, x: this.sn(c.x), y: this.sn(c.y) };
      if (LAYER_BY_CAT[cat]) o.layer = LAYER_BY_CAT[cat];
      else if (/^(lantern_wall|candle_sconce)/.test(key)) o.layer = "walldecor";   // accrochés au mur
      cfg.objects.push(o);
      this.s.addObject(o);
      if (this.mode !== 'obj') this.setMode('obj');
      this.select({ type: 'obj', ref: o });
      this.commit();
      if (window.innerWidth < 760 && !this.panel.classList.contains('collapsed')) {
        this.panel.classList.add('collapsed'); this.toggle.textContent = '▴';
      }
    }

    floorTileScale(key) {
      const t = this.s.textures.exists(key) ? this.s.textures.get(key).getSourceImage() : null;
      return t && t.width > 200 ? Math.round(128 / t.width * 1000) / 1000 : null;
    }

    addZone() {
      const c = this.viewCenterWorld();
      const r = { x: this.sn(c.x - 100), y: this.sn(c.y - 40), w: 200, h: 80 };
      if (this.mode === 'floor') {
        const k = (this.cfg.floors[0] && this.cfg.floors[0].key) || 'floor_chevron_01';
        r.key = k;
        const ts = this.floorTileScale(k);
        if (ts) r.tileScale = ts;
        this.cfg.floors.push(r); this.s.addFloor(r);
      } else this.cfg.walkable.push(r);
      this.select({ type: this.mode, ref: r });
      this.commit();
    }

    addLight() {
      const c = this.viewCenterWorld();
      const L = { x: this.sn(c.x), y: this.sn(c.y), r: 80, a: 0.6 };
      this.cfg.lights.push(L);
      this.s.addLight(L);
      this.select({ type: 'light', ref: L });
      this.commit();
    }

    /* ===================== inspecteur ===================== */
    syncInsp() {
      const r = this.sel && this.sel.ref;
      if (!r) return;
      ['x', 'y', 'w', 'h'].forEach((k) => {
        const f = this.fields[k];
        if (f && document.activeElement !== f) f.value = Math.round(r[k]);
      });
      if (this.sel.type === 'obj' && this.fields.scale && document.activeElement !== this.fields.scale) {
        const n = Math.round((r.scale == null ? 1 : r.scale) * 100);
        this.fields.scale.value = n; if (this.fields.scaleRng) this.fields.scaleRng.value = n;
      }
    }

    renderInsp() {
      const box = this.insp;
      box.innerHTML = '';
      this.fields = {};
      this.dimEl = null; this.fpInputs = null;
      const sel = this.sel;
      this.btnDup.disabled = this.btnDel.disabled = !sel || sel.type === 'npc' || sel.type === 'player';
      this.selLabel.textContent = sel ? this.titleOf(sel) : '';

      const addBtn = (label, fn) => h('button', { class: 'ed-wide', text: label, onclick: fn });
      if (!sel) {
        box.appendChild(h('div', { class: 'ed-help', html:
          this.mode === 'obj'
            ? '<b>Touche un objet</b> pour le sélectionner, puis glisse-le. Retouche au même endroit pour passer à l’objet en dessous. ' +
              'Glisse dans le vide (ou ✋) pour déplacer la vue, molette / pincement pour zoomer.'
            : this.mode === 'walk'
              ? '<b>Zones de marche</b> (bleu) : là où le joueur peut aller. Touche une zone, glisse-la ou tire ses coins.'
              : '<b>Sols</b> (orange) : zones recouvertes par le motif de parquet.'
        }));
        if (this.mode === 'obj') box.appendChild(addBtn('＋ Ajouter une lumière', () => this.addLight()));
        else box.appendChild(addBtn('＋ Ajouter une zone', () => this.addZone()));
        this.addObjectList(box);
        return;
      }

      const r = sel.ref, t = sel.type;
      const num = (label, k, step) => {
        const i = h('input', { type: 'number', step: String(step || 1) });
        i.value = r[k] == null ? '' : Math.round(r[k] * 1000) / 1000;
        i.addEventListener('change', () => {
          const v = parseFloat(i.value);
          if (isNaN(v)) return;
          r[k] = (k === 'w' || k === 'h') ? Math.max(8, v) : v;
          this.rebuild(sel); this.commit();
        });
        this.fields[k] = i;
        return h('label', { class: 'ed-num' }, label, i);
      };
      const check = (label, get, set) => {
        const i = h('input', { type: 'checkbox' });
        i.checked = get();
        i.addEventListener('change', () => { set(i.checked); this.rebuild(sel); this.commit(); this.renderInsp(); });
        return h('label', { class: 'ed-chk' }, i, label);
      };

      box.appendChild(h('div', { class: 'ed-title' }, h('b', { text: this.titleOf(sel) }),
        t === 'obj' ? h('small', { text: ' ' + (CATS[(this.s.assetMap[r.key] || '').split('/')[0]] || '') }) : null));

      if (t === 'obj' || t === 'npc' || t === 'player' || t === 'light') {
        box.appendChild(h('div', { class: 'ed-row' }, num('X', 'x'), num('Y', 'y')));
      }

      if (r._actor && (t === 'obj' || t === 'npc' || t === 'player')) {
        const NAMES = { down: 'Face (vers le bas)', up: 'Dos (vers le haut)', left: 'Vers la gauche', right: 'Vers la droite' };
        const reg = h('select', { onchange: (e) => {
          if (t === 'player') { r._actor.face = e.target.value; r.face = e.target.value; }
          else { r.face = e.target.value; }
          this.rebuild(sel); this.commit(); this.renderInsp();
        } });
        Object.keys(r._actor.def.rows).forEach((k) => {
          const op = h('option', { value: k, text: NAMES[k] || k });
          if ((r.face || 'down') === k) op.selected = true;
          reg.appendChild(op);
        });
        box.appendChild(h('div', { class: 'ed-row' }, h('span', { text: 'Regard' }), reg));
      }

      if (t === 'obj') {
        const base = this.s.placeholders.has(r.key) ? 1 : ((this.cfg.assetScale || {})[r.key] ?? 1);
        const cur = Math.round((r.scale == null ? 1 : r.scale) * 100);
        const pct = h('input', { type: 'number', min: '5', max: '1000', step: '1', class: 'ed-pct' });
        pct.value = cur;
        const rng = h('input', { type: 'range', min: '10', max: '400', step: '1' });
        rng.value = cur;
        this.fields.scale = pct; this.fields.scaleRng = rng;
        const apply = (v) => {
          v = clamp(v, 0.05, 10);
          if (Math.abs(v - 1) < 0.005) delete r.scale; else r.scale = Math.round(v * 1000) / 1000;
          this.rebuild(sel);
        };
        rng.addEventListener('input', () => {
          apply(parseInt(rng.value, 10) / 100);
          pct.value = Math.round((r.scale == null ? 1 : r.scale) * 100);
        });
        rng.addEventListener('change', () => { this.commit(); });
        pct.addEventListener('change', () => {
          const n = parseFloat(String(pct.value).replace(',', '.'));
          if (isNaN(n) || n <= 0) { pct.value = Math.round((r.scale == null ? 1 : r.scale) * 100); return; }
          apply(n / 100);
          const now = Math.round((r.scale == null ? 1 : r.scale) * 100);
          pct.value = now; rng.value = now;
          this.commit();
        });
        pct.addEventListener('keydown', (e) => { if (e.key === 'Enter') pct.blur(); });
        box.appendChild(h('div', { class: 'ed-row' }, h('span', { text: 'Taille' }), rng, pct, h('span', { text: '%' })));
        this.dimEl = h('div', { class: 'ed-dim' });
        box.appendChild(this.dimEl);
        box.appendChild(h('div', { class: 'ed-row' },
          h('button', { text: 'Mémoriser cette taille', title: 'Les prochains « ' + r.key + ' » apparaîtront à cette taille', onclick: () => this.rememberScale() }),
          h('button', { text: 'Appliquer aux copies', title: 'Toutes les copies prennent la même taille', onclick: () => this.uniformScale() })));

        const lay = h('select', { onchange: (e) => {
          const v = e.target.value;
          if (v === 'object') delete r.layer; else r.layer = v;
          this.rebuild(sel); this.commit(); this.renderInsp();
        } });
        LAYERS.forEach(([id, label]) => {
          const op = h('option', { value: id, text: label });
          if ((r.layer || 'object') === id) op.selected = true;
          lay.appendChild(op);
        });
        box.appendChild(h('div', { class: 'ed-row' },
          check('Miroir', () => !!r.flipX, (v) => { if (v) r.flipX = true; else delete r.flipX; }), lay));

        const isObj = (r.layer || 'object') === 'object';
        box.appendChild(h('div', { class: 'ed-row' },
          h('span', { text: isObj ? 'Passe : ' + (r.sortY != null ? 'tri Y ' + Math.round(r.sortY) : 'auto') : 'Ordre ' + (r.order || 0) }),
          h('button', { text: '⬇ Derrière', onclick: () => this.depthStep(-6) }),
          h('button', { text: '⬆ Devant', onclick: () => this.depthStep(6) }),
          isObj ? h('button', { text: 'Auto', onclick: () => { delete r.sortY; this.rebuild(sel); this.commit(); this.renderInsp(); } }) : null));

        if (isObj) {
          const solidOn = r.solid !== false;
          const fpw = h('input', { type: 'number', placeholder: 'auto' });
          const fph = h('input', { type: 'number', placeholder: 'auto' });
          this.fpInputs = [fpw, fph];
          if (r.fp) { fpw.value = r.fp[0]; fph.value = r.fp[1]; }
          const setFp = () => {
            const a = parseFloat(fpw.value), b = parseFloat(fph.value);
            if (isNaN(a) || isNaN(b)) delete r.fp; else r.fp = [a, b];
            this.rebuild(sel); this.commit();
          };
          fpw.addEventListener('change', setFp); fph.addEventListener('change', setFp);
          box.appendChild(h('div', { class: 'ed-row' },
            check('Bloque le passage', () => r.solid !== false, (v) => { if (v) delete r.solid; else r.solid = false; }),
            check('Ombre', () => r.shadow !== false, (v) => { if (v) delete r.shadow; else r.shadow = false; })));
          if (solidOn) box.appendChild(h('div', { class: 'ed-row' },
            h('label', { class: 'ed-num' }, 'Bloc L', fpw), h('label', { class: 'ed-num' }, 'H', fph)));
        }
        if (r.talk) box.appendChild(h('div', { class: 'ed-help', text: 'Cet objet a un dialogue/une quête : il est conservé.' }));
      }

      if (t === 'light') {
        const a = h('input', { type: 'range', min: '5', max: '150', step: '1' });
        a.value = Math.round((r.a != null ? r.a : 0.6) * 100);
        a.addEventListener('input', () => { r.a = parseInt(a.value, 10) / 100; this.rebuild(sel); });
        a.addEventListener('change', () => this.commit());
        const rr = h('input', { type: 'range', min: '20', max: '300', step: '2' });
        rr.value = r.r || 80;
        rr.addEventListener('input', () => { r.r = parseInt(rr.value, 10); this.rebuild(sel); });
        rr.addEventListener('change', () => this.commit());
        box.appendChild(h('div', { class: 'ed-row' }, h('span', { text: 'Rayon' }), rr));
        box.appendChild(h('div', { class: 'ed-row' }, h('span', { text: 'Intensité' }), a));
        box.appendChild(h('div', { class: 'ed-row' },
          check('Vacille', () => !!r.flicker, (v) => { if (v) r.flicker = true; else delete r.flicker; })));
      }

      if (t === 'npc') box.appendChild(h('div', { class: 'ed-help', text: 'Personnage non joueur (remplaçant provisoire). Glisse-le pour le déplacer.' }));
      if (t === 'player') box.appendChild(h('div', { class: 'ed-help', text: 'Point de départ du joueur. Glisse-le pour le déplacer.' }));

      if (t === 'walk' || t === 'floor') {
        box.appendChild(h('div', { class: 'ed-row' }, num('X', 'x'), num('Y', 'y')));
        box.appendChild(h('div', { class: 'ed-row' }, num('L', 'w'), num('H', 'h')));
        if (t === 'floor') {
          const ks = Object.keys(this.s.assetMap).filter((k) => this.s.assetMap[k].split('/')[0] === 'floor');
          const sk = h('select', { onchange: (e) => {
            r.key = e.target.value;
            const ts = this.floorTileScale(r.key);
            if (ts) r.tileScale = ts; else delete r.tileScale;
            this.rebuild(sel); this.commit(); this.renderInsp();
          } });
          ks.forEach((k) => { const op = h('option', { value: k, text: k }); if (k === r.key) op.selected = true; sk.appendChild(op); });
          box.appendChild(h('div', { class: 'ed-row' }, h('span', { text: 'Motif' }), sk));
          box.appendChild(h('div', { class: 'ed-row' }, num('Échelle du motif', 'tileScale', 0.05)));
        }
        box.appendChild(h('div', { class: 'ed-help', text: 'Tire les carrés aux coins pour redimensionner.' }));
      }

      if (t === 'obj' || t === 'light' || t === 'walk' || t === 'floor') {
        box.appendChild(h('div', { class: 'ed-row' },
          h('button', { text: '⧉ Dupliquer', onclick: () => this.duplicate() }),
          h('button', { class: 'ed-danger', text: '🗑 Supprimer', onclick: () => this.remove() })));
      }
      box.appendChild(h('button', { class: 'ed-wide', text: 'Désélectionner', onclick: () => this.select(null) }));
    }

    addObjectList(box) {
      if (this.mode !== 'obj') return;
      const det = h('details', { class: 'ed-list' }, h('summary', { text: 'Tous les objets (' + this.cfg.objects.length + ')' }));
      this.cfg.objects.forEach((o, i) => {
        det.appendChild(h('button', { text: (o.layer ? '[' + o.layer + '] ' : '') + o.key + '  (' + Math.round(o.x) + ',' + Math.round(o.y) + ')',
          onclick: () => { this.select({ type: 'obj', ref: o }); this.cam.centerOn(o.x, o.y - 30); } }));
      });
      box.appendChild(det);
    }

    titleOf(sel) {
      const r = sel.ref;
      if (sel.type === 'obj') return r.key;
      if (sel.type === 'npc') return r.name || r.id || 'PNJ';
      if (sel.type === 'player') return 'Joueur (départ)';
      if (sel.type === 'light') return 'Lumière';
      if (sel.type === 'walk') return 'Zone de marche';
      return 'Sol ' + (r.key || '');
    }

    rememberScale() {
      if (!this.sel || this.sel.type !== 'obj') return;
      const o = this.sel.ref, k = o.key, cfg = this.cfg;
      const ratio = o.scale == null ? 1 : o.scale;
      if (Math.abs(ratio - 1) < 0.001) return;
      const base = cfg.assetScale[k] != null ? cfg.assetScale[k] : 1;
      cfg.assetScale[k] = Math.round(base * ratio * 1000) / 1000;
      cfg.objects.forEach((x) => {
        if (x.key !== k) return;
        const s = (x.scale == null ? 1 : x.scale) / ratio;
        if (Math.abs(s - 1) < 0.001) delete x.scale; else x.scale = Math.round(s * 1000) / 1000;
        this.rebuild({ type: 'obj', ref: x });
      });
      this.commit(); this.renderInsp();
    }

    uniformScale() {
      if (!this.sel || this.sel.type !== 'obj') return;
      const o = this.sel.ref;
      this.cfg.objects.forEach((x) => {
        if (x.key !== o.key) return;
        if (o.scale == null) delete x.scale; else x.scale = o.scale;
        this.rebuild({ type: 'obj', ref: x });
      });
      this.commit();
    }

    /* ===================== repères visuels ===================== */
    draw() {
      const g = this.g, cfg = this.cfg, u = this.u, mode = this.mode;
      g.clear();
      g.lineStyle(1.5 * u, 0xf3e9d2, 0.35);
      g.strokeRect(0, 0, cfg.world.width, cfg.world.height);

      if (this.guides) {
        const wm = mode === 'walk';
        cfg.walkable.forEach((r) => {
          g.fillStyle(0x4aa3ff, wm ? 0.14 : 0.04); g.fillRect(r.x, r.y, r.w, r.h);
          g.lineStyle((wm ? 2 : 1) * u, 0x4aa3ff, wm ? 0.9 : 0.35); g.strokeRect(r.x, r.y, r.w, r.h);
        });
        const fm = mode === 'floor';
        if (fm) cfg.floors.forEach((r) => {
          g.fillStyle(0xe0903a, 0.1); g.fillRect(r.x, r.y, r.w, r.h);
          g.lineStyle(2 * u, 0xe0903a, 0.9); g.strokeRect(r.x, r.y, r.w, r.h);
        });
        if (mode === 'obj') {
          g.lineStyle(1 * u, 0x55ff55, 0.55);
          this.s.solids.forEach((r) => g.strokeRect(r.x, r.y, r.w, r.h));
          cfg.lights.forEach((L) => {
            g.lineStyle(1 * u, 0xffd27a, 0.35); g.strokeCircle(L.x, L.y, L.r || 80);
            g.fillStyle(0xffd27a, 0.95); g.fillCircle(L.x, L.y, 6 * u);
            g.lineStyle(1.5 * u, 0x3a2410, 1); g.strokeCircle(L.x, L.y, 6 * u);
          });
        }
      }

      const sel = this.sel;
      if (!sel) return;
      const r = sel.ref;
      if (this.dimEl && sel.type === 'obj') this.updDims(r);
      if (sel.type === 'walk' || sel.type === 'floor') {
        g.lineStyle(2.5 * u, 0xffffff, 1); g.strokeRect(r.x, r.y, r.w, r.h);
        const s = 7 * u;
        [[r.x, r.y], [r.x + r.w, r.y], [r.x, r.y + r.h], [r.x + r.w, r.y + r.h]].forEach((c) => {
          g.fillStyle(0xffffff, 1); g.fillRect(c[0] - s, c[1] - s, 2 * s, 2 * s);
          g.lineStyle(1.5 * u, 0x222222, 1); g.strokeRect(c[0] - s, c[1] - s, 2 * s, 2 * s);
        });
      } else if (sel.type === 'light') {
        g.lineStyle(2.5 * u, 0xffffff, 1); g.strokeCircle(r.x, r.y, 11 * u);
      } else if (r._img && r._img.scene) {
        const im = r._img, dw = im.displayWidth, dh = im.displayHeight;
        g.lineStyle(2 * u, 0xffffff, 0.95); g.strokeRect(im.x - dw * im.originX, im.y - dh * im.originY, dw, dh);
        if (r.rect && sel.type === 'obj') {
          g.lineStyle(2 * u, 0x55ff55, 1); g.strokeRect(r.rect.x, r.rect.y, r.rect.w, r.rect.h);
        }
        if (sel.type === 'obj' && !this.lock[r.layer || 'object']) {
          const s = 7 * u, cs = this.objCorners(r);
          for (const k in cs) {
            g.fillStyle(0xffffff, 1); g.fillRect(cs[k][0] - s, cs[k][1] - s, 2 * s, 2 * s);
            g.lineStyle(1.5 * u, 0x222222, 1); g.strokeRect(cs[k][0] - s, cs[k][1] - s, 2 * s, 2 * s);
          }
        }
        g.fillStyle(0xe34a4a, 1); g.fillCircle(r.x, r.y, 4 * u);
        g.lineStyle(1.5 * u, 0xffffff, 1); g.strokeCircle(r.x, r.y, 4 * u);
      }
    }
  }

  window.Editor = Editor;
})();
