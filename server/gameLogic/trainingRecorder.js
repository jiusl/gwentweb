/**
 * 昆特牌训练数据录制器
 *
 * 在每局游戏中捕获出牌快照，对局结束后将胜方每一步出牌
 * 写入训练数据文件（偏好学习格式）。
 *
 * 用法:
 *   const { TrainingRecorder } = require('./trainingRecorder');
 *   const recorder = new TrainingRecorder(outputPath);
 *
 *   // 每步出牌前调用
 *   recorder.recordSnapshot(game, playerId, card, row);
 *
 *   // 对局结束时调用
 *   recorder.onGameEnd(game);
 */

const fs = require('fs');
const path = require('path');

const DEFAULT_OUTPUT = path.join(__dirname, '..', '..', 'training_data.json');

// ── 阵营中文名 ──
const FACTION_CN = {
  northern: '北方领域', nilfgaard: '尼弗迦德',
  scoiatael: '松鼠党', monsters: '怪物', neutral: '中立',
};
const ROW_CN = { melee: '近战', ranged: '远程', siege: '攻城' };

// ═══════════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════════

function describeCard(c) {
  const parts = [`${c.name}（${c.power}点`];
  if (c.isHero) parts.push('英雄');
  if (c.type === 'special') parts.push('特殊牌');
  else if (c.type === 'unit') parts.push('单位');
  if (c.isSpy) parts.push('间谍');
  if (c.isMedic) parts.push('医生');
  if (c.isMuster) parts.push('召集');
  if (c.isTightBond) parts.push('同袍');
  if (c.isMoraleBoost) parts.push('士气');
  if (c.isScorch) parts.push('烧灼');
  parts.push('）');
  return parts.join('');
}

function describeRow(cards) {
  if (!cards || cards.length === 0) return '（空）';
  return cards.map(c => c.name).join('、') + `（共${cards.length}张）`;
}

/**
 * 将游戏状态描述为中文自然语言
 */
function buildStateDescription(game, playerId, opponentId) {
  const p = game.players[playerId];
  const opp = game.players[opponentId];
  const faction = p.faction || 'northern';
  const oppFaction = opp.faction || 'northern';

  let desc = `${FACTION_CN[faction] || faction}对阵${FACTION_CN[oppFaction] || oppFaction}，`;
  desc += `当前第${game.currentRound}局，`;
  desc += `比分 ${p.roundsWon}-${opp.roundsWon}`;
  if (p.roundsWon > opp.roundsWon) desc += '（我方领先）';
  else if (opp.roundsWon > p.roundsWon) desc += '（我方落后）';
  desc += `。场上战力 ${p.score} - ${opp.score}`;

  if (p.score > opp.score) desc += '，我方暂时领先。';
  else if (opp.score > p.score) desc += '，我方暂时落后。';
  else desc += '，双方持平。';

  desc += ` 对方近战排：${describeRow(opp.melee)}；`;
  desc += `远程排：${describeRow(opp.ranged)}；`;
  desc += `攻城排：${describeRow(opp.siege)}。`;

  if (p.melee.length > 0 || p.ranged.length > 0 || p.siege.length > 0) {
    desc += ` 我方近战排：${describeRow(p.melee)}；`;
    desc += `远程排：${describeRow(p.ranged)}；`;
    desc += `攻城排：${describeRow(p.siege)}。`;
  } else {
    desc += ' 我方场上暂无单位。';
  }

  desc += ` 对方剩余手牌${opp.hand.length}张、牌组${opp.deck.length}张。`;
  desc += ` 我方手牌${p.hand.length}张（`;
  desc += p.hand.map(c => c.name).join('、');
  desc += `），牌组剩余${p.deck.length}张。`;

  if (opp.passed) desc += ' 对方已放弃本轮。';
  if (p.passed) desc += ' 我方已放弃本轮。';

  const weathers = [];
  for (const [row, w] of Object.entries(game.weather || {})) {
    if (w) weathers.push(`${ROW_CN[row]}排${w === 'frost' ? '霜冻' : w === 'fog' ? '浓雾' : '暴雨'}`);
  }
  if (weathers.length > 0) desc += ` 当前天气：${weathers.join('、')}。`;

  return desc;
}

