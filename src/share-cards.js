'use strict';
/*
 * 分享卡片（scene-aware share cards）
 *
 * 依据微信官方《小游戏设计指南》：
 *   3.5 设置合理的分享节点 —— 每一次游戏过程分享点不宜超过 1 个；分享须为真实意愿，
 *       不得利诱（含道具利诱）或强制；分享奖励不应损害游戏平衡性。
 *   3.6 分享卡片的设计   —— 卡片 = 分享文案 + 分享图，二者信息互补；文案口语化、
 *       情感化、体现用户情绪；分享图融入用户个性化内容；落地内容须与卡片呼应。
 *
 * 本模块只负责「生成卡片内容」，不含任何奖励发放逻辑——这是刻意设计：
 * 分享本身不产生任何数值收益，从结构上排除利诱与刷分享的动机。
 *
 * 图的选材说明：当前用的是素材库里的方形插画作为占位，能保证卡片有图、尺寸合规、
 * 不同场景可区分；后续换成专门设计的分享图时，只需改 SHARE_IMAGES 里的 ID。
 */

const SHARE_IMAGES = {
  blocks: 'P02-CONTENT-005',
  fruit: 'P18-CONTENT-010',
  line: 'P05-CONTENT-002',
  brick: 'P03-CONTENT-018',
  reaction: 'P04-CONTENT-031',
  gomoku: 'P06-CONTENT-002',
  collection: 'P01-CONTENT-006'
};

// 场景化文案。全部第一人称、带情绪，不用「快来玩这款超好玩的游戏」这类空话（3.6）。
const COPY = {
  milestone: (g) => `我在「${g.name}」刷到 ${g.score} 分，个人最高 ${g.best}，你能超过我吗？`,
  firstClear: (g) => `「${g.name}」终于过关了，卡了我好几局`,
  daily: (g) => `今天的每日挑战我拿了 ${g.score} 分，同一开局，你也试试？`,
  duel: (g, x) => (x.win ? `「${g.name}」${x.win} 拿下这一局，输赢都开心` : `「${g.name}」打成平手，再战一局？`),
  collection: (done, total) => (done >= total ? '六款小游戏我全都玩过了，最喜欢水果合成' : `六款小游戏我玩过 ${done} 款，还差 ${total - done} 款`),
  hub: () => '玩一会儿：6 款小游戏，单人解压、双人对决'
};

// 落地路径只带必要参数：卡片本身会完整表达分数（3.6），不在链接里堆数据。
// 带 from 是为了让落地页知道这次是分享进来的，可据此给一句欢迎语。
const PATHS = {
  game: (id) => `?from=share&game=${id}`,
  collection: () => '?from=share&view=collection',
  hub: () => '?from=share'
};

// 卡片文案里的成绩随路径一起带过去，落地页才能"呼应卡片"而不是措辞一致而已（3.6）。
// 只带分数这一类展示值，不带任何可用于发奖的字段。
const LANDING_SCORE = {
  duel: null,
  milestone: (x) => x.score,
  daily: (x) => x.score,
  hub: null
};

