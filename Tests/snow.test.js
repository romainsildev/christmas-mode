const test = require('node:test');
const assert = require('node:assert');
const Snow = require('../web/js/snow.js');

const W = 1512, H = 982;
const win = (id, x, y, w, h, z = 0) => ({ id, x, y, w, h, z });
const total = (p, id) => p.wins.get(id).bins.reduce((a, b) => a + b, 0);

test('visibleSpans removes the part of a top edge covered by a front window', () => {
  const back = win(2, 100, 200, 400, 300, 1);
  const front = win(1, 250, 100, 100, 300, 0);
  assert.deepStrictEqual(Snow.visibleSpans(back, [front]), [[100, 250], [350, 500]]);
});

test('deposit lands on a visible window top, not on a covered part', () => {
  const p = new Snow.Piles(W, H);
  p.sync([win(1, 250, 100, 100, 300, 0), win(2, 100, 200, 400, 300, 1)], 1 / 30);
  assert.strictEqual(p.deposit(150, 190, 201, 1), 2);          // visible part of back window
  assert.strictEqual(p.deposit(300, 190, 201, 1), null);       // covered by front window → keeps falling
  assert.strictEqual(p.deposit(300, 90, 101, 1), 1);           // front window top
});

test('falling past every window lands on the ground', () => {
  const p = new Snow.Piles(W, H);
  p.sync([], 1 / 30);
  assert.strictEqual(p.deposit(700, H - 1, H + 1, 1), 'ground');
  assert.ok(p.groundTop(700) < H);
});

test('moving a window slowly carries its pile', () => {
  const p = new Snow.Piles(W, H);
  p.sync([win(1, 100, 200, 300, 200)], 1 / 30);
  for (let i = 0; i < 20; i++) p.deposit(200, 190, 201, 1);
  const before = total(p, 1);
  const chunks = p.sync([win(1, 110, 205, 300, 200)], 1 / 30);    // 11 pt in 1/30 s ≈ 335 pt/s
  assert.strictEqual(chunks.length, 0);
  assert.strictEqual(total(p, 1), before);
  assert.ok(p.topAt(1, 210) < 205);                              // pile follows new position
});

test('a fast drag sheds at least half the snow as falling chunks', () => {
  const p = new Snow.Piles(W, H);
  p.sync([win(1, 100, 200, 300, 200)], 1 / 30);
  for (let i = 0; i < 40; i++) p.deposit(150 + i * 5, 190, 201, 1);
  const before = total(p, 1);
  const chunks = p.sync([win(1, 160, 200, 300, 200)], 1 / 30);    // 60 pt in 1/30 s = 1800 pt/s
  assert.ok(chunks.length > 0);
  assert.ok(total(p, 1) <= before * 0.5);
});

test('closing a window turns all its snow into chunks', () => {
  const p = new Snow.Piles(W, H);
  p.sync([win(1, 100, 200, 300, 200)], 1 / 30);
  for (let i = 0; i < 10; i++) p.deposit(200, 190, 201, 1);
  const chunks = p.sync([], 1 / 30);
  assert.ok(chunks.length > 0);
  assert.strictEqual(p.wins.has(1), false);
});

test('shrinking a window drops the snow beyond its new width', () => {
  const p = new Snow.Piles(W, H);
  p.sync([win(1, 100, 200, 300, 200)], 1 / 30);
  for (let i = 0; i < 10; i++) p.deposit(380, 190, 201, 1);
  const chunks = p.sync([win(1, 100, 200, 150, 200)], 1 / 30);
  assert.ok(chunks.length > 0);
  assert.ok(chunks.every(c => c.x >= 250));
});

test('piles never exceed their maximum height', () => {
  const p = new Snow.Piles(W, H);
  p.sync([win(1, 100, 200, 300, 200)], 1 / 30);
  for (let i = 0; i < 500; i++) p.deposit(200, 150, 201, 1);
  assert.ok(Math.max(...p.wins.get(1).bins) <= Snow.WIN_MAX + 1e-9);
});

test('landAt finds where a falling actor lands without adding snow', () => {
  const p = new Snow.Piles(W, H);
  p.sync([win(1, 250, 100, 100, 300, 0), win(2, 100, 200, 400, 300, 1)], 1 / 30);
  assert.strictEqual(p.landAt(300, 190, 205), null);            // behind the front window
  assert.strictEqual(p.landAt(150, 190, 205), 2);
  assert.strictEqual(p.landAt(150, H - 2, H + 2), 'ground');
  assert.strictEqual(total(p, 2), 0);
});

test('sync reports which windows shed snow this tick', () => {
  const p = new Snow.Piles(W, H);
  p.sync([win(1, 100, 200, 300, 200)], 1 / 30);
  p.sync([win(1, 200, 200, 300, 200)], 1 / 30);
  assert.ok(p.shed.has(1));
  p.sync([win(1, 201, 200, 300, 200)], 1 / 30);
  assert.ok(!p.shed.has(1));
});

test('switching Space (several windows vanish at once) keeps their snow for later', () => {
  const p = new Snow.Piles(W, H);
  p.sync([win(1, 100, 200, 300, 200, 0), win(2, 600, 300, 300, 200, 1)], 1 / 30);
  for (let i = 0; i < 10; i++) { p.deposit(200, 190, 201, 1); p.deposit(700, 290, 301, 1); }
  const before = total(p, 1);
  const chunks = p.sync([], 1 / 30);
  assert.strictEqual(chunks.length, 0);
  p.sync([win(1, 100, 200, 300, 200, 0)], 1 / 30);
  assert.strictEqual(total(p, 1), before);
});
