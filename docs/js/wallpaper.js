// Animated cosy village wallpaper: SVG layers (Fable) + canvases between them.
(function () {
  const log = m => { try { webkit.messageHandlers.log.postMessage(String(m)); } catch (e) { console.log(m); } };
  window.onerror = (m, s, l) => log('JS ' + m + ' @' + l);
  const VW = 1512, VH = 982;
  const rand = (a, b) => a + Math.random() * (b - a);
  const LAYERS = ['sky', 'c0', 'mountains', 'c1', 'village', 'c2', 'foreground', 'c3'];
  const root = document.getElementById('scene');
  const el = {}, ctx = {};
  for (const n of LAYERS) {
    const e = document.createElement(n[0] === 'c' && n.length === 2 ? 'canvas' : 'img');
    if (e.tagName === 'IMG') e.src = 'assets/wallpaper/' + n + '.svg';
    e.style.position = 'absolute';
    root.appendChild(e);
    el[n] = e;
    if (e.tagName === 'CANVAS') ctx[n] = e.getContext('2d');
  }
  let S = 1, OX = 0, OY = 0, DPR = 2, paused = false;
  const RES = { c0: 1, c1: 1, c2: 1.5, c3: 1 };   // blurry layers don't need Retina
  function fit() {
    DPR = Math.max(1, devicePixelRatio || 2);
    S = Math.max(innerWidth / VW, innerHeight / VH);
    OX = (innerWidth - VW * S) / 2; OY = (innerHeight - VH * S) / 2;
    for (const n of LAYERS) {
      const e = el[n];
      Object.assign(e.style, { left: OX + 'px', top: OY + 'px', width: VW * S + 'px', height: VH * S + 'px' });
      if (e.tagName === 'CANVAS') { e.width = Math.round(VW * S * RES[n]); e.height = Math.round(VH * S * RES[n]); }
    }
  }

  // ---------- glow sprites ----------
  const GL = {};
  function rgba(h, a) { const n = parseInt(h.slice(1), 16); return 'rgba(' + (n >> 16) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')'; }
  function glow(o, c, x, y, r, a) {
    if (!GL[c]) {
      const s = document.createElement('canvas'); s.width = s.height = 64;
      const x2 = s.getContext('2d'), gr = x2.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, rgba(c, 1)); gr.addColorStop(0.15, rgba(c, 0.5)); gr.addColorStop(1, rgba(c, 0));
      x2.fillStyle = gr; x2.fillRect(0, 0, 64, 64); GL[c] = s;
    }
    o.globalAlpha = a; o.drawImage(GL[c], x - r, y - r, r * 2, r * 2); o.globalAlpha = 1;
  }

  // ---------- data ----------
  let A = null;
  const stars = [], far = [], mid = [], near = [], smoke = [], winState = [];
  let shooting = null, nextShoot = rand(8, 20);
  for (let i = 0; i < 110; i++) stars.push({ x: rand(0, VW), y: rand(30, 420), r: rand(0.5, 1.4), p: rand(0, 6.3), s: rand(0.6, 2.2) });
  const mk = (arr, n, r0, r1, v0, v1, a) => { for (let i = 0; i < n; i++) arr.push({ x: rand(0, VW), y: rand(0, VH), r: rand(r0, r1), v: rand(v0, v1), p: rand(0, 6.3), a }); };
  mk(far, 90, 0.4, 0.9, 8, 14, 0.55);
  mk(mid, 110, 0.7, 1.5, 16, 26, 0.75);
  mk(near, 26, 2.5, 5, 30, 46, 0.25);

  // polyline helpers for the train and the passers-by
  function polyLen(pl) { let L = 0; for (let i = 1; i < pl.length; i++) L += Math.hypot(pl[i][0] - pl[i - 1][0], pl[i][1] - pl[i - 1][1]); return L; }
  function at(pl, d) {
    for (let i = 1; i < pl.length; i++) {
      const [x0, y0] = pl[i - 1], [x1, y1] = pl[i], l = Math.hypot(x1 - x0, y1 - y0);
      if (d <= l || i === pl.length - 1) { const u = Math.max(0, Math.min(1, d / l)); return { x: x0 + (x1 - x0) * u, y: y0 + (y1 - y0) * u, a: Math.atan2(y1 - y0, x1 - x0) }; }
      d -= l;
    }
    return { x: pl[0][0], y: pl[0][1], a: 0 };
  }
  let railL = 1, pathL = 1, train = { d: -400, wait: 4 }, passers = [], skaters = [];

  fetch('assets/wallpaper/anchors.json').then(r => r.json()).then(j => {
    A = j;
    railL = polyLen(A.rail || [[0, 0], [1, 0]]);
    pathL = polyLen(A.path || [[0, 0], [1, 0]]);
    (A.windows || []).forEach(() => winState.push({ on: Math.random() < 0.85, f: rand(0, 6.3), next: rand(20, 120) }));
    for (let i = 0; i < 3; i++) passers.push({ d: rand(0, pathL), dir: Math.random() < 0.5 ? 1 : -1, sp: rand(6, 10), f: rand(0, 2) });
    skaters = [{ a: 0, sp: 0.35, f: 0 }, { a: Math.PI, sp: 0.28, f: 0.5 }];
    log('wallpaper ready');
  }).catch(e => log('ancres: ' + e));
  Sprites.load(['skater1', 'skater2', 'walker1', 'walker2', 'train_engine', 'train_car', 'train_car_tree', 'wheel_small']);

  function begin(n) { const o = ctx[n]; o.setTransform(S * RES[n], 0, 0, S * RES[n], 0, 0); o.clearRect(0, 0, VW, VH); return o; }

  function snow(o, arr, dt, t, wind) {
    for (const f of arr) {
      f.y += f.v * dt; f.x += (wind + Math.sin(t * 0.8 + f.p) * 6) * dt * (f.r / 1.5);
      if (f.y > VH + 6) { f.y = -6; f.x = rand(-20, VW); }
      if (f.x > VW + 10) f.x = -10;
      glow(o, '#ffffff', f.x, f.y, f.r * (f.a < 0.4 ? 3 : 1.8), f.a);
    }
  }

  function drawTrain(o, t, dt) {
    if (!A || !A.rail) return;
    if (train.d > railL + 220) { train.wait -= dt; if (train.wait <= 0) { train.d = -160; train.wait = rand(25, 45); } return; }
    train.d += 38 * dt;
    const cars = [['train_engine', 58, [[11, 28.5], [25, 28.5], [39, 28.5]]], ['train_car', 46, [[10, 22.5], [36, 22.5]]], ['train_car_tree', 46, [[10, 22.5], [36, 22.5]]]];
    let d = train.d;
    cars.forEach(([n, w, wheels], i) => {
      const c = d - w / 2;
      d -= w + 3;
      if (c < -60 || c > railL + 60) return;
      const p = at(A.rail, Math.max(0, Math.min(railL, c)));
      o.save(); o.translate(p.x, p.y); o.rotate(p.a);
      const h = Sprites.LIST[n][2];
      Sprites.draw(o, n, 0, -2);
      for (const [wx, wy] of wheels) Sprites.draw(o, 'wheel_small', wx - w / 2, wy - h - 2, { rot: train.d / 5.5 });
      if (i === 0) {
        glow(o, '#ffe1a0', w / 2 + 2, -h + 14, 14, 0.8);
        if (Math.random() < 0.3) smoke.push({ x: p.x + Math.cos(p.a) * 16, y: p.y - h + 2, r: 2, l: 3, L: 3, vx: -6, vy: -14 });
      } else if (n === 'train_car') glow(o, '#ffcc66', 0, -h / 2 - 2, 26, 0.35);
      o.restore();
    });
  }

  function frame(dt, t) {
    const wind = 5 + Math.sin(t * 0.1) * 5;
    // sky: stars + shooting star
    let o = begin('c0');
    for (const s of stars) glow(o, '#e8f0ff', s.x, s.y, s.r * 2.5, 0.35 + 0.35 * Math.sin(t * s.s + s.p));
    nextShoot -= dt;
    if (nextShoot <= 0 && !shooting) { shooting = { x: rand(200, VW - 200), y: rand(60, 220), vx: rand(-420, -300), vy: rand(80, 140), l: 1.1 }; nextShoot = rand(25, 55); }
    if (shooting) {
      const s = shooting; s.l -= dt; s.x += s.vx * dt; s.y += s.vy * dt;
      const gr = o.createLinearGradient(s.x, s.y, s.x - s.vx * 0.18, s.y - s.vy * 0.18);
      gr.addColorStop(0, 'rgba(255,250,235,' + Math.max(0, s.l) + ')'); gr.addColorStop(1, 'rgba(255,250,235,0)');
      o.strokeStyle = gr; o.lineWidth = 1.4; o.beginPath(); o.moveTo(s.x, s.y); o.lineTo(s.x - s.vx * 0.18, s.y - s.vy * 0.18); o.stroke();
      if (s.l <= 0) shooting = null;
    }
    // far snow behind the village
    o = begin('c1'); snow(o, far, dt, t, wind);
    // village life
    o = begin('c2');
    if (A) {
      o.globalCompositeOperation = 'lighter';
      (A.windows || []).forEach(([x, y, w, h], i) => {
        const s = winState[i]; if (!s) return;
        s.next -= dt; if (s.next <= 0) { s.on = Math.random() < 0.8; s.next = rand(30, 160); }
        if (!s.on) return;
        const fl = 0.75 + 0.12 * Math.sin(t * 3 + s.f) + 0.08 * Math.sin(t * 11.3 + s.f * 2);
        glow(o, '#ffc66b', x + w / 2, y + h / 2, Math.max(w, h) * 1.3, 0.45 * fl);
      });
      (A.lamps || []).forEach(([x, y], i) => { glow(o, '#ffd89a', x, y, 22, 0.75 + 0.05 * Math.sin(t * 7 + i)); glow(o, '#ffcc66', x, y + 26, 30, 0.18); });
      const TC = ['#ff6b5b', '#ffd27a', '#7fd6ff', '#ff9ad5', '#9fe8a0'];
      (A.tree || []).forEach(([x, y], i) => glow(o, TC[i % TC.length], x, y, 6, 0.35 + 0.5 * Math.max(0, Math.sin(t * 1.7 + i * 1.9))));
      o.globalCompositeOperation = 'source-over';
      // chimney smoke
      (A.chimneys || []).forEach(([x, y]) => { if (Math.random() < dt * 3) smoke.push({ x: x + rand(-1, 1), y, r: rand(2, 3), l: rand(4, 6), L: 6, vx: rand(2, 6), vy: rand(-12, -8) }); });
      // skaters on the pond
      if (A.pond) {
        const [ex, ey, ew, eh] = A.pond, cx = ex + ew / 2, cy = ey + (eh || 30) / 2;
        skaters.forEach(k => {
          k.a += k.sp * dt; k.f += dt * 2.2;
          const x = cx + Math.cos(k.a) * ew * 0.32, y = cy + Math.sin(k.a) * (eh || 30) * 0.25 + 8;
          Sprites.draw(o, Math.floor(k.f) % 2 ? 'skater1' : 'skater2', x, y, { flip: Math.sin(k.a) > 0 });
        });
      }
      // passers-by with lanterns
      passers.forEach(p => {
        p.d += p.dir * p.sp * dt; p.f += dt * 3;
        if (p.d < 0 || p.d > pathL) p.dir *= -1;
        const q = at(A.path, Math.max(0, Math.min(pathL, p.d)));
        Sprites.draw(o, Math.floor(p.f) % 2 ? 'walker1' : 'walker2', q.x, q.y, { flip: p.dir < 0 });
        o.globalCompositeOperation = 'lighter'; glow(o, '#ffcc66', q.x + (p.dir < 0 ? -3 : 3), q.y - 9, 10, 0.7); o.globalCompositeOperation = 'source-over';
      });
      drawTrain(o, t, dt);
    }
    for (let i = smoke.length - 1; i >= 0; i--) {
      const s = smoke[i]; s.l -= dt;
      if (s.l <= 0) { smoke.splice(i, 1); continue; }
      s.x += (s.vx + wind * 0.6) * dt; s.y += s.vy * dt; s.r += dt * 2.6;
      o.globalAlpha = 0.16 * (s.l / s.L); o.fillStyle = '#c9d2ea'; o.beginPath(); o.arc(s.x, s.y, s.r, 0, 7); o.fill();
    }
    o.globalAlpha = 1;
    snow(o, mid, dt, t, wind);
    // foreground bokeh
    o = begin('c3'); snow(o, near, dt, t, wind);
  }

  window.MN = {
    update(s) { if (s.paused !== undefined) paused = s.paused; },
    outro() { root.style.transition = 'opacity 1.1s ease'; root.style.opacity = 0; },
    setOpts() {},
  };

  let last = performance.now(), t = 0, acc = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (paused) return;
    acc += dt; if (acc < 1 / 24) return;
    t += acc; frame(acc, t); acc = 0;
  }
  fit();
  addEventListener('resize', fit);
  root.style.opacity = 0;                       // fade the village in when the mode starts
  requestAnimationFrame(() => { root.style.transition = 'opacity 1.8s ease'; root.style.opacity = 1; });
  requestAnimationFrame(loop);
})();
