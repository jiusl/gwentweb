/**
 * 昆特牌 AI 技能库
 *
 * 技能（Skills）是高层次的策略知识片段，根据当前对局上下文
 * 动态注入到 LLM prompt 中，帮助 AI 做出更优决策。
 *
 * 技能类型：
 *   - 阵营克制（counter_faction）
 *   - 卡牌组合技（tight_bond、muster_chain）
 *   - 天气策略（weather_control）
 *   - 间谍时机（spy_timing）
 *   - 烧灼把控（scorch_timing）
 *   - 选牌策略（deck_selection）
 *   - 通用博弈（general_principles）
 */

// ═══════════════════════════════════════════
// 阵营克制映射（单一数据源）
// ═══════════════════════════════════════════

const FACTION_COUNTER = {
  northern: 'nilfgaard',
  nilfgaard: 'monsters',
  scoiatael: 'northern',
  monsters: 'northern',
};

const FACTION_COUNTER_DESC = {
  northern: 'nilfgaard（尼弗迦德）——间谍体系可打乱北方同袍节奏，医生复活保持战力',
  nilfgaard: 'monsters（怪物）——大量召集单位不怕间谍送分，霜冻破坏尼弗迦德近战集群',
  scoiatael: 'northern（北方领域）——同袍体系稳定输出，号角攻城克制松鼠党远程集群',
  monsters: 'northern（北方领域）——英雄+攻城体系不受天气影响，烧灼清理怪物群',
};

const COUNTER_FACTION_SKILLS = {
  northern: {
    name: '对阵北方领域',
    content: `【阵营克制】对手是北方领域，核心威胁：
- 同袍单位（蓝衣铁卫、巨龙猎人、投石车）叠加后战力爆炸
- 号角+攻城排是主要得分手段
对策：优先用烧灼/天气破坏其同袍集群，间谍牌打乱其手牌节奏`,
  },
  nilfgaard: {
    name: '对阵尼弗迦德',
    content: `【阵营克制】对手是尼弗迦德，核心威胁：
- 大量间谍牌会抽走你的牌库
- 年轻使者同袍体系+医生复活
对策：尽早打出高战力确立优势，间谍对抽不落下风，注意墓地中的复活目标`,
  },
  scoiatael: {
    name: '对阵松鼠党',
    content: `【阵营克制】对手是松鼠党，核心威胁：
- 远程排弓箭手同袍集群
- 矮人散兵高基础战力
- 高敏捷单位可任意排位
对策：浓雾天气针对远程排，烧灼清理同袍集群`,
  },
  monsters: {
    name: '对阵怪物',
    content: `【阵营克制】对手是怪物，核心威胁：
- 大量召集单位一次铺场
- 霜冻+食尸鬼的组合
对策：保留晴天应对天气，英雄牌不受天气影响最为稳定`,
  },
};

// ═══════════════════════════════════════════
// 卡牌组合技技能
// ═══════════════════════════════════════════

function detectCardCombos(hand) {
  const skills = [];

  // 同袍检测
  const nameCount = {};
  hand.forEach(c => { nameCount[c.name] = (nameCount[c.name] || 0) + 1; });
  const tightBondCards = Object.entries(nameCount)
    .filter(([, count]) => count >= 2)
    .map(([name]) => name);

  if (tightBondCards.length > 0) {
    skills.push({
      name: '同袍组合技',
      priority: 'high',
      content: `【同袍组合技】你手中有同名牌: ${tightBondCards.join('、')}。打出多张同名卡可触发同袍效果，战力翻倍。优先集中打出同一排。`,
    });
  }

  // 召集检测
  const musterCards = hand.filter(c => c.isMuster);
  if (musterCards.length > 0) {
    skills.push({
      name: '召集铺场',
      priority: 'high',
      content: `【召集铺场】你手中有召集牌: ${musterCards.map(c => c.name).join('、')}。打出后会从手牌和牌组拉出所有同名卡，一次性铺场建立优势。`,
    });
  }

  // 医生+高战力墓地组合
  const medicCards = hand.filter(c => c.isMedic);
  if (medicCards.length > 0) {
    skills.push({
      name: '医生复活',
      priority: 'medium',
      content: `【医生复活】你手中有医生牌: ${medicCards.map(c => c.name).join('、')}。打出后会自动复活己方墓地中战力最高的非英雄单位。注意：先用高战力单位，再用医生。`,
    });
  }

  return skills;
}

// ═══════════════════════════════════════════
// 天气策略技能
// ═══════════════════════════════════════════

