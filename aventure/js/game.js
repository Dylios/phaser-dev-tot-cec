// ============================================================
// EXPEDITION 2028 — Phaser 4.2.1 — V0.3
// GitHub Pages friendly: no modules, no npm, no build step.
// V0.3: corrected character frame sizes + rebuilt library layout.
// ============================================================

const GAME_W = 960;
const GAME_H = 540;

class LibraryScene extends Phaser.Scene {
  constructor() {
    super("LibraryScene");
  }

  preload() {
    // Character sheets: 4 columns x 8 rows = 48 x 64 frames.
    this.load.spritesheet("thomas", "assets/characters/thomas_sheet.png", {
      frameWidth: 48,
      frameHeight: 64
    });

    this.load.spritesheet("cecile", "assets/characters/cecile_sheet.png", {
      frameWidth: 48,
      frameHeight: 64
    });

    this.load.image("cecile-seated", "assets/characters/cecile_seated.png");
    this.load.image("ti-chat", "assets/characters/ti-chat.png");
    this.load.image("player", "assets/characters/player.png");

    const env = [
      "floor_wood", "floor_wood_diag", "floor_pattern", "floor_pattern2",
      "carpet", "wall_panel", "bookshelf", "fireplace", "cabinet",
      "plant", "table", "chair", "armchair", "globe", "lamp",
      "map", "books_stack", "book"
    ];

    env.forEach(key => {
      this.load.image(key, `assets/environment/${key}.png`);
    });
  }

  create() {
    this.physics.world.setBounds(0, 0, GAME_W, GAME_H);
    this.cameras.main.setBackgroundColor("#17120f");

    this.nearest = null;
    this.dialogueLines = null;
    this.dialogueIndex = 0;

    this.createLibrary();
    this.createCharacters();
    this.createPlayer();
    this.createCollisions();
    this.createInput();

    // Very short opening line: the game should quickly become playable.
    this.showDialogue([
      ["Livre", "La bibliothèque semble attendre quelqu'un."],
      ["Livre", "Et cette fois, l'expédition est déjà commencée."]
    ]);
  }

  addTiledFloor() {
    const floor = this.add.tileSprite(480, 348, 912, 368, "floor_wood");
    floor.setScale(0.62);
    floor.setDepth(0);

    // Subtle floor border.
    this.add.rectangle(480, 166, 912, 4, 0x6d4b35).setDepth(1);
    this.add.rectangle(480, 526, 912, 4, 0x2b1b15).setDepth(1);
  }

  addWall() {
    // Warm wood wall filling the previously empty black area.
    this.add.rectangle(480, 84, 912, 156, 0x2a1d17).setDepth(0);

    for (let x = 48; x <= 912; x += 40) {
      const panel = this.add.image(x, 90, "wall_panel");
      panel.setScale(0.67);
      panel.setDepth(1);
    }

    this.add.rectangle(480, 157, 912, 8, 0x5c3d2b).setDepth(2);
    this.add.rectangle(480, 164, 912, 5, 0x211610).setDepth(2);
  }

  shelf(x, y, scale = 1) {
    const s = this.add.image(x, y, "bookshelf");
    s.setScale(scale);
    s.setDepth(4);
    return s;
  }

  createLibrary() {
    this.addTiledFloor();
    this.addWall();

    // Back-wall bookcases: arranged as furniture, not a tiled border.
    for (const x of [92, 162, 798, 868]) {
      this.shelf(x, 116, 1.0);
    }

    // Short lower bookcases create the side wings of the room.
    for (const x of [75, 145, 815, 885]) {
      this.shelf(x, 455, 0.90);
    }

    // Left reading corner.
    this.add.image(66, 214, "fireplace")
      .setScale(1.05)
      .setDepth(5);

    this.add.image(162, 232, "plant")
      .setScale(0.62)
      .setDepth(7);

    // Right history / map corner.
    this.add.image(894, 216, "cabinet")
      .setScale(1.05)
      .setDepth(5);

    this.add.image(840, 225, "globe")
      .setScale(0.62)
      .setDepth(7);

    this.add.image(892, 310, "map")
      .setScale(0.55)
      .setDepth(6);

    // Central rug — deliberately smaller than V0.2.
    const rug = this.add.image(480, 348, "carpet");
    rug.setScale(2.25, 1.35);
    rug.setDepth(1);

    // Central reading table.
    const table = this.add.image(480, 346, "table");
    table.setScale(0.78);
    table.setDepth(8);

    // Four chairs around the table.
    const chairs = [
      [420, 320], [540, 320],
      [420, 397], [540, 397]
    ];

    for (const [x, y] of chairs) {
      this.add.image(x, y, "chair")
        .setScale(0.47)
        .setDepth(y);
    }

    // Objects on the table.
    this.add.image(480, 331, "book")
      .setScale(0.48)
      .setDepth(10);

    this.add.image(530, 309, "lamp")
      .setScale(0.45)
      .setDepth(10);

    // Small stacks near the walls.
    this.add.image(270, 460, "books_stack")
      .setScale(0.52)
      .setDepth(9);

    this.add.image(690, 460, "books_stack")
      .setScale(0.52)
      .setDepth(9);

    // Thomas' workshop corner: no floating UI-like box anymore.
    const workbench = this.add.image(760, 285, "cabinet");
    workbench.setScale(0.95);
    workbench.setDepth(6);

    this.add.image(760, 246, "lamp")
      .setScale(0.42)
      .setDepth(8);

    // A subtle mechanism marker, integrated into the furniture.
    this.add.circle(758, 277, 16, 0x5c4531)
      .setStrokeStyle(3, 0xa88a52)
      .setDepth(9);

    // Exit / threshold at the bottom.
    this.add.rectangle(480, 523, 92, 30, 0x241711)
      .setStrokeStyle(3, 0x72543b)
      .setDepth(7);

    this.add.text(480, 519, "SORTIE", {
      fontFamily: "Georgia, serif",
      fontSize: "10px",
      color: "#a88a52"
    }).setOrigin(0.5).setDepth(8);
  }

