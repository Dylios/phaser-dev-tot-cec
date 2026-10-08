const GAME_W = 960;
const GAME_H = 540;

class LibraryScene extends Phaser.Scene {
  constructor() { super('LibraryScene'); }

  preload() {
    const e = 'assets/environment/';
    this.load.image('floor', e + 'floor_wood_diag.png');
    this.load.image('floorPattern', e + 'floor_pattern.png');
    this.load.image('carpet', e + 'carpet.png');
    this.load.image('bookshelf', e + 'bookshelf.png');
    this.load.image('cabinet', e + 'cabinet.png');
    this.load.image('fireplace', e + 'fireplace.png');
    this.load.image('wallPanel', e + 'wall_panel.png');
    this.load.image('table', e + 'table.png');
    this.load.image('chair', e + 'chair.png');
    this.load.image('armchair', e + 'armchair.png');
    this.load.image('lamp', e + 'lamp.png');
    this.load.image('plant', e + 'plant.png');
    this.load.image('globe', e + 'globe.png');
    this.load.image('books', e + 'books_stack.png');
    this.load.image('book', e + 'book.png');
    this.load.image('map', e + 'map.png');

    this.load.spritesheet('thomas', 'assets/characters/thomas_sheet.png', { frameWidth: 48, frameHeight: 64 });
    this.load.spritesheet('cecile', 'assets/characters/cecile_sheet.png', { frameWidth: 48, frameHeight: 64 });
    this.load.image('cat', 'assets/characters/ti-chat.png');
    this.load.image('player', 'assets/characters/player.png');
  }

  create() {
    this.physics.world.setBounds(24, 34, 912, 482);

    // --- Base room: dark wood wall + diagonal parquet ---
    this.add.rectangle(480, 72, 920, 92, 0x2b1b15).setDepth(0);
    this.add.rectangle(480, 296, 920, 430, 0x17100d).setDepth(-2);
    this.add.tileSprite(480, 325, 920, 405, 'floor').setDepth(-1).setAlpha(0.96);

    // Decorative floor inset / rug zone
    const carpet = this.add.image(480, 342, 'carpet').setDisplaySize(350, 250).setOrigin(.5, .5).setDepth(1);
    carpet.setAlpha(.95);

    // --- Back wall, deliberately assembled from individual pieces ---
    for (let x = 55; x <= 905; x += 70) {
      this.add.image(x, 92, 'wallPanel').setOrigin(.5, 1).setScale(1.05).setDepth(2);
    }

    const backShelves = [95, 250, 410, 715, 865];
    backShelves.forEach(x => this.add.image(x, 132, 'bookshelf').setOrigin(.5, 1).setScale(1.48).setDepth(4));

    this.add.image(555, 135, 'cabinet').setOrigin(.5, 1).setScale(1.5).setDepth(4);
    this.add.image(555, 135, 'fireplace').setOrigin(.5, 1).setScale(1.45).setDepth(5);

    // Wall details
    this.add.image(820, 135, 'map').setOrigin(.5, 1).setScale(1.05).setDepth(6);
    this.add.image(755, 136, 'globe').setOrigin(.5, 1).setScale(.75).setDepth(6);
    this.add.image(160, 134, 'plant').setOrigin(.5, 1).setScale(.72).setDepth(6);

    // --- Central reading area ---
    this.table = this.add.image(480, 385, 'table').setOrigin(.5, 1).setScale(1.18).setDepth(385);
    this.add.image(385, 372, 'chair').setOrigin(.5, 1).setScale(.82).setDepth(372);
    this.add.image(575, 372, 'chair').setOrigin(.5, 1).setScale(.82).setDepth(372);
    this.add.image(480, 500, 'chair').setOrigin(.5, 1).setScale(.82).setDepth(500);
    this.add.image(480, 360, 'book').setOrigin(.5, 1).setScale(.55).setDepth(390);
    this.add.image(455, 365, 'books').setOrigin(.5, 1).setScale(.45).setDepth(391);
    this.add.image(510, 365, 'lamp').setOrigin(.5, 1).setScale(.65).setDepth(391);

    // --- Left reading corner ---
    this.add.image(165, 405, 'armchair').setOrigin(.5, 1).setScale(1.08).setDepth(405);
    this.add.image(245, 405, 'lamp').setOrigin(.5, 1).setScale(.72).setDepth(406);
    this.add.image(120, 442, 'books').setOrigin(.5, 1).setScale(.58).setDepth(442);
    this.add.image(215, 442, 'books').setOrigin(.5, 1).setScale(.46).setDepth(442);

    // --- Right side: expedition / travel corner ---
    this.add.image(785, 420, 'cabinet').setOrigin(.5, 1).setScale(1.15).setDepth(420);
    this.add.image(785, 356, 'globe').setOrigin(.5, 1).setScale(.82).setDepth(421);
    this.add.image(875, 440, 'books').setOrigin(.5, 1).setScale(.55).setDepth(440);
    this.add.image(885, 355, 'plant').setOrigin(.5, 1).setScale(.62).setDepth(356);

    // --- Character shadows: tiny and understated ---
    const shadow = (x, y, w = 24) => this.add.ellipse(x, y, w, 8, 0x000000, .32).setDepth(y - 2);
    shadow(165, 455, 28);
    shadow(810, 405, 28);
    shadow(690, 470, 24);
    shadow(480, 500, 22);

    this.cecile = this.add.sprite(165, 455, 'cecile', 0).setScale(.86).setOrigin(.5, .9).setDepth(455);
    this.thomas = this.add.sprite(810, 405, 'thomas', 0).setScale(.86).setOrigin(.5, .9).setDepth(405);
    this.cat = this.add.image(690, 470, 'cat').setDisplaySize(54, 54).setOrigin(.5, .9).setDepth(470);

    this.player = this.physics.add.sprite(480, 500, 'player').setScale(.70).setOrigin(.5, .88).setDepth(510).setCollideWorldBounds(true);
    this.player.body.setSize(20, 22);
    this.player.body.setOffset(14, 30);
    this.player.setDrag(1000, 1000);

    // Invisible collision geometry roughly matching the visible furniture.
    this.obstacles = this.physics.add.staticGroup();
    const block = (x, y, w, h) => {
      const r = this.add.rectangle(x, y, w, h, 0x000000, 0);
      this.physics.add.existing(r, true);
      this.obstacles.add(r);
    };
    block(480, 57, 900, 25);       // back wall
    block(95, 128, 95, 50);
    block(250, 128, 95, 50);
    block(410, 128, 95, 50);
    block(555, 128, 105, 50);
    block(715, 128, 95, 50);
    block(865, 128, 95, 50);
    block(480, 390, 190, 58);      // table
    block(165, 405, 70, 60);       // armchair
    block(785, 420, 75, 55);       // cabinet

    this.physics.add.collider(this.player, this.obstacles);

    this.nearest = null;
    this.dialogueLines = null;
    this.dialogueIndex = 0;
    this.setupInput();
  }