/**
 * 根据出牌决策生成中文策略建议（output）
 */
function buildActionDescription(game, playerId, opponentId, card, decision) {
  const p = game.players[playerId];
  const opp = game.players[opponentId];

  let output = `打出【${card.name}】`;

  if (decision.row && card.type !== 'special') {
    output += `到${ROW_CN[decision.row] || decision.row}排`;
  }

  const reasons = [];

  if (card.isHero) {
    if (card.isScorch || card.heroAbility === 'scorch') {
      reasons.push('英雄牌不受天气和烧灼影响，同时可摧毁对方高战力单位');
    } else {
      reasons.push('英雄牌战力高且不受天气/号角/烧灼影响，是最稳定的得分手段');
    }
  }

  if (card.isSpy) {
    reasons.push('间谍牌打到对方场上为我方抽2张牌，用一张牌的代价换取手牌优势');
  }

  if (card.isMedic) {
    reasons.push('医生牌可从墓地复活高战力单位，相当于免费获得额外战力');
  }

  if (card.isMuster) {
    reasons.push('召集效果可一次性拉出所有同名卡，快速铺场建立战力优势');
  }

  if (card.isTightBond) {
    const same = p.hand.filter(c => c.name === card.name).length;
    if (same >= 2) {
      reasons.push(`手牌中还有${same - 1}张同名卡，打出后可触发同袍效果翻倍战力`);
    }
  }

  if (card.type === 'special' && card.ability === 'commanders_horn') {
    reasons.push('号角牌可翻倍一排非英雄单位战力，在单位多时收益极高');
  }
  if (card.type === 'special' && card.ability === 'scorch') {
    reasons.push('烧灼可摧毁全场战力最高的非英雄单位，在对方有高战力单位时使用可扭转局势');
  }
  if (card.type === 'special' && card.ability === 'decoy') {
    reasons.push('诱饵可回收己方非英雄单位，用于再次触发技能或调整战力布局');
  }
  if (card.type === 'special' && card.ability === 'weather_frost') {
    reasons.push('霜冻将近战排非英雄单位降为1点，有效削弱对方近战集群');
  }
  if (card.type === 'special' && card.ability === 'weather_fog') {
    reasons.push('浓雾将远程排非英雄单位降为1点，克制远程射手阵型');
  }
  if (card.type === 'special' && card.ability === 'weather_rain') {
    reasons.push('暴雨将攻城排非英雄单位降为1点，克制攻城器械阵型');
  }
  if (card.type === 'special' && card.ability === 'clear_weather') {
    reasons.push('晴天清除所有天气效果，恢复我方被天气压制的战力');
  }

  const scoreGap = p.score - opp.score;
  if (card.power > 7 && scoreGap < -10) {
    reasons.push('我方大比分落后，用高战力牌缩小差距是当务之急');
  }
  if (scoreGap > 10 && p.hand.length <= 3) {
    reasons.push('我方领先且手牌不多，稳固优势保持到本局结束');
  }
  if (opp.passed && scoreGap < 0) {
    reasons.push('对方已放弃但仍领先，需要继续出牌追回分数');
  }

  if (reasons.length === 0) {
    reasons.push('根据当前形势选择最优出牌方案');
  }

  output += '。' + reasons.join('。');

  const winnerId = game.gameWinner || game.roundWinner;
  if (winnerId === playerId) {
    if (p.roundsWon >= (opp.roundsWon + 1)) {
      output += ' 这手牌为最终的胜利奠定了基础。';
    }
  }

  return output;
}

// ═══════════════════════════════════════════
// TrainingRecorder 类
// ═══════════════════════════════════════════

const INSTRUCTION = '你是一位资深的《巫师3》昆特牌对战专家，精通资源博弈、阵营克制和战术决策。请根据玩家描述的具体对战局面，给出最优的操作建议。';

