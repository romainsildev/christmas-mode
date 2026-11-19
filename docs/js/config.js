// Turns the panel's choices into concrete numbers for the engine. Pure, tested with node.
(function (root) {
  // index = people level: 0 nobody · 1 chill · 2 busy · 3 party
  const LEVELS = [
    { skiers: 0, workers: 0, penguins: 0, kids: 0 },
    { skiers: 1, workers: 1, penguins: 1, kids: 1 },
    { skiers: 2, workers: 2, penguins: 3, kids: 1 },
    { skiers: 4, workers: 3, penguins: 5, kids: 2 },
  ];

  const Config = {
    crew(level, o) {
      const L = LEVELS[Math.max(0, Math.min(3, level | 0))];
      const on = level > 0;
      return {
        skiers: o.skiers ? L.skiers : 0,
        workers: o.workers ? L.workers : 0,
        penguins: o.penguins ? L.penguins : 0,
        kids: o.kids ? L.kids : 0,
        plow: on && !!o.plow,
        sleigh: on && !!o.sleigh,
      };
    },
    // 0 → 40 flakes, 0.5 → 220, 1 → 560 on a 1512×982 screen
    flakes(snow, W, H) {
      const s = Math.max(0, Math.min(1, snow));
      const n = 40 + 360 * s + 160 * s * s * s;
      return Math.round(n * (W * H) / (1512 * 982));
    },
  };
  if (typeof module !== 'undefined') module.exports = Config; else root.Config = Config;
})(this);
