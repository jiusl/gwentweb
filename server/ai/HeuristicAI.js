/**
 * 启发式 AI 实现 —— 资源战与局数规划
 *
 * 核心目标：用最少的资源消耗，赢得2局胜利。
 *
 * 三层决策架构：
 *   战略层 → 局数目标的动态选择（WIN / ATTRITION / CRUSH）
 *   战术层 → 出牌顺序的效用评估（9级优先级体系）
 *   回合层 → Pass 算法（四原则：领先够多 / 亏卡止损 / 已赢不浪费 / 必输放弃）
 *
 * 阵营特性：
 *   北方领域 → 死拼首局（赢后多抽牌）+ 次局疯狂消耗
 *   尼弗迦德 → 拖长局 + 医生间谍循环
 *   怪物     → 猛冲首局（有遗产单位）
 *   松鼠党   → 灵活换排 + 诱饵/医生 combo
 */

const AIInterface = require('./AIInterface');
const { ABILITIES } = require('../gameLogic/cards');

/** 回合战略目标 */
const GOAL = { WIN: 'win', ATTRITION: 'attrition', CRUSH: 'crush' };

/** 天气 → 排位映射 */
const WEATHER_TO_ROW = {
  [ABILITIES.WEATHER_FROST]: 'melee',
  [ABILITIES.WEATHER_FOG]: 'ranged',
  [ABILITIES.WEATHER_RAIN]: 'siege',
};

class HeuristicAI extends AIInterface {
  getName() { return 'HeuristicAI'; }

  /* ═══════════════════ 主入口 ═══════════════════ */
  decideAction(game, aiPlayerId) {
    const ai = game.players[aiPlayerId];
    if (!ai || ai.hand.length === 0) return { action: 'pass' };

    const oppId = game.getOpponentId(aiPlayerId);
    const opp = game.players[oppId];
    game.updateScores();

    const goal = this._determineGoal(game, ai, opp);

    if (this._shouldPass(game, ai, opp, goal)) {
      return { action: 'pass' };
    }

    return this._pickBestCard(game, ai, opp, goal);
  }

  /* ═══════════════════ 战略层：局数目标 ═══════════════════ */

  /**
   * 根据手牌强度、当前比分、已赢局数，动态决定本轮目标
   */
  _determineGoal(game, ai, opp) {
    const round = game.currentRound;
    const aiWon = ai.roundsWon;
    const oppWon = opp.roundsWon;
    const aiPower = this._estimateHandPower(ai, game);
    const oppPower = this._estimateHandPower(opp, game);

    // ── 决胜局 / 第三局 → 无情碾压 ──
    if ((aiWon === 1 && oppWon === 1) || round >= 3) {
      return GOAL.CRUSH;
    }

    // ── AI 已赢1局（第二局，对面0胜）→ 消耗为主 ──
    if (aiWon === 1 && oppWon === 0) {
      if (aiPower > oppPower * 1.3 && ai.hand.length >= opp.hand.length) {
        return GOAL.WIN; // 碾压级手牌 → 直接终结比赛
      }
      return GOAL.ATTRITION;
    }

    // ── 对手赢1局（第二局，AI 0胜）→ 生死局，必须赢 ──
    if (oppWon === 1 && aiWon === 0) {
      return GOAL.WIN;
    }

    // ── 第一局：根据阵营和手牌决定 ──
    const faction = this._detectFaction(ai);

    if (faction === 'monsters') {
      // 怪物阵营：有遗产单位，死战不退
      return aiPower > oppPower * 0.7 ? GOAL.WIN : GOAL.ATTRITION;
    }
    if (faction === 'northern') {
      // 北方领域：拼命争首局（赢后多抽1张牌）
      return aiPower > oppPower * 0.8 ? GOAL.WIN : GOAL.ATTRITION;
    }
    // 帝国 / 松鼠党：默认消耗战，手牌碾压时才争胜
    if (aiPower > oppPower * 1.25) return GOAL.WIN;
    return GOAL.ATTRITION;
  }

  /* ═══════════════════ Pass 算法：四原则 ═══════════════════ */

