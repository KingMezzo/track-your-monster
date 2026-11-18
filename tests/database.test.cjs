const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
function setup(product) {
  const storage = new Map();
  const requests = [];
  const context = vm.createContext({
    window: {}, localStorage: {
      getItem: key => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: key => storage.delete(key)
    }, AbortController, setTimeout, clearTimeout,
    fetch: async url => { requests.push(url); return { ok: true, json: async () => ({ status: 1, product }) }; }
  });
  for (const file of ['catalog.js', 'database.js']) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context);
  return { db: context.window.MonsterDB, storage, requests };
}
test('every local picture has exactly one catalog entry and exists on disk', () => {
  const { db } = setup();
  const files = fs.readdirSync(path.join(root, 'monster_pictures')).filter(f => f.endsWith('.webp'));
  assert.equal(db.CATALOG.length, 32);
  assert.equal(new Set(db.CATALOG.map(p => p.image)).size, files.length);
  for (const p of db.CATALOG) assert.ok(fs.existsSync(path.join(root, p.image)), p.image);
  for (const file of files) assert.ok(db.CATALOG.some(p => p.image.endsWith('/' + file)), file);
});
test('known barcodes work offline, including equivalent GTIN leading zero', async () => {
  const { db, requests } = setup();
  assert.equal((await db.resolve('5060337500401')).id, 'original');
  assert.equal((await db.resolve('05060337500401')).id, 'original');
  assert.equal(requests.length, 0);
});
test('specific flavors win, ambiguous zero sugar never guesses a can color', () => {
  const { db } = setup();
  for (const p of db.CATALOG) assert.equal(db.matchVariant('Monster ' + p.sub).id, p.id, p.sub);
  assert.equal(db.matchVariant('Monster Zero Sugar Original'), null);
  assert.equal(db.matchVariant('Monster Energy Ultra Fiesta Mango').id, 'ultra-fiesta-mango');
  assert.equal(db.matchVariant('Monster Zero Ultra').id, 'ultra-white');
  assert.equal(db.matchVariant('Monster Ultra Blue'), null);
});
test('OFF metadata resolves a local image and remembers the barcode without requesting photos', async () => {
  const { db, requests } = setup({ product_name: 'Monster Mango Loco', brands: 'Monster', quantity: '355 ml', nutriments: { caffeine_100g: 0.032 }, image_front_url: 'https://forbidden.test/photo.jpg' });
  const p = await db.resolve('1234567890123');
  assert.equal(p.catalogId, 'mango-loco');
  assert.equal(p.mg, 114);
  assert.equal(p.ml, 355);
  assert.equal(db.localImage(p), 'monster_pictures/monster-mango-loco.webp');
  assert.equal((await db.resolve(p.ean)).id, 'mango-loco');
  assert.equal(requests.length, 1);
  assert.ok(!requests[0].includes('image'));
  assert.equal(p.image, undefined);
});
test('manual correction beats stale names, cached URLs, and existing catalog IDs', () => {
  const { db, storage } = setup();
  const p = { ean: '123456789012', name: 'Monster Mango Loco', catalogId: 'mango-loco', image: 'https://old.test/photo.jpg' };
  storage.set('monsterTracker.imgCache.v1', JSON.stringify({ [p.ean]: p.image }));
  assert.equal(db.localImage(p), 'monster_pictures/monster-mango-loco.webp');
  assert.ok(db.linkBarcode(p.ean, 'pipeline-punch'));
  assert.equal(db.localImage(p), 'monster_pictures/monster-pipeline-punch.webp');
  assert.equal(db.getLocal('0123456789012').id, 'pipeline-punch');
  assert.ok(db.linkBarcode(p.ean, ''));
  assert.equal(db.localImage(p), '');
  assert.equal(db.linkBarcode(p.ean, 'does-not-exist'), false);
  db.clearMappings();
  assert.equal(db.localImage(p), 'monster_pictures/monster-mango-loco.webp');
});
test('unrecognized products have no remote image and other brands are rejected', async () => {
  const { db } = setup({ product_name: 'Cola', brands: 'Other Brand', image_front_url: 'https://forbidden.test/photo.jpg' });
  assert.equal(await db.resolve('12345678'), null);
  assert.equal(db.localImage({ ean: '87654321', name: 'Unknown', image: 'https://old.test/image.jpg' }), '');
});
