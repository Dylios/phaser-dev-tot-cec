const GAME_W = 960;
const GAME_H = 540;

class LibraryScene extends Phaser.Scene {
  constructor() { super('LibraryScene'); }

  preload() {
    const base = 'assets/';
    // Modular environment — no composed background image is loaded.
    this.load.image('floorTile', base + 'environment/floor_wood_diag.png');
    this.load.image('wallPanel', base + 'environment/wall_panel.png');
    this.load.image('bookshelf', base + 'sprites/bookshelf.png');
    this.load.image('cabinet', base + 'sprites/cabinet.png');
    this.load.image('fireplace', base + 'sprites/fireplace.png');
    this.load.image('table', base + 'sprites/table.png');
    this.load.image('armchair', base + 'sprites/armchair.png');
    this.load.image('chair', base + 'sprites/chair.png');
    this.load.image('lamp', base + 'sprites/lamp.png');
    this.load.image('plant', base + 'sprites/plant.png');
    this.load.image('globe', base + 'sprites/globe.png');
    this.load.image('map', base + 'sprites/map.png');
    this.load.image('book', base + 'sprites/book.png');
    this.load.image('books', base + 'sprites/books_stack.png');
    this.load.image('carpet', base + 'environment/carpet.png');

    this.load.spritesheet('player', base + 'characters/player.png', { frameWidth: 48, frameHeight: 48 });
    this.load.spritesheet('thomas', base + 'characters/thomas_sheet.png', { frameWidth: 48, frameHeight: 64 });
    this.load.spritesheet('cecile', base + 'characters/cecile_sheet.png', { frameWidth: 48, frameHeight: 64 });
    this.load.image('cat', base + 'characters/ti-chat.png');
  }

  create() {
    this.physics.world.setBounds(24, 24, 912, 492);
    this.buildFloor();
    this.buildWalls();
    this.buildLibrary();
    this.buildCharacters();
    this.buildCollisions();
    this.setupInput();
  }

  buildFloor() {
    // Repeated tile: the room is genuinely assembled from the floor asset.
    for (let y = 42; y < 500; y += 34) {
      for (let x = 34; x < 930; x += 34) {
        this.add.image(x, y, 'floorTile').setDisplaySize(34, 34).setDepth(0);
      }
    }
    // Slightly darker border / entrance area.
    this.add.rectangle(480, 28, 920, 18, 0x241812).setDepth(1);
    this.add.rectangle(480, 516, 920, 18, 0x241812).setDepth(1);
  }

  buildWalls() {
    // Back wall made from repeated modular panels.
    for (let x = 50; x < 920; x += 62) {
      this.add.image(x, 68, 'wallPanel').setDisplaySize(60, 68).setDepth(8);
    }
    // Side wall modules — deliberately sparse so the room keeps a playable opening.
    for (let y = 120; y < 430; y += 68) {
      this.add.image(44, y, 'wallPanel').setDisplaySize(60, 68).setAngle(-90).setDepth(8);
      this.add.image(916, y, 'wallPanel').setDisplaySize(60, 68).setAngle(90).setDepth(8);
    }
    // Architectural top trim.
    this.add.rectangle(480, 34, 870, 10, 0x5a351f).setDepth(9);
  }

  addObject(key, x, y, scale = 1, depth = null, interactiveId = null) {
    const s = this.add.image(x, y, key).setScale(scale);
    s.setDepth(depth === null ? y : depth);
    if (interactiveId) s.setData('id', interactiveId);
    return s;
  }