  createCharacters() {
    // Thomas: corrected 48x64 sprite frame.
    this.thomas = this.add.sprite(760, 330, "thomas", 0);
    this.thomas.setScale(0.92);
    this.thomas.setOrigin(0.5, 0.88);
    this.thomas.setDepth(this.thomas.y);

    // Cécile is a seated environmental character here.
    this.cecile = this.add.image(205, 300, "cecile-seated");
    this.cecile.setDisplaySize(150, 171);
    this.cecile.setOrigin(0.5, 0.93);
    this.cecile.setDepth(this.cecile.y + 25);

    // Ti Chat.
    this.cat = this.add.image(820, 430, "ti-chat");
    this.cat.setDisplaySize(58, 58);
    this.cat.setOrigin(0.5, 0.9);
    this.cat.setDepth(this.cat.y);

    // Invisible interaction point for the central book.
    this.bookPoint = this.add.circle(480, 331, 10, 0x000000, 0);
    this.bookPoint.setDepth(12);
  }

  createPlayer() {
    this.player = this.physics.add.sprite(480, 475, "player");
    this.player.setScale(0.68);
    this.player.setOrigin(0.5, 0.88);
    this.player.setDepth(this.player.y);
    this.player.setCollideWorldBounds(true);
    this.player.setDrag(900, 900);
    this.player.setMaxVelocity(155, 155);

    this.player.body.setSize(20, 22);
    this.player.body.setOffset(14, 30);
  }

  createCollisions() {
    this.obstacles = this.physics.add.staticGroup();

    const block = (x, y, w, h) => {
      const r = this.add.rectangle(x, y, w, h, 0x000000, 0);
      r.setVisible(false);
      this.physics.add.existing(r, true);
      this.obstacles.add(r);
    };

    // Walls.
    block(480, 82, 920, 150);
    block(25, 340, 25, 340);
    block(935, 340, 25, 340);

    // Side bookcases.
    block(92, 116, 62, 62);
    block(162, 116, 62, 62);
    block(798, 116, 62, 62);
    block(868, 116, 62, 62);

    // Lower shelves.
    block(75, 455, 64, 70);
    block(145, 455, 64, 70);
    block(815, 455, 64, 70);
    block(885, 455, 64, 70);

    // Fireplace and cabinet.
    block(66, 214, 65, 68);
    block(894, 216, 65, 68);

    // Central table.
    block(480, 346, 145, 58);

    // Thomas workbench.
    block(760, 285, 65, 58);

    // Keep the bottom exit clear.
  }