function detectWeatherSkills(hand, opponentRows) {
  const skills = [];
  const weatherCards = hand.filter(c =>
    c.type === 'special' && ['weather_frost', 'weather_fog', 'weather_rain'].includes(c.ability)
  );
  const hasClear = hand.some(c => c.type === 'special' && c.ability === 'clear_weather');

  if (weatherCards.length === 0 && !hasClear) return skills;

  // 分析对方哪排单位最多
  const rowCounts = {
    melee: opponentRows.melee?.length || 0,
    ranged: opponentRows.ranged?.length || 0,
    siege: opponentRows.siege?.length || 0,
  };
  const maxRow = Object.entries(rowCounts).sort((a, b) => b[1] - a[1])[0];

  for (const wc of weatherCards) {
    const rowMap = { weather_frost: '近战', weather_fog: '远程', weather_rain: '攻城' };
    const rowName = rowMap[wc.ability];
    const rowKey = { weather_frost: 'melee', weather_fog: 'ranged', weather_rain: 'siege' }[wc.ability];
    const enemyCount = opponentRows[rowKey]?.length || 0;

    if (enemyCount >= 3) {
      skills.push({
        name: `天气压制-${rowName}`,
        priority: 'high',
        content: `【天气压制】对方${rowName}排有${enemyCount}张单位！你手中的「${wc.name}」可将其全部降为1点，收益极大。`,
      });
    } else if (enemyCount >= 1) {
      skills.push({
        name: `天气压制-${rowName}`,
        priority: 'medium',
        content: `【天气压制】对方${rowName}排有${enemyCount}张单位，你手中的「${wc.name}」可削弱其战力。注意：天气也影响我方同排单位。`,
      });
    }
  }

  if (hasClear && weatherCards.length > 0) {
    skills.push({
      name: '天气配合',
      priority: 'low',
      content: '【天气配合】你同时持有天气牌和晴天。可先用天气削弱对方（注意不能影响己方主力），后续在需要时用晴天清除。',
    });
  }

  return skills;
}

// ═══════════════════════════════════════════
// 间谍与烧灼时机技能
// ═══════════════════════════════════════════

function detectAdvancedSkills(hand, game, playerId) {
  const skills = [];
  const player = game.players[playerId];
  const oppId = game.getOpponentId(playerId);
  const opp = game.players[oppId];
  const scoreGap = player.score - opp.score;

  // 间谍时机
  const spyCards = hand.filter(c => c.isSpy);
  if (spyCards.length > 0) {
    const reason = scoreGap < -15
      ? '我方大幅落后，用间谍抽牌换手牌优势争取翻盘'
      : scoreGap < 0
        ? '我方落后，间谍可帮助追回牌差'
        : '我方领先，可用于巩固手牌优势（注意给对方送的分数）';
    skills.push({
      name: '间谍策略',
      priority: 'high',
      content: `【间谍策略】你手中有间谍牌: ${spyCards.map(c => c.name).join('、')}。打出间谍到对方场上会送${spyCards[0].power}分但为你抽2张牌。${reason}。`,
    });
  }

  // 烧灼时机
  const scorchCards = hand.filter(c =>
    (c.type === 'special' && c.ability === 'scorch') ||
    (c.isHero && c.heroAbility === 'scorch')
  );
  if (scorchCards.length > 0) {
    // 找全场最高非英雄战力
    let maxPower = 0;
    let maxOwner = null;
    for (const [pid, p] of Object.entries(game.players)) {
      for (const row of ['melee', 'ranged', 'siege']) {
        for (const c of p[row]) {
          if (!c.isHero && c.power > maxPower) {
            maxPower = c.power;
            maxOwner = pid;
          }
        }
      }
    }
    if (maxPower >= 8 && maxOwner === oppId) {
      skills.push({
        name: '烧灼时机',
        priority: 'high',
        content: `【烧灼时机】对方场上有${maxPower}点非英雄单位！你手中的烧灼牌可将其摧毁。注意：烧灼会摧毁全场所有等于该战力的单位（包括己方）。`,
      });
    } else if (maxPower >= 6) {
      skills.push({
        name: '烧灼时机',
        priority: 'medium',
        content: `【烧灼时机】当前全场最高非英雄战力为${maxPower}点。烧灼可清除高战力单位，但注意不要误伤己方。`,
      });
    }
  }

  // 号角时机
  const hornCards = hand.filter(c => c.type === 'special' && c.ability === 'commanders_horn');
  if (hornCards.length > 0) {
    // 检查各排非英雄单位数量
    const rowCounts = {};
    for (const row of ['melee', 'ranged', 'siege']) {
      rowCounts[row] = player[row].filter(c => !c.isHero).length;
    }
    const bestRow = Object.entries(rowCounts).sort((a, b) => b[1] - a[1])[0];
    if (bestRow[1] >= 3) {
      const rowCN = { melee: '近战', ranged: '远程', siege: '攻城' };
      skills.push({
        name: '号角时机',
        priority: 'high',
        content: `【号角时机】你${rowCN[bestRow[0]]}排有${bestRow[1]}张非英雄单位！打出号角可翻倍该排战力，收益极高。`,
      });
    }
  }

  return skills;
}

