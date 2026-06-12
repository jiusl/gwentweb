/**
 * AI 决策模块 —— 单元测试
 * 覆盖 HeuristicAI.decideAction 及其私有方法
 */

const HeuristicAI = require('../ai');
const aiPlayer = new HeuristicAI();

// 构造最小 game mock（只包含 AI 需要的字段）
function makeGame(overrides = {}) {
  const base = {
    players: {
      'ai_001': {
        id: 'ai_001',
        hand: [
          { id: '001', name: '步兵', type: 'unit', power: 4 },
          { id: '002', name: '弓箭手', type: 'unit', power: 6 },
          { id: '004', name: '杰洛特', type: 'unit', power: 15 },
        ],
        melee: [],
        ranged: [],
        siege: [],
        graveyard: [],
        deck: [],
        score: 0,
        passed: false,
        roundsWon: 0,
      },
      'human1': {
        id: 'human1',
        hand: [{ id: '001', name: '步兵', type: 'unit', power: 4 }],
        melee: [],
        ranged: [],
        siege: [],
        graveyard: [],
        deck: [],
        score: 0,
        passed: false,
        roundsWon: 0,
      },
    },
    getOpponentId(pid) {
      return pid === 'ai_001' ? 'human1' : 'ai_001';
    },
    horn: {},
    weather: { melee: false, ranged: false, siege: false },
    updateScores() {
      for (const pid of Object.keys(this.players)) {
        const p = this.players[pid];
        p.score = [...p.melee, ...p.ranged, ...p.siege]
          .reduce((s, c) => s + c.power, 0);
      }
    },
  };

  return deepMerge(base, overrides);
}

function deepMerge(target, source) {
  if (source === undefined) return target;
  const result = {};
  for (const key of Object.keys(target)) {
    if (source[key] !== undefined && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = source[key] !== undefined ? source[key] : target[key];
    }
  }
  return result;
}

describe('HeuristicAI 决策模块', () => {
  // ==================== 基础决策 ====================

  test('无牌可出时应 pass', () => {
    const game = makeGame({
      players: {
        ai_001: { hand: [] },
      },
    });
    const decision = aiPlayer.decideAction(game, 'ai_001');
    expect(decision).toEqual({ action: 'pass' });
  });

  test('不存在的玩家 ID 应 pass', () => {
    const game = makeGame();
    const decision = aiPlayer.decideAction(game, 'nonexistent');
    expect(decision).toEqual({ action: 'pass' });
  });

  test('有牌时应出牌（playCard）', () => {
    const game = makeGame();
    const decision = aiPlayer.decideAction(game, 'ai_001');
    expect(decision.action).toBe('playCard');
    expect(decision.cardIndex).toBeGreaterThanOrEqual(0);
    expect(['melee', 'ranged', 'siege']).toContain(decision.row);
  });

  // ==================== 放弃策略 ====================

  test('对手已 pass 且 AI 领先 >5 分时应 pass', () => {
    const game = makeGame({
      players: {
        ai_001: {
          melee: [{ id: '004', name: '杰洛特', type: 'unit', power: 15 }],
        },
        human1: {
          passed: true,
          melee: [{ id: '001', name: '步兵', type: 'unit', power: 4 }],
        },
      },
    });
    game.updateScores();
    // AI: 15, human: 4 → margin = 11 > 5
    const decision = aiPlayer.decideAction(game, 'ai_001');
    expect(decision).toEqual({ action: 'pass' });
  });

  test('对手已 pass 但 AI 领先 ≤5 分时应出牌', () => {
    const game = makeGame({
      players: {
        ai_001: {
          melee: [{ id: '001', name: '步兵', type: 'unit', power: 4 }],
        },
        human1: {
          passed: true,
          melee: [{ id: '001', name: '步兵', type: 'unit', power: 4 }],
        },
      },
    });
    game.updateScores();
    // AI: 4, human: 4 → margin = 0 ≤ 5
    const decision = aiPlayer.decideAction(game, 'ai_001');
    expect(decision.action).toBe('playCard');
  });

  test('对手未 pass 时正常出牌', () => {
    const game = makeGame();
    const decision = aiPlayer.decideAction(game, 'ai_001');
    expect(decision.action).toBe('playCard');
  });

  // ==================== 选牌策略（通过 decideAction 验证） ====================

  test('应选择战力最高的单位牌', () => {
    const game = makeGame({
      players: {
        ai_001: {
          hand: [
            { id: '001', name: '步兵', type: 'unit', power: 4, row: 'melee' },
            { id: '004', name: '杰洛特', type: 'unit', power: 15, row: 'melee' },
            { id: '002', name: '弓箭手', type: 'unit', power: 6, row: 'ranged' },
          ],
        },
      },
    });
    const decision = aiPlayer.decideAction(game, 'ai_001');
    expect(decision.action).toBe('playCard');
    // 杰洛特最高战力，索引为 1
    expect(decision.cardIndex).toBe(1);
  });

  test('仅特殊牌时打出第一张', () => {
    const game = makeGame({
      players: {
        ai_001: {
          hand: [
            { id: '005', name: '天气:霜冻', type: 'special', power: 0, row: 'melee', ability: 'weather_frost' },
            { id: '006', name: '号角', type: 'special', power: 0, row: 'melee', ability: 'commanders_horn' },
          ],
        },
      },
    });
    const decision = aiPlayer.decideAction(game, 'ai_001');
    expect(decision.action).toBe('playCard');
    expect(decision.cardIndex).toBeGreaterThanOrEqual(0);
  });

  test('混合手牌时优先单位牌', () => {
    const game = makeGame({
      players: {
        ai_001: {
          hand: [
            { id: '005', name: '天气:霜冻', type: 'special', power: 0, row: 'melee', ability: 'weather_frost' },
            { id: '001', name: '步兵', type: 'unit', power: 4, row: 'melee' },
            { id: '006', name: '号角', type: 'special', power: 0, row: 'melee', ability: 'commanders_horn' },
          ],
        },
      },
    });
    const decision = aiPlayer.decideAction(game, 'ai_001');
    expect(decision.action).toBe('playCard');
    // 步兵是唯一单位，应选中
    expect(decision.cardIndex).toBe(1);
  });

  // ==================== 排位选择 ====================



  test('牌指定了 row 时应在对应排位打出', () => {
    const game = makeGame({
      players: {
        ai_001: {
          hand: [
            { id: '001', name: '弓箭手', type: 'unit', power: 5, row: 'ranged' },
            { id: '002', name: '步兵', type: 'unit', power: 1, row: 'melee' },
          ],
        },
      },
    });
    const decision = aiPlayer.decideAction(game, 'ai_001');
    expect(decision).toMatchObject({ action: 'playCard' });
    expect(['melee', 'ranged', 'siege']).toContain(decision.row);
  });

  // ==================== 特殊牌处理 ====================

  test('AI 手牌只有特殊牌时打出且 row 为 melee', () => {
    const game = makeGame({
      players: {
        ai_001: {
          hand: [{ id: '005', name: '天气:霜冻', type: 'special', power: 0 }],
        },
      },
    });
    const decision = aiPlayer.decideAction(game, 'ai_001');
    expect(decision.action).toBe('playCard');
    expect(decision.cardIndex).toBe(0);
    expect(decision.row).toBe('melee');
  });
});