  createInput() {
    this.cursors = this.input.keyboard.createCursorKeys();

    this.keys = this.input.keyboard.addKeys({
      up: "Z",
      down: "S",
      left: "Q",
      right: "D"
    });

    this.input.keyboard.on("keydown-E", () => this.interact());
    this.input.keyboard.on("keydown-ENTER", () => this.nextDialogue());
    this.input.keyboard.on("keydown-SPACE", () => this.nextDialogue());

    this.touch = { x: 0, y: 0 };

    const joystick = document.getElementById("joystick");
    const knob = document.getElementById("joystick-knob");
    let pointerId = null;

    const updateJoystick = (event) => {
      const rect = joystick.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;

      let dx = event.clientX - cx;
      let dy = event.clientY - cy;
      const max = rect.width * 0.32;
      const distance = Math.hypot(dx, dy);

      if (distance > max) {
        dx = dx / distance * max;
        dy = dy / distance * max;
      }

      this.touch.x = dx / max;
      this.touch.y = dy / max;

      knob.style.transform =
        `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    };

    const resetJoystick = () => {
      pointerId = null;
      this.touch.x = 0;
      this.touch.y = 0;
      knob.style.transform = "translate(-50%, -50%)";
    };

    joystick.addEventListener("pointerdown", e => {
      e.preventDefault();
      pointerId = e.pointerId;
      joystick.setPointerCapture(pointerId);
      updateJoystick(e);
    });

    joystick.addEventListener("pointermove", e => {
      if (e.pointerId === pointerId) updateJoystick(e);
    });

    joystick.addEventListener("pointerup", resetJoystick);
    joystick.addEventListener("pointercancel", resetJoystick);

    document.getElementById("action-button")
      .addEventListener("pointerdown", e => {
        e.preventDefault();
        this.interact();
      });

    document.getElementById("dialogue")
      .addEventListener("pointerdown", e => {
        e.preventDefault();
        this.nextDialogue();
      });
  }

  update() {
    if (!this.player) return;

    if (this.dialogueLines) {
      this.player.setVelocity(0, 0);
      return;
    }

    let x = 0;
    let y = 0;

    if (this.cursors.left.isDown || this.keys.left.isDown) x -= 1;
    if (this.cursors.right.isDown || this.keys.right.isDown) x += 1;
    if (this.cursors.up.isDown || this.keys.up.isDown) y -= 1;
    if (this.cursors.down.isDown || this.keys.down.isDown) y += 1;

    if (Math.abs(this.touch.x) > 0.12 || Math.abs(this.touch.y) > 0.12) {
      x += this.touch.x;
      y += this.touch.y;
    }

    const length = Math.hypot(x, y);
    if (length > 1) {
      x /= length;
      y /= length;
    }

    const speed = 155;
    this.player.setVelocity(x * speed, y * speed);
    this.player.depth = this.player.y;

    this.updateDepth(this.thomas);
    this.updateDepth(this.cecile, 25);
    this.updateDepth(this.cat);

    this.updateInteraction();
  }

  updateDepth(object, offset = 0) {
    if (object) object.setDepth(object.y + offset);
  }

  updateInteraction() {
    const targets = [
      { object: this.thomas, id: "thomas", radius: 70 },
      { object: this.cecile, id: "cecile", radius: 90 },
      { object: this.cat, id: "ti-chat", radius: 65 },
      { object: this.bookPoint, id: "book", radius: 60 }
    ];

    let best = null;
    let bestDistance = Infinity;

    for (const target of targets) {
      const dx = this.player.x - target.object.x;
      const dy = this.player.y - target.object.y;
      const distance = Math.hypot(dx, dy);

      if (distance < target.radius && distance < bestDistance) {
        best = target;
        bestDistance = distance;
      }
    }

    this.nearest = best;

    const hint = document.getElementById("interaction-hint");
    if (best) {
      hint.classList.remove("hidden");
      hint.textContent = best.id === "book"
        ? "E — Examiner"
        : "E — Interagir";
    } else {
      hint.classList.add("hidden");
    }
  }

  interact() {
    if (this.dialogueLines) {
      this.nextDialogue();
      return;
    }

    if (!this.nearest) return;

    if (this.nearest.id === "cecile") {
      this.showDialogue([
        ["Cécile", "Bonjour."],
        ["Cécile", "Je lis un peu avant de repartir."],
        ["Cécile", "Tu connais Krasznahorkai ?"]
      ]);
    }

    if (this.nearest.id === "thomas") {
      this.showDialogue([
        ["Thomas", "Ah. Enfin quelqu'un."],
        ["Thomas", "Tu sais comment fonctionne ce mécanisme ?"],
        ["Voyageur", "Non."],
        ["Thomas", "Moi non plus."],
        ["Thomas", "Mais ça devrait fonctionner."]
      ]);
    }

    if (this.nearest.id === "ti-chat") {
      this.showDialogue([["Ti Chat", "Miaou."]]);
    }

    if (this.nearest.id === "book") {
      this.showDialogue([
        ["Livre", "Les pages sont couvertes d'une écriture ancienne."],
        ["Livre", "Certaines phrases semblent avoir été effacées."],
        ["Livre", "Une seule ligne reste parfaitement lisible."],
        ["Livre", "« Toute expédition commence avant même que ses voyageurs sachent où ils vont. »"]
      ]);
    }
  }

  showDialogue(lines) {
    this.dialogueLines = lines;
    this.dialogueIndex = 0;
    this.renderDialogue();
  }

  renderDialogue() {
    if (!this.dialogueLines) return;

    const [name, text] = this.dialogueLines[this.dialogueIndex];
    document.getElementById("dialogue-name").textContent = name;
    document.getElementById("dialogue-text").textContent = text;
    document.getElementById("dialogue").classList.remove("hidden");
  }

  nextDialogue() {
    if (!this.dialogueLines) return;

    this.dialogueIndex++;

    if (this.dialogueIndex >= this.dialogueLines.length) {
      this.closeDialogue();
      return;
    }

    this.renderDialogue();
  }

  closeDialogue() {
    this.dialogueLines = null;
    this.dialogueIndex = 0;
    document.getElementById("dialogue").classList.add("hidden");
  }
}

const config = {
  type: Phaser.AUTO,
  parent: "game-root",
  width: GAME_W,
  height: GAME_H,
  backgroundColor: "#17120f",
  pixelArt: true,
  antialias: false,
  physics: {
    default: "arcade",
    arcade: {
      gravity: { y: 0 },
      debug: false
    }
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_W,
    height: GAME_H
  },
  scene: [LibraryScene]
};

new Phaser.Game(config);