  /**
   * Pass 判断：
   *   1. 领先足够多 → 对手追不上
   *   2. 继续跟牌亏卡 → 付出 > 收益
   *   3. 这局赢定了 → 对手已 Pass，绝不多出
   *   4. 这局输定了 → 及时止损
   */
  _shouldPass(game, ai, opp, goal) {
    const scoreGap = ai.score - opp.score;

    // ── 原则3：对手已 Pass ──
    if (opp.passed) {
      if (scoreGap > 0) return true; // 已领先 → 绝不出牌浪费
      // 落后但在消耗局 → 差5分以内且手上有小牌可尝试追
      if (goal === GOAL.ATTRITION) {
        return scoreGap < -5 || ai.hand.length === 0;
      }
      return false; // 必须赢的局：算出牌追
    }

    // ── 原则1 & 2：AI 领先时分析 ──
    if (scoreGap > 0) {
      const cardsNeeded = this._cardsToCatchUp(scoreGap, opp, game);
      const oppCards = opp.hand.length;

      // 对手追分需要的牌 > 对手手牌数 → 绝对追不上 → Pass
      if (cardsNeeded > oppCards) {
        if (goal !== GOAL.CRUSH || cardsNeeded > oppCards + 2) return true;
      }

      // 领先分差 > 对手手牌总期望战力 → Pass
      if (scoreGap > oppCards * this._avgCardPower(opp, game)) {
        return true;
      }

      // 消耗局：领先 ≥ 10 且对手需要 ≥ 2 张牌追 → 干脆 Pass
      if (goal === GOAL.ATTRITION && scoreGap >= 10 && cardsNeeded >= 2) {
        return true;
      }

      // 领先 ≥ 15 且对手需要 ≥ 3 张牌
      if (scoreGap >= 15 && cardsNeeded >= 3) {
        return true;
      }
    }

    // ── 原则4：AI 落后太多，及时止损 ──
    if (scoreGap < 0) {
      const gap = Math.abs(scoreGap);
      const myCards = ai.hand.length;
      const cardsNeeded = this._cardsToCatchUp(gap, ai, game);

      // 需要 ≥ 3 张牌且手牌 ≤ 3 → 放弃
      if (cardsNeeded >= 3 && myCards <= 3) return true;
      // 需要的牌 > 手牌总数 → 放弃
      if (cardsNeeded > myCards) return true;
      // 消耗局：落后 ≥ 12 且需要 ≥ 2 张牌 → 放弃
      if (goal === GOAL.ATTRITION && gap >= 12 && cardsNeeded >= 2) return true;
      // 必须赢但怎么都追不上
      if (goal === GOAL.WIN && cardsNeeded > myCards) return true;
    }

    return false;
  }

  /** 估算追 N 分最少需要几张牌（按牌力从高到低累加） */
  _cardsToCatchUp(gap, player, game) {
    if (gap <= 0) return 0;
    const powers = player.hand
      .map(c => this._estimateCardValue(c, player, game))
      .sort((a, b) => b - a);
    let sum = 0;
    for (let i = 0; i < powers.length; i++) {
      sum += powers[i];
      if (sum >= gap) return i + 1;
    }
    return powers.length + 1; // 所有牌打完也追不上
  }

  /** 估算单卡期望战力 */
  _estimateCardValue(card, player, game) {
    if (card.type === 'special') {
      if (card.ability === ABILITIES.SCORCH) {
        // 烧灼：估算能烧掉对方的最大点数
        let maxOpp = 0;
        for (const r of ['melee', 'ranged', 'siege']) {
          for (const c of (game.players[Object.keys(game.players).find(p => p !== player.id)] || {})[r] || []) {
            if (!c.isHero && (c.power || 0) > maxOpp) maxOpp = c.power;
          }
        }
        return Math.min(maxOpp, 15);
      }
      if (card.ability === ABILITIES.COMMANDERS_HORN) {
        const row = this._bestHornRow(game, player);
        if (row) {
          return player[row].filter(c => !c.isHero).reduce((s, c) => s + (c.power || 0), 0);
        }
        return 3;
      }
      if (card.ability === ABILITIES.DECOY) return 0;
      return 2;
    }
    if (card.isHero) return card.power || 0;
    if (card.isSpy) return -(card.power || 0);
    if (card.isMuster) {
      const total = 1 +
        player.hand.filter(c => c.name === card.name && c !== card).length +
        player.deck.filter(c => c.name === card.name).length;
      return (card.power || 0) * Math.min(total, 4);
    }
    if (card.isMedic) {
      const best = player.graveyard
        .filter(c => c.type === 'unit' && !c.isHero)
        .reduce((m, c) => Math.max(m, c.power || 0), 0);
      return (card.power || 0) + best;
    }
    let p = card.power || 0;
    if (card.isTightBond) {
      const onField = player[card.row || 'melee'].filter(x => x.name === card.name).length;
      const inHand = player.hand.filter(x => x.name === card.name && x !== card).length;
      if (onField + inHand >= 1) p *= 2;
    }
    return p;
  }

