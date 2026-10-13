/* Scène « pièce » : construit toute la pièce à partir de data/<pièce>.json.
 *
 * Principes
 *  - tout est modulaire : sol en tuiles, murs et objets = PNG transparents indépendants ;
 *  - chaque objet est posé par son POINT AU SOL (bas-centre du sprite) : x, y ;
 *  - tri de profondeur par Y (un objet plus bas à l'écran passe devant) ;
 *  - si un PNG est absent, un rectangle de remplacement s'affiche (la scène reste jouable) ;
 *  - ?debug dans l'URL affiche les zones de collision et les coordonnées du pointeur.
 */
(function () {
  const $ = (id) => document.getElementById(id);
  const clamp = (v, a, b) => Math.min(Math.max(v, a), b);

  class RoomScene extends Phaser.Scene {
    constructor() { super('room'); }

    init(data) {
      this.cfg = data.room;
      this.assetMap = data.assets;
      this.dpr = data.dpr || 1;
      this.debug = !!data.debug;
      this.edit = !!data.edit;
      this.fromDraft = !!data.fromDraft;
      this.chars = data.chars || {};          // personnages animés (data/characters.json)
      this.game = data.game || {};            // réglages du scénario (data/game.json)
      this.comps = [];                        // compagnons qui suivent le joueur
      this.trail = [];                        // trace des pas du joueur
      this.moves = [];                        // déplacements scriptés en cours
      this.seq = null;                        // séquence de dialogue / mise en scène en cours
      this.actors = new Set();
      this.flags = this.loadFlags();
      this.transitioning = false;
      this.lines = null;
      this.entry = null;
      this.speaker = '';
      this.missing = new Set();
      this.placeholders = new Set();
      this.solids = [];
      this.talkables = [];
    }

    /* ---------- progression (drapeaux) : gardée dans ce navigateur ---------- */
    loadFlags() {
      if (this.edit) return {};
      try {
        const q = new URLSearchParams(location.search);
        if (q.has('reset')) localStorage.removeItem('exp2028:flags');
        const f = JSON.parse(localStorage.getItem('exp2028:flags') || '{}') || {};
        if (q.get('flags')) q.get('flags').split(',').forEach((k) => { if (k) f[k] = true; });   // pour tester : ?flags=a,b
        return f;
      } catch (e) { return {}; }
    }

    saveFlags() {
      try { localStorage.setItem('exp2028:flags', JSON.stringify(this.flags)); } catch (e) { /* navigation privée : pas grave */ }
    }

    setFlag(name) {
      if (!name || this.flags[name]) return;
      this.flags[name] = true;
      this.saveFlags();
      this.refreshAll();
    }

    /* Condition {needs, not} : vraie si le drapeau requis est levé et l'interdit ne l'est pas. */
    condOk(w) {
      if (!w || this.edit) return true;                  // l'éditeur montre tout
      const f = this.flags;
      return (!w.needs || !!f[w.needs]) && (!w.not || !f[w.not]);
    }

    /* Affiche, cache, rend solide ou non un élément selon son champ "when". */
    refreshState(e) {
      if (!e || !e._parts) return;
      const on = this.condOk(e.when);
      e._parts.forEach((p) => { if (p && p.scene) p.setVisible(on); });
      if (e.rect) {
        const i = this.solids.indexOf(e.rect), want = on && e._solid;
        if (want && i < 0) this.solids.push(e.rect);
        if (!want && i >= 0) this.solids.splice(i, 1);
      }
      if (e.talk) {
        const t = this.talkables.indexOf(e);
        if (on && t < 0) this.talkables.push(e);
        if (!on && t >= 0) this.talkables.splice(t, 1);
      }
    }

    refreshAll() {
      const c = this.cfg;
      [].concat(c.objects || [], c.npcs || [], c.lights || []).forEach((e) => this.refreshState(e));
    }

    /* ---------- chargement ---------- */
    preload() {
      const cfg = this.cfg;
      this.load.setPath('assets/');
      this.load.on('loaderror', (f) => this.missing.add(f.key));

      const keys = new Set();
      (cfg.floors || []).forEach((f) => keys.add(f.key));
      cfg.objects.forEach((o) => keys.add(o.key));
      (cfg.npcs || []).forEach((n) => n.key && keys.add(n.key));
      if (cfg.player && cfg.player.key) keys.add(cfg.player.key);
      (this.game.companions || []).forEach((c) => keys.add(c.key));

      if (this.edit) Object.keys(this.assetMap).forEach((k) => keys.add(k));

      // feuilles d'animation des personnages utilisés (tous en mode éditeur)
      const loadChars = this.edit ? Object.keys(this.chars) : [...keys].filter((k) => this.chars[k]);
      loadChars.forEach((k) => {
        const d = this.chars[k];
        if (d) this.load.spritesheet(k + '__sheet', d.sheet, { frameWidth: d.cell[0], frameHeight: d.cell[1] });
      });

      keys.forEach((k) => {
        const path = this.assetMap[k];
        if (path) this.load.image(k, path);
        else this.missing.add(k);
      });
    }

    /* ---------- textures générées par le code ---------- */
    makeCanvasTexture(key, w, h, draw) {
      if (this.textures.exists(key)) return;
      const t = this.textures.createCanvas(key, w, h);
      draw(t.getContext(), w, h);
      t.refresh();
    }

    makeSharedTextures() {
      this.makeCanvasTexture('glow', 128, 128, (c, w, h) => {
        const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
        g.addColorStop(0, 'rgba(255,214,150,1)');
        g.addColorStop(0.35, 'rgba(255,170,80,0.45)');
        g.addColorStop(1, 'rgba(255,140,40,0)');
        c.fillStyle = g; c.fillRect(0, 0, w, h);
      });
      this.makeCanvasTexture('shadow', 64, 64, (c, w, h) => {
        const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
        g.addColorStop(0, 'rgba(0,0,0,0.85)');
        g.addColorStop(0.6, 'rgba(0,0,0,0.35)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = g; c.fillRect(0, 0, w, h);
      });
    }

    // rectangle de remplacement quand le PNG n'existe pas
    makePlaceholder(key, spec) {
      spec = spec || {};
      const w = spec.w || 48, h = spec.h || 64;
      this.placeholders.add(key);
      if (this.textures.exists(key)) return;
      this.makeCanvasTexture(key, w, h, (c) => {
        if (spec.person) {
          // petit personnage provisoire
          const cx = w / 2;
          c.fillStyle = '#2b3a55'; c.fillRect(cx - w * 0.28, h * 0.58, w * 0.24, h * 0.4);
          c.fillRect(cx + w * 0.04, h * 0.58, w * 0.24, h * 0.4);
          c.fillStyle = spec.color || '#8b2a35'; c.fillRect(cx - w * 0.36, h * 0.28, w * 0.72, h * 0.34);
          c.fillStyle = '#e0b48a'; c.beginPath(); c.arc(cx, h * 0.17, w * 0.27, 0, Math.PI * 2); c.fill();
          c.fillStyle = spec.hair || '#5a3a26'; c.fillRect(cx - w * 0.27, h * 0.05, w * 0.54, h * 0.09);
        } else {
          c.fillStyle = spec.color || 'rgba(201,162,74,0.35)'; c.fillRect(0, 0, w, h);
          c.strokeStyle = '#f3e9d2'; c.lineWidth = 1; c.strokeRect(0.5, 0.5, w - 1, h - 1);
          c.fillStyle = '#f3e9d2'; c.font = '9px monospace'; c.textBaseline = 'top';
          c.fillText(String(key).slice(0, Math.floor(w / 5.5)), 2, 2);
        }
      });
    }

    ensureTexture(key, spec) {
      if (this.missing.has(key) || !this.textures.exists(key)) this.makePlaceholder(key, spec);
    }

    /* ---------- construction ---------- */
    create() {
      this.makeSharedTextures();
      this.buildWorld();

      // caméra
      this.setupCamera();

      // saisie clavier (désactivée en mode éditeur pour ne pas gêner la saisie de texte)
      this.keys = this.edit ? null : this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,ENTER,E');

      if (this.debug) this.setupDebug();

      this.updateQuest();
      this.hint = { box: $('hint'), label: $('hint-label') };

      // pour les tests automatiques
      window.__scene = this;

      if (this.edit && window.Editor) this.editor = new window.Editor(this);
    }

    /* Construit tout le contenu de la pièce depuis this.cfg (réutilisable par l'éditeur). */
    buildWorld() {
      const cfg = this.cfg;
      this.solids = [];
      this.talkables = [];
      (cfg.floors || []).forEach((f) => this.addFloor(f));
      cfg.objects.forEach((o) => this.addObject(o));
      (cfg.npcs || []).forEach((n) => this.addNpc(n));
      this.addPlayer();
      this.spawnCompanions();
      (cfg.lights || []).forEach((L) => this.addLight(L));
      this.refreshAll();
    }

    /* Détruit tout le contenu (avant de recharger une autre version de la pièce). */
    clearWorld() {
      const cfg = this.cfg;
      this.comps.forEach((c) => this.destroyEntity(c));
      this.comps = []; this.trail = []; this.moves = [];
      [].concat(cfg.floors || [], cfg.objects || [], cfg.npcs || [], cfg.lights || [], [cfg.player])
        .forEach((e) => e && this.destroyEntity(e));
      this.solids = [];
      this.talkables = [];
    }

    /* Détruit les éléments graphiques d'une entité (objet, pnj, lumière, sol…). */
    destroyEntity(e) {
      (e._parts || []).forEach((p) => {
        if (p && p.scene) { this.tweens.killTweensOf(p); p.destroy(); }
      });
      e._parts = [];
      if (e._actor) { this.actors.delete(e); e._actor = null; }
      e._w = null;
      if (e.rect) {
        const i = this.solids.indexOf(e.rect);
        if (i >= 0) this.solids.splice(i, 1);
        e.rect = null;
      }
      const t = this.talkables.indexOf(e);
      if (t >= 0) this.talkables.splice(t, 1);
    }

    addFloor(f) {
      this.ensureTexture(f.key, { w: 64, h: 64, color: '#5a3a26' });
      const ts = this.add.tileSprite(f.x, f.y, f.w, f.h, f.key).setOrigin(0, 0).setDepth(0);
      if (f.tileScale) ts.setTileScale(f.tileScale, f.tileScale);
      f._parts = [ts];
    }

    spriteScale(key, o) {
      const base = this.placeholders.has(key) ? 1 : ((this.cfg.assetScale || {})[key] ?? 1);
      return base * ((o && o.scale) ?? 1);
    }

    /* Image ou sprite animé (si la clé est un personnage de data/characters.json). */
    makeImage(e, sc, keyOverride) {
      const key = keyOverride || e.key;
      const def = this.chars[key];
      const tex = key + '__sheet';
      let img;
      if (def && this.textures.exists(tex)) {
        img = this.add.sprite(e.x, e.y, tex, 0).setOrigin(0.5, 1).setScale(sc);
        e._actor = { img: img, def: def, face: e.face || 'down', t: 0, moving: false, key: '' };
        this.actors.add(e);
        this.applyActor(e);
      } else {
        img = this.add.image(e.x, e.y, key).setOrigin(0.5, 1).setScale(sc);
      }
      return img;
    }

    /* Choisit l'image de la feuille selon la direction, la marche et le temps. */
    applyActor(e) {
      const A = e._actor;
      if (!A || !A.img || !A.img.scene) return;
      const d = A.def, cols = d.frames || 4;
      const face = d.rows[A.face] != null ? A.face : 'down';
      const n = (d.counts && d.counts[face]) || cols;
      let row = d.rows[face], f = 0, flip = false, bob = 0;
      const idleOn = d.idle && d.idle.fps && (!d.idle.faces || d.idle.faces.indexOf(face) >= 0);
      if (A.moving && d.walk) {
        const w = d.walk, st = A.t * w.fps / 1000, si = Math.floor(st);
        const wr = d.walkRows && d.walkRows[face];          // rangée de marche dédiée à cette direction
        if (wr) { row = d.rows[wr]; f = si % ((d.counts && d.counts[wr]) || cols); }
        else f = si % n;
        if (!wr && (w.flipAlt || []).indexOf(face) >= 0) { flip = (si % 2) === 1; bob = (w.bob || 0) * Math.sin(Math.PI * (st - si)); }
      } else if (idleOn) {
        f = Math.floor(A.t * d.idle.fps / 1000) % n;
      } else if (d.stand && d.stand[face]) {
        row = d.rows[d.stand[face][0]]; f = d.stand[face][1];
      }
      if (e.flipX) flip = !flip;
      const k = row + ':' + f + ':' + flip + ':' + Math.round(bob * 4);
      if (k === A.key) return;
      A.key = k;
      A.img.setFrame(row * cols + f);
      A.img.setFlipX(flip);
      const sc = Math.abs(A.img.scaleY) || 1;
      A.img.setOrigin(0.5, 1 + (bob / sc) / d.cell[1]);
    }

    tickActors(delta) {
      this.actors.forEach((e) => {
        const A = e._actor;
        if (!A) return;
        if (A.moving || (A.def.idle && A.def.idle.fps)) { A.t += delta; this.applyActor(e); }
      });
    }

    /* Un personnage avec "wander": rayon (px) se promène autour de sa position de départ. */
    canStandActor(e, x, y) {
      if (!this.walkable(x - 6, y) || !this.walkable(x + 6, y) || !this.walkable(x - 6, y - 6) || !this.walkable(x + 6, y - 6)) return false;
      const f = { x: x - 8, y: y - 6, w: 16, h: 6 };
      for (const s of this.solids) {
        if (s === e.rect) continue;
        if (f.x < s.x + s.w && f.x + f.w > s.x && f.y < s.y + s.h && f.y + f.h > s.y) return false;
      }
      const p = this.player;
      return !p || Math.hypot(p.x - x, p.y - y) > 24;
    }

    moveActor(e, x, y) {
      const dx = x - e.x, dy = y - e.y;
      e.x = x; e.y = y;
      const A = e._actor;
      A.img.setPosition(x, y);
      if (e.sortY != null) e.sortY += dy;
      A.img.setDepth(e.sortY != null ? e.sortY : y);
      const sh = e._parts && e._parts[1];
      if (sh && sh.scene) sh.setPosition(x, y - 1).setDepth(A.img.depth - 0.5);
      if (e.rect) { e.rect.x += dx; e.rect.y += dy; }
    }

    updateWander(delta, paused) {
      this.actors.forEach((e) => {
        if (!(e.wander > 0) || !e._actor) return;
        const A = e._actor, rows = A.def.rows;
        const w = e._w || (e._w = { st: 'idle', t: 800 + Math.random() * 2500, hx: e.x, hy: e.y });
        if (paused || this.near === e || this.talkTarget === e) { A.moving = false; return; }
        if (w.st === 'idle') {
          A.moving = false;
          w.t -= delta;
          if (w.t > 0) return;
          for (let i = 0; i < 8; i++) {
            const a = Math.random() * Math.PI * 2, d = 25 + Math.random() * Math.max(10, e.wander - 25);
            const tx = w.hx + Math.cos(a) * d, ty = w.hy + Math.sin(a) * d * 0.6;
            if (this.canStandActor(e, tx, ty)) { w.st = 'walk'; w.tx = tx; w.ty = ty; break; }
          }
          if (w.st !== 'walk') w.t = 1500;
        } else {
          const dx = w.tx - e.x, dy = w.ty - e.y, d = Math.hypot(dx, dy);
          const step = (e.wanderSpeed || 28) * Math.min(delta, 50) / 1000;
          if (d <= step || !this.canStandActor(e, e.x + dx / d * step, e.y + dy / d * step)) {
            if (d <= step) this.moveActor(e, w.tx, w.ty);
            w.st = 'idle'; w.t = 2500 + Math.random() * 4500; A.moving = false; A.t = 0;
            const f = Math.random() < 0.75 ? 'down' : 'up';
            A.face = rows[f] != null ? f : 'down';
            this.applyActor(e);
            return;
          }
          this.moveActor(e, e.x + dx / d * step, e.y + dy / d * step);
          if (Math.abs(dx) > 0.5) A.face = dx < 0 ? 'left' : 'right';
          if (rows[A.face] == null) A.face = 'down';
          A.moving = true;
        }
      });
    }

    /* Tourne un personnage vers un point. */
    faceToward(e, x, y) {
      const A = e._actor;
      if (!A) return;
      const dx = x - e.x, dy = y - e.y;
      A.face = Math.abs(dx) > Math.abs(dy) * 1.2 ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
      this.applyActor(e);
    }

    addObject(o) {
      this.ensureTexture(o.key, (this.cfg.placeholders || {})[o.key]);
      const sc = this.spriteScale(o.key, o);
      const img = this.makeImage(o, sc);
      if (o.flipX && !o._actor) img.setFlipX(true);
      if (o.alpha != null) img.setAlpha(o.alpha);

      const layer = o.layer || 'object';
      let depth;
      if (o.depth != null) depth = o.depth;
      else if (layer === 'floor') depth = 1 + (o.order || 0) * 0.01;
      else if (layer === 'wall') depth = 10 + (o.order || 0) * 0.01;
      else if (layer === 'walldecor') depth = 20 + (o.order || 0) * 0.01;
      else depth = (o.sortY != null ? o.sortY : o.y);
      img.setDepth(depth);
      o._img = img;
      o._parts = [img];

      if (layer === 'object' && o.shadow !== false) {
        const w = img.displayWidth * (o.shadowW || 0.9);
        o._parts.push(this.add.image(o.x, o.y - 1, 'shadow')
          .setDisplaySize(w, clamp(w * 0.2, 6, 20)).setAlpha(0.5).setDepth(depth - 0.5));
      }

      o._solid = layer === 'object' && o.solid !== false;
      if (layer === 'object' && o.solid !== false) {
        const w = o.fp ? o.fp[0] : Math.min(img.displayWidth * 0.8, 260);
        const h = o.fp ? o.fp[1] : clamp(img.displayHeight * 0.16, 6, 16);
        o.rect = { x: o.x - w / 2 + (o.fpx || 0), y: o.y - h, w, h };
        this.solids.push(o.rect);
      } else {
        o.rect = { x: o.x - 6, y: o.y - 6, w: 12, h: 6 };
      }
      if (o.talk) this.talkables.push(o);
    }

    addNpc(n) {
      const spec = n.placeholder || { w: 28, h: 62, person: true, color: '#c9c3b5' };
      this.ensureTexture(n.key || ('npc_' + n.id), spec);
      const key = n.key || ('npc_' + n.id);
      const sc = this.spriteScale(key, n);
      const img = this.makeImage(n, sc, key);
      const depth = n.sortY != null ? n.sortY : n.y;
      img.setDepth(depth);
      const sh = this.add.image(n.x, n.y - 1, 'shadow').setDisplaySize(img.displayWidth * 0.9, 9).setAlpha(0.45).setDepth(depth - 0.5);
      n._img = img;
      n._parts = [img, sh];
      const w = n.fp ? n.fp[0] : 16, h = n.fp ? n.fp[1] : 8;
      n.rect = { x: n.x - w / 2, y: n.y - h, w, h };
      n._solid = n.solid !== false;
      if (n.solid !== false) this.solids.push(n.rect);
      if (n.talk) this.talkables.push(n);
    }

    addPlayer() {
      const P = this.cfg.player;
      const key = P.key || 'player';
      this.ensureTexture(key, { w: 28, h: 62, person: true, color: '#f3e9d2', hair: '#4a2f1e' });
      const sc = this.spriteScale(key, P);
      this.player = this.makeImage(P, sc, key).setDepth(P.y);
      this.pShadow = this.add.image(P.x, P.y - 1, 'shadow')
        .setDisplaySize(this.player.displayWidth * 0.9, 9).setAlpha(0.55).setDepth(P.y - 0.5);
      this.speed = P.speed || 150;
      P._img = this.player;
      P._parts = [this.player, this.pShadow];
    }

    addLight(L) {
      const a = L.a != null ? L.a : 0.6;
      const im = this.add.image(L.x, L.y, 'glow')
        .setBlendMode(Phaser.BlendModes.ADD).setScale((L.r || 80) / 64).setAlpha(a).setDepth(9000);
      if (L.tint) im.setTint(parseInt(String(L.tint).replace('#', '0x'), 16));
      L._img = im;
      L._parts = [im];
      if (L.flicker) {
        this.tweens.add({
          targets: im, alpha: a * 0.72, duration: 320 + Math.random() * 280,
          yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
        });
      }
    }

    /* ---------- caméra ---------- */
    setupCamera() {
      const W = this.cfg.world.width, H = this.cfg.world.height;
      const cam = this.cameras.main;
      cam.setBackgroundColor(this.cfg.background || '#0b0705');
      cam.setBounds(0, 0, W, H);
      if (!this.edit) { cam.stopFollow(); cam.startFollow(this.player, true, 0.12, 0.12); }
      cam.roundPixels = false;
      if (this.edit) { cam.removeBounds(); return; }
      this.applyZoom();
      cam.centerOn(this.player.x, this.player.y);
      if (!this._resizeBound) { this._resizeBound = true; this.scale.on('resize', () => this.applyZoom()); }
    }

    applyZoom() {
      const W = this.cfg.world.width, H = this.cfg.world.height;
      const cw = this.scale.width / this.dpr, ch = this.scale.height / this.dpr;
      const fit = Math.min(cw / W, ch / H);
      const min = (this.cfg.camera && this.cfg.camera.minZoom) || 0.85;
      const max = (this.cfg.camera && this.cfg.camera.maxZoom) || 3.2;
      const z = clamp(Math.max(fit, min), 0.2, max);
      const cam = this.cameras.main;
      cam.setZoom(z * this.dpr);

      // si l'écran montre plus que la pièce, on étend les limites pour centrer la pièce
      // (sinon elle reste collée en haut ou à gauche)
      const vw = cw / z, vh = ch / z;
      const bw = Math.max(W, vw), bh = Math.max(H, vh);
      cam.setBounds(-(bw - W) / 2, -(bh - H) / 2, bw, bh);
      if (this.player) cam.centerOn(this.player.x, this.player.y);
    }

    /* ---------- mouvement ---------- */
    walkable(x, y) {
      const list = this.cfg.walkable;
      if (!list) return true;
      return list.some((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
    }

    canStand(x, y) {
      const hw = 7, hh = 8;
      if (!(this.walkable(x - hw, y) && this.walkable(x + hw, y) &&
            this.walkable(x - hw, y - hh) && this.walkable(x + hw, y - hh))) return false;
      const f = { x: x - hw, y: y - hh, w: hw * 2, h: hh };
      for (const s of this.solids) {
        if (f.x < s.x + s.w && f.x + f.w > s.x && f.y < s.y + s.h && f.y + f.h > s.y) return false;
      }
      return true;
    }

    tryMove(dx, dy) {
      const p = this.player;
      const nx = p.x + dx, ny = p.y + dy;
      if (this.canStand(nx, ny)) { p.x = nx; p.y = ny; }
    }

    setPlayerMoving(moving, dx, dy) {
      const P = this.cfg.player, A = P && P._actor;
      if (!A) return;
      if (dx || dy) A.face = Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
      if (!moving && A.moving) A.t = 0;
      A.moving = moving;
      this.applyActor(P);
    }

    /* ---------- boucle ---------- */
    update(time, delta) {
      if (this.edit) { window.Controls.act = false; return; }
      if (this.transitioning) { window.Controls.act = false; this.setPlayerMoving(false, 0, 0); this.tickActors(delta); return; }
      const K = Phaser.Input.Keyboard.JustDown, k = this.keys;
      let act = window.Controls.act || K(k.SPACE) || K(k.ENTER) || K(k.E);
      window.Controls.act = false;

      if (this.seq) {
        this.setPlayerMoving(false, 0, 0);
        this.updateWander(delta, true);
        this.updateMoves(delta);
        this.tickActors(delta);
        const S = this.seq;
        if (S.mode === 'line') { if (act) this.advanceSeq(); }
        else if (S.mode === 'wait') { S.t -= delta; if (S.t <= 0) this.advanceSeq(); }
        else if (S.mode === 'move') { if (!this.moves.length) this.advanceSeq(); }
        return;
      }

      let dx = window.Controls.x, dy = window.Controls.y;
      if (k.LEFT.isDown || k.A.isDown) dx -= 1;
      if (k.RIGHT.isDown || k.D.isDown) dx += 1;
      if (k.UP.isDown || k.W.isDown) dy -= 1;
      if (k.DOWN.isDown || k.S.isDown) dy += 1;
      const m = Math.hypot(dx, dy);
      if (m > 1) { dx /= m; dy /= m; }

      const step = this.speed * Math.min(delta, 50) / 1000;
      const px0 = this.player.x, py0 = this.player.y;
      this.tryMove(dx * step, 0);
      this.tryMove(0, dy * step);
      const moved = Math.abs(this.player.x - px0) + Math.abs(this.player.y - py0) > 0.01;
      this.setPlayerMoving(moved, dx, dy);
      this.updateWander(delta, false);
      this.updateMoves(delta);
      this.updateFollowers(delta);
      this.tickActors(delta);

      const p = this.player;
      p.setDepth(p.y);
      this.pShadow.setPosition(p.x, p.y - 1).setDepth(p.y - 0.5);

      // objet ou personnage à portée
      let best = null, bd = 1e9;
      for (const t of this.talkables) {
        if (!this.pickEntry(t)) continue;                 // rien à dire pour l'instant : inerte
        const r = t.rect, pad = t.reach || 26;
        const cx = clamp(p.x, r.x - pad, r.x + r.w + pad);
        const cy = clamp(p.y, r.y - pad, r.y + r.h + pad);
        const inside = p.x >= r.x - pad && p.x <= r.x + r.w + pad && p.y >= r.y - pad && p.y <= r.y + r.h + pad;
        if (!inside) continue;
        const d = Math.hypot(p.x - (r.x + r.w / 2), p.y - (r.y + r.h / 2));
        if (d < bd) { bd = d; best = t; }
      }
      this.near = best;
      $('act').classList.toggle('on', !!best);
      if (this.hint) {
        this.hint.box.hidden = !best;
        if (best) this.hint.label.textContent = best.label || 'Examiner';
      }
      if (act && best) this.talk(best);

      this.checkExits();
      if (this.debug) this.updateDebug();
    }

    /* ---------- sorties : passer d'une pièce à l'autre ----------
     * "exits": [{ x, y, w, h, to: "reserve", spawn: { x, y, face }, when: { needs, not } }]
     * Quand le joueur entre dans le rectangle, fondu, puis arrivée à "spawn" dans la pièce "to".
     * "spawn" doit être HORS du rectangle de sortie de l'autre pièce, sinon retour immédiat. */
    checkExits() {
      const list = this.cfg.exits;
      if (!list || this.transitioning) return;
      const p = this.player;
      for (const x of list) {
        if (!this.condOk(x.when)) continue;
        if (p.x >= x.x && p.x <= x.x + x.w && p.y >= x.y && p.y <= x.y + x.h) { this.goToRoom(x.to, x.spawn); return; }
      }
    }

    goToRoom(id, spawn) {
      if (this.transitioning) return;
      this.transitioning = true;
      const cam = this.cameras.main;
      this.setPlayerMoving(false, 0, 0);
      $('act').classList.remove('on');
      if (this.hint) this.hint.box.hidden = true;
      const wanted = fetch('data/' + id + '.json').then((r) => { if (!r.ok) throw new Error(id + ' introuvable'); return r.json(); });
      cam.once('camerafadeoutcomplete', () => {
        wanted.then((room) => this.enterRoom(room, spawn))
          .catch((e) => { console.error(e); cam.fadeIn(250, 11, 7, 5); this.transitioning = false; });
      });
      cam.fadeOut(300, 11, 7, 5);
    }

    enterRoom(room, spawn) {
      if (this.fromDraft) {
        try { const d = localStorage.getItem('exp2028:draft:' + room.id); if (d) room = JSON.parse(d); } catch (e) { /* tant pis */ }
      }
      this.clearWorld();
      this.cfg = room;
      room.assetScale = room.assetScale || {}; room.walkable = room.walkable || []; room.floors = room.floors || [];
      room.lights = room.lights || []; room.npcs = room.npcs || []; room.objects = room.objects || [];
      room.player = room.player || { x: 100, y: 100 };
      if (spawn) { room.player.x = spawn.x; room.player.y = spawn.y; if (spawn.face) room.player.face = spawn.face; }
      this.near = null; this.talkTarget = null;

      const keys = new Set();
      room.floors.forEach((f) => keys.add(f.key));
      room.objects.forEach((o) => keys.add(o.key));
      room.npcs.forEach((n) => n.key && keys.add(n.key));
      if (room.player.key) keys.add(room.player.key);
      (this.game.companions || []).forEach((c) => keys.add(c.key));
      let todo = 0;
      keys.forEach((k) => {
        const d = this.chars[k];
        if (d && !this.textures.exists(k + '__sheet')) { this.load.spritesheet(k + '__sheet', d.sheet, { frameWidth: d.cell[0], frameHeight: d.cell[1] }); todo++; }
        if (this.textures.exists(k)) return;
        const path = this.assetMap[k];
        if (path) { this.load.image(k, path); todo++; } else this.missing.add(k);
      });
      const go = () => {
        this.buildWorld();
        this.setupCamera();
        this.updateQuest();
        this.cameras.main.fadeIn(350, 11, 7, 5);
        this.transitioning = false;
      };
      if (todo) { this.load.once('complete', go); this.load.start(); } else go();
    }

    /* ---------- dialogues, mises en scène et quête ----------
     * Une réplique "talk" = { who, portrait, needs, not, sets, text: [ ... ] }.
     * Chaque élément de "text" est :
     *   - une chaîne                    → dite par "who" (avec son portrait) ;
     *   - { who, t, off }               → réplique d'un autre personnage ("off": hors champ, sans portrait) ;
     *   - { do: "wait", ms }            → silence (la boîte de dialogue se ferme) ;
     *   - { do: "set", flag }           → lève un drapeau ;
     *   - { do: "fragment", flag }      → ajoute un fragment (bandeau + son) ;
     *   - { do: "move", id, to: [[x,y],…], speed, wait } → un personnage marche (id = "cecile", "thomas" ou l'id d'un PNJ) ;
     *   - { do: "summon", from: {id:[x,y]}, to: {id:[[x,y],…]} } → les compagnons rejoignent le joueur et le suivent. */
    pickEntry(t) {
      const f = this.flags;
      return (t.talk || []).find((e) => (!e.needs || f[e.needs]) && (!e.not || !f[e.not]));
    }

    talk(t) {
      const e = this.pickEntry(t);
      if (!e) return;
      this.entry = e;
      this.talkTarget = t;
      if (t._actor) this.faceToward(t, this.player.x, this.player.y);
      this.defWho = e.who || t.name || '';
      this.defPortrait = e.portrait || t.portrait || '';
      if (this.hint) this.hint.box.hidden = true;
      this.startSeq((e.text || []).slice(), () => {
        $('dlg').hidden = true;
        const tt = this.talkTarget; this.talkTarget = null;
        if (tt && tt._actor) { tt._actor.face = tt.face || 'down'; this.applyActor(tt); }
        if (e.sets) this.setFlag(e.sets);
        this.entry = null;
        this.updateQuest();
      });
    }

    startSeq(items, onEnd) {
      this.seq = { items: items, onEnd: onEnd, mode: 'idle', t: 0 };
      this.advanceSeq();
    }

    advanceSeq() {
      const S = this.seq;
      if (!S) return;
      for (;;) {
        if (!S.items.length) {
          const end = S.onEnd; this.seq = null;
          if (end) end();
          return;
        }
        const it = S.items.shift();
        if (typeof it === 'string' || it.t != null) { this.showLine(it); S.mode = 'line'; return; }
        if (this.runAction(it, S)) return;                // true = l'action fait attendre
      }
    }

    runAction(it, S) {
      const hide = () => { $('dlg').hidden = true; };
      switch (it.do) {
        case 'wait': hide(); S.mode = 'wait'; S.t = it.ms || 600; return true;
        case 'set': this.setFlag(it.flag); return false;
        case 'fragment': hide(); this.giveFragment(it.flag); S.mode = 'wait'; S.t = it.ms || 1800; return true;
        case 'move': {
          hide();
          const e = this.actorById(it.id);
          if (e) this.queueMove(e, it.to, it.speed, it.end);
          if (!e || it.wait === false) return false;
          S.mode = 'move'; return true;
        }
        case 'face': { const e = this.actorById(it.id); if (e && e._actor) { e._actor.face = it.dir || 'down'; this.applyActor(e); } return false; }
        case 'summon': {
          hide();
          if (!this.flags.compagnons) this.setFlag('compagnons');
          if (!this.comps.length) {
            (this.game.companions || []).forEach((d) => {
              const c = this.addCompanion(d, (it.from || {})[d.id]);
              if (it.to && it.to[d.id]) this.queueMove(c, it.to[d.id], it.speed, 'player');
            });
          }
          if (!this.moves.length) return false;
          S.mode = 'move'; return true;
        }
        default: return false;
      }
    }

    showLine(it) {
      let who = this.defWho, portrait = this.defPortrait, text;
      if (typeof it === 'string') text = it;
      else {
        text = it.t;
        if (it.who != null) { who = it.who; portrait = ((this.game.speakers || {})[who] || {}).portrait || ''; }
        if (it.off) portrait = '';
        if (it.portrait != null) portrait = it.portrait;
      }
      const d = $('dlg');
      d.textContent = '';
      d.classList.toggle('has-portrait', !!portrait);
      if (portrait) {
        const im = document.createElement('img');
        im.className = 'portrait'; im.src = portrait; im.alt = who || '';
        d.appendChild(im);
      }
      const box = document.createElement('div');
      box.className = 'txt';
      if (who) {
        const w = document.createElement('span');
        w.className = 'who'; w.textContent = who;
        box.appendChild(w);
      }
      box.appendChild(document.createTextNode(text));
      d.appendChild(box);
      d.hidden = false;
    }

    /* ---------- compagnons (Thomas et Cécile) : ils suivent le joueur à la trace ---------- */
    actorById(id) {
      const c = this.comps.find((x) => x.id === id);
      if (c) return c;
      return [].concat(this.cfg.npcs || [], this.cfg.objects || []).find((x) => x.id === id && x._actor) || null;
    }

    spawnCompanions() {
      this.comps = []; this.trail = [];
      if (this.edit || !this.flags.compagnons) return;
      (this.game.companions || []).forEach((d) => this.addCompanion(d, null));
    }

    addCompanion(d, at) {
      const P = this.cfg.player, o = d.offset || [0, 0];
      let x = at ? at[0] : P.x + o[0], y = at ? at[1] : P.y + o[1];
      if (!at && !this.walkable(x, y)) { x = P.x; y = P.y; }
      const n = { id: d.id, key: d.key, x: x, y: y, face: 'down', name: d.name, solid: false, gap: d.gap, _comp: true };
      this.addNpc(n);
      this.comps.push(n);
      return n;
    }

    queueMove(e, pts, speed, end) {
      if (!e || !e._actor) return;
      if (pts && typeof pts[0] === 'number') pts = [pts];
      this.moves = this.moves.filter((m) => m.e !== e);
      this.moves.push({ e: e, pts: (pts || []).map((p) => [p[0], p[1]]), speed: speed || 110, end: end });
    }

    updateMoves(delta) {
      for (let i = this.moves.length - 1; i >= 0; i--) {
        const m = this.moves[i], e = m.e, A = e._actor;
        if (!A || !A.img || !A.img.scene) { this.moves.splice(i, 1); continue; }
        const tg = m.pts[0];
        if (!tg) { this.moves.splice(i, 1); continue; }
        const dx = tg[0] - e.x, dy = tg[1] - e.y, d = Math.hypot(dx, dy);
        const step = m.speed * Math.min(delta, 50) / 1000;
        if (d <= step) {
          this.moveActor(e, tg[0], tg[1]);
          m.pts.shift();
          if (!m.pts.length) {
            A.moving = false; A.t = 0;
            if (m.end === 'player' || m.end == null) this.faceToward(e, this.player.x, this.player.y);
            else if (m.end) { A.face = m.end; this.applyActor(e); }
            this.moves.splice(i, 1);
          }
          continue;
        }
        this.moveActor(e, e.x + dx / d * step, e.y + dy / d * step);
        A.face = Math.abs(dx) > Math.abs(dy) * 1.2 ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
        A.moving = true;
      }
    }

    updateFollowers(delta) {
      if (!this.comps.length) return;
      const p = this.player, tr = this.trail, h = tr[0];
      if (!h || Math.hypot(p.x - h.x, p.y - h.y) >= 4) { tr.unshift({ x: p.x, y: p.y }); if (tr.length > 160) tr.length = 160; }
      this.comps.forEach((c) => {
        const A = c._actor;
        if (!A || this.moves.some((m) => m.e === c)) return;
        const L = c.gap || 28;
        let acc = 0, prev = { x: p.x, y: p.y }, tx = null, ty = null;
        for (const q of tr) {
          const seg = Math.hypot(q.x - prev.x, q.y - prev.y);
          if (acc + seg >= L) { const r = (L - acc) / (seg || 1); tx = prev.x + (q.x - prev.x) * r; ty = prev.y + (q.y - prev.y) * r; break; }
          acc += seg; prev = q;
        }
        const dx = tx == null ? 0 : tx - c.x, dy = tx == null ? 0 : ty - c.y, d = Math.hypot(dx, dy);
        if (tx == null || d < 2) {
          if (A.moving) { A.moving = false; A.t = 0; this.faceToward(c, p.x, p.y); }
          return;
        }
        const step = Math.min(d, 150 * (d > 60 ? 1.7 : 1.05) * Math.min(delta, 50) / 1000);
        this.moveActor(c, c.x + dx / d * step, c.y + dy / d * step);
        A.face = Math.abs(dx) > Math.abs(dy) * 1.2 ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
        A.moving = true;
      });
    }

    /* ---------- fragments : bandeau, son, tableau ---------- */
    giveFragment(flag) {
      this.setFlag(flag);
      const list = this.game.fragments || [], i = list.findIndex((f) => f.flag === flag);
      const f = list[i];
      if (f) this.showToast('Fragment ' + (i + 1) + '/' + list.length + ' : ' + f.name, f.sub, f.icon);
      this.chime();
      this.updateQuest();
    }

    showToast(title, sub, iconKey) {
      let t = $('toast');
      if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
      const path = iconKey && this.assetMap[iconKey];
      t.innerHTML = (path ? '<img src="assets/' + path + '" alt="">' : '') +
        '<div><b></b><span></span></div>';
      t.querySelector('b').textContent = title;
      t.querySelector('span').textContent = sub || '';
      t.classList.remove('show'); void t.offsetWidth; t.classList.add('show');
      clearTimeout(this._toastT);
      this._toastT = setTimeout(() => t.classList.remove('show'), 3200);
    }

    chime() {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const ac = this._ac || (this._ac = new AC());
        if (ac.state === 'suspended') ac.resume();
        [659, 784, 988, 1319].forEach((fr, i) => {
          const o = ac.createOscillator(), g = ac.createGain(), t0 = ac.currentTime + i * 0.11;
          o.type = 'triangle'; o.frequency.value = fr;
          g.gain.setValueAtTime(0.0001, t0);
          g.gain.exponentialRampToValueAtTime(0.16, t0 + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.55);
          o.connect(g); g.connect(ac.destination); o.start(t0); o.stop(t0 + 0.6);
        });
      } catch (e) { /* pas de son : pas grave */ }
    }

    updateQuest() {
      const f = this.flags;
      const list = this.cfg.quest || this.game.quest || [];
      const q = list.find((e) => (!e.needs || f[e.needs]) && (!e.not || !f[e.not]));
      $('quest').textContent = q ? q.text : '';
      $('quest').hidden = !q;
      // tableau des fragments
      const fr = this.game.fragments || [];
      let box = $('frags');
      if (!box && fr.length) { box = document.createElement('div'); box.id = 'frags'; document.body.appendChild(box); }
      if (box) {
        box.innerHTML = '';
        fr.forEach((x) => {
          const on = !!f[x.flag], path = this.assetMap[x.icon];
          const s = document.createElement('div');
          s.className = 'slot' + (on ? ' on' : '');
          s.title = on ? x.name : '?';
          if (on && path) { const im = document.createElement('img'); im.src = 'assets/' + path; im.alt = x.name; s.appendChild(im); }
          else s.textContent = on ? '✓' : '?';
          box.appendChild(s);
        });
      }
    }

    /* ---------- outils de mise au point (?debug) ---------- */
    setupDebug() {
      this.dbg = this.add.graphics().setDepth(99999);
      $('debug').hidden = false;
      this.input.on('pointerdown', (p) => {
        console.log('x:' + Math.round(p.worldX) + ', y:' + Math.round(p.worldY));
      });
    }

    updateDebug() {
      const g = this.dbg; g.clear();
      g.lineStyle(1, 0x55ff55, 0.9);
      this.solids.forEach((r) => g.strokeRect(r.x, r.y, r.w, r.h));
      g.lineStyle(1, 0x5599ff, 0.9);
      (this.cfg.walkable || []).forEach((r) => g.strokeRect(r.x, r.y, r.w, r.h));
      g.lineStyle(1, 0xffaa33, 0.95);
      (this.cfg.exits || []).forEach((r) => g.strokeRect(r.x, r.y, r.w, r.h));
      const p = this.input.activePointer;
      $('debug').textContent =
        'joueur  x:' + Math.round(this.player.x) + ' y:' + Math.round(this.player.y) + '\n' +
        'pointeur x:' + Math.round(p.worldX) + ' y:' + Math.round(p.worldY) + '\n' +
        'zoom ' + this.cameras.main.zoom.toFixed(2) +
        (this.missing.size ? '\nmanquants (' + this.missing.size + ') : ' + Array.from(this.missing).slice(0, 5).join(', ') + (this.missing.size > 5 ? '…' : '') : '');
    }
  }

  window.RoomScene = RoomScene;
})();
