const test = require('node:test');
const assert = require('node:assert');
const Config = require('../web/js/config.js');

const all = { skiers: true, workers: true, plow: true, penguins: true, kids: true, sleigh: true };

test('people level scales the crew', () => {
  const calme = Config.crew(1, all), fete = Config.crew(3, all);
  assert.ok(fete.skiers > calme.skiers);
  assert.ok(fete.workers > calme.workers);
  assert.ok(fete.penguins > calme.penguins);
  assert.ok(calme.skiers >= 1);
});

test('level 0 means nobody at all', () => {
  assert.deepStrictEqual(Config.crew(0, all), { skiers: 0, workers: 0, penguins: 0, kids: 0, plow: false, sleigh: false });
});

test('a switched-off family is absent whatever the level', () => {
  const c = Config.crew(3, { ...all, skiers: false, plow: false });
  assert.strictEqual(c.skiers, 0);
  assert.strictEqual(c.plow, false);
  assert.ok(c.workers > 0);
});

test('snow amount maps to a flake count scaled by screen area', () => {
  const base = Config.flakes(0.5, 1512, 982);
  assert.ok(Config.flakes(0, 1512, 982) < base && base < Config.flakes(1, 1512, 982));
  assert.ok(Config.flakes(0, 1512, 982) >= 30);
  assert.ok(Math.abs(Config.flakes(0.5, 3024, 982) - 2 * base) <= 1);
});
