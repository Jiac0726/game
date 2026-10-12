'use strict';
/*
 * 分享机制回归测试
 *
 * 对应微信官方《小游戏设计指南》的硬性结论：
 *   3.5 每一次游戏过程分享点不宜超过 1 个；不得利诱（含道具利诱）或强制；
 *       分享奖励不应损害游戏平衡性。
 *   3.6 卡片 = 文案 + 图，二者信息互补；文案口语化、情感化；落地内容须与卡片呼应；
 *       不得借热点或擦边球诱导点击。
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const { App } = require('../src/app');
const { SHARE_IMAGES } = require('../src/share-cards');

const context = new Proxy({}, { get: (o, k) => o[k] || (() => {}), set: (o, k, v) => (o[k] = v, true) });

function make(store = {}) {
  const calls = [];
  const platform = {
    getStorageSync: (k) => store[k],
    setStorageSync: (k, v) => { store[k] = JSON.parse(JSON.stringify(v)); },
    shareAppMessage: (opts) => calls.push(opts),
    createImage: () => ({ set src(v) { this._src = v; }, get src() { return this._src; } })
  };
  const app = new App({ getContext: () => context }, { windowWidth: 375, windowHeight: 812, pixelRatio: 2 }, platform);
  // Real asset hosts, so imageUrl is populated; mirrors production wiring.
  const files = require('../src/asset-files');
  const resolved = {};
  for (const id of Object.keys(files)) resolved[id] = 'https://example.test/' + files[id];
  app.setAssetFiles(resolved);
  app.__calls = calls;
  return app;
}

function startAndFinish(app, id, score) {
  app.start(id);
  app.game.score = score;
  app.finish();
  return app;
}

test('结算页恰好一个分享入口（3.5 单局分享点 ≤ 1）', () => {
  const app = make();
  startAndFinish(app, 'blocks', 500);
  app.render();
  const shareButtons = app.buttons.filter((b) => /分享/.test(b.label || ''));
  assert.equal(shareButtons.length, 1, '结算页分享入口应恰好 1 个，实际 ' + shareButtons.length);
  // 其余按钮不是分享入口
  const others = app.buttons.filter((b) => !/分享/.test(b.label || ''));
  assert.ok(others.length >= 2, '应有「再来一局」「换个游戏」等非分享按钮');
});

test('主页与大厅页不出现第二个分享入口', () => {
  const app = make();
  for (const tab of ['大厅', '一起玩', '挑战', '我的']) {
    app.tab = tab;
    app.screen = 'home';
    app.render();
    const shareButtons = app.buttons.filter((b) => /分享/.test(b.label || ''));
    assert.ok(shareButtons.length <= 1, `${tab} 页分享入口应 ≤1，实际 ${shareButtons.length}`);
  }
});

test('卡片文案随场景变化，且为第一人称情绪化表达（3.6）', () => {
  const app = make();
  const titles = {};

  // 破个人纪录 → 炫耀型
  startAndFinish(app, 'blocks', 900);
  titles.milestone = app.shareCard().title;
  assert.match(titles.milestone, /900/, '炫耀型文案应包含成绩数字');

  // 双人局 → 对抗型
  const duel = make();
  duel.start('gomoku');
  duel.game.winner = 1;
  duel.game.moves = 12;
  duel.finish();
  titles.duel = duel.shareCard().title;

  // 未开局（主页）→ 合集型
  const hub = make();
  titles.hub = hub.shareCard().title;

  const all = Object.values(titles);
  assert.equal(new Set(all).size, all.length, '不同场景文案不应重复：' + JSON.stringify(titles));
  for (const t of all) {
    assert.ok(t.length > 0 && t.length <= 60, '文案应简短：' + t);
    assert.doesNotMatch(t, /https?:\/\//, '文案不应含链接');
  }
  // 不得使用空泛的诱导话术
  for (const t of all) {
    assert.doesNotMatch(t, /超好玩|快来玩|最好玩|史上/, '不应使用空泛诱导话术：' + t);
  }
});

test('卡片同时有文案与分享图，且图是真实解析出的 URL（3.6 文案+图互补）', () => {
  const app = make();
  startAndFinish(app, 'fruit', 420);
  const card = app.shareCard();
  assert.ok(card.title, '应有文案');
  assert.ok(card.imageUrl, '应有分享图');
  assert.match(card.imageUrl, /^https:\/\//, '分享图应是绝对 HTTPS 地址');
  assert.ok(card.path && card.path.startsWith('?'), '应带落地参数');

  // 6 款游戏的分享图应可解析且互不相同
  const seen = new Set();
  for (const id of ['blocks', 'fruit', 'line', 'brick', 'reaction', 'gomoku']) {
    const a = make();
    startAndFinish(a, id, 100);
    const img = a.shareCard().imageUrl;
    assert.ok(img, `${id} 的分享图应能解析`);
    seen.add(img);
  }
  assert.equal(seen.size, 6, '6 款游戏的分享图应互不相同，实际 ' + seen.size);
});

test('分享图素材 ID 全部存在（避免卡片无图）', () => {
  const files = require('../src/asset-files');
  for (const [scene, id] of Object.entries(SHARE_IMAGES)) {
    assert.ok(files[id], `SHARE_IMAGES.${scene} 引用的素材 ${id} 不存在于 asset-files`);
  }
});

test('分享按钮与右上角菜单产出同一份内容（3.6 一致性）', () => {
  const app = make();
  startAndFinish(app, 'brick', 300);
  app.render();
  const fromButton = app.buildShareContent();
  const fromMenu = app.buildShareContent();
  assert.deepEqual(fromButton, fromMenu);

  // share() 实际发给微信的内容应与菜单内容一致
  app.share();
  const sent = app.__calls.at(-1);
  assert.ok(sent, 'share() 应调用 shareAppMessage');
  assert.equal(sent.title, fromButton.title);
  assert.equal(sent.imageUrl, fromButton.imageUrl);
});

test('分享不产生任何游戏内收益（3.5 不得利诱、不得损害平衡性）', () => {
  const app = make();
  startAndFinish(app, 'blocks', 250);
  const before = {
    best: JSON.stringify(app.best),
    recent: JSON.stringify(app.recent),
    stats: JSON.stringify(app.stats)
  };
  app.share();
  app.share();
  app.share();
  assert.equal(JSON.stringify(app.best), before.best, '分享不得改变最高分');
  assert.equal(JSON.stringify(app.recent), before.recent, '分享不得改变最近游戏');
  assert.equal(JSON.stringify(app.stats), before.stats, '分享不得改变统计数据');

  // 源码层面：分享模块不得出现发奖/加分的赋值写法。
  // 先剥掉注释再扫，否则合规说明文字本身会被误判。
  const raw = fs.readFileSync(path.join(__dirname, '..', 'src', 'share-cards.js'), 'utf8');
  const code = raw
    .replace(/\/\*[\s\S]*?\*\//g, '')   // 块注释
    .replace(/^\s*\/\/.*$/gm, '');      // 行注释
  assert.doesNotMatch(code, /this\.best\s*(\[[^\]]*\]|\.\w+)?\s*(=[^=]|\+=|-=|\*=|\+\+|--)/, '分享模块不应写最高分');
  assert.doesNotMatch(code, /this\.(stats|recent|unlocked)\s*(=[^=]|\+=|-=|\+=)/, '分享模块不应改统计/进度');
  assert.doesNotMatch(code, /\.score\s*(\+=|-=|\*=|\+\+|--)/, '分享模块不应直接加分');
});

test('未配置素材时省略 imageUrl 而不是传空串', () => {
  const store = {};
  const calls = [];
  const platform = {
    getStorageSync: (k) => store[k],
    setStorageSync: (k, v) => { store[k] = v; },
    shareAppMessage: (o) => calls.push(o)
  };
  const app = new App({ getContext: () => context }, { windowWidth: 375, windowHeight: 812, pixelRatio: 2 }, platform);
  app.setAssetFiles({});            // 未配置素材
  app.start('blocks');
  app.game.score = 100;
  app.finish();
  const card = app.shareCard();
  assert.equal(card.imageUrl, undefined, '无素材时应为 undefined');
  app.share();
  assert.equal('imageUrl' in calls.at(-1), false, '空 imageUrl 不应传给微信');
});

test('联机房间：满员后卡片不再声称缺人（在线小程序 3.6）', () => {
  const dir = path.resolve(__dirname, '..', 'online', 'miniprogram', 'pages', 'room');
  let definition;
  const wx = {
    getStorageSync: () => undefined,
    setStorageSync: () => {},
    removeStorageSync: () => {},
    setClipboardData: () => {},
    showModal: () => {}
  };
  const api = { call: async () => ({ room: { id: 'x', status: 'waiting', seats: [], revision: 1 } }) };
  vm.runInNewContext(fs.readFileSync(path.join(dir, 'room.js'), 'utf8'), {
    Page: (p) => { definition = p; },
    require: (n) => (n === '../../lib/api' ? api : require(path.resolve(dir, n))),
    wx, console, setTimeout: () => 1, clearTimeout() {}, Date, Math
  });

  const client = Object.assign({}, definition, {
    data: JSON.parse(JSON.stringify(definition.data)),
    setData(v) { Object.assign(this.data, v); }
  });
  client.roomId = 'a'.repeat(32);

  client.data.count = 2;
  const partial = client.onShareAppMessage();
  assert.match(partial.title, /还差 2 人/, '缺 2 人时应如实说明');

  client.data.count = 4;
  const full = client.onShareAppMessage();
  assert.doesNotMatch(full.title, /还差|缺/, '满员后不得再说缺人：' + full.title);
  assert.doesNotMatch(full.title, /围观|观战/, '未实现观战前不得承诺围观：' + full.title);
  assert.ok(full.path.includes('roomId='), '落地页应带房间码');

  // 对局中同样不得声称缺人
  client.data.count = 1;
  client.data.room = { status: 'playing' };
  const playing = client.onShareAppMessage();
  assert.doesNotMatch(playing.title, /还差/, '对局中不得声称缺人');
  assert.doesNotMatch(playing.title, /围观|观战/, '未实现观战前不得承诺围观：' + playing.title);
});

test('联机房间：满员时邀请按钮被禁用（3.6 不得诱导发送无效卡片）', () => {
  const wxml = fs.readFileSync(
    path.resolve(__dirname, '..', 'online', 'miniprogram', 'pages', 'room', 'room.wxml'), 'utf8');
  assert.match(wxml, /disabled="\{\{busy \|\| count >= 4\}\}"/, '满员应禁用邀请按钮');
  assert.match(wxml, /房间已满/, '满员应有明确文案');
});

/* ---------------------------------------------------------------- 落地一致性 */

