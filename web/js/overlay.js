// Overlay layer: snow over everything, piles on real windows, garland, cursor, mini-world.
(function () {
  const cv = document.getElementById('c'), g = cv.getContext('2d');
  const log = m => { try { webkit.messageHandlers.log.postMessage(String(m)); } catch (e) { console.log(m); } };
  window.MNlog = log;
  window.onerror = (m, s, l) => log('JS ' + m + ' @' + l);
  const rand = (a, b) => a + Math.random() * (b - a);

  let W = innerWidth, H = innerHeight, DPR = Math.max(1, devicePixelRatio || 2);
  const piles = new Snow.Piles(W, H);
  const st = { wins: [], mouse: [-999, -999], paused: false, debug: false, menu: 33, notch: null, dock: null };
  const opts = { snow: 0.5, people: 2, piles: true, ground: true, cursor: true, garland: true, hat: true, music: false, volume: 0.6, igloos: true,
    skiers: true, workers: true, plow: true, penguins: true, kids: true, sleigh: true };
  let banner = null;
  let prevMouse = null, mvx = 0, mvy = 0, lastSync = 0, prefilled = false, t = 0;
  let introT = -1, outroT = -1;          // seconds since the on/off animations started
  const grow = new Map();                // window id → target pile heights (piles build up during the intro)

  function fit() {
    W = innerWidth; H = innerHeight; DPR = Math.max(1, devicePixelRatio || 2);
    cv.width = W * DPR; cv.height = H * DPR;
    piles.resize(W, H);
    buildGarland();
  }

  // ---------- glow sprites ----------
  const GL = {};
  function rgba(h, a) { const n = parseInt(h.slice(1), 16); return 'rgba(' + (n >> 16) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')'; }
  function glowSprite(c, core) {
    const k = c + core;
    if (GL[k]) return GL[k];
    const s = document.createElement('canvas'); s.width = s.height = 64;
    const x = s.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, rgba(c, 1)); gr.addColorStop(core, rgba(c, core > 0.3 ? 0.85 : 0.45)); gr.addColorStop(1, rgba(c, 0));
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    return (GL[k] = s);
  }
  function glow(o, c, x, y, r, a) {
    o.save(); o.globalCompositeOperation = 'lighter'; o.globalAlpha = a;
    o.drawImage(glowSprite(c, 0.12), x - r, y - r, r * 2, r * 2);
    o.restore();
  }

  // ---------- flakes ----------
  const F = [];
  function newFlake(f, init) {
    f.x = rand(-40, W + 40); f.y = init ? rand(-10, H) : rand(-60, -6); f.py = f.y;
    f.z = Math.random(); f.r = 0.7 + f.z * 2.3; f.v = 16 + f.z * 44; f.p = rand(0, 6.3); f.sw = rand(0.6, 1.4); f.vx = 0;
    const n = st.notch;
    if (!init && n && Math.random() < 0.2) {          // the notch is a snow cannon
      f.x = n[0] + rand(12, n[2] - 12); f.y = n[1] + n[3] + rand(0, 3); f.vx = rand(-55, 55); f.v *= 0.6;
    }
    return f;
  }
  function setDensity() {
    const n = Config.flakes(opts.snow, W, H);
    while (F.length < n) F.push(newFlake({}, true));
    F.length = n;
  }

  // ---------- particles & falling chunks ----------
  const PT = [], CH = [];
  const CONF = ['#c94a3f', '#e0b84a', '#2f5d50', '#f4f6fb', '#ffcc66'];
  function spawn(k, x, y, n) {
    for (let i = 0; i < n; i++) {
      const p = { k, x, y, vx: 0, vy: 0, l: 1, L: 1, r: 2, rot: rand(0, 6), c: '#ffffff' };
      if (k === 'puff') { const a = rand(Math.PI, 2 * Math.PI), s = rand(20, 70); p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s; p.L = p.l = rand(0.4, 0.8); p.r = rand(1.5, 3.2); }
      else if (k === 'spray') { p.vx = rand(-30, -5); p.vy = rand(-40, -10); p.L = p.l = rand(0.25, 0.5); p.r = rand(0.8, 1.6); }
      else if (k === 'dust') { p.vx = rand(-12, 12) + mvx * 0.05; p.vy = rand(-8, 14); p.L = p.l = rand(0.5, 1.1); p.r = rand(0.6, 1.5); p.c = Math.random() < 0.15 ? '#ffd89a' : '#ffffff'; }
      else if (k === 'gold') { p.vx = rand(-25, 5); p.vy = rand(-6, 18); p.L = p.l = rand(0.6, 1.3); p.r = rand(1, 2.4); }
      else if (k === 'smoke') { p.vx = rand(-4, 6); p.vy = rand(-16, -9); p.L = p.l = rand(2.5, 4); p.r = rand(2, 3.5); }
      else if (k === 'spark') { p.vx = rand(-8, 8); p.vy = rand(-40, -20); p.L = p.l = rand(0.4, 0.9); p.r = rand(0.6, 1.1); }
      else if (k === 'confetti') { const a = rand(0, 2 * Math.PI), s = rand(40, 140); p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s - 60; p.L = p.l = rand(1, 1.8); p.r = rand(1.4, 2.4); p.c = CONF[i % CONF.length]; }
      else if (k === 'ring') { p.L = p.l = 0.5; p.r = 2; }
      PT.push(p);
    }
  }
  // Where something falling lands, honouring the "on windows" / "on the ground" switches.
  function land(x, py, y, amount) {
    const id = piles.landAt(x, py, y);
    if (id === null) return null;
    if (id !== 'ground' && !opts.piles) {           // windows are bare: keep falling to the ground
      if (y < piles.groundTop(x)) return null;
      if (opts.ground) piles.addTo('ground', x, amount);
      return 'ground';
    }
    if (id === 'ground' && !opts.ground) return 'ground';
    piles.addTo(id, x, amount);
    return id;
  }

  function drawBanner(o, dt) {
    if (!banner) return;
    banner.t += dt;
    const T = banner.t, life = 4.2;
    if (T > life) { banner = null; return; }
    const a = Math.min(1, T / 0.4, (life - T) / 0.6), drop = (1 - Math.min(1, T / 0.5)) ** 3 * -30;
    o.save();
    o.globalAlpha = a;
    o.font = '600 15px -apple-system, "SF Pro Rounded", system-ui, sans-serif';
    const tw = o.measureText(banner.text).width, w = tw + 74, h = 38, x = W / 2 - w / 2, y = st.menu + 26 + drop;
    o.shadowColor = 'rgba(0,0,0,.35)'; o.shadowBlur = 18; o.shadowOffsetY = 6;
    const gr = o.createLinearGradient(x, y, x, y + h);
    gr.addColorStop(0, '#1d2a5c'); gr.addColorStop(1, '#0b1433');
    o.fillStyle = gr; o.beginPath(); o.roundRect(x, y, w, h, h / 2); o.fill();
    o.shadowColor = 'transparent';
    o.strokeStyle = 'rgba(224,184,74,.85)'; o.lineWidth = 1.2; o.stroke();
    o.fillStyle = '#f4ead8'; o.textBaseline = 'middle'; o.fillText(banner.text, x + 46, y + h / 2 + 0.5);
    o.strokeStyle = '#e0b84a'; o.lineWidth = 1.6; o.lineCap = 'round';
    const cx = x + 26, cy = y + h / 2;
    for (let i = 0; i < 3; i++) { const an = i * Math.PI / 3 + T * 0.6; o.beginPath(); o.moveTo(cx + Math.cos(an) * 8, cy + Math.sin(an) * 8); o.lineTo(cx - Math.cos(an) * 8, cy - Math.sin(an) * 8); o.stroke(); }
    o.restore();
    if (Math.random() < 0.5) spawn('gold', x + Math.random() * w, y + h, 1);
  }

  function stepParticles(dt) {
    for (let i = PT.length - 1; i >= 0; i--) {
      const p = PT[i];
      p.l -= dt;
      if (p.l <= 0) { PT.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += dt * 4;
      if (p.k === 'puff' || p.k === 'spray') { p.vy += 160 * dt; p.vx *= 0.96; }
      else if (p.k === 'confetti') { p.vy += 150 * dt; p.vx *= 0.97; }
      else if (p.k === 'smoke') { p.r += dt * 3; p.vx += 4 * dt; }
      else if (p.k === 'dust' || p.k === 'gold') p.vy += 10 * dt;
      else if (p.k === 'ring') p.r += dt * 90;
    }
    if (PT.length > 900) PT.splice(0, PT.length - 900);
    for (let i = CH.length - 1; i >= 0; i--) {
      const c = CH[i];
      const py = c.y;
      c.vy += 620 * dt; c.x += c.vx * dt; c.y += c.vy * dt;
      if (c.vy > 0) {
        const id = land(c.x, py, c.y, c.size * 2.2);
        if (id !== null) {
          spawn('puff', c.x, c.y, c.ball ? 10 : Math.min(8, 2 + Math.round(c.size)));
          CH.splice(i, 1); continue;
        }
      }
      if (c.y > H + 30) CH.splice(i, 1);
    }
  }

  // ---------- garland under the menu bar ----------
  let BUL = [], HOOKS = [];
  const BCOL = ['#ffd27a', '#ff8f6b', '#ffe9c4', '#9fd8a0', '#ffb35c', '#ff7070'];
  function buildGarland() {
    const segs = Math.max(4, Math.round(W / 150)), sw = W / segs;
    HOOKS = []; BUL = [];
    for (let k = 0; k <= segs; k++) HOOKS.push(k * sw);
    for (let x = 9; x < W; x += 19) { const s = Math.floor(x / sw), u = (x - s * sw) / sw; BUL.push({ x, u, s }); }
  }
  // 0..1 brightness of bulb i: they switch on left→right when the mode starts, off right→left when it stops.
  function bulbPower(i) {
    const n = BUL.length;
    if (outroT >= 0) { const off = outroT * 1.4 - ((n - 1 - i) / n) * 0.9; return off <= 0 ? 1 : Math.max(0, 1 - off * 4); }
    if (introT < 0) return 1;
    const on = introT * 1.25 - (i / n) * 1.6;
    return on <= 0 ? 0 : Math.min(1, on * 4) * (on < 0.25 ? 1.4 : 1);
  }
  // Snow stuck under the MacBook notch, with icicles.
  function drawNotch(o) {
    const n = st.notch;
    if (!n) return;
    const [x, y, w, h] = n, b = y + h;
    o.save();
    o.fillStyle = '#f4f6fb';
    o.beginPath(); o.moveTo(x + 6, b - 1);
    for (let i = 0; i <= 24; i++) { const px = x + 6 + (w - 12) * i / 24; o.lineTo(px, b + 2.2 + Math.sin(i * 1.7) * 1.2); }
    o.lineTo(x + w - 6, b - 1); o.closePath(); o.fill();
    for (let px = x + 12; px < x + w - 10; px += 9) {
      const len = 4 + hash(Math.round(px), 3) * 9 + Math.sin(t * 0.4 + px) * 0.6;
      const ig = o.createLinearGradient(0, b, 0, b + len);
      ig.addColorStop(0, 'rgba(240,248,255,.95)'); ig.addColorStop(1, 'rgba(200,225,255,0)');
      o.fillStyle = ig; o.beginPath(); o.moveTo(px - 1.5, b + 1); o.lineTo(px + 1.5, b + 1); o.lineTo(px, b + 1 + len); o.fill();
    }
    o.restore();
  }

  function drawGarland(o) {
    const y0 = st.menu + 1, sag = 10, sw = W / (HOOKS.length - 1);
    o.strokeStyle = '#2b3524'; o.lineWidth = 1;
    o.beginPath();
    for (let k = 0; k < HOOKS.length - 1; k++) { o.moveTo(HOOKS[k], y0); o.quadraticCurveTo(HOOKS[k] + sw / 2, y0 + sag * 2, HOOKS[k + 1], y0); }
    o.stroke();
    BUL.forEach((b, i) => {
      const y = y0 + sag * 4 * b.u * (1 - b.u);
      const c = BCOL[i % BCOL.length];
      const tw = (0.55 + 0.45 * Math.sin(t * 1.4 + i * 2.13) * Math.sin(t * 0.37 + i)) * bulbPower(i);
      if (tw <= 0.02) { o.fillStyle = '#3a3a3a'; o.fillRect(b.x - 1, y, 2, 2); o.fillStyle = 'rgba(120,120,130,.6)'; o.beginPath(); o.ellipse(b.x, y + 4.8, 2, 3, 0, 0, 7); o.fill(); return; }
      glow(o, c, b.x, y + 5, 11, Math.max(0.15, tw) * 0.8);
      o.fillStyle = '#3a3a3a'; o.fillRect(b.x - 1, y, 2, 2);
      o.globalAlpha = 0.55 + 0.45 * Math.max(0, tw);
      o.fillStyle = c; o.beginPath(); o.ellipse(b.x, y + 4.8, 2, 3, 0, 0, 7); o.fill();
      o.fillStyle = 'rgba(255,255,255,.7)'; o.beginPath(); o.arc(b.x - 0.6, y + 3.8, 0.7, 0, 7); o.fill();
      o.globalAlpha = 1;
    });
  }

  // ---------- piles ----------
  function hash(a, b) { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function pileOutline(o, x0, y0, bins, wMax, edgeFn) {
    o.beginPath(); o.moveTo(x0, y0);
    let px = x0, py = y0;
    for (let i = 0; i < bins.length; i++) {
      const x = Math.min(x0 + i * Snow.BIN, x0 + wMax), y = y0 - bins[i] * edgeFn(x);
      o.quadraticCurveTo(px, py, (px + x) / 2, (py + y) / 2);
      px = x; py = y;
    }
    o.lineTo(x0 + wMax, y0); o.closePath();
  }
  function drawPiles(o) {
    const order = piles.order;
    for (let i = opts.piles ? order.length - 1 : -1; i >= 0; i--) {
      const p = order[i];
      if (!p) continue;
      const front = order.slice(0, i);
      o.save();
      if (front.length) { o.beginPath(); o.rect(0, 0, W, H); front.forEach(f => o.rect(f.x, f.y - 1, f.w, f.h + 1)); o.clip('evenodd'); }
      const edge = x => Math.sqrt(Math.max(0, Math.min(1, Math.min(x - p.x, p.x + p.w - x) / 12)));
      // soft shadow cast on the title bar
      const sh = o.createLinearGradient(0, p.y, 0, p.y + 6);
      sh.addColorStop(0, 'rgba(10,16,40,.28)'); sh.addColorStop(1, 'rgba(10,16,40,0)');
      o.fillStyle = sh; o.fillRect(p.x + 4, p.y, p.w - 8, 6);
      // icicles
      for (let k = 2; k < p.bins.length - 2; k++) {
        if (hash(p.id, k) > 0.09 || p.bins[k] < 3.5) continue;
        const x = p.x + k * Snow.BIN, len = Math.min(11, (p.bins[k] - 3) * 2.2) * (0.6 + hash(k, p.id) * 0.6);
        const ig = o.createLinearGradient(0, p.y, 0, p.y + len);
        ig.addColorStop(0, 'rgba(240,248,255,.95)'); ig.addColorStop(1, 'rgba(200,225,255,0)');
        o.fillStyle = ig; o.beginPath(); o.moveTo(x - 1.6, p.y); o.lineTo(x + 1.6, p.y); o.lineTo(x, p.y + len); o.fill();
      }
      pileOutline(o, p.x, p.y, p.bins, p.w, edge);
      const gr = o.createLinearGradient(0, p.y - p.max, 0, p.y);
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#cbd5ee');
      o.fillStyle = gr; o.fill();
      o.strokeStyle = 'rgba(255,255,255,.9)'; o.lineWidth = 0.8; o.stroke();
      o.restore();
    }
    // ground
    const gb = piles.ground;
    if (!opts.ground) return;
    o.save();
    pileOutline(o, 0, H, gb, W, () => 1);
    const gr = o.createLinearGradient(0, H - Snow.GROUND_MAX, 0, H);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#c3cde8');
    o.fillStyle = gr; o.fill();
    o.strokeStyle = 'rgba(255,255,255,.9)'; o.lineWidth = 0.8; o.stroke();
    o.restore();
    // glints
    for (let k = 0; k < 6; k++) {
      const p = order[Math.floor(hash(k, Math.floor(t * 2)) * order.length)];
      if (!p) continue;
      const i = Math.floor(hash(Math.floor(t * 2), k + 7) * p.bins.length), x = p.x + i * Snow.BIN;
      if (p.bins[i] > 3 && piles.visibleAt(p, x)) glow(g, '#ffffff', x, piles.topAt(p.id, x) + 1.5, 3.5, 0.6 + 0.4 * Math.sin(t * 9 + k));
    }
  }

  function drawFlakes(o, near) {
    const s = glowSprite('#ffffff', 0.38);
    for (const f of F) {
      if ((f.z >= 0.45) !== near) continue;
      if (f.z > 0.975) { o.globalAlpha = 0.2; const r = f.r * 4.5; o.drawImage(s, f.x - r, f.y - r, r * 2, r * 2); }
      else { o.globalAlpha = 0.45 + f.z * 0.5; const r = f.r * 1.6; o.drawImage(s, f.x - r, f.y - r, r * 2, r * 2); }
    }
    o.globalAlpha = 1;
  }

  function drawParticles(o) {
    const ws = glowSprite('#ffffff', 0.38);
    for (const p of PT) {
      const a = Math.max(0, p.l / p.L);
      if (p.k === 'puff' || p.k === 'spray' || p.k === 'dust') {
        if (p.c !== '#ffffff') { glow(o, p.c, p.x, p.y, p.r * 3, a); continue; }
        o.globalAlpha = a * 0.95; o.drawImage(ws, p.x - p.r * 1.6, p.y - p.r * 1.6, p.r * 3.2, p.r * 3.2);
      } else if (p.k === 'gold') glow(o, '#ffd66b', p.x, p.y, p.r * 3, a * 0.9);
      else if (p.k === 'spark') glow(o, '#ffb347', p.x, p.y, p.r * 3, a);
      else if (p.k === 'smoke') { o.globalAlpha = a * 0.22; o.fillStyle = '#d8deef'; o.beginPath(); o.arc(p.x, p.y, p.r, 0, 7); o.fill(); }
      else if (p.k === 'confetti') { o.globalAlpha = a; o.save(); o.translate(p.x, p.y); o.rotate(p.rot); o.fillStyle = p.c; o.fillRect(-p.r, -p.r * 0.5, p.r * 2, p.r); o.restore(); }
      else if (p.k === 'ring') { o.globalAlpha = a * 0.7; o.strokeStyle = '#ffffff'; o.lineWidth = 1.2; o.beginPath(); o.arc(p.x, p.y, p.r, 0, 7); o.stroke(); }
    }
    o.globalAlpha = 1;
    for (const c of CH) {
      const r = c.ball ? 3 : 1.2 + Math.sqrt(c.size) * 1.3;
      o.fillStyle = '#f4f6fb'; o.beginPath(); o.arc(c.x, c.y, r, 0, 7); o.fill();
      o.fillStyle = 'rgba(180,195,230,.8)'; o.beginPath(); o.arc(c.x + r * 0.3, c.y + r * 0.3, r * 0.55, 0, 7); o.fill();
    }
  }

  // ---------- world ----------
  const world = new World({
    piles, W: () => W, H: () => H, menu: () => st.menu, notch: () => st.notch, spawn, glow, party: () => (opts.people | 0) >= 3,
    chunk: c => CH.push(c), music: () => opts.music,
  });

  // ---------- bridge from Swift ----------
  window.MN = {
    update(s) {
      if (s.paused !== undefined && s.paused !== st.paused) { st.paused = s.paused; if (st.paused) g.clearRect(0, 0, cv.width, cv.height); }
      if (s.menu) st.menu = s.menu;
      if (s.debug !== undefined) st.debug = s.debug;
      if (s.mouse) {
        const now = performance.now();
        if (prevMouse) { const dt = Math.max(0.016, (now - prevMouse[2]) / 1000); mvx = (s.mouse[0] - prevMouse[0]) / dt; mvy = (s.mouse[1] - prevMouse[1]) / dt; }
        prevMouse = [s.mouse[0], s.mouse[1], now];
        st.mouse = s.mouse;
      }
      if (s.clicks) for (const [x, y] of s.clicks) { if (!world.click(x, y) && opts.cursor) { spawn('puff', x, y, 18); spawn('ring', x, y, 1); } }
      if (s.wins) {
        const now = performance.now(), dt = lastSync ? Math.min(0.25, Math.max(1 / 60, (now - lastSync) / 1000)) : 1 / 30;
        lastSync = now;
        st.wins = s.wins;
        if (s.notch !== undefined) st.notch = s.notch;
        st.dock = s.dock || null;
        const surfaces = st.dock ? [{ id: -7, x: st.dock[0], y: st.dock[1], w: st.dock[2], h: st.dock[3], z: -1 }, ...s.wins] : s.wins;
        piles.sync(surfaces, dt).forEach(c => CH.push(c));
        if (!prefilled) {   // targets the intro grows the piles towards
          prefilled = true;
          for (const p of piles.wins.values()) {
            const g2 = new Float32Array(p.bins.length);
            for (let i = 0; i < g2.length; i++) g2[i] = p.max * (0.55 + 0.2 * Math.sin(i * 0.31 + p.id) + 0.1 * Math.sin(i * 0.07));
            grow.set(p.id, g2);
          }
          const gg = new Float32Array(piles.ground.length);
          for (let i = 0; i < gg.length; i++) gg[i] = Snow.GROUND_MAX * (0.4 + 0.15 * Math.sin(i * 0.05));
          grow.set('ground', gg);
          if (introT < 0) introT = 0;
        }
        // shaking a window: a cloud of powder along its top edge
        for (const id of piles.shed) {
          const p = piles.wins.get(id);
          if (p && opts.piles) for (let x = p.x + 6; x < p.x + p.w - 6; x += 12) spawn('puff', x + rand(-4, 4), p.y - 3, 1);
        }
        world.onSync();
      }
    },
    setOpts(o) {
      Object.assign(opts, o);
      setDensity();
      world.configure(opts);
      if (!opts.piles) for (const p of piles.wins.values()) p.bins.fill(0);
      if (!opts.ground) piles.ground.fill(0);
      Audio2.setVolume(opts.volume == null ? 0.6 : opts.volume);
      Audio2.setMusic(!!opts.music);
    },
    banner(text) { banner = { text, t: 0 }; },
    intro() {
      introT = 0; outroT = -1;
      cv.style.transition = 'none'; cv.style.opacity = 1;
      for (const f of F) { newFlake(f, false); f.y = rand(-H * 1.1, -5); f.py = f.y; }   // snow starts falling in from the top
    },
    // Piles at full height right away (web demo / screenshots), instead of building up during the intro.
    fill() {
      for (const [id, target] of grow) {
        const bins = id === 'ground' ? piles.ground : piles.wins.get(id)?.bins;
        if (bins) for (let i = 0; i < Math.min(bins.length, target.length); i++) bins[i] = Math.max(bins[i], target[i]);
      }
    },
    outro() {
      outroT = 0;
      for (const p of piles.wins.values()) piles._shed(p, 1, 0, -60, CH);                // everything slides off the windows
      cv.style.transition = 'opacity .8s ease .6s'; cv.style.opacity = 0;
    },
    jingle() { Audio2.jingle(); },
  };

  // ---------- loop ----------
  function step(dt) {
    t += dt;
    const wind = 7 + Math.sin(t * 0.11) * 9 + Math.max(0, Math.sin(t * 0.37)) ** 6 * 25;
    const [mx, my] = st.mouse;
    const ms = Math.hypot(mvx, mvy);
    if (opts.cursor && ms > 60 && Math.random() < Math.min(1, ms / 600)) spawn('dust', mx + rand(-3, 3), my + rand(0, 6), 1);
    mvx *= 0.9; mvy *= 0.9;
    for (const f of F) {
      f.py = f.y;
      f.y += f.v * dt;
      f.x += (wind * (0.4 + f.z) + Math.sin(t * f.sw + f.p) * 9 * (0.4 + f.z) + (f.vx || 0)) * dt;
      if (f.vx) f.vx *= 0.985;
      const dx = f.x - mx, dy = f.y - my, d2 = dx * dx + dy * dy;
      if (opts.cursor && d2 < 6400) {
        const d = Math.sqrt(d2) || 1, k = (1 - d / 80) * (0.3 + f.z);
        f.x += (dx / d * 110 + mvx * 0.35) * k * dt;
        f.y += (dy / d * 70 + mvy * 0.35) * k * dt;
      }
      if (f.z >= 0.45 && f.y > f.py) {
        const id = land(f.x, f.py, f.y, 1.6 + f.r * 0.5);
        if (id !== null) { newFlake(f); continue; }
      }
      if (f.y > H + 10 || f.x < -60 || f.x > W + 60) newFlake(f);
    }
    if (introT >= 0) {
      introT += dt;
      if (introT < 8) {   // piles build up quickly at first, then normal accumulation takes over
        const k = 1 - Math.exp(-dt * 0.75);
        for (const [id, target] of grow) {
          const bins = id === 'ground' ? piles.ground : piles.wins.get(id)?.bins;
          if (!bins || (id === 'ground' ? !opts.ground : !opts.piles)) continue;
          for (let i = 0; i < Math.min(bins.length, target.length); i++) if (bins[i] < target[i]) bins[i] += (target[i] - bins[i]) * k;
        }
      } else grow.clear();
    }
    if (outroT >= 0) outroT += dt;
    piles.relax();
    stepParticles(dt);
    world.update(dt, t);
  }

  function draw() {
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    g.clearRect(0, 0, W, H);
    drawFlakes(g, false);
    drawPiles(g);
    world.draw(g, t);
    const front = piles.order[0];
    if (opts.hat && front && front.w > 220) Sprites.draw(g, 'santa_hat', front.x + 24, piles.topAt(front.id, front.x + 24) + 6, { rot: -0.3, scale: 1.35 });
    if (opts.garland) drawGarland(g);
    drawNotch(g);
    world.drawSky(g, t);
    drawFlakes(g, true);
    drawParticles(g);
    drawBanner(g, 1 / 30);
    if (st.debug) { g.strokeStyle = 'lime'; g.lineWidth = 1; st.wins.forEach(w => g.strokeRect(w.x, w.y, w.w, w.h)); }
  }

  // 30 fps is plenty for snow and halves the GPU/battery cost.
  let last = performance.now(), acc = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    acc += Math.min(0.1, (now - last) / 1000);
    last = now;
    if (st.paused || acc < 1 / 31) return;
    step(Math.min(0.05, acc));
    acc = 0;
    draw();
  }

  fit();
  setDensity();
  addEventListener('resize', fit);
  Sprites.load(Object.keys(Sprites.LIST)).then(() => log('sprites ok'));
  requestAnimationFrame(frame);
})();
