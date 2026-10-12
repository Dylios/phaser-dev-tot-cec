/* Point d'entrée : charge la pièce (JSON) et la liste des assets, puis lance Phaser. */
(function () {
  const params = new URLSearchParams(location.search);
  const roomId = params.get('piece') || 'bibliotheque';
  const debug = params.has('debug');
  const edit = params.has('edit');                  // éditeur de pièce
  const draft = edit || params.has('brouillon');    // jouer / éditer le brouillon enregistré dans ce navigateur
  const DRAFT_KEY = 'exp2028:draft:' + roomId;

  // rendu net sur écrans haute densité (plafonné à 2 pour rester léger sur mobile)
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  Promise.all([
    fetch('data/' + roomId + '.json').then((r) => r.json()),
    fetch('data/assets.json').then((r) => r.json())
  ]).then(function (res) {
    let room = res[0];
    const assets = res[1];
    let fromDraft = false;
    if (draft) {
      try {
        const saved = localStorage.getItem(DRAFT_KEY);
        if (saved) { room = JSON.parse(saved); fromDraft = true; }
      } catch (e) { console.warn('brouillon illisible', e); }
    }
    window.__draftKey = DRAFT_KEY;
    window.__original = res[0];

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: 'game',
      width: Math.round(window.innerWidth * dpr),
      height: Math.round(window.innerHeight * dpr),
      backgroundColor: '#0b0705',
      pixelArt: false,
      antialias: true,
      roundPixels: false,
      scale: { mode: Phaser.Scale.NONE, zoom: 1 / dpr },
      scene: []
    });

    game.scene.add('room', window.RoomScene, true, { room: room, assets: assets, dpr: dpr, debug: debug, edit: edit, fromDraft: fromDraft });

    window.addEventListener('resize', function () {
      game.scale.resize(Math.round(window.innerWidth * dpr), Math.round(window.innerHeight * dpr));
    });
    window.__game = game;

    // bandeau quand on joue le brouillon
    if (draft && !edit) {
      const bar = document.createElement('div');
      bar.id = 'draftbar';
      bar.innerHTML = fromDraft
        ? 'Brouillon · <a href="?piece=' + roomId + '&edit">Modifier</a> · <a href="?piece=' + roomId + '">Version publiée</a>'
        : 'Aucun brouillon enregistré · <a href="?piece=' + roomId + '&edit">Ouvrir l’éditeur</a>';
      document.body.appendChild(bar);
    }
  }).catch(function (e) {
    document.body.insertAdjacentHTML('beforeend',
      '<pre style="position:fixed;inset:20px;color:#f88;white-space:pre-wrap">Erreur de chargement : ' + e + '\n\n' +
      'Ouvre le jeu via un serveur (GitHub Pages ou « python -m http.server »), pas en double-cliquant sur index.html.</pre>');
    console.error(e);
  });
})();
