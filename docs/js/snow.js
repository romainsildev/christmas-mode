// Snow piles on real windows + ground. Pure logic (no drawing) — tested with node.
(function (root) {
  const BIN = 3;
  const Snow = { BIN, WIN_MAX: 12, WIN_MAX_HIGH: 8, GROUND_MAX: 14, SHED_SPEED: 900 };

  // Parts [x0,x1] of win's top edge not hidden by any window in `front`.
  Snow.visibleSpans = function (win, front) {
    let spans = [[win.x, win.x + win.w]];
    for (const f of front) {
      if (!(f.y <= win.y && f.y + f.h >= win.y)) continue;
      const a = f.x, b = f.x + f.w, next = [];
      for (const [s, e] of spans) {
        if (b <= s || a >= e) { next.push([s, e]); continue; }
        if (a > s) next.push([s, a]);
        if (b < e) next.push([b, e]);
      }
      spans = next;
    }
    return spans;
  };

  function covered(x, y, front) {
    for (const f of front) if (x >= f.x && x <= f.x + f.w && y >= f.y && y <= f.y + f.h) return true;
    return false;
  }

  class Piles {
    constructor(W, H) {
      this.W = W; this.H = H;
      this.wins = new Map();   // id -> {id,x,y,w,h,z,bins,max}
      this.order = [];         // windows front → back
      this.ground = new Float32Array(Math.ceil(W / BIN) + 1);
      this.shed = new Set();
      this.sleeping = new Map();
    }

    resize(W, H) {
      this.W = W; this.H = H;
      const g = new Float32Array(Math.ceil(W / BIN) + 1);
      g.set(this.ground.subarray(0, Math.min(g.length, this.ground.length)));
      this.ground = g;
    }

    _maxFor(w) { return w.y < 45 ? Snow.WIN_MAX_HIGH : Snow.WIN_MAX; }

    _chunk(out, x, y, amount, vx, vy) {
      if (amount > 0.05) out.push({ x, y, vx, vy, size: amount });
    }

    // Shed `frac` of every bin of `p` as chunks (grouped by 4 bins).
    _shed(p, frac, vx, vy, out) {
      for (let i = 0; i < p.bins.length; i += 4) {
        let amt = 0, hmax = 0;
        for (let k = i; k < Math.min(i + 4, p.bins.length); k++) {
          const take = p.bins[k] * frac;
          amt += take; hmax = Math.max(hmax, p.bins[k]);
          p.bins[k] -= take;
        }
        this._chunk(out, p.x + (i + 2) * BIN, p.y - hmax, amt, vx * 0.35 + (Math.random() - 0.5) * 40, Math.min(vy * 0.35, 0) - 20 - Math.random() * 40);
      }
    }

    // Update from the real windows (front→back, screen-local). Returns falling chunks.
    sync(list, dt) {
      const out = [];
      const seen = new Set();
      this.shed = new Set();
      for (const w of list) {
        seen.add(w.id);
        let p = this.wins.get(w.id);
        const n = Math.ceil(w.w / BIN) + 1;
        if (!p && this.sleeping.has(w.id)) {
          p = this.sleeping.get(w.id); this.sleeping.delete(w.id);
          Object.assign(p, { x: w.x, y: w.y, w: w.w, h: w.h, z: w.z });
          if (p.bins.length !== n) { const nb = new Float32Array(n); nb.set(p.bins.subarray(0, Math.min(n, p.bins.length))); p.bins = nb; }
          this.wins.set(w.id, p);
          continue;
        }
        if (!p) {
          p = { ...w, bins: new Float32Array(n) };
          p.max = this._maxFor(w);
          this.wins.set(w.id, p);
          continue;
        }
        const dx = w.x - p.x, dy = w.y - p.y;
        const speed = Math.hypot(dx, dy) / Math.max(dt, 1e-3);
        if (speed > Snow.SHED_SPEED) {
          const frac = Math.min(1, 0.5 + (speed - Snow.SHED_SPEED) / 1800);
          this.shed.add(w.id);
          this._shed(p, frac, dx / dt, dy / dt, out);
        }
        if (n !== p.bins.length) {
          const nb = new Float32Array(n);
          nb.set(p.bins.subarray(0, Math.min(n, p.bins.length)));
          for (let i = n; i < p.bins.length; i++) this._chunk(out, p.x + i * BIN, p.y - p.bins[i], p.bins[i], 30, -10);
          p.bins = nb;
        }
        Object.assign(p, { x: w.x, y: w.y, w: w.w, h: w.h, z: w.z });
        p.max = this._maxFor(w);
      }
      const gone = [...this.wins.keys()].filter(id => !seen.has(id));
      for (const id of gone) {
        const p = this.wins.get(id);
        this.wins.delete(id);
        // Several windows vanishing together = Space / full-screen switch: keep their snow for later.
        if (gone.length >= 2) { this.sleeping.set(id, p); if (this.sleeping.size > 60) this.sleeping.delete(this.sleeping.keys().next().value); }
        else this._shed(p, 1, 0, 0, out);
      }
      this.order = list.map(w => this.wins.get(w.id));
      return out;
    }

    front(p) { return this.order.filter(o => o.z < p.z); }

    _h(p, x) {
      const f = (x - p.x) / BIN, i = Math.floor(f), a = f - i;
      const h0 = p.bins[i] || 0, h1 = p.bins[Math.min(i + 1, p.bins.length - 1)] || 0;
      const edge = Math.sqrt(Math.max(0, Math.min(1, Math.min(x - p.x, p.x + p.w - x) / 12)));
      return (h0 * (1 - a) + h1 * a) * edge;
    }

    // y of the snow surface on window `id` at x (null if outside).
    topAt(id, x) {
      const p = this.wins.get(id);
      if (!p || x < p.x || x > p.x + p.w) return null;
      return p.y - this._h(p, x);
    }

    visibleAt(p, x) { return !covered(x, p.y - 1, this.front(p)); }

    groundTop(x) {
      const i = Math.max(0, Math.min(this.ground.length - 1, Math.round(x / BIN)));
      return this.H - this.ground[i];
    }

    _add(bins, i, amount, max) {
      const w = [0.15, 0.5, 1, 0.5, 0.15];
      for (let k = -2; k <= 2; k++) {
        const j = i + k;
        if (j >= 0 && j < bins.length) bins[j] = Math.min(max, bins[j] + amount * w[k + 2] * 0.45);
      }
    }

    addTo(id, x, amount) {
      if (id === 'ground') return this._add(this.ground, Math.round(x / BIN), amount, Snow.GROUND_MAX);
      const p = this.wins.get(id);
      if (p) this._add(p.bins, Math.round((x - p.x) / BIN), amount, p.max);
    }

    // A flake/chunk moved from (x,py) to (x,y): where does it land? Returns window id, 'ground' or null.
    // Where does something moving down from (x,py) to (x,y) touch a surface? id, 'ground' or null.
    landAt(x, py, y) {
      for (const p of this.order) {
        if (x < p.x || x > p.x + p.w) continue;
        const top = p.y - this._h(p, x);
        if (py < top && y >= top && this.visibleAt(p, x)) return p.id;
      }
      return y >= this.groundTop(x) ? 'ground' : null;
    }

    deposit(x, py, y, amount) {
      const id = this.landAt(x, py, y);
      if (id !== null) this.addTo(id, x, amount);
      return id;
    }

    // First visible surface at or below y at x: {id, top}.
    surfaceBelow(x, y) {
      let best = { id: 'ground', top: this.groundTop(x) };
      for (const p of this.order) {
        if (x < p.x || x > p.x + p.w) continue;
        const top = p.y - this._h(p, x);
        if (top >= y - 2 && top < best.top && this.visibleAt(p, x)) best = { id: p.id, top };
      }
      return best;
    }

    // Remove up to `amount` of snow around x (shovel / plow). Returns what was removed.
    dig(id, x, amount, radius = 4) {
      const bins = id === 'ground' ? this.ground : this.wins.get(id)?.bins;
      if (!bins) return 0;
      const ox = id === 'ground' ? 0 : this.wins.get(id).x;
      const c = Math.round((x - ox) / BIN);
      let got = 0;
      for (let k = -radius; k <= radius && got < amount; k++) {
        const j = c + k;
        if (j < 0 || j >= bins.length) continue;
        const t = Math.min(bins[j], amount - got);
        bins[j] -= t; got += t;
      }
      return got;
    }

    heightAt(id, x) {
      if (id === 'ground') return this.H - this.groundTop(x);
      const p = this.wins.get(id);
      return p ? this._h(p, x) : 0;
    }

    // Small slides so piles stay smooth.
    relax() {
      const all = [this.ground, ...[...this.wins.values()].map(p => p.bins)];
      for (const b of all) {
        for (let i = 0; i < b.length - 1; i++) {
          const d = b[i] - b[i + 1];
          if (Math.abs(d) > 1.1) { const m = d * 0.2; b[i] -= m; b[i + 1] += m; }
        }
      }
    }
  }

  Snow.Piles = Piles;
  if (typeof module !== 'undefined') module.exports = Snow; else root.Snow = Snow;
})(this);