// ═══════════════════════════════════════════
// 通用博弈原则
// ═══════════════════════════════════════════

function getGeneralPrinciples(player, opponent, currentRound) {
  const scoreGap = player.score - opponent.score;
  const principles = ['【通用博弈原则】'];

  // 第1局策略
  if (currentRound === 1 && player.roundsWon === 0 && opponent.roundsWon === 0) {
    principles.push('- 第一局：如果领先并对手放弃，果断跟弃保留手牌优势');
    principles.push('- 第一局：如果落后较多，考虑战略性放弃保留强力手牌给后两局');
  }

  // 第2局策略
  if (currentRound === 2 && player.roundsWon === 0 && opponent.roundsWon === 1) {
    principles.push('- 你输了第一局，必须赢下这一局！全力出击');
  }
  if (currentRound === 2 && player.roundsWon === 1 && opponent.roundsWon === 0) {
    principles.push('- 你赢了第一局，这一局可以消耗对方手牌，为决胜局做准备');
  }

  // 第3局策略
  if (currentRound >= 3) {
    principles.push('- 决胜局！用尽所有资源争取胜利');
  }

  // 分数建议
  if (scoreGap > 15) {
    principles.push('- 我方大幅领先，可以考虑适时放弃保留手牌');
  } else if (scoreGap < -15) {
    principles.push('- 我方大幅落后，需要高战力牌或特殊牌扭转局面');
  }

  // 手牌管理
  if (player.hand.length <= 3 && opponent.hand.length > 5) {
    principles.push('- 你手牌少于对手，每张牌都要精打细算');
  }
  if (player.hand.length > opponent.hand.length + 3) {
    principles.push('- 你手牌优势明显，可以主动出击施压');
  }

  // 对方已放弃
  if (opponent.passed && scoreGap > 0) {
    principles.push('- 对方已放弃且你领先，直接放弃即可拿下本局');
  }

  return principles.join('\n');
}

// ═══════════════════════════════════════════
// 选牌技能（对局开始前）
// ═══════════════════════════════════════════

function getDeckSelectionSkill(opponentFaction) {
  const recommendation = FACTION_COUNTER_DESC[opponentFaction]
    || 'northern（北方领域）——通用稳定，适合各种对局';

  return `【选牌策略】对手阵营为 ${opponentFaction}。推荐选择 ${recommendation}。\n可选阵营: northern(北方领域)、nilfgaard(尼弗迦德)、scoiatael(松鼠党)、monsters(怪物)`;
}

// ═══════════════════════════════════════════
// 技能汇集入口
// ═══════════════════════════════════════════

/**
 * 根据当前游戏状态，收集所有适用的技能
 *
 * @param {object} game - 游戏状态
 * @param {string} playerId - 玩家 ID
 * @param {object} options - { opponentFaction?: string, isPreGame?: boolean }
 * @returns {string} 拼接后的技能 prompt 文本
 */
function collectSkills(game, playerId, options = {}) {
  const player = game.players[playerId];
  const oppId = game.getOpponentId(playerId);
  const opp = game.players[oppId];

  // 对局前选牌
  if (options.isPreGame && options.opponentFaction) {
    return getDeckSelectionSkill(options.opponentFaction);
  }

  const allSkills = [];

  // 1. 阵营克制
  const oppFaction = opp.faction || 'northern';
  const counterSkill = COUNTER_FACTION_SKILLS[oppFaction];
  if (counterSkill) {
    allSkills.push({ priority: 'high', ...counterSkill });
  }

  // 2. 卡牌组合技
  allSkills.push(...detectCardCombos(player.hand));

  // 3. 天气策略
  allSkills.push(...detectWeatherSkills(player.hand, { melee: opp.melee, ranged: opp.ranged, siege: opp.siege }));

  // 4. 间谍/烧灼/号角时机
  allSkills.push(...detectAdvancedSkills(player.hand, game, playerId));

  // 按优先级排序：high > medium > low
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  allSkills.sort((a, b) => (priorityOrder[a.priority] || 0) - (priorityOrder[b.priority] || 0));

  // 5. 通用原则
  const general = getGeneralPrinciples(player, opp, game.currentRound);

  // 拼接（限制数量，避免 prompt 过长）
  const maxSkills = 5;
  const selected = allSkills.slice(0, maxSkills);
  const skillTexts = selected.map(s => s.content);

  return skillTexts.join('\n\n') + '\n\n' + general;
}

/**
 * 获取阵营克制推荐（对局前使用）
 */
function getCounterFaction(opponentFaction) {
  return FACTION_COUNTER[opponentFaction] || 'northern';
}

module.exports = {
  collectSkills,
  getCounterFaction,
  getDeckSelectionSkill,
  COUNTER_FACTION_SKILLS,
  FACTION_COUNTER,
};