  _avgCardPower(player, game) {
    if (player.hand.length === 0) return 5;
    return player.hand.reduce((s, c) => s + Math.max(1, this._estimateCardValue(c, player, game)), 0)
      / player.hand.length;
  }

  /* ═══════════════════ 战术层：9级效用评估 ═══════════════════ */

  /**
   * 按优先级链评估每张手牌，返回效用最高的行动
   *
   * 优先级链：
   *   1. 间谍    — 卡差大于一切（除非领先极多且手牌少）
   *   2. 医生    — 复活最高价值非英雄单位
   *   3. 诱饵    — 换回间谍 > 换回医生 combo > 避险
   *   4. 天气    — 净收益最大化：己方零影响，对方受重创
   *   5. 灼烧    — 等待高价值目标，不烧自己
   *   6. 英雄    — 稳定得分，不受天气克制
   *   7. 召集    — 激活铺场特效
   *   8. 高战力  — 同袍 > 士气 > 白板高战力
   *   9. 低战力  — 消耗局里"磨洋工"骗对方出牌
   */
  _pickBestCard(game, ai, opp, goal) {
    const hand = ai.hand;
    let bestIdx = -1;
    let bestUtility = -Infinity;

    for (let i = 0; i < hand.length; i++) {
      const u = this._scoreUtility(hand[i], i, game, ai, opp, goal);
      if (u > bestUtility) { bestUtility = u; bestIdx = i; }
    }

    if (bestIdx === -1) return { action: 'pass' };

    const card = hand[bestIdx];
    let row = card.row || 'melee';

    // ── 特殊牌：确定目标排 ──
    if (card.ability === ABILITIES.DECOY) {
      const target = this._findDecoyTarget(game, ai, opp);
      if (target) {
        return { action: 'playCard', cardIndex: bestIdx, row: 'melee', targetCardId: target.card.id };
      }
    }
    if (card.isMedic) {
      const grave = ai.graveyard.filter(c => c.type === 'unit' && !c.isHero);
      if (grave.length > 0) {
        grave.sort((a, b) => (b.power || 0) - (a.power || 0));
        return { action: 'playCard', cardIndex: bestIdx, row, targetCardId: grave[0].id };
      }
    }
    if (card.type === 'special') {
      row = WEATHER_TO_ROW[card.ability] ||
        (card.ability === ABILITIES.COMMANDERS_HORN ? (this._bestHornRow(game, ai) || 'melee') : 'melee');
    }

    return { action: 'playCard', cardIndex: bestIdx, row };
  }

