const GAME_W = 960;
const GAME_H = 540;

class LibraryScene extends Phaser.Scene {
  constructor() { super('LibraryScene'); }

  preload() {
    const a = 'assets/';
    const s = a + 'sprites_v071/';
    const e = a + 'environment_v071/';

    // Real modular floor: repeated tile, not a composed background.
    this.load.image('floorTile', a + 'environment/floor_wood_diag.png');
    this.load.image('wallPanel', e + 'wallpanel.png');

    // V0.7.1 isolated pixel-art assets.
    this.load.image('bookshelf', s + 'bookshelf.png');
    this.load.image('bookshelf2', s + 'bookshelf2.png');
    this.load.image('fireplace', s + 'fireplace.png');
    this.load.image('table', s + 'table.png');
    this.load.image('armchair', s + 'armchair.png');
    this.load.image('chair', s + 'chair.png');
    this.load.image('carpet', s + 'carpet.png');
    this.load.image('plant', s + 'plant.png');
    this.load.image('globe', s + 'globe.png');
    this.load.image('lamp', s + 'lamp.png');
    this.load.image('books', s + 'books_stack.png');

    // Existing clean small assets retained where the generated sheet was less useful.
    this.load.image('map', a + 'sprites/map.png');
    this.load.image('cabinet', a + 'sprites/cabinet.png');

    this.load.spritesheet('player', a + 'characters/player.png', { frameWidth: 48, frameHeight: 48 });
    this.load.spritesheet('thomas', a + 'characters/thomas_sheet.png', { frameWidth: 48, frameHeight: 64 });
    this.load.spritesheet('cecile', a + 'characters/cecile_sheet.png', { frameWidth: 48, frameHeight: 64 });
    this.load.image('cat', a + 'characters/ti-chat.png');
  }

  create() {
    this.physics.world.setBounds(18, 18, GAME_W - 36, GAME_H - 36);
    this.buildFloor();
    this.buildWalls();
    this.buildRoom();
    this.buildCharacters();
    this.buildCollisions();
    this.setupInput();
  }

  buildFloor() {
    // 32px-ish modular parquet. The room is assembled from repeated tiles.
    for (let y = 22; y < 540; y += 34) {
      for (let x = 18; x < 960; x += 34) {
        this.add.image(x, y, 'floorTile')
          .setDisplaySize(34, 34)
          .setDepth(0);
      }
    }
  }

  buildWalls() {
    // Back wall: independent wood panels.
    for (let x = 52; x <= 908; x += 72) {
      this.add.image(x, 152, 'wallPanel')
        .setDisplaySize(66, 184)
        .setOrigin(.5, 1)
        .setDepth(20);
    }

    // Side architectural pillars.
    for (const x of [38, 922]) {
      for (let y = 145; y <= 405; y += 92) {
        this.add.image(x, y, 'wallPanel')
          .setDisplaySize(46, 150)
          .setOrigin(.5, 1)
          .setDepth(20);
      }
    }
  }

  object(key, x, y, w, h, depth = null, id = null) {
    const o = this.add.image(x, y, key)
      .setDisplaySize(w, h)
      .setOrigin(.5, 1)
      .setDepth(depth ?? y);
    if (id) o.setData('id', id);
    return o;
  }