function install(App) {
  const p = App.prototype;

  /**
   * 生成当前界面应该分享的卡片内容。
   * @returns {{title:string, imageUrl?:string, path:string, scene:string}}
   */
  p.shareCard = function () {
    const def = this.definition;
    const inResult = this.screen === 'result' && def && this.game;

    // 非结算场景：分享的是"合集"，不伪造成绩
    if (!inResult) {
      return {
        title: def ? COPY.hub() : COPY.hub(),
        imageUrl: this.shareImage(SHARE_IMAGES.collection),
        path: def ? PATHS.hub() : PATHS.collection(),
        scene: 'hub'
      };
    }

    const score = (this.game && this.game.score) || 0;
    const best = this.best[def.id] || 0;
    const isDuel = def.tag === '双人';
    const context = { win: this.game.winner ? '玩家' + this.game.winner : '', score };

    let scene, title;
    if (isDuel) {
      scene = 'duel';
      title = COPY.duel(def, context);
    } else if (score > (this.previous || 0) && score > 0) {
      // 刷新个人纪录是最强的炫耀节点（3.5 列举的"炫耀性分享"）
      scene = 'milestone';
      title = COPY.milestone({ name: def.name, score, best: Math.max(best, score) });
    } else if (this.daily) {
      scene = 'daily';
      title = COPY.daily({ name: def.name, score, best });
    } else {
      scene = 'daily';
      title = COPY.daily({ name: def.name, score, best });
    }

    const shareScore = LANDING_SCORE[scene] ? LANDING_SCORE[scene](context) : null;
    const path = shareScore ? `${PATHS.game(def.id)}&score=${shareScore}` : PATHS.game(def.id);

    return {
      title,
      imageUrl: this.shareImage(SHARE_IMAGES[def.id] || SHARE_IMAGES.collection),
      path,
      scene
    };
  };

  /**
   * 解析本次启动的分享来源（3.6 要求落地内容与卡片呼应）。
   * @returns {{fromShare:boolean, gameId:string|null, view:string|null, score:number|null}}
   */
  p.parseShareEntry = function (query) {
    const q = query || {};
    const score = Number(q.score);
    return {
      fromShare: q.from === 'share',
      gameId: typeof q.game === 'string' && q.game ? q.game : null,
      view: typeof q.view === 'string' && q.view ? q.view : null,
      score: Number.isFinite(score) && score > 0 ? score : null
    };
  };

  /**
   * 落地页：接住分享参数，让接收者先看到卡片上提到的内容，再给入口（3.6）。
   * 不直接开局，避免接收者还没看清就被推进一局。
   * @returns {boolean} 是否接管了本次落地
   */
  p.shareLanding = function (query) {
    const entry = this.parseShareEntry(query);
    if (!entry.fromShare) return false;

    const def = entry.gameId ? this.definitionFor(entry.gameId) : null;
    // 合集/大厅分享：直接回玩法大厅，无需额外引导
    if (!def) {
      this.screen = 'home';
      this.tab = '玩法';
      return true;
    }
    this.landing = {
      gameId: def.id,
      name: def.name,
      score: entry.score,
      challenge: entry.view === 'challenge'
    };
    this.screen = 'shareLanding';
    return true;
  };

  /** 按 id 找游戏定义（GAMES 在 app.js 里，原型上没挂，用构造函数注入的列表）。 */
  p.definitionFor = function (id) {
    const list = this.games || [];
    return list.find((g) => g.id === id) || null;
  };

  /**
   * 启动/回前台时的分享参数入口。同时处理两种落地：
   *   - 小游戏：卡片 path 的 query 直接带过来
   *   - 小程序（online/）：卡片 path 是页面路径，不走这里
   */
  p.handleShareEntry = function (query) {
    if (!query) return false;
    return this.shareLanding(query);
  };

  /** 分享落地页的渲染。单独成函数，便于测试与主题覆写。 */
  p.shareLandingView = function () {
    const L = this.landing || {};
    const C = this.colors || {};
    this.header('朋友分享给你', L.name || '玩一会儿');
    this.rect(24, 186, 327, 245, C.white || '#FFFCF3', 24);
    this.text('你的朋友在', 187, 244, 16, C.muted || '#738079', 'center');
    this.text(L.name || '', 187, 288, 30, C.ink || '#283748', 'center', true);
    if (L.score) {
      this.text(L.score, 187, 352, 48, C.green || '#497F76', 'center', true);
      this.text('拿了这个分数', 187, 400, 14, C.muted || '#738079', 'center');
    } else {
      this.text('等你来一局', 187, 366, 22, C.ink || '#283748', 'center', true);
    }
    this.button('我也玩一局', 24, 461, 327, 54, () => {
      const id = L.gameId;
      this.landing = null;
      this.start(id);
    });
    this.button('先看看别的', 24, 533, 327, 54, () => {
      this.landing = null;
      this.screen = 'home';
      this.tab = '玩法';
    }, C.white || '#FFFCF3', C.ink || '#283748');
    this.text('同一款游戏，刷新你自己的纪录', 187, 709, 14, C.muted || '#738079', 'center');
  };

  /** 把素材 ID 解析成真实 URL；未配置素材时返回 undefined 而不是空串。 */
  p.shareImage = function (assetId) {
    if (!assetId || !this.assetFiles) return undefined;
    return this.assetFiles[assetId] || undefined;
  };

  /** 分享按钮与右上角菜单共用的内容构造，避免两条路径文案不一致（3.6）。 */
  p.buildShareContent = function () {
    const card = this.shareCard();
    const out = { title: card.title, path: card.path };
    if (card.imageUrl) out.imageUrl = card.imageUrl; // 空串会被微信拒绝，故省略
    return out;
  };

  /** 分享入口。只发内容，不给任何游戏内收益。 */
  p.share = function () {
    if (!this.platform.shareAppMessage) {
      this.toast('微信版本可分享成绩');
      return;
    }
    const content = this.buildShareContent();
    const payload = { title: content.title };
    if (content.imageUrl) payload.imageUrl = content.imageUrl;   // 空值必须省略
    if (content.path) payload.path = content.path;
    payload.fail = () => this.toast('当前环境暂不支持微信分享');
    this.platform.shareAppMessage(payload);
  };
}

module.exports = { install, SHARE_IMAGES, COPY, PATHS };