  buildLibrary() {
    // BACK ROW — all independent transparent sprites.
    this.addObject('fireplace', 92, 126, 1.65, 20);
    this.addObject('bookshelf', 180, 100, 1.65, 22);
    this.addObject('bookshelf', 270, 100, 1.65, 22);
    this.addObject('cabinet', 370, 101, 1.55, 22);
    this.addObject('bookshelf', 585, 100, 1.65, 22);
    this.addObject('bookshelf', 690, 100, 1.65, 22);
    this.addObject('cabinet', 790, 101, 1.55, 22);

    this.addObject('plant', 155, 155, 1.0, 30);
    this.addObject('plant', 875, 150, 1.0, 30);
    this.addObject('lamp', 460, 118, 0.9, 35);
    this.addObject('lamp', 520, 118, 0.9, 35);
    this.addObject('map', 695, 150, 0.8, 34);
    this.addObject('globe', 825, 176, 0.85, 48);
    this.addObject('books', 120, 205, 0.7, 55);
    this.addObject('books', 850, 220, 0.7, 55);

    // CENTRAL RUG — a real independent transparent asset.
    this.addObject('carpet', 480, 330, 2.75, 40);

    // CENTRAL TABLE + individual chairs.
    this.addObject('table', 480, 310, 1.0, 320, 'book');
    this.addObject('chair', 370, 342, 0.95, 342);
    this.addObject('chair', 590, 342, 0.95, 342);
    this.addObject('chair', 415, 405, 0.82, 405);
    this.addObject('chair', 545, 405, 0.82, 405);
    this.addObject('book', 480, 286, 0.65, 360, 'book');
    this.addObject('lamp', 485, 260, 0.75, 365);
    this.addObject('plant', 520, 278, 0.7, 365);

    // READING CORNER.
    this.addObject('armchair', 165, 330, 1.2, 335, 'cecile');
    this.addObject('lamp', 245, 320, 0.9, 325);
    this.addObject('books', 125, 405, 0.75, 405);
    this.addObject('books', 215, 405, 0.55, 405);

    // STUDY CORNER.
    this.addObject('cabinet', 775, 330, 1.2, 335);
    this.addObject('plant', 850, 350, 0.85, 355);
    this.addObject('lamp', 820, 330, 0.8, 355);
    this.addObject('books', 875, 415, 0.75, 415);
  }

  buildCharacters() {
    this.player = this.physics.add.sprite(480, 455, 'player', 0)
      .setScale(.92)
      .setOrigin(.5, .88)
      .setDepth(455)
      .setCollideWorldBounds(true);
    this.player.body.setSize(20, 22);
    this.player.body.setOffset(14, 24);
    this.player.setDrag(1000, 1000);

    this.thomas = this.add.sprite(480, 205, 'thomas', 0)
      .setScale(.92).setOrigin(.5, .88).setDepth(205);
    this.cecile = this.add.sprite(165, 330, 'cecile', 0)
      .setScale(.88).setOrigin(.5, .88).setDepth(330);
    this.cat = this.add.image(745, 400, 'cat').setScale(.62).setDepth(400);

    this.targets = [
      { x: this.thomas.x, y: this.thomas.y, id: 'thomas', r: 72 },
      { x: this.cecile.x, y: this.cecile.y - 20, id: 'cecile', r: 72 },
      { x: this.cat.x, y: this.cat.y, id: 'cat', r: 62 },
      { x: 480, y: 286, id: 'book', r: 70 }
    ];
  }

  buildCollisions() {
    this.blocks = this.physics.add.staticGroup();
    const block = (x, y, w, h) => {
      const r = this.add.rectangle(x, y, w, h, 0x000000, 0);
      this.physics.add.existing(r, true);
      this.blocks.add(r);
    };

    // Walls.
    block(480, 72, 870, 45);
    block(42, 270, 35, 390);
    block(918, 270, 35, 390);

    // Major furniture footprints.
    block(92, 145, 105, 60);       // fireplace
    block(480, 310, 185, 55);      // table
    block(165, 330, 75, 70);       // armchair
    block(775, 330, 75, 65);       // study cabinet
    block(180, 112, 60, 48);
    block(270, 112, 60, 48);
    block(585, 112, 60, 48);
    block(690, 112, 60, 48);
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
    if (best) { hint.classList.remove('hidden'); hint.textContent = best.id === 'book' ? 'E — Examiner' : 'E — Interagir'; }
    else hint.classList.add('hidden');
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
      this.dialogueLines = null; document.getElementById('dialogue').classList.add('hidden');
    } else this.renderDialogue();
  }
}

new Phaser.Game({
  type: Phaser.AUTO, parent: 'game-root', width: GAME_W, height: GAME_H,
  backgroundColor: '#17120f', pixelArt: true, antialias: false,
  physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: GAME_W, height: GAME_H },
  scene: [LibraryScene]
});
