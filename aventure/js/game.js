const GAME_W = 960;
const GAME_H = 540;

class LibraryScene extends Phaser.Scene {
  constructor() { super('LibraryScene'); }

  preload() {
    this.load.image('library', 'assets/environment/library_scene.png');
    this.load.spritesheet('player', 'assets/characters/player.png', { frameWidth: 48, frameHeight: 48 });
  }

  create() {
    this.physics.world.setBounds(20, 20, 920, 500);

    // V0.6: the room is an authored pixel-art composition.
    // Gameplay entities are still separate so we can progressively replace
    // the background with true transparent modular assets.
    this.add.image(480, 270, 'library').setDisplaySize(960, 540).setDepth(0);

    this.player = this.physics.add.sprite(500, 445, 'player', 0)
      .setScale(.82)
      .setOrigin(.5, .88)
      .setDepth(1000)
      .setCollideWorldBounds(true);
    this.player.body.setSize(20, 22);
    this.player.body.setOffset(14, 24);
    this.player.setDrag(1000, 1000);

    // Interaction points correspond to the NPCs/objects visible in the scene.
    this.targets = [
      { x: 490, y: 185, id: 'thomas', r: 72 },
      { x: 165, y: 300, id: 'cecile', r: 72 },
      { x: 760, y: 300, id: 'cat', r: 62 },
      { x: 500, y: 270, id: 'book', r: 75 }
    ];

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
    this.player.setDepth(this.player.y + 100);
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