test('卡片路径带上落地所需参数（3.6 落地须与卡片呼应）', () => {
  const app = make();
  startAndFinish(app, 'blocks', 860);
  const card = app.shareCard();
  assert.match(card.path, /from=share/, '路径应标记分享来源');
  assert.match(card.path, /game=blocks/, '路径应带游戏 id');
  assert.match(card.path, /score=860/, '炫耀型卡片应把成绩带过去，落地页才能呼应');

  // 双人局没有可比分数，不应带 score
  const duel = make();
  duel.start('gomoku');
  duel.game.winner = 2;
  duel.finish();
  assert.doesNotMatch(duel.shareCard().path, /score=/, '双人局路径不必带分数');
});

test('从分享卡片进入时落到对应游戏的欢迎页，而不是大厅', () => {
  const app = make();
  const handled = app.handleShareEntry({ from: 'share', game: 'fruit', score: '420' });
  assert.equal(handled, true, '应接管本次落地');
  assert.equal(app.screen, 'shareLanding', '应进入分享落地页');
  assert.equal(app.landing.gameId, 'fruit');
  assert.equal(app.landing.score, 420);

  // 落地页能渲染，且第一个动作是"我也玩一局"
  app.render();
  const labels = app.buttons.map((b) => b.label);
  assert.ok(labels.includes('我也玩一局'), '应给出进入该游戏的入口：' + labels.join('/'));

  // 点进去确实开始同一款游戏
  const btn = app.buttons.find((b) => b.label === '我也玩一局');
  btn.fn();
  assert.equal(app.screen, 'game');
  assert.equal(app.definition.id, 'fruit');
});