  setupInput() {
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys({ up: 'Z', down: 'S', left: 'Q', right: 'D' });
    this.input.keyboard.on('keydown-E', () => this.interact());
    this.input.keyboard.on('keydown-ENTER', () => this.nextDialogue());
    this.input.keyboard.on('keydown-SPACE', () => this.nextDialogue());

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
    joy.addEventListener('pointerup', reset);
    joy.addEventListener('pointercancel', reset);
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

    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    this.player.setVelocity(x * 145, y * 145);

    // The whole scene uses Y sorting: objects become foreground when the player passes them.
    this.player.setDepth(this.player.y + 20);
    this.cecile.setDepth(this.cecile.y + 10);
    this.thomas.setDepth(this.thomas.y + 10);
    this.cat.setDepth(this.cat.y + 10);
    this.updateInteraction();
  }

  updateInteraction() {
    const targets = [
      { o: this.cecile, id: 'cecile', r: 78 },
      { o: this.thomas, id: 'thomas', r: 78 },
      { o: this.cat, id: 'cat', r: 65 },
      { o: { x: 480, y: 355 }, id: 'book', r: 70 }
    ];
    let best = null, bestDist = Infinity;
    for (const t of targets) {
      const d = Math.hypot(this.player.x - t.o.x, this.player.y - t.o.y);
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

  showDialogue(lines) {
    this.dialogueLines = lines;
    this.dialogueIndex = 0;
    this.renderDialogue();
  }

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
    } else this.renderDialogue();
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game-root',
  width: GAME_W,
  height: GAME_H,
  backgroundColor: '#17120f',
  pixelArt: true,
  antialias: false,
  physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: GAME_W, height: GAME_H },
  scene: [LibraryScene]
});
