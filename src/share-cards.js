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

    return {
      title,
      imageUrl: this.shareImage(SHARE_IMAGES[def.id] || SHARE_IMAGES.collection),
      path: PATHS.game(def.id),
      scene
    };
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
