'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const paths = require('../src/asset-files');
const catalog = require('../src/asset-catalog');
const { createAssetFiles } = require('../src/asset-source');

test('every catalog image has a stable path and dimensions without bundled PNGs', () => {
  for (const id of Object.keys(catalog)) {
    const item = catalog[id];
    if (!item.asset_id) continue;
    assert.ok(paths[id] || paths[item.asset_id], id);
    assert.ok(item.pixel_size.width > 0 && item.pixel_size.height > 0, id);
  }
});
test('remote library preserves IDs and aliases and joins paths exactly once', () => {
  const files = createAssetFiles({ baseUrl: 'https://cdn.example.com/game/v1///' });
  assert.equal(Object.keys(files).length, Object.keys(paths).length);
  for (const id of Object.keys(paths)) {
    assert.equal(files[id], 'https://cdn.example.com/game/v1/' + paths[id]);
  }
});
test('missing configuration uses drawn fallback; local images require explicit opt-in', () => {
  assert.deepEqual(createAssetFiles(), {});
  assert.deepEqual(createAssetFiles({ useLocalAssets: true }), paths);
});
test('reject unsafe or malformed asset library addresses', () => {
  for (const baseUrl of ['http://cdn.example.com', 'file:///assets', 'https://cdn.example.com?v=1', 'https://cdn.example.com/#x', 'https://cdn.example.com/../private', 'https://']) {
    assert.throws(() => createAssetFiles({ baseUrl }));
  }
});

test('drawing uses the remote URL, reuses the image, and preserves aspect ratio', () => {
  const { App } = require('../src/app');
  const requested = [];
  const draws = [];
  const ctx = new Proxy({ drawImage: (...args) => draws.push(args) }, {
    get: (object, key) => object[key] || (() => {}),
    set: (object, key, value) => (object[key] = value, true)
  });
  const platform = {
    getStorageSync: () => null,
    createImage: () => ({ set src(url) { requested.push(url); this.onload(); } })
  };
  const app = new App({ getContext: () => ctx }, { windowWidth: 375, windowHeight: 812 }, platform);
  const files = createAssetFiles({ baseUrl: 'https://cdn.example.com/game/v1' });
  app.setAssetFiles(files);
  const id = 'P01-CONTENT-008';
  const result = app.drawAsset(id, 20, 30, 100, 80);
  app.drawAsset(id, 20, 30, 100, 80);
  assert.equal(result.status, 'ready');
  assert.deepEqual(requested, [files[id]]);
  assert.equal(draws.length, 2);
  assert.ok(Math.abs(result.bounds.width / result.bounds.height - catalog[id].pixel_size.width / catalog[id].pixel_size.height) < 1e-12);
});
