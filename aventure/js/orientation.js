/* Écran « Tourne ton téléphone » : en portrait sur un appareil tactile, le jeu est mis en pause
   et un voile demande de passer en paysage. Il disparaît tout seul à la rotation. */
(function () {
  const params = new URLSearchParams(location.search);
  if (params.has('edit')) return;                 // l'éditeur se règle comme on veut
  const el = document.getElementById('rotate');
  if (!el) return;
  const mq = window.matchMedia('(orientation: portrait) and (pointer: coarse)');
  let shown = false;

  function apply() {
    const need = mq.matches || params.has('forceportrait');
    if (need === shown) return;
    shown = need;
    el.hidden = !need;
    document.body.classList.toggle('is-portrait-blocked', need);
    const g = window.__game;
    if (g && g.scene) {
      try { need ? g.scene.pause('room') : g.scene.resume('room'); } catch (e) { /* jeu pas encore prêt */ }
    }
  }

  if (mq.addEventListener) mq.addEventListener('change', apply); else mq.addListener(apply);
  window.addEventListener('resize', apply);
  window.addEventListener('orientationchange', apply);
  // au démarrage : le jeu se crée après le chargement des données ; on pause dès que la scène tourne
  apply();
  let tries = 0;
  const t = setInterval(function () {
    const g = window.__game;
    if (g && g.scene && g.scene.isActive('room')) {
      if (shown) { try { g.scene.pause('room'); } catch (e) {} }
      clearInterval(t);
    } else if (++tries > 80) clearInterval(t);
  }, 250);
})();

/* Plein écran (Android / tablettes) : au premier toucher, on passe en plein écran et on tente de
   verrouiller le paysage. Sur iPhone Safari, ce n'est pas possible : il faut installer le jeu sur
   l'écran d'accueil (« Partager » → « Sur l'écran d'accueil »), il s'ouvre alors sans barre. */
(function () {
  if (new URLSearchParams(location.search).has('edit')) return;
  const de = document.documentElement;
  const req = de.requestFullscreen || de.webkitRequestFullscreen;
  const standalone = window.matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches || navigator.standalone;
  if (!req || standalone) return;
  function go() {
    window.removeEventListener('pointerup', go, true);
    if (document.fullscreenElement) return;
    try {
      const pr = req.call(de, { navigationUI: 'hide' });
      const lock = function () { try { screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(function () {}); } catch (e) {} };
      if (pr && pr.then) pr.then(lock).catch(function () {}); else lock();
    } catch (e) { /* refusé : tant pis */ }
  }
  if (window.matchMedia('(pointer: coarse)').matches) window.addEventListener('pointerup', go, true);
})();
