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
      this.actors = new Set();
      this.flags = {};
      this.lines = null;
      this.entry = null;
      this.speaker = '';
      this.missing = new Set();
      this.placeholders = new Set();
      this.solids = [];
      this.talkables = [];
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
      (cfg.lights || []).forEach((L) => this.addLight(L));
    }

    /* Détruit tout le contenu (avant de recharger une autre version de la pièce). */
    clearWorld() {
      const cfg = this.cfg;
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
      let f = 0, flip = false, bob = 0;
      if (A.moving && d.walk) {
        const w = d.walk, st = A.t * w.fps / 1000, si = Math.floor(st);
        f = si % n;
        if ((w.flipAlt || []).indexOf(face) >= 0) { flip = (si % 2) === 1; bob = (w.bob || 0) * Math.sin(Math.PI * (st - si)); }
      } else if (d.idle && d.idle.fps) {
        f = Math.floor(A.t * d.idle.fps / 1000) % n;
      }
      if (e.flipX) flip = !flip;
      const k = d.rows[face] + ':' + f + ':' + flip + ':' + Math.round(bob * 4);
      if (k === A.key) return;
      A.key = k;
      A.img.setFrame(d.rows[face] * cols + f);
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
      if (!this.edit) cam.startFollow(this.player, true, 0.12, 0.12);
      cam.roundPixels = false;
      if (this.edit) { cam.removeBounds(); return; }
      this.applyZoom();
      cam.centerOn(this.player.x, this.player.y);
      this.scale.on('resize', () => this.applyZoom());
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
      const K = Phaser.Input.Keyboard.JustDown, k = this.keys;
      let act = window.Controls.act || K(k.SPACE) || K(k.ENTER) || K(k.E);
      window.Controls.act = false;

      if (this.lines) {
        this.setPlayerMoving(false, 0, 0);
        this.updateWander(delta, true);
        this.tickActors(delta);
        if (act) this.nextLine();
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
      this.tickActors(delta);

      const p = this.player;
      p.setDepth(p.y);
      this.pShadow.setPosition(p.x, p.y - 1).setDepth(p.y - 0.5);

      // objet ou personnage à portée
      let best = null, bd = 1e9;
      for (const t of this.talkables) {
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

      if (this.debug) this.updateDebug();
    }

    /* ---------- dialogues et quête ---------- */
    talk(t) {
      const f = this.flags;
      const e = (t.talk || []).find((e) => (!e.needs || f[e.needs]) && (!e.not || !f[e.not]));
      if (!e) return;
      this.entry = e;
      this.talkTarget = t;
      if (t._actor) this.faceToward(t, this.player.x, this.player.y);
      this.speaker = e.who || t.name || '';
      this.lines = e.text.slice();
      if (this.hint) this.hint.box.hidden = true;
      this.showLine();
    }

    showLine() {
      const d = $('dlg');
      d.textContent = '';
      if (this.speaker) {
        const w = document.createElement('span');
        w.className = 'who'; w.textContent = this.speaker;
        d.appendChild(w);
      }
      d.appendChild(document.createTextNode(this.lines[0]));
      d.hidden = false;
    }

    nextLine() {
      this.lines.shift();
      if (this.lines.length) { this.showLine(); return; }
      $('dlg').hidden = true;
      const tt = this.talkTarget; this.talkTarget = null;
      if (tt && tt._actor) { tt._actor.face = tt.face || 'down'; this.applyActor(tt); }
      if (this.entry && this.entry.sets) this.flags[this.entry.sets] = true;
      this.lines = null;
      this.entry = null;
      this.updateQuest();
    }

    updateQuest() {
      const f = this.flags;
      $('quest').textContent = f.fini ? '✓ La page manquante'
        : f.page ? 'Rapporte la page au registre'
        : 'Quête : trouve la page manquante';
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
