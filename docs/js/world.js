// The little working village living on top of the real windows.
(function (root) {
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const GRAV = 760;
  let env;                       // {piles, W(), H(), menu(), spawn(kind,x,y,n), chunk(c), music(), glow(o,color,x,y,r,a)}
  const P = () => env.piles;
  const K = 1.35;
  const D = (o, n, x, y, opt) => root.Sprites.draw(o, n, x, y, Object.assign({}, opt, { scale: (opt && opt.scale != null ? opt.scale : 1) * K }));

  function surfTop(s, x) { return s === 'ground' ? P().groundTop(x) : P().topAt(s, x); }
  function spanAt(id, x) {
    const p = P().wins.get(id);
    if (!p) return null;
    for (const sp of root.Snow.visibleSpans(p, P().front(p))) if (x >= sp[0] - 1 && x <= sp[1] + 1) return sp;
    return null;
  }
  function pickSpan(minW) {
    const c = [];
    for (const p of P().order) for (const sp of root.Snow.visibleSpans(p, P().front(p))) if (sp[1] - sp[0] >= minW) c.push({ id: p.id, sp });
    return c.length ? pick(c) : null;
  }

  // Something standing on a surface (a window top or the ground), carried when the window moves.
  class Body {
    constructor() { this.s = 'ground'; this.rx = 0; this.x = 0; this.y = 0; this.vx = 0; this.vy = 0; this.air = false; this.dead = false; }
    get X() {
      if (this.air || this.s === 'ground') return this.x;
      const p = P().wins.get(this.s);
      return p ? p.x + this.rx : this.x;
    }
    setOn(s, x) {
      this.s = s; this.air = false; this.x = x;
      if (s !== 'ground') this.rx = x - P().wins.get(s).x;
      this.y = surfTop(s, x) ?? this.y;
    }
    moveBy(dx) { if (this.s === 'ground') this.x += dx; else this.rx += dx; }
    fall(vx, vy) { this.x = this.X; this.air = true; this.vx = vx; this.vy = vy; }
    stepAir(dt) {
      const py = this.y;
      this.vy += GRAV * dt; this.x += this.vx * dt; this.y += this.vy * dt;
      if (this.vy > 0) {
        const id = P().landAt(this.x, py, this.y);
        if (id !== null) { this.setOn(id, this.x); return id; }
      }
      if (this.y > env.H() + 60 || this.x < -90 || this.x > env.W() + 90) this.dead = true;
      return null;
    }
    follow() {
      if (this.air) return;
      if (this.s === 'ground') { this.y = P().groundTop(this.x); return; }
      const p = P().wins.get(this.s);
      if (!p) { this.fall(rand(-30, 30), -40); return; }
      this.x = p.x + this.rx;
      const t = P().topAt(this.s, this.x);
      if (t === null) { this.fall(this.rx < 0 ? -30 : 30, -20); return; }
      this.y = t;
    }
    visible() {
      if (this.air || this.s === 'ground') return true;
      const p = P().wins.get(this.s);
      return p ? P().visibleAt(p, this.X) : false;
    }
    onSync() {
      if (!this.dead && !this.air && this.s !== 'ground' && (P().shed.has(this.s) || !P().wins.has(this.s))) this.fall(rand(-50, 50), -90);
    }
  }

  class Skier extends Body {
    constructor(delay) { super(); this.dead = true; this.wait = delay; this.rot = 0; this.crash = 0; }
    spawn() {
      const c = pickSpan(220);
      if (c) this.setOn(c.id, c.sp[0] + 12); else this.setOn('ground', -30);
      this.dead = false; this.rot = 0; this.flip = false; this.crash = 0; this.speed = rand(75, 105);
    }
    update(dt) {
      if (this.dead) { this.wait -= dt; if (this.wait <= 0) this.spawn(); return; }
      if (this.crash > 0) { this.crash -= dt; this.follow(); return; }
      if (this.air) {
        if (this.flip) this.rot += 8.2 * dt; else this.rot = Math.atan2(this.vy, this.vx) * 0.35;
        const id = this.stepAir(dt);
        if (this.dead) { this.wait = rand(3, 8); return; }
        if (id !== null) {
          const r = ((this.rot % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
          env.spawn('puff', this.x, this.y, 10);
          if (Math.min(r, 2 * Math.PI - r) > 0.7 || Math.random() < 0.12) { this.crash = 1.7; env.spawn('puff', this.x, this.y, 18); }
          this.rot = 0; this.flip = false;
        }
        return;
      }
      this.moveBy(this.speed * dt);
      this.follow();
      if (this.air) return;
      const x = this.X;
      if (this.s === 'ground') { if (x > env.W() + 40) { this.dead = true; this.wait = rand(4, 9); } }
      else {
        const sp = spanAt(this.s, x);
        if (!sp || x > sp[1] - 3) { this.fall(this.speed * 1.25, -rand(130, 175)); this.flip = Math.random() < 0.5; if (this.flip) this.vy -= 50; return; }
      }
      if (Math.random() < 0.35) env.spawn('spray', x - 10, this.y - 1, 1);
      const t2 = surfTop(this.s, x + 3);
      this.rot = t2 == null ? 0 : Math.atan2(t2 - this.y, 3) * 0.8;
    }
    draw(o) {
      if (this.dead || !this.visible()) return;
      const x = this.X;
      if (this.crash > 0) D(o, 'skier_crash', x, this.y + 2);
      else if (this.air) D(o, 'skier_jump', x, this.y - 15 * K, { rot: this.rot });
      else D(o, 'skier_ride', x, this.y + 1.5, { rot: this.rot });
    }
  }

  class Worker extends Body {
    constructor(delay) { super(); this.dead = true; this.wait = delay; this.dir = 1; this.frame = 0; }
    spawn() {
      const c = pickSpan(170);
      if (!c) { this.wait = 4; return; }
      const p = P().wins.get(c.id), x = rand(c.sp[0] + 24, c.sp[1] - 24);
      this.s = c.id; this.rx = x - p.x; this.x = x; this.air = false;
      this.mode = 'rope'; this.ry = env.menu() - 30; this.dead = false;
      this.dir = Math.random() < 0.5 ? 1 : -1; this.life = rand(50, 95); this.cool = 0; this.t = 0; this.n = 0;
    }
    update(dt) {
      if (this.dead) { this.wait -= dt; if (this.wait <= 0) this.spawn(); return; }
      if (this.mode === 'rope' || this.mode === 'up') {
        const p = P().wins.get(this.s);
        if (!p) { this.fall(0, 0); this.mode = 'walk'; return; }
        this.x = p.x + this.rx;
        const top = P().topAt(this.s, this.x) ?? p.y;
        if (this.mode === 'rope') { this.ry += 75 * dt; if (this.ry >= top) { this.mode = 'walk'; this.y = top; env.spawn('puff', this.x, top, 5); } }
        else { this.ry -= 75 * dt; if (this.ry < env.menu() - 40) { this.dead = true; this.wait = rand(6, 14); } }
        return;
      }
      if (this.air) { const id = this.stepAir(dt); if (this.dead) this.wait = rand(5, 10); if (id !== null) env.spawn('puff', this.x, this.y, 8); return; }
      this.life -= dt;
      this.follow();
      if (this.air) return;
      const x = this.X;
      if (this.mode === 'walk') {
        this.frame += dt * 5;
        this.moveBy(this.dir * 18 * dt);
        if (this.s === 'ground') { if (x < -30 || x > env.W() + 30) { this.dead = true; this.wait = rand(5, 10); } else if (x < 40) this.dir = -1; else if (x > env.W() - 40) this.dir = 1; return; }
        const sp = spanAt(this.s, x);
        if (!sp) { this.fall(this.dir * 20, -30); return; }
        if (x < sp[0] + 12) this.dir = 1;
        if (x > sp[1] - 12) this.dir = -1;
        this.cool -= dt;
        if (this.cool <= 0 && P().heightAt(this.s, x + this.dir * 9) > 4.5) { this.mode = 'dig'; this.t = 0; this.n = 0; }
        if (this.life <= 0) { this.mode = 'up'; this.ry = this.y; }
      } else if (this.mode === 'dig') {
        this.t += dt;
        if (this.t > 0.8) {
          this.t = 0; this.n++;
          const got = P().dig(this.s, x + this.dir * 9, 2.6, 3);
          if (got > 0) env.chunk({ x: x - this.dir * 6, y: this.y - 28, vx: -this.dir * rand(50, 110), vy: -rand(120, 170), size: got });
          if (P().heightAt(this.s, x + this.dir * 9) < 2.5 || this.n > 5) { this.mode = 'walk'; this.cool = rand(3, 7); }
        }
      }
    }
    draw(o) {
      if (this.dead) return;
      if (this.mode === 'rope' || this.mode === 'up') {
        o.strokeStyle = 'rgba(150,115,80,.95)'; o.lineWidth = 1;
        o.beginPath(); o.moveTo(this.x + 3 * K, env.menu()); o.lineTo(this.x + 3 * K, this.ry - 22 * K); o.stroke();
        D(o, 'worker_walk1', this.x, this.ry, { flip: this.dir < 0 });
        return;
      }
      if (!this.visible()) return;
      const n = this.air ? 'worker_walk2' : this.mode === 'dig' ? (this.t < 0.45 ? 'worker_shovel1' : 'worker_shovel2') : (Math.floor(this.frame) % 2 ? 'worker_walk1' : 'worker_walk2');
      D(o, n, this.X, this.y + 1.5, { flip: this.dir < 0 });
    }
  }

  class Plow {
    constructor() { this.active = false; this.timer = rand(18, 30); this.load = 0; this.rot = 0; this.dir = 1; this.x = -200; }
    update(dt, t) {
      const W = env.W(), H = env.H();
      if (!this.active) {
        this.timer -= dt;
        const g = P().ground; let avg = 0; for (const v of g) avg += v; avg /= g.length;
        if (this.timer <= 0 || avg > 9) { this.active = true; this.dir = Math.random() < 0.5 ? 1 : -1; this.x = this.dir > 0 ? -60 : W + 60; this.load = 0; }
        return;
      }
      this.x += this.dir * 44 * dt;
      this.rot += this.dir * 44 * dt / 8;
      const bx = this.x + this.dir * 34 * K;
      for (let k = 0; k < 4; k++) this.load += P().dig('ground', bx + this.dir * k * 3, 99, 0);
      env.knock(bx);
      if (Math.random() < 0.25) env.spawn('smoke', this.x + this.dir * 9, H - 36, 1);
      if (this.load > 1 && Math.random() < 0.5) env.spawn('spray', bx + this.dir * 14, H - 8, 1);
      if ((this.dir > 0 && this.x > W + 100) || (this.dir < 0 && this.x < -100)) { this.active = false; this.timer = env.party() ? rand(18, 30) : rand(60, 110); }
    }
    draw(o, t) {
      if (!this.active) return;
      const H = env.H(), f = this.dir < 0, x = this.x, L = lx => x + (f ? -1 : 1) * (lx - 35) * K;
      if (this.load > 0.5) D(o, 'snow_heap', x + this.dir * (44 * K + Math.min(16, this.load * 0.06)), H + 3, { scale: Math.min(1.5, 0.35 + this.load * 0.012), flip: f });
      // headlight beam
      const hx = L(60), hy = H - 20 * K;
      const gr = o.createRadialGradient(hx, hy, 0, hx, hy, 70);
      gr.addColorStop(0, 'rgba(255,225,150,.35)'); gr.addColorStop(1, 'rgba(255,225,150,0)');
      o.save(); o.fillStyle = gr; o.beginPath(); o.moveTo(hx, hy - 2); o.lineTo(hx + this.dir * 75, hy - 22); o.lineTo(hx + this.dir * 75, hy + 18); o.closePath(); o.fill(); o.restore();
      D(o, 'snowplow', x, H, { flip: f });
      D(o, 'wheel', L(16), H - 8 * K, { rot: this.rot });
      D(o, 'wheel', L(42), H - 8 * K, { rot: this.rot });
      if (Math.sin(t * 9) > 0) env.glow(o, '#ff9a3c', L(19.5), H - 38 * K, 16 * K, 0.9);
    }
  }

  class Penguin extends Body {
    constructor(home, delay) { super(); this.home = home; this.dead = true; this.wait = delay; this.frame = 0; this.alpha = 0; }
    spawn() {
      this.setOn('ground', this.home()); this.dead = false; this.alpha = 0; this.mode = 'walk';
      this.dir = Math.random() < 0.5 ? 1 : -1; this.life = rand(18, 40); this.slide = 0;
    }
    update(dt) {
      if (this.dead) { this.wait -= dt; if (this.wait <= 0) this.spawn(); return; }
      this.alpha = Math.min(1, this.alpha + dt * 2);
      this.life -= dt; this.frame += dt * 4;
      if (this.mode === 'enter') { this.alpha -= dt * 2.5; if (this.alpha <= 0) { this.dead = true; this.wait = rand(5, 16); } return; }
      if (this.life <= 0) { const hx = this.home(); this.dir = hx > this.x ? 1 : -1; if (Math.abs(hx - this.x) < 4) this.mode = 'enter'; }
      else if (this.slide <= 0 && Math.random() < dt * 0.08) { this.slide = 1.4; env.spawn('puff', this.x, this.y, 5); }
      const sp = this.slide > 0 ? 55 : 14;
      this.slide -= dt;
      this.x += this.dir * sp * dt;
      if (this.x < 12) this.dir = 1;
      if (this.x > env.W() - 12) this.dir = -1;
      if (this.slide > 0 && Math.random() < 0.3) env.spawn('spray', this.x - this.dir * 8, this.y, 1);
      this.follow();
    }
    poke() { if (!this.dead && this.slide <= 0) { this.slide = 1.6; this.dir = -this.dir; env.spawn('puff', this.x, this.y, 8); } }
    draw(o) {
      if (this.dead) return;
      const n = this.slide > 0 ? 'penguin_slide' : Math.floor(this.frame) % 2 ? 'penguin_walk1' : 'penguin_walk2';
      D(o, n, this.x, this.y + 1.5, { flip: this.dir < 0, alpha: Math.max(0, this.alpha) });
    }
  }

  class Kid {
    constructor(home, delay) { this.home = home; this.wait = delay; this.mode = 'wait'; this.frame = 0; }
    update(dt) {
      if (this.mode === 'wait') { this.wait -= dt; if (this.wait <= 0) { this.mode = 'push'; this.x = this.home() + 16; this.r = 3; this.ballRot = 0; this.dist = 0; this.goal = rand(140, 260); this.alpha = 0; } return; }
      this.frame += dt * 6; this.alpha = Math.min(1, (this.alpha || 0) + dt * 2);
      if (this.mode === 'push') {
        const v = 16 * dt;
        this.x += v; this.dist += v; this.ballRot += v / this.r;
        this.r = Math.min(11, this.r + v * 0.045 + P().dig('ground', this.x + 8 + this.r, 0.08, 0) * 0.2);
        if (this.dist > this.goal || this.x > env.W() - 60) { this.mode = 'build'; this.t = 0; env.addSnowman(this.x + 8 + this.r); env.spawn('puff', this.x + 8 + this.r, P().groundTop(this.x) - 6, 14); }
      } else if (this.mode === 'build') {
        this.t += dt;
        if (this.t > 1.6) {
          this.mode = 'throw'; this.t = 0;
          env.chunk({ x: this.x + 4, y: P().groundTop(this.x) - 22, vx: rand(-160, -60), vy: -rand(220, 300), size: 0.6, ball: true });
        }
      } else if (this.mode === 'throw') {
        this.t += dt;
        if (this.t > 0.7) this.mode = 'home';
      } else if (this.mode === 'home') {
        this.x -= 22 * dt;
        if (this.x <= this.home() + 4) { this.alpha = 0; this.mode = 'wait'; this.wait = rand(25, 50); }
      }
    }
    draw(o) {
      if (this.mode === 'wait') return;
      const y = P().groundTop(this.x) + 1.5, a = this.alpha;
      if (this.mode === 'push') {
        const bx = this.x + 8 + this.r, by = P().groundTop(bx) + 1 - this.r;
        const gr = o.createRadialGradient(bx - this.r * 0.4, by - this.r * 0.4, 1, bx, by, this.r);
        gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#c3cde8');
        o.fillStyle = gr; o.beginPath(); o.arc(bx, by, this.r, 0, 7); o.fill();
        o.strokeStyle = 'rgba(170,185,220,.6)'; o.lineWidth = 0.7;
        for (let i = 0; i < 3; i++) { const a0 = this.ballRot + i * 2.1; o.beginPath(); o.arc(bx, by, this.r * 0.6, a0, a0 + 0.8); o.stroke(); }
        D(o, Math.floor(this.frame) % 2 ? 'kid_push1' : 'kid_push2', this.x, y, { alpha: a });
      } else if (this.mode === 'build') D(o, 'kid_push2', this.x, y, { alpha: a });
      else if (this.mode === 'throw') D(o, 'kid_throw', this.x, y, { flip: true });
      else D(o, Math.floor(this.frame) % 2 ? 'kid_push1' : 'kid_push2', this.x, y, { flip: true });
    }
  }

  class Sleigh {
    constructor() { this.active = false; this.timer = 7; this.frame = 0; }
    update(dt, t) {
      if (!this.active) {
        this.timer -= dt;
        if (this.timer <= 0) {
          this.active = true; this.y0 = rand(env.menu() + 45, env.menu() + 120); this.dropAt = rand(env.W() * 0.2, env.W() * 0.8); this.dropped = false;
          const n = env.notch && env.notch();
          this.fromNotch = !!n && Math.random() < 0.6;          // Santa takes off from the MacBook notch
          if (this.fromNotch) { this.x0 = n[0] + n[2] / 2; this.x = this.x0; this.top = n[1] + n[3]; this.dropAt = Math.max(this.dropAt, this.x0 + 260); env.spawn('gold', this.x0, this.top + 4, 24); env.spawn('puff', this.x0, this.top + 4, 14); }
          else this.x = -260;
          if (env.music()) root.Audio2.sleighBells(4, 0.012);
        }
        return;
      }
      this.x += 165 * dt; this.frame += dt * 11;
      this.y = this.y0 + Math.sin(t * 1.7) * 7;
      this.sc = 1;
      if (this.fromNotch) {                                   // grows out of the notch, then swoops to cruising height
        const u = Math.min(1, (this.x - this.x0) / 320), e = u * u * (3 - 2 * u);
        this.sc = 0.2 + 0.8 * e;
        this.y = (this.top + 26) * (1 - e) + this.y * e;
      }
      env.spawn('gold', this.x - 30, this.y - 10 + rand(-4, 4), 2);
      if (!this.dropped && this.x > this.dropAt) { this.dropped = true; env.gift(this.x, this.y - 10); }
      if (this.x > env.W() + 320) { this.active = false; this.timer = env.party() ? rand(14, 24) : rand(80, 130); }
    }
    draw(o, t) {
      if (!this.active) return;
      const x = this.x, y = this.y, sc = this.sc || 1, k = K * sc;
      o.strokeStyle = 'rgba(212,166,74,.9)'; o.lineWidth = 0.8 * sc;
      for (let i = 0; i < 3; i++) {
        const rx = x + (66 + i * 40) * k, ry = y - (6 - Math.sin(t * 9 + i) * 2) * sc;
        o.beginPath(); o.moveTo(x + 24 * k, y - 22 * k); o.quadraticCurveTo((x + rx) / 2, y - 12 * k, rx - 2 * k, ry - 20 * k); o.stroke();
      }
      for (let i = 2; i >= 0; i--) {
        const rx = x + (66 + i * 40) * k, ry = y - (6 - Math.sin(t * 9 + i) * 2) * sc;
        D(o, 'reindeer' + (1 + (Math.floor(this.frame) + i) % 4), rx, ry, { scale: sc });
        if (i === 2) env.glow(o, '#ff4a4a', rx + 18 * k, ry - 24 * k, 9 * k, 0.8);
      }
      D(o, 'sleigh', x, y, { scale: sc });
    }
  }

  class Gift extends Body {
    constructor(x, y) { super(); this.n = pick(['gift_red', 'gift_green', 'gift_gold']); this.x = x; this.y = y; this.air = true; this.vx = rand(-20, 20); this.vy = 0; this.life = 110; this.sw = rand(0, 6); }
    update(dt, t) {
      if (this.air) { this.vy = Math.min(this.vy, 140); this.stepAir(dt * 0.6); this.x += Math.sin(t * 3 + this.sw) * 0.4; if (!this.air) env.spawn('puff', this.x, this.y, 6); return; }
      this.follow();
      this.life -= dt;
      if (this.life <= 0) this.dead = true;
    }
    open() { this.dead = true; env.spawn('confetti', this.X, this.y - 7, 34); env.spawn('gold', this.X, this.y - 7, 16); root.Audio2.sleighBells(0.5, 0.02); }
    draw(o) { if (!this.dead && this.visible()) D(o, this.n, this.X, this.y + 1, { alpha: Math.min(1, this.life / 3), rot: this.air ? Math.sin(this.sw + this.y * 0.05) * 0.3 : 0 }); }
  }

  class World {
    constructor(e) {
      env = e;
      env.addSnowman = x => this.addSnowman(x);
      env.knock = x => this.knock(x);
      env.gift = (x, y) => this.gifts.push(new Gift(x, y));
      this.leftIgloo = () => 90; this.rightIgloo = () => env.W() - 96;
      this.skiers = [new Skier(2), new Skier(9)];
      this.workers = [new Worker(4), new Worker(16)];
      this.plow = new Plow();
      this.penguins = [new Penguin(this.leftIgloo, 3), new Penguin(this.rightIgloo, 6), new Penguin(this.rightIgloo, 14)];
      this.kids = [new Kid(this.leftIgloo, 10)];
      this.plowOn = true; this.sleighOn = true; this.igloosOn = true;
      this.sleigh = new Sleigh();
      this.gifts = [];
      this.snowmen = [];
    }
    addSnowman(x) {
      this.snowmen.push({ x, s: 0, melt: false });
      const alive = this.snowmen.filter(s => !s.melt);
      if (alive.length > 3) alive[0].melt = true;
    }
    knock(x) {
      for (const s of this.snowmen) if (!s.melt && Math.abs(s.x - x) < 10) { s.melt = true; s.fast = true; env.spawn('puff', s.x, P().groundTop(s.x) - 15, 20); }
    }
    // Apply the panel's choices (counts per family + switches). Extra actors simply leave.
    configure(o) {
      const c = root.Config.crew(o.people == null ? 2 : o.people, o);
      const fit = (arr, n, make) => { while (arr.length < n) arr.push(make(arr.length)); arr.length = n; };
      fit(this.skiers, c.skiers, i => new Skier(1 + i * 2.5));
      fit(this.workers, c.workers, i => new Worker(2 + i * 6));
      fit(this.penguins, c.penguins, i => new Penguin(i % 2 ? this.rightIgloo : this.leftIgloo, 1 + i * 2));
      fit(this.kids, c.kids, i => new Kid(this.leftIgloo, 4 + i * 14));
      if (!c.plow) this.plow.active = false;
      if (!c.sleigh) this.sleigh.active = false;
      this.plowOn = c.plow; this.sleighOn = c.sleigh; this.igloosOn = o.igloos !== false;
    }
    onSync() { [...this.skiers, ...this.workers, ...this.gifts].forEach(a => a.onSync()); }
    click(x, y) {
      for (const g of this.gifts) if (!g.dead && Math.abs(g.X - x) < 14 && Math.abs(g.y - 7 - y) < 14) { g.open(); return true; }
      for (const p of this.penguins) if (!p.dead && Math.abs(p.x - x) < 14 && Math.abs(p.y - 10 - y) < 16) { p.poke(); return true; }
      return false;
    }
    update(dt, t) {
      this.skiers.forEach(a => a.update(dt, t));
      this.workers.forEach(a => a.update(dt, t));
      if (this.plowOn) this.plow.update(dt, t);
      this.penguins.forEach(a => a.update(dt, t));
      this.kids.forEach(a => a.update(dt, t));
      if (this.sleighOn) this.sleigh.update(dt, t);
      this.gifts.forEach(a => a.update(dt, t));
      this.gifts = this.gifts.filter(g => !g.dead);
      for (const s of this.snowmen) s.s = s.melt ? s.s - dt * (s.fast ? 3 : 0.25) : Math.min(1, s.s + dt * 0.7);
      this.snowmen = this.snowmen.filter(s => s.s > 0 || !s.melt);
      if (Math.random() < dt * 1.5) env.spawn('smoke', 140, P().groundTop(140) - 20, 1);
      if (Math.random() < dt * 6) env.spawn('spark', 140, P().groundTop(140) - 10, 1);
    }
    drawGround(o, t) {
      const G = x => P().groundTop(x) + 2, W = env.W();
      D(o, 'tree_decorated', 26, G(26));
      D(o, 'igloo', this.leftIgloo(), G(this.leftIgloo()));
      env.glow(o, '#ffc56b', this.leftIgloo(), G(this.leftIgloo()) - 8 * K, (22 + Math.sin(t * 2) * 2) * K, 0.55);
      D(o, 'campfire', 140, G(140), { scale: 1 + Math.sin(t * 13) * 0.04 });
      env.glow(o, '#ff9a3c', 140, G(140) - 8 * K, (26 + Math.sin(t * 11) * 3) * K, 0.6);
      D(o, 'mailbox', W - 150, G(W - 150));
      D(o, 'igloo_small', this.rightIgloo(), G(this.rightIgloo()));
      env.glow(o, '#ffc56b', this.rightIgloo() + 4 * K, G(this.rightIgloo()) - 5 * K, (16 + Math.sin(t * 2.3) * 2) * K, 0.5);
      D(o, 'tree_snowy', W - 32, G(W - 32));
      for (const s of this.snowmen) D(o, 'snowman', s.x, G(s.x), { scale: Math.max(0, s.s) });
    }
    draw(o, t) {
      if (this.igloosOn) this.drawGround(o, t);
      else for (const s of this.snowmen) D(o, 'snowman', s.x, P().groundTop(s.x) + 2, { scale: Math.max(0, s.s) });
      this.penguins.forEach(a => a.draw(o));
      this.kids.forEach(a => a.draw(o));
      if (this.plowOn) this.plow.draw(o, t);
      this.gifts.forEach(a => a.draw(o));
      this.workers.forEach(a => a.draw(o));
      this.skiers.forEach(a => a.draw(o));
    }
    drawSky(o, t) { if (this.sleighOn) this.sleigh.draw(o, t); }
  }

  root.World = World;
})(this);