test('落地页不给出第二个分享入口（3.5 单次分享点 ≤ 1 的延伸）', () => {
  const app = make();
  app.handleShareEntry({ from: 'share', game: 'brick', score: '300' });
  app.render();
  const shareButtons = app.buttons.filter((b) => /分享/.test(b.label || ''));
  assert.equal(shareButtons.length, 0, '接收者刚落地不应被再次要求分享');
});

test('无分享参数时行为与普通启动完全一致（不回归）', () => {
  const app = make();
  assert.equal(app.handleShareEntry(null), false);
  assert.equal(app.handleShareEntry({}), false);
  assert.equal(app.handleShareEntry({ game: 'blocks' }), false, '缺 from=share 不应接管');
  assert.equal(app.screen, 'home', '仍应停在默认首页');
});

test('未知/伪造的 game 参数不会崩，退化为普通启动', () => {
  const app = make();
  app.handleShareEntry({ from: 'share', game: 'not-a-real-game' });
  // 查不到定义时按"合集分享"处理，回玩法大厅
  assert.equal(app.screen, 'home');
  assert.doesNotThrow(() => app.render());
});

test('score 只用于展示，不进入任何存档或结算（3.5 不得利诱）', () => {
  const store = {};
  const app = make(store);
  startAndFinish(app, 'blocks', 100);
  const before = JSON.stringify(app.best);
  app.handleShareEntry({ from: 'share', game: 'blocks', score: '99999' });
  assert.equal(JSON.stringify(app.best), before, '落地参数不得写入最高分');
  assert.equal(app.landing.score, 99999, '仅作为展示值保存');
});
