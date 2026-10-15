'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const config = require('../src/asset-config');
const { createAssetFiles } = require('../src/asset-source');
const shared = require('../src/shared-ui-assets');
const fruit = require('../src/fruit-assets');
const { App } = require('../src/app');

test('shared skin, every fruit level and flying chess use the same remote-only host', () => {
  assert.equal(config.useLocalAssets, false);
  assert.equal(config.baseUrl, 'https://www.gskj.cloud/game-assets/v1');
  const files = createAssetFiles(config);
  const uiIds = Object.keys(shared.files), fruitIds = fruit.levels.map(v => v.id);
  assert.ok(uiIds.length >= 10, 'shared Canva UI should include actual art IDs');
  assert.equal(fruitIds.length, 9, 'all nine fruit levels need sprites');
  for (const id of [...uiIds, ...fruitIds, 'FG-BOARD-001']) {
    const path = shared.files[id] || fruit.files[id] || require('../src/flying-assets').files[id];
    assert.equal(files[id], config.baseUrl + '/' + path.split('/').map(encodeURIComponent).join('/'), id);
    assert.match(files[id], /^https:\/\/www\.gskj\.cloud\/game-assets\/v1\/assets\//);
    assert.ok(!files[id].includes('/gamecenter/'), id);
  }
});

test('game renderer requests cloud handdrawn backgrounds and real fruit sprites', () => {
  const requested = [], draws = [];
  const ctx = new Proxy({
    drawImage: (...args) => draws.push(args),
    measureText: text => ({ width: String(text).length * 7 })
  }, {
    get: (target, key) => key in target ? target[key] : (() => {}),
    set: (target, key, value) => (target[key] = value, true)
  });
  const platform = {
    getStorageSync: () => null,
    createImage: () => ({
      set src(url) { requested.push(url); if (this.onload) this.onload(); }
    })
  };
  const app = new App({ getContext: () => ctx }, { windowWidth: 375, windowHeight: 812 }, platform);
  const urls = createAssetFiles(config);
  app.setAssetFiles(urls);
  assert.equal(typeof app.sharedSkin, 'function');
  assert.equal(typeof app.drawFruitSprite, 'function');
  assert.ok(app.assetInfo('UI-PAPER'));
  app.render();
  assert.ok(requested.includes(urls['UI-PAPER']), 'home should request the paper background');
  assert.ok(requested.some(url => url.includes('CANVA_SPLIT_20261012')), 'home should use the Canva art collection');
  app.start('fruit');
  app.render();
  assert.ok(requested.includes(urls[fruit.levels[app.game.next].id]), 'fruit game must request its next sprite');
  assert.ok(draws.length > 0, 'loaded sprites are actually drawn on Canvas');
});
