// ============================================================
// EXPEDITION 2028 — Phaser 4 prototype
// GitHub Pages friendly: no modules, no npm, no build step.
// ============================================================

const GAME_W = 960;
const GAME_H = 540;

class LibraryScene extends Phaser.Scene {
  constructor() {
    super("LibraryScene");
  }

  preload() {
    // Characters
    this.load.spritesheet("thomas", "assets/characters/thomas_sheet.png", {
      frameWidth: 32, frameHeight: 32
    });

    this.load.spritesheet("cecile", "assets/characters/cecile_sheet.png", {
      frameWidth: 32, frameHeight: 32
    });

    this.load.image("cecile-seated", "assets/characters/cecile_seated_ref.png");
    this.load.image("ti-chat", "assets/characters/ti-chat.png");
    this.load.image("player", "assets/characters/player.png");

    // Environment
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

    this.createLibrary();
    this.createCharacters();
    this.createPlayer();
    this.createCollisions();
    this.createInput();

    this.nearest = null;
    this.dialogueLines = null;
    this.dialogueIndex = 0;

    this.showDialogue([
      ["Livre", "La bibliothèque semble attendre quelqu'un."],
      ["Livre", "Et cette fois, l'expédition est déjà commencée."]
    ]);

    this.cameras.main.setBackgroundColor("#17120f");
  }

  createLibrary() {
    // --- Floor
    const floor = this.add.tileSprite(
      GAME_W / 2, 320, GAME_W - 32, 408,
      "floor_wood"
    );
    floor.setScale(0.62);
    floor.setDepth(0);

    // Dark vignette around the room edges.
    const topWall = this.add.rectangle(480, 42, 928, 84, 0x251a14);
    topWall.setDepth(1);

    // Wall panels
    for (let x = 38; x <= 922; x += 40) {
      const panel = this.add.image(x, 62, "wall_panel");
      panel.setScale(.67);
      panel.setDepth(2);
    }

    // Back bookcases: continuous composition rather than isolated grid cells.
    for (const x of [55, 125, 195, 765, 835, 905]) {
      const shelf = this.add.image(x, 128, "bookshelf");
      shelf.setScale(1.03);
      shelf.setDepth(4);
    }

    // Lower shelves.
    for (const x of [115, 185, 775, 845]) {
      const shelf = this.add.image(x, 430, "bookshelf");
      shelf.setScale(1.02);
      shelf.setDepth(4);
    }

    // Fireplace and cabinet.
    this.add.image(50, 198, "fireplace").setScale(1.2).setDepth(5);
    this.add.image(905, 205, "cabinet").setScale(1.2).setDepth(5);

    // Central carpet.
    const carpet = this.add.image(480, 335, "carpet");
    carpet.setScale(4.8, 2.5);
    carpet.setDepth(1);

    // Main table.
    const table = this.add.image(480, 342, "table");
    table.setScale(1.15);
    table.setDepth(8);

    // Chairs.
    for (const [x, y] of [[380, 325], [580, 325], [430, 395], [530, 395]]) {
      const chair = this.add.image(x, y, "chair");
      chair.setScale(.55);
      chair.setDepth(y);
    }

    // Central book and lamp.
    this.add.image(480, 325, "book").setScale(.55).setDepth(10);
    this.add.image(535, 300, "lamp").setScale(.52).setDepth(10);

    // Decorative objects.
    this.add.image(140, 235, "plant").setScale(.7).setDepth(6);
    this.add.image(820, 235, "globe").setScale(.72).setDepth(6);
    this.add.image(100, 470, "books_stack").setScale(.65).setDepth(9);
    this.add.image(860, 465, "books_stack").setScale(.65).setDepth(9);

    // Thomas' mechanism corner.
    const mechanism = this.add.container(760, 185);
    const mechBox = this.add.rectangle(0, 0, 120, 70, 0x4b3021)
      .setStrokeStyle(3, 0xa88a52);
    const ring = this.add.circle(0, 0, 27, 0x8f6b37)
      .setStrokeStyle(5, 0xd3b56c);
    mechanism.add([mechBox, ring]);
    mechanism.setDepth(6);

    // Exit.
    const door = this.add.rectangle(480, 512, 90, 38, 0x2b1c15)
      .setStrokeStyle(3, 0x72543b);
    door.setDepth(6);
  }

  createCharacters() {
    // Thomas: use the first frame of the sprite sheet, scaled up.
    this.thomas = this.add.sprite(760, 205, "thomas", 0);
    this.thomas.setScale(2.1);
    this.thomas.setDepth(this.thomas.y);

    // Cécile: seated reading, using the dedicated seated reference.
    this.cecile = this.add.image(205, 270, "cecile-seated");
    this.cecile.setDisplaySize(112, 154);
    this.cecile.setDepth(this.cecile.y + 55);

    // Ti Chat.
    this.cat = this.add.image(770, 410, "ti-chat");
    this.cat.setDisplaySize(64, 64);
    this.cat.setDepth(this.cat.y + 20);

    // Small ambient label for the central book.
    this.bookPoint = this.add.circle(480, 325, 10, 0x000000, 0);
    this.bookPoint.setDepth(12);
  }

  createPlayer() {
    this.player = this.physics.add.sprite(480, 465, "player");
    this.player.setScale(.72);
    this.player.setDepth(this.player.y);
    this.player.setCollideWorldBounds(true);
    this.player.setDrag(900, 900);
    this.player.setMaxVelocity(155, 155);

    // Slightly smaller collision body than the artwork.
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

    // Back wall.
    block(480, 74, 920, 70);

    // Side shelves.
    block(55, 160, 70, 130);
    block(125, 160, 70, 130);
    block(195, 160, 70, 130);
    block(765, 160, 70, 130);
    block(835, 160, 70, 130);
    block(905, 160, 70, 130);

    // Lower shelves.
    block(115, 430, 70, 90);
    block(185, 430, 70, 90);
    block(775, 430, 70, 90);
    block(845, 430, 70, 90);

    // Fireplace / cabinet.
    block(50, 198, 72, 72);
    block(905, 205, 72, 72);

    // Table.
    block(480, 342, 210, 90);

    // Thomas' mechanism.
    block(760, 185, 125, 70);
  }

  createInput() {
    this.cursors = this.input.keyboard.createCursorKeys();

    this.keys = this.input.keyboard.addKeys({
      up: "Z",
      down: "S",
      left: "Q",
      right: "D"
    });

    this.input.keyboard.on("keydown-E", () => {
      this.interact();
    });

    // Dialogue: E, Enter, Space or tap dialogue box.
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
      const max = rect.width * .32;
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

    if (Math.abs(this.touch.x) > .12 || Math.abs(this.touch.y) > .12) {
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
    this.updateDepth(this.cecile, 55);
    this.updateDepth(this.cat, 20);

    this.updateInteraction();
  }

  updateDepth(object, offset = 0) {
    if (object) object.setDepth(object.y + offset);
  }

  updateInteraction() {
    const targets = [
      { object: this.thomas, id: "thomas", radius: 70 },
      { object: this.cecile, id: "cecile", radius: 85 },
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
      this.dialogueLines = null;
      document.getElementById("dialogue").classList.add("hidden");
      return;
    }

    this.renderDialogue();
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
