const test = require('node:test');
const assert = require('node:assert');
const vm = require('vm');
const fs = require('fs');

// Minimal browser-ish globals so world.js can load in node.
global.window = global; global.devicePixelRatio = 2;
global.Snow = require('../web/js/snow.js');
global.Config = require('../web/js/config.js');
global.Sprites = { draw() {}, LIST: {} };
vm.runInThisContext(fs.readFileSync(__dirname + '/../web/js/world.js', 'utf8'));

function world() {
  const piles = new Snow.Piles(1512, 982);
  return new World({ piles, W: () => 1512, H: () => 982, menu: () => 33, party: () => false, spawn() {}, glow() {}, chunk() {}, music: () => false });
}
const all = { skiers: true, workers: true, plow: true, penguins: true, kids: true, sleigh: true, igloos: true };

test('World.configure sets the crew from the panel', () => {
  const w = world();
  w.configure({ ...all, people: 3, sleigh: false });
  assert.strictEqual(w.skiers.length, Config.crew(3, all).skiers);
  assert.strictEqual(w.sleighOn, false);
});

test('people level 0 empties the village and it keeps running', () => {
  const w = world();
  w.configure({ ...all, people: 0 });
  assert.strictEqual(w.skiers.length + w.workers.length + w.penguins.length + w.kids.length, 0);
  for (let i = 0; i < 120; i++) w.update(1 / 30, i / 30);
});