  /**
   * 计算单张牌的效用值（0-100）
   * 分数越高 = 越应该优先打出
   */
  _scoreUtility(card, idx, game, ai, opp, goal) {
    const gap = ai.score - opp.score;
    const handN = ai.hand.length;
    const oppN = opp.hand.length;
    const faction = this._detectFaction(ai);

    /* ─── 1. 间谍牌（80-100）─── */
    if (card.isSpy) {
      // 领先极多且手牌少 → 不出（给对方送分可能翻盘）
      if (gap > 15 && handN <= 2) return 10;
      // 消耗局、手牌充裕 → 稍降优先级（不想抽太多牌）
      if (goal === GOAL.ATTRITION && handN >= 7) return 78;
      // 必须赢且落后 → 最高优先级（翻盘关键）
      if ((goal === GOAL.WIN || goal === GOAL.CRUSH) && gap < -5) return 100;
      // 北方首局 → 极高（赢局多抽牌的正循环）
      if (faction === 'northern' && game.currentRound === 1) return 98;
      return 90;
    }

    /* ─── 2. 医生牌（65-95）─── */
    if (card.isMedic) {
      const graves = ai.graveyard.filter(c => c.type === 'unit' && !c.isHero);
      if (graves.length === 0) return 12;
      const bestP = Math.max(...graves.map(c => c.power || 0));
      if (bestP >= 10) return 93;
      if (bestP >= 8)  return 88;
      if (bestP >= 6)  return 82;
      // 帝国/松鼠党倾向医生循环
      if (faction === 'nilfgaard' || faction === 'scoiatael') return 76;
      return 68;
    }

    /* ─── 3. 诱饵牌（55-90）─── */
    if (card.ability === ABILITIES.DECOY) {
      const t = this._findDecoyTarget(game, ai, opp);
      if (!t) return 6;
      if (t.card.isSpy)  return 90;  // 换回间谍 → 最高
      if (t.card.isMedic) return 86; // 换回医生 combo
      if (t.card.power >= 8 && !t.card.isHero && game.weather[t.row]) return 72; // 避险
      if (t.card.power < 5) return 58;
      return 55;
    }

    /* ─── 4. 天气牌（40-85）─── */
    if (WEATHER_TO_ROW[card.ability]) {
      const row = WEATHER_TO_ROW[card.ability];
      if (game.weather[row]) return 3;
      const oppLoss = opp[row].filter(c => !c.isHero).reduce((s, c) => s + (c.power || 1) - 1, 0);
      const aiLoss = ai[row].filter(c => !c.isHero).reduce((s, c) => s + (c.power || 1) - 1, 0);
      const net = oppLoss - aiLoss;
      if (net > 15) return 84;
      if (net > 8)  return 76;
      if (net > 3)  return 66;
      if (net > 0)  return 56;
      return 4; // 损己利人 → 不出
    }

    /* ─── 晴天 ─── */
    if (card.ability === ABILITIES.CLEAR_WEATHER) {
      const hasW = game.weather.melee || game.weather.ranged || game.weather.siege;
      if (!hasW) return 4;
      let benefit = 0;
      for (const r of ['melee', 'ranged', 'siege']) {
        if (game.weather[r])
          benefit += ai[r].filter(c => !c.isHero).reduce((s, c) => s + (c.power || 1) - 1, 0);
      }
      if (benefit > 10) return 80;
      if (benefit > 5)  return 68;
      return 48;
    }

    /* ─── 号角 ─── */
    if (card.ability === ABILITIES.COMMANDERS_HORN) {
      const r = this._bestHornRow(game, ai);
      if (r) {
        const sum = ai[r].filter(c => !c.isHero).reduce((s, c) => s + (c.power || 0), 0);
        if (sum > 18) return 82;
        if (sum > 10) return 72;
        return 58;
      }
      return 10;
    }

    /* ─── 5. 灼烧牌（35-78）─── */
    if (card.isScorch || card.ability === ABILITIES.SCORCH) {
      const maxOpp = this._maxNonHero(opp);
      const maxAi = this._maxNonHero(ai);
      if (maxOpp >= 10 && maxOpp > maxAi) return 78;
      if (maxOpp >= 8 && maxOpp > maxAi)  return 70;
      if (maxOpp >= 6 && maxOpp > maxAi)  return 58;
      if (maxOpp >= 10 && maxOpp === maxAi) return 32; // 会烧自己
      return 14;
    }
    if (card.ability === ABILITIES.SCORCH_MELEE || card.ability === ABILITIES.SCORCH_SIEGE) {
      const tr = card.ability === ABILITIES.SCORCH_MELEE ? 'melee' : 'siege';
      const om = opp[tr].filter(c => !c.isHero).reduce((m, c) => Math.max(m, c.power || 0), 0);
      const am = ai[tr].filter(c => !c.isHero).reduce((m, c) => Math.max(m, c.power || 0), 0);
      if (om >= 8 && om > am) return 72;
      if (om >= 6 && om > am) return 60;
      return 14;
    }

    /* ─── 6. 英雄牌（50-65）─── */
    if (card.isHero) {
      if (goal === GOAL.CRUSH) return 65;
      if (goal === GOAL.WIN)   return 62;
      return 55; // 消耗局也保留一定价值（稳定）
    }

    /* ─── 7. 召集牌（38-62）─── */
    if (card.isMuster) {
      const extra = ai.hand.filter((c, i) => i !== idx && c.name === card.name).length +
                    ai.deck.filter(c => c.name === card.name).length;
      if (extra >= 2) return 62;
      if (extra >= 1) return 56;
      return 42;
    }

    /* ─── 8-9. 普通单位牌 ─── */
    let power = card.power || 1;
    if (card.isTightBond) {
      const onField = ai[card.row || 'melee'].filter(x => x.name === card.name).length;
      const inHand = ai.hand.filter((x, i) => i !== idx && x.name === card.name).length;
      if (onField + inHand >= 1) power *= 2;
    }
    if (card.isMoraleBoost) {
      power += ai[card.row || 'melee'].filter(c => !c.isHero).length;
    }

    let util = Math.min(50, power * 3 + 5);

    // 消耗局倒置：低战力牌优先（磨洋工骗对方出牌）
    if (goal === GOAL.ATTRITION) {
      util = 55 - util;
    }
    // 碾压局：高战力最大化
    if (goal === GOAL.CRUSH) {
      util = Math.min(55, power * 4);
    }

    return util;
  }