class TrainingRecorder {
  /**
   * @param {string} outputPath - 训练数据输出文件路径
   */
  constructor(outputPath) {
    this.outputPath = outputPath || DEFAULT_OUTPUT;
    // 每个 gameId -> snapshots[]
    this._gameSnapshots = new Map();
  }

  /**
   * 记录一次出牌前的快照
   * @param {GameState} game - 当前游戏状态
   * @param {string} playerId - 出牌玩家ID
   * @param {object} card - 打出的卡牌对象
   * @param {string} row - 目标排 (melee/ranged/siege)
   * @param {string|null} targetCardId - 可选目标卡牌ID
   */
  recordSnapshot(game, playerId, card, row, targetCardId = null) {
    if (!game || game.status !== 'playing') return;

    const opponentId = game.getOpponentId(playerId);
    const stateDesc = buildStateDescription(game, playerId, opponentId);

    let snapshots = this._gameSnapshots.get(game.gameId);
    if (!snapshots) {
      snapshots = [];
      this._gameSnapshots.set(game.gameId, snapshots);
    }

    snapshots.push({
      stateDesc,
      playerId,
      opponentId,
      card,
      row: row || card.row || 'melee',
      targetCardId,
    });
  }

  /**
   * 对局结束时调用，将胜方出牌记录写入训练数据文件
   * @param {GameState} game - 已结束的游戏状态
   */
  onGameEnd(game) {
    const snapshots = this._gameSnapshots.get(game.gameId);
    if (!snapshots || snapshots.length === 0) return;

    this._gameSnapshots.delete(game.gameId);

    const winnerId = game.gameWinner;
    if (!winnerId) return; // 平局跳过

    const entries = [];
    for (const snap of snapshots) {
      if (snap.playerId !== winnerId) continue;

      const output = buildActionDescription(
        game, snap.playerId, snap.opponentId, snap.card,
        { row: snap.row, targetCardId: snap.targetCardId }
      );

      entries.push({
        instruction: INSTRUCTION,
        input: snap.stateDesc + ' 我该怎么办？',
        output,
      });
    }

    if (entries.length === 0) return;

    // ── 增量写入：读取已有数据 → 合并 → 写回 ──
    this._appendToFile(entries);
  }

  /**
   * 将所有游戏快照直接转为训练数据条目（用于 AI 对战批量收集）
   * @param {GameState} game - 已结束的游戏
   * @returns {object[]} 训练数据条目数组
   */
  collectEntries(game) {
    const snapshots = this._gameSnapshots.get(game.gameId);
    if (!snapshots || snapshots.length === 0) return [];

    this._gameSnapshots.delete(game.gameId);

    const winnerId = game.gameWinner;
    if (!winnerId) return [];

    const entries = [];
    for (const snap of snapshots) {
      if (snap.playerId !== winnerId) continue;

      const output = buildActionDescription(
        game, snap.playerId, snap.opponentId, snap.card,
        { row: snap.row, targetCardId: snap.targetCardId }
      );

      entries.push({
        instruction: INSTRUCTION,
        input: snap.stateDesc + ' 我该怎么办？',
        output,
      });
    }

    return entries;
  }

  /**
   * 内部：追加条目到 JSON 文件
   */
  _appendToFile(newEntries) {
    let existing = [];
    try {
      if (fs.existsSync(this.outputPath)) {
        const raw = fs.readFileSync(this.outputPath, 'utf-8');
        if (raw.trim()) {
          existing = JSON.parse(raw);
        }
      }
    } catch (err) {
      console.error('读取训练数据文件失败:', err.message);
    }

    existing.push(...newEntries);

    try {
      fs.writeFileSync(this.outputPath, JSON.stringify(existing, null, 2), 'utf-8');
    } catch (err) {
      console.error('写入训练数据文件失败:', err.message);
    }
  }

  /**
   * 获取指定游戏的快照数
   */
  snapshotCount(gameId) {
    const s = this._gameSnapshots.get(gameId);
    return s ? s.length : 0;
  }
}

module.exports = {
  TrainingRecorder,
  buildStateDescription,
  buildActionDescription,
  describeCard,
  describeRow,
  INSTRUCTION,
};