  buildRoom() {
    // BACK ROW — large isolated objects.
    this.object('fireplace', 92, 285, 132, 185, 90);
    this.object('bookshelf', 190, 215, 72, 180, 105);
    this.object('bookshelf', 285, 215, 72, 180, 105);
    this.object('bookshelf2', 680, 215, 76, 175, 105);
    this.object('bookshelf', 775, 215, 72, 180, 105);

    // Back-wall decoration.
    this.object('lamp', 390, 142, 38, 74, 125);
    this.object('lamp', 570, 142, 38, 74, 125);
    this.object('plant', 345, 235, 58, 105, 145);
    this.object('plant', 855, 235, 58, 105, 145);
    this.object('globe', 625, 240, 58, 128, 150);
    this.object('books', 115, 340, 52, 52, 155);
    this.object('books', 875, 345, 52, 52, 155);

    // Floor rug goes BELOW furniture and characters.
    this.object('carpet', 480, 470, 330, 275, 12);

    // Central table. It is an isolated furniture asset; its decorative props are part of the artwork.
    this.object('table', 480, 390, 255, 150, 390, 'book');
    this.object('chair', 345, 425, 54, 82, 425);
    this.object('chair', 615, 425, 54, 82, 425);
    this.object('chair', 410, 490, 54, 82, 490);
    this.object('chair', 550, 490, 54, 82, 490);

    // Reading corner.
    this.object('armchair', 175, 435, 90, 122, 435, 'cecile');
    this.object('lamp', 235, 430, 38, 74, 435);
    this.object('books', 110, 490, 50, 50, 490);

    // Study corner.
    this.object('cabinet', 795, 420, 70, 92, 420);
    this.object('map', 800, 300, 72, 72, 300);
    this.object('plant', 865, 445, 54, 96, 445);
    this.object('lamp', 845, 430, 38, 74, 445);
  }

  buildCharacters() {
    this.player = this.physics.add.sprite(480, 510, 'player', 0)
      .setScale(.92)
      .setOrigin(.5, .88)
      .setDepth(610)
      .setCollideWorldBounds(true);
    this.player.body.setSize(20, 22);
    this.player.body.setOffset(14, 24);
    this.player.setDrag(1000, 1000);

    this.thomas = this.add.sprite(480, 285, 'thomas', 0)
      .setScale(.92).setOrigin(.5, .88).setDepth(285);

    this.cecile = this.add.sprite(175, 385, 'cecile', 0)
      .setScale(.88).setOrigin(.5, .88).setDepth(385);

    this.cat = this.add.image(720, 440, 'cat')
      .setScale(.65).setOrigin(.5, .9).setDepth(440);

    this.targets = [
      { x: this.thomas.x, y: this.thomas.y, id: 'thomas', r: 72 },
      { x: this.cecile.x, y: this.cecile.y, id: 'cecile', r: 70 },
      { x: this.cat.x, y: this.cat.y, id: 'cat', r: 62 },
      { x: 480, y: 390, id: 'book', r: 80 }
    ];
  }

  buildCollisions() {
    this.blocks = this.physics.add.staticGroup();
    const block = (x, y, w, h) => {
      const r = this.add.rectangle(x, y, w, h, 0x000000, 0);
      this.physics.add.existing(r, true);
      this.blocks.add(r);
    };

    // Back and side walls.
    block(480, 112, 880, 45);
    block(34, 330, 35, 360);
    block(926, 330, 35, 360);

    // Fireplace and bookshelves.
    block(92, 250, 95, 65);
    block(190, 210, 55, 45);
    block(285, 210, 55, 45);
    block(680, 210, 55, 45);
    block(775, 210, 55, 45);

    // Table and reading corner.
    block(480, 380, 215, 58);
    block(175, 430, 65, 55);
    block(795, 415, 55, 55);
  }

  setupInput() {
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys({ up: 'Z', down: 'S', left: 'Q', right: 'D' });
    this.input.keyboard.on('keydown-E', () => this.interact());
    this.input.keyboard.on('keydown-ENTER', () => this.nextDialogue());
    this.input.keyboard.on('keydown-SPACE', () => this.nextDialogue());

    this.physics.add.collider(this.player, this.blocks);

    this.touch = { x: 0, y: 0 };
    const joy = document.getElementById('joystick');
    const knob = document.getElementById('joystick-knob');
    let pid = null;
    const move = e => {
      const r = joy.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      let dx = e.clientX - cx, dy = e.clientY - cy;
      const max = r.width * .32, len = Math.hypot(dx, dy);
      if (len > max) { dx = dx / len * max; dy = dy / len * max; }
      this.touch.x = dx / max; this.touch.y = dy / max;
      knob.style.transform = `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`;
    };
    const reset = () => { pid = null; this.touch.x = 0; this.touch.y = 0; knob.style.transform = 'translate(-50%,-50%)'; };
    joy.addEventListener('pointerdown', e => { e.preventDefault(); pid = e.pointerId; joy.setPointerCapture(pid); move(e); });
    joy.addEventListener('pointermove', e => { if (e.pointerId === pid) move(e); });
    joy.addEventListener('pointerup', reset); joy.addEventListener('pointercancel', reset);
    document.getElementById('action-button').addEventListener('pointerdown', e => { e.preventDefault(); this.interact(); });
    document.getElementById('dialogue').addEventListener('pointerdown', e => { e.preventDefault(); this.nextDialogue(); });
  }

