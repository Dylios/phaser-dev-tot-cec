/* Contrôles : joystick virtuel + bouton « Agir » (mobile) et clavier (ordinateur).
 * Expose window.Controls = { x, y, act } lu par la scène à chaque image. */
(function () {
  const ctl = { x: 0, y: 0, act: false };
  window.Controls = ctl;

  const joy = document.getElementById('joy');
  const stick = document.getElementById('stick');
  const btn = document.getElementById('act');
  const dlg = document.getElementById('dlg');

  let pid = null;

  function move(e) {
    const r = joy.getBoundingClientRect();
    const R = r.width / 2;
    const max = R * 0.6;
    let dx = e.clientX - (r.left + R);
    let dy = e.clientY - (r.top + R);
    const d = Math.hypot(dx, dy);
    if (d > max) { dx *= max / d; dy *= max / d; }
    stick.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
    // petite zone morte pour éviter les dérives
    const nx = dx / max, ny = dy / max;
    ctl.x = Math.abs(nx) < 0.12 ? 0 : nx;
    ctl.y = Math.abs(ny) < 0.12 ? 0 : ny;
  }

  function end(e) {
    if (e.pointerId !== pid) return;
    pid = null;
    ctl.x = ctl.y = 0;
    stick.style.transform = '';
  }

  joy.addEventListener('pointerdown', function (e) {
    pid = e.pointerId;
    joy.setPointerCapture(pid);
    move(e);
    e.preventDefault();
  });
  joy.addEventListener('pointermove', function (e) { if (e.pointerId === pid) move(e); });
  joy.addEventListener('pointerup', end);
  joy.addEventListener('pointercancel', end);

  btn.addEventListener('pointerdown', function (e) { ctl.act = true; e.preventDefault(); });
  // toucher la boîte de dialogue la fait avancer
  dlg.addEventListener('pointerdown', function (e) { ctl.act = true; e.preventDefault(); });
})();
