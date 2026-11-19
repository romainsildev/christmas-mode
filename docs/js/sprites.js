// Loads the Fable SVG sprites and pre-rasterises them at Retina resolution.
(function (root) {
  const RES = Math.max(2, root.devicePixelRatio || 2) * 1.5;
  // name: [path under assets/, width, height, anchor ('b' bottom-centre | 'c' centre)]
  const LIST = {
    skier_ride: ['characters/skier_ride', 30, 34], skier_jump: ['characters/skier_jump', 30, 30, 'c'], skier_crash: ['characters/skier_crash', 34, 20],
    worker_walk1: ['characters/worker_walk1', 24, 30], worker_walk2: ['characters/worker_walk2', 24, 30],
    worker_shovel1: ['characters/worker_shovel1', 24, 30], worker_shovel2: ['characters/worker_shovel2', 24, 30],
    penguin_walk1: ['characters/penguin_walk1', 16, 20], penguin_walk2: ['characters/penguin_walk2', 16, 20], penguin_slide: ['characters/penguin_slide', 22, 12],
    kid_push1: ['characters/kid_push1', 18, 24], kid_push2: ['characters/kid_push2', 18, 24], kid_throw: ['characters/kid_throw', 18, 24],
    snowman: ['characters/snowman', 30, 44],
    skater1: ['characters/skater1', 14, 20], skater2: ['characters/skater2', 14, 20], walker1: ['characters/walker1', 10, 18], walker2: ['characters/walker2', 10, 18],
    snowplow: ['vehicles/snowplow', 70, 40], wheel: ['vehicles/wheel', 16, 16, 'c'], wheel_small: ['vehicles/wheel_small', 11, 11, 'c'],
    sleigh: ['vehicles/sleigh', 64, 40], reindeer1: ['vehicles/reindeer1', 40, 34], reindeer2: ['vehicles/reindeer2', 40, 34], reindeer3: ['vehicles/reindeer3', 40, 34], reindeer4: ['vehicles/reindeer4', 40, 34],
    sled: ['vehicles/sled', 22, 10], train_engine: ['vehicles/train_engine', 58, 34], train_car: ['vehicles/train_car', 46, 28], train_car_tree: ['vehicles/train_car_tree', 46, 28],
    igloo: ['props/igloo', 60, 34], igloo_small: ['props/igloo_small', 40, 24], santa_hat: ['props/santa_hat', 40, 30],
    gift_red: ['props/gift_red', 14, 14], gift_green: ['props/gift_green', 14, 14], gift_gold: ['props/gift_gold', 14, 14],
    street_lamp: ['props/street_lamp', 12, 48], tree_decorated: ['props/tree_decorated', 26, 40], tree_snowy: ['props/tree_snowy', 22, 36],
    mailbox: ['props/mailbox', 16, 30], signpost: ['props/signpost', 26, 30], snow_heap: ['props/snow_heap', 40, 14], campfire: ['props/campfire', 20, 18],
  };
  const S = {};

  function load(names) {
    return Promise.all(names.map(n => new Promise(res => {
      const d = LIST[n];
      if (!d) return res();
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = Math.ceil(d[1] * RES); c.height = Math.ceil(d[2] * RES);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        S[n] = { c, w: d[1], h: d[2], a: d[3] || 'b' };
        res();
      };
      img.onerror = () => { (root.MNlog || console.log)('missing sprite: ' + n); res(); };
      img.src = 'assets/' + d[0] + '.svg';
    })));
  }

  // Draw sprite anchored at (x,y). opt: {flip, rot, scale, alpha}
  function draw(o, n, x, y, opt) {
    const s = S[n];
    if (!s) return false;
    opt = opt || {};
    const sc = opt.scale == null ? 1 : opt.scale;
    if (sc <= 0) return true;
    o.save();
    o.translate(x, y);
    if (opt.rot) o.rotate(opt.rot);
    if (opt.flip) o.scale(-1, 1);
    if (opt.alpha != null) o.globalAlpha *= opt.alpha;
    const w = s.w * sc, h = s.h * sc;
    if (s.a === 'c') o.drawImage(s.c, -w / 2, -h / 2, w, h);
    else o.drawImage(s.c, -w / 2, -h, w, h);
    o.restore();
    return true;
  }

  root.Sprites = { load, draw, has: n => !!S[n], LIST };
})(this);