  /* ═══════════════════ 辅助方法 ═══════════════════ */

  _estimateHandPower(player, game) {
    return player.hand.reduce((s, c) => s + Math.max(1, this._estimateCardValue(c, player, game)), 0);
  }

  /** 从手牌+牌组中推断主导阵营 */
  _detectFaction(player) {
    const cnt = {};
    for (const c of [...player.hand, ...player.deck]) {
      if (c.faction && c.faction !== 'neutral') {
        cnt[c.faction] = (cnt[c.faction] || 0) + 1;
      }
    }
    let best = 'northern', bestN = 0;
    for (const [f, n] of Object.entries(cnt)) {
      if (n > bestN) { bestN = n; best = f; }
    }
    return best;
  }

  _maxNonHero(player) {
    let max = 0;
    for (const row of ['melee', 'ranged', 'siege']) {
      for (const c of player[row]) {
        if (!c.isHero && (c.power || 0) > max) max = c.power;
      }
    }
    return max;
  }

  _bestHornRow(game, player) {
    let best = null, bestV = 0;
    for (const row of ['melee', 'ranged', 'siege']) {
      if (game.horn[player.id] && game.horn[player.id][row]) continue;
      const cards = player[row].filter(c => !c.isHero);
      const sum = cards.reduce((s, c) => s + (c.power || 0), 0);
      if (sum > bestV && cards.length >= 2) { bestV = sum; best = row; }
    }
    return best;
  }

  /**
   * 诱饵目标：换回间谍 > 换回医生 combo > 紧急避险 > 低战力换手
   * @returns {{ card: object, row: string } | null}
   */
  _findDecoyTarget(game, player, opponent) {
    let best = null, bestP = -1;

    for (const row of ['melee', 'ranged', 'siege']) {
      for (const c of player[row]) {
        if (c.isHero) continue;
        let priority = 0;
        // 对方打过来的间谍 → 换回去打回给对方
        if (c.isSpy) priority = 100;
        // 医生 + 墓地有可复活单位 → combo
        else if (c.isMedic && player.graveyard.some(g => g.type === 'unit' && !g.isHero)) priority = 85;
        // 当前排被天气影响的高价值单位 → 避险
        else if (game.weather[row] && (c.power || 0) >= 8) priority = 55;
        // 低战力牌 → 可换手
        else if ((c.power || 0) < 5) priority = 25;
        else priority = 10;

        if (priority > bestP) { bestP = priority; best = { card: c, row }; }
      }
    }
    return best;
  }
}

module.exports = HeuristicAI;