  update() {
    if (this.dialogueLines) { this.player.setVelocity(0, 0); return; }
    let x = 0, y = 0;
    if (this.cursors.left.isDown || this.keys.left.isDown) x--;
    if (this.cursors.right.isDown || this.keys.right.isDown) x++;
    if (this.cursors.up.isDown || this.keys.up.isDown) y--;
    if (this.cursors.down.isDown || this.keys.down.isDown) y++;
    if (Math.abs(this.touch.x) > .12 || Math.abs(this.touch.y) > .12) { x += this.touch.x; y += this.touch.y; }
    const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
    this.player.setVelocity(x * 145, y * 145);

    // Y-sort characters so the 2.5D depth reads correctly.
    this.player.setDepth(this.player.y + 100);
    this.cecile.setDepth(this.cecile.y + 100);
    this.thomas.setDepth(this.thomas.y + 100);
    this.cat.setDepth(this.cat.y + 100);

    this.updateInteraction();
  }

  updateInteraction() {
    let best = null, bestDist = Infinity;
    for (const t of this.targets) {
      const d = Math.hypot(this.player.x - t.x, this.player.y - t.y);
      if (d < t.r && d < bestDist) { best = t; bestDist = d; }
    }
    this.nearest = best;
    const hint = document.getElementById('interaction-hint');
    if (best) {
      hint.classList.remove('hidden');
      hint.textContent = best.id === 'book' ? 'E — Examiner' : 'E — Interagir';
    } else hint.classList.add('hidden');
  }

  interact() {
    if (this.dialogueLines) { this.nextDialogue(); return; }
    if (!this.nearest) return;
    if (this.nearest.id === 'cecile') this.showDialogue([
      ['Cécile', 'Bonjour.'],
      ['Cécile', 'Je lis un peu avant de repartir.'],
      ['Cécile', 'Tu connais Krasznahorkai ?']
    ]);
    if (this.nearest.id === 'thomas') this.showDialogue([
      ['Thomas', 'Ah. Enfin quelqu’un.'],
      ['Thomas', 'Tu sais comment fonctionne ce mécanisme ?'],
      ['Voyageur', 'Non.'],
      ['Thomas', 'Moi non plus.'],
      ['Thomas', 'Mais ça devrait fonctionner.']
    ]);
    if (this.nearest.id === 'cat') this.showDialogue([['Ti Chat', 'Miaou.']]);
    if (this.nearest.id === 'book') this.showDialogue([
      ['Livre', 'Les pages sont couvertes d’une écriture ancienne.'],
      ['Livre', 'Certaines phrases semblent avoir été effacées.'],
      ['Livre', 'Une seule ligne reste parfaitement lisible.'],
      ['Livre', '« Toute expédition commence avant même que ses voyageurs sachent où ils vont. »']
    ]);
  }

  showDialogue(lines) { this.dialogueLines = lines; this.dialogueIndex = 0; this.renderDialogue(); }
  renderDialogue() {
    const [name, text] = this.dialogueLines[this.dialogueIndex];
    document.getElementById('dialogue-name').textContent = name;
    document.getElementById('dialogue-text').textContent = text;
    document.getElementById('dialogue').classList.remove('hidden');
  }
  nextDialogue() {
    if (!this.dialogueLines) return;
    this.dialogueIndex++;
    if (this.dialogueIndex >= this.dialogueLines.length) {
      this.dialogueLines = null;
      document.getElementById('dialogue').classList.add('hidden');
      return;
    }
    this.renderDialogue();
  }
}

const config = {
  type: Phaser.AUTO,
  parent: 'game-root',
  width: GAME_W,
  height: GAME_H,
  backgroundColor: '#17120f',
  pixelArt: true,
  physics: { default: 'arcade', arcade: { debug: false } },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [LibraryScene]
};

new Phaser.Game(config);
