/**
 * 昆特牌游戏逻辑层 —— 单元测试
 * 覆盖 cards.js / gameState.js / gameManager.js
 */

// Mock 数据库工具，避免测试时写真实数据库
jest.mock('../db/dbUtils', () => ({
  saveMatch: jest.fn().mockResolvedValue(1),
}));

const { Card, allCards, n, neu, sp, g, s, m, starterDeck } = require('../gameLogic/cards');
const GameState = require('../gameLogic/gameState');
const GameManager = require('../gameLogic/gameManager');
const dbUtils = require('../db/dbUtils');

// ==================== cards.js 测试 ====================
describe('Card 模块 (cards.js)', () => {
  describe('Card 类', () => {
    test('应该正确创建卡牌实例', () => {
      const card = new Card('c1', '测试卡', 'unit', 8, 'northern', 'melee', 'test_ability', null);
      expect(card.id).toBe('c1');
      expect(card.name).toBe('测试卡');
      expect(card.type).toBe('unit');
      expect(card.power).toBe(8);
      expect(card.faction).toBe('northern');
      expect(card.row).toBe('melee');
      expect(card.ability).toBe('test_ability');
      expect(card.heroAbility).toBeNull();
    });

    test('ability 默认为 null', () => {
      const card = new Card('c2', '无技能卡', 'unit', 3, 'neutral');
      expect(card.ability).toBeNull();
    });

    test('type 应支持 unit / special / leader', () => {
      const unit = new Card('u1', '单位', 'unit', 5, 'neutral', 'melee', null, null);
      const special = new Card('s1', '特殊', 'special', 0, 'neutral', null, 'weather_frost', null);
      const leader = new Card('l1', '领袖', 'leader', 0, 'faction', null, null, null);
      expect(unit.type).toBe('unit');
      expect(special.type).toBe('special');
      expect(leader.type).toBe('leader');
    });
  });

  describe('allCards 预定义卡牌库', () => {
    test('应包含 4 个阵营 + 中立 + 特殊', () => {
      expect(n).toBeDefined(); // 北方领域
      expect(g).toBeDefined(); // 尼弗迦德
      expect(s).toBeDefined(); // 松鼠党
      expect(m).toBeDefined(); // 怪物
      expect(neu).toBeDefined(); // 中立
      expect(sp).toBeDefined(); // 特殊
    });

    test('北方领域 瑞达尼亚步兵团 属性正确', () => {
      const card = n['瑞达尼亚步兵团'];
      expect(card.name).toBe('瑞达尼亚步兵团');
      expect(card.type).toBe('unit');
      expect(card.power).toBe(2);
      expect(card.faction).toBe('northern');
      expect(card.row).toBe('melee');
    });

    test('杰洛特是中立英雄单位', () => {
      const card = neu['杰洛特'];
      expect(card.name).toBe('杰洛特');
      expect(card.type).toBe('unit');
      expect(card.power).toBe(15);
      expect(card.faction).toBe('neutral');
      expect(card.isHero).toBe(true);
    });

    test('霜冻是特殊牌', () => {
      const card = sp['霜冻'];
      expect(card.name).toBe('霜冻');
      expect(card.type).toBe('special');
      expect(card.power).toBe(0);
      expect(card.ability).toBe('weather_frost');
    });
  });

  describe('starterDeck 预设卡组', () => {
    test('应包含 32 张牌', () => {
      expect(starterDeck).toHaveLength(32);
    });

    test('应包含杰洛特(英雄)和特殊牌', () => {
      const names = starterDeck.map(c => c.name);
      expect(names.filter(n => n === '杰洛特')).toHaveLength(1);
      expect(names.filter(n => n === '霜冻')).toHaveLength(1);
      expect(names.filter(n => n === '晴天')).toHaveLength(1);
      expect(names.filter(n => n === '烧灼')).toHaveLength(1);
      expect(names.filter(n => n === '诱饵')).toHaveLength(1);
      expect(names.filter(n => n === '指挥号角')).toHaveLength(2);
    });
  });
});

// ==================== gameState.js 测试 ====================
describe('GameState 模块 (gameState.js)', () => {
  let gameState;

  beforeEach(() => {
    gameState = new GameState('p1', 'p2');
  });

  describe('构造函数', () => {
    test('应生成唯一的 gameId', () => {
      const gs2 = new GameState('a', 'b');
      expect(gameState.gameId).not.toBe(gs2.gameId);
      expect(gameState.gameId).toMatch(/^\d+-[a-z0-9]+$/);
    });

    test('应为两名玩家创建正确的初始结构', () => {
      ['p1', 'p2'].forEach(pid => {
        const p = gameState.players[pid];
        expect(p.id).toBe(pid);
        expect(p.deck).toEqual([]);
        expect(p.hand).toEqual([]);
        expect(p.graveyard).toEqual([]);
        expect(p.melee).toEqual([]);
        expect(p.ranged).toEqual([]);
        expect(p.siege).toEqual([]);
        expect(p.leader).toBeNull();
        expect(p.score).toBe(0);
        expect(p.passed).toBe(false);
      });
    });

    test('初始状态值正确', () => {
      expect(gameState.currentRound).toBe(1);
      expect(gameState.activePlayer).toBeNull();
      expect(gameState.roundWinner).toBeNull();
      expect(gameState.gameWinner).toBeNull();
      expect(gameState.status).toBe('waiting');
    });
  });

  describe('getBattlefieldUnits', () => {
    test('应返回近战 + 远程 + 攻城排所有单位', () => {
      gameState.players['p1'].melee = [{ name: '步兵', power: 4 }];
      gameState.players['p1'].ranged = [{ name: '弓箭手', power: 6 }];
      gameState.players['p1'].siege = [{ name: '投石机', power: 8 }];
      const units = gameState.getBattlefieldUnits('p1');
      expect(units).toHaveLength(3);
      expect(units.map(u => u.power)).toEqual([4, 6, 8]);
    });

    test('战场为空时应返回空数组', () => {
      expect(gameState.getBattlefieldUnits('p1')).toEqual([]);
    });
  });

  describe('calculateScore', () => {
    test('应正确汇总所有战场单位战力', () => {
      gameState.players['p1'].melee = [{ name: 'A', power: 5 }, { name: 'B', power: 3 }];
      gameState.players['p1'].ranged = [{ name: 'C', power: 7 }];
      gameState.players['p1'].siege = [];
      expect(gameState.calculateScore('p1')).toBe(15);
    });

    test('战场为空时分数为 0', () => {
      expect(gameState.calculateScore('p1')).toBe(0);
    });
  });

  describe('updateScores', () => {
    test('应同时更新双方玩家的分数', () => {
      gameState.players['p1'].melee = [{ name: 'A', power: 10 }];
      gameState.players['p2'].melee = [{ name: 'B', power: 5 }, { name: 'C', power: 3 }];
      gameState.updateScores();
      expect(gameState.players['p1'].score).toBe(10);
      expect(gameState.players['p2'].score).toBe(8);
    });
  });

  describe('isRoundOver', () => {
    test('双方都 passed 时应结束', () => {
      gameState.players['p1'].passed = true;
      gameState.players['p2'].passed = true;
      expect(gameState.isRoundOver()).toBe(true);
    });

    test('双方手牌都为空时应结束', () => {
      gameState.players['p1'].hand = [];
      gameState.players['p2'].hand = [];
      expect(gameState.isRoundOver()).toBe(true);
    });

    test('仅一方 passed 且另一方有牌时不应结束', () => {
      gameState.players['p1'].passed = true;
      gameState.players['p2'].hand = [{ name: 'A', power: 5 }];
      expect(gameState.isRoundOver()).toBe(false);
    });

    test('仅一方手牌为空时不应结束', () => {
      gameState.players['p1'].hand = [];
      gameState.players['p2'].hand = [{ name: 'A', power: 5 }];
      expect(gameState.isRoundOver()).toBe(false);
    });
  });

  describe('getRoundWinner', () => {
    test('p1 分数高时返回 p1', () => {
      gameState.players['p1'].score = 20;
      gameState.players['p2'].score = 10;
      expect(gameState.getRoundWinner()).toBe('p1');
    });

    test('p2 分数高时返回 p2', () => {
      gameState.players['p1'].score = 8;
      gameState.players['p2'].score = 15;
      expect(gameState.getRoundWinner()).toBe('p2');
    });

    test('分数相同时返回 null (平局)', () => {
      gameState.players['p1'].score = 12;
      gameState.players['p2'].score = 12;
      expect(gameState.getRoundWinner()).toBeNull();
    });
  });

  describe('resetForNextRound', () => {
    test('应清空双方战场并重置 passed', () => {
      gameState.players['p1'].melee = [{ name: 'A', power: 3 }];
      gameState.players['p1'].ranged = [{ name: 'B', power: 5 }];
      gameState.players['p1'].passed = true;
      gameState.players['p2'].siege = [{ name: 'C', power: 8 }];
      gameState.players['p2'].passed = true;

      gameState.resetForNextRound();

      ['p1', 'p2'].forEach(pid => {
        const p = gameState.players[pid];
        expect(p.melee).toEqual([]);
        expect(p.ranged).toEqual([]);
        expect(p.siege).toEqual([]);
        expect(p.passed).toBe(false);
      });
    });

    test('应将当前回合数 +1', () => {
      expect(gameState.currentRound).toBe(1);
      gameState.resetForNextRound();
      expect(gameState.currentRound).toBe(2);
      gameState.resetForNextRound();
      expect(gameState.currentRound).toBe(3);
    });

    test('应更新双方分数为 0', () => {
      gameState.players['p1'].melee = [{ name: 'A', power: 10 }];
      gameState.updateScores();
      gameState.resetForNextRound();
      expect(gameState.players['p1'].score).toBe(0);
      expect(gameState.players['p2'].score).toBe(0);
    });
  });
});

// ==================== gameManager.js 测试 ====================
describe('GameManager 模块 (gameManager.js)', () => {
  let manager;

  beforeEach(() => {
    manager = new GameManager();
  });

  describe('构造函数', () => {
    test('应初始化空的 activeGames Map', () => {
      expect(manager.activeGames).toBeInstanceOf(Map);
      expect(manager.activeGames.size).toBe(0);
    });
  });

  describe('copyDeck', () => {
    test('应返回新数组（不修改原始数组）', () => {
      const original = [{ name: 'A', power: 5 }];
      const copied = manager.copyDeck(original);
      copied[0].power = 99;
      expect(original[0].power).toBe(5);
    });

    test('应复制所有卡牌属性', () => {
      const card = new Card('t1', '测试', 'unit', 7, 'neutral', 'melee', null, null);
      const deck = [card];
      const copied = manager.copyDeck(deck);
      expect(copied[0]).toMatchObject({
        id: 't1', name: '测试', type: 'unit', power: 7, faction: 'neutral',
      });
    });
  });

  describe('shuffleAndDraw', () => {
    test('应从牌组中抽取手牌', () => {
      const player = {
        deck: manager.copyDeck(starterDeck),
        hand: [],
      };
      manager.shuffleAndDraw(player);
      expect(player.hand.length).toBeGreaterThan(0);
    });

    test('抽牌后牌组应减少', () => {
      const player = {
        deck: manager.copyDeck(starterDeck),
        hand: [],
      };
      const deckBefore = player.deck.length;
      manager.shuffleAndDraw(player);
      expect(player.deck.length).toBeLessThan(deckBefore);
      expect(player.hand.length + player.deck.length).toBe(deckBefore);
    });

    test('牌组不足 10 张时应抽出全部', () => {
      const player = {
        deck: [{ name: 'A', power: 1 }, { name: 'B', power: 2 }],
        hand: [],
      };
      manager.shuffleAndDraw(player);
      expect(player.hand).toHaveLength(2);
      expect(player.deck).toHaveLength(0);
    });
  });

  describe('createGame', () => {
    let game;

    beforeEach(() => {
      game = manager.createGame('playerA', 'playerB');
    });

    test('应返回 GameState 实例', () => {
      expect(game).toBeInstanceOf(GameState);
    });

    test('应将游戏存入 activeGames', () => {
      expect(manager.activeGames.has(game.gameId)).toBe(true);
      expect(manager.activeGames.get(game.gameId)).toBe(game);
    });

    test('双方应有初始化的卡组', () => {
      ['playerA', 'playerB'].forEach(pid => {
        expect(game.players[pid].deck).toBeInstanceOf(Array);
        expect(game.players[pid].hand).toBeInstanceOf(Array);
        expect(game.players[pid].hand.length).toBeGreaterThan(0);
      });
    });

    test('应设置活跃玩家', () => {
      expect(['playerA', 'playerB']).toContain(game.activePlayer);
      expect(game.activePlayer).not.toBeNull();
    });

    test('游戏状态应为 playing', () => {
      expect(game.status).toBe('playing');
    });

    test('手牌数 + 牌组数应等于初始牌组总数', () => {
      // playerA 使用 starterDeck (32张), playerB 使用 aiDefaultDeck (34张)
      expect(game.players['playerA'].hand.length + game.players['playerA'].deck.length).toBe(32);
      expect(game.players['playerB'].hand.length + game.players['playerB'].deck.length).toBe(34);
    });

    test('多次创建的游戏应有不同 gameId', () => {
      const game2 = manager.createGame('x', 'y');
      expect(game.gameId).not.toBe(game2.gameId);
    });
  });

  describe('getClientGameState', () => {
    let game;

    beforeEach(() => {
      game = manager.createGame('alice', 'bob');
    });

    test('不存在的游戏应返回 null', () => {
      expect(manager.getClientGameState('nonexistent', 'alice')).toBeNull();
    });

    test('应返回正确的 gameId 和 currentRound', () => {
      const state = manager.getClientGameState(game.gameId, 'alice');
      expect(state.gameId).toBe(game.gameId);
      expect(state.currentRound).toBe(1);
      expect(state.status).toBe('playing');
    });

    test('应返回 myself 的手牌信息', () => {
      const state = manager.getClientGameState(game.gameId, 'alice');
      expect(state.myself).toBeDefined();
      expect(state.myself.id).toBe('alice');
      expect(state.myself.hand).toBeDefined();
      expect(state.myself.hand.length).toBeGreaterThan(0);
      expect(state.myself.melee).toEqual([]);
      expect(state.myself.ranged).toEqual([]);
      expect(state.myself.siege).toEqual([]);
      expect(state.myself.score).toBe(0);
      expect(state.myself.passed).toBe(false);
      expect(state.myself.roundsWon).toBe(0);
    });

    test('应隐藏对手手牌内容，仅暴露 handCount', () => {
      const state = manager.getClientGameState(game.gameId, 'alice');
      expect(state.opponent.hand).toBeUndefined();
      expect(state.opponent.handCount).toBeDefined();
      expect(typeof state.opponent.handCount).toBe('number');
    });

    test('应正确识别对手的战场数据', () => {
      const state = manager.getClientGameState(game.gameId, 'alice');
      expect(state.opponent.id).toBe('bob');
      expect(state.opponent.melee).toEqual([]);
      expect(state.opponent.ranged).toEqual([]);
      expect(state.opponent.siege).toEqual([]);
      expect(state.opponent.score).toBe(0);
      expect(state.opponent.roundsWon).toBe(0);
    });
  });

  describe('playCard (出牌)', () => {
    test('应能从手牌打出一张卡到近战排', () => {
      const game = manager.createGame('p1', 'p2');
      const activePlayer = game.activePlayer;
      const player = game.players[activePlayer];
      // 找到一张可放 melee 的单位牌
      const card = player.hand.find(c => c.type === 'unit' && (!c.row || c.row === 'melee'));
      const cardToPlay = card || player.hand[0];
      const idx = player.hand.indexOf(cardToPlay);
      const handCountBefore = player.hand.length;

      const result = manager.playCard(game.gameId, activePlayer, idx, 'melee');
      expect(result.success).toBe(true);
      expect(result.gameState).toBeDefined();
      expect(player.melee.length).toBeGreaterThanOrEqual(1);
      if (player.melee.length > 0) {
        expect(player.melee[0]).toMatchObject({ name: cardToPlay.name, power: cardToPlay.power });
      }
      expect(player.hand.length).toBe(handCountBefore - 1);
    });

    test('应能从手牌打出一张卡到远程排', () => {
      const game = manager.createGame('p1', 'p2');
      const activePlayer = game.activePlayer;
      // 找到一张可以放远程排的卡（row 为 ranged 或 null 的）
      const hand = game.players[activePlayer].hand;
      const cardIndex = hand.findIndex(c => !c.row || c.row === 'ranged');
      const idx = cardIndex >= 0 ? cardIndex : 0;

      const result = manager.playCard(game.gameId, activePlayer, idx, 'ranged');
      expect(result.success).toBe(true);
      expect(result.gameState).toBeDefined();
      expect(game.players[activePlayer].ranged.length).toBeGreaterThanOrEqual(1);
    });

    test('非当前行动玩家不能出牌', () => {
      const game = manager.createGame('p1', 'p2');
      const inactivePlayer = game.activePlayer === 'p1' ? 'p2' : 'p1';

      const result = manager.playCard(game.gameId, inactivePlayer, 0, 'melee');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('已放弃跟牌的玩家不能出牌', () => {
      const game = manager.createGame('p1', 'p2');
      const ap = game.activePlayer;
      game.players[ap].passed = true;

      const result = manager.playCard(game.gameId, ap, 0, 'melee');
      expect(result.success).toBe(false);
      expect(result.error).toContain('放弃跟牌');
    });

    test('出牌后应切换到对方回合', () => {
      const game = manager.createGame('p1', 'p2');
      const originalActive = game.activePlayer;
      // 找到一张 row 兼容 melee 的卡
      const hand = game.players[originalActive].hand;
      const card = hand.find(c => !c.row || c.row === 'melee');
      const idx = hand.indexOf(card);

      manager.playCard(game.gameId, originalActive, idx >= 0 ? idx : 0, 'melee');
      const newActive = game.activePlayer;
      expect(newActive).not.toBe(originalActive);
      expect(['p1', 'p2']).toContain(newActive);
    });

    test('无效的卡牌索引应返回错误', () => {
      const game = manager.createGame('p1', 'p2');
      const activePlayer = game.activePlayer;

      const result = manager.playCard(game.gameId, activePlayer, 99, 'melee');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('无效的排类型应返回错误', () => {
      const game = manager.createGame('p1', 'p2');
      const activePlayer = game.activePlayer;
      // 找到一张单位牌（特殊牌不校验 row）
      const hand = game.players[activePlayer].hand;
      const cardIdx = hand.findIndex(c => c.type === 'unit');
      const idx = cardIdx >= 0 ? cardIdx : 0;

      const result = manager.playCard(game.gameId, activePlayer, idx, 'invalid_row');
      expect(result.success).toBe(false);
    });
  });

  describe('passTurn (放弃跟牌)', () => {
    let game, activePlayer;

    beforeEach(() => {
      game = manager.createGame('p1', 'p2');
      activePlayer = game.activePlayer;
    });

    test('应设置当前玩家 passed = true', () => {
      const result = manager.passTurn(game.gameId, activePlayer);
      expect(result.success).toBe(true);
      expect(result.gameState).toBeDefined();
      expect(game.players[activePlayer].passed).toBe(true);
    });

    test('非当前行动玩家不能 pass', () => {
      const inactive = activePlayer === 'p1' ? 'p2' : 'p1';
      const result = manager.passTurn(game.gameId, inactive);
      expect(result.success).toBe(false);
    });

    test('已经 pass 的玩家不能再次 pass', () => {
      manager.passTurn(game.gameId, activePlayer);
      // 对方行动后切回来
      const other = game.activePlayer;
      manager.passTurn(game.gameId, other); // 触发双方 pass → 自动 endRound
      expect(game.players[activePlayer].passed).toBe(true);
      // 此时游戏已 roundEnd，再次 pass 应被拒绝
      const result = manager.passTurn(game.gameId, activePlayer);
      expect(result.success).toBe(false);
    });

    test('pass 后应切换到对方回合', () => {
      manager.passTurn(game.gameId, activePlayer);
      expect(game.activePlayer).not.toBe(activePlayer);
    });
  });

  describe('完整小局流程', () => {
    test('双方 pass 后小局应结束并自动结算', () => {
      const game = manager.createGame('p1', 'p2');
      const firstActive = game.activePlayer;
      const secondActive = firstActive === 'p1' ? 'p2' : 'p1';

      manager.passTurn(game.gameId, firstActive);
      manager.passTurn(game.gameId, secondActive);

      expect(game.isRoundOver()).toBe(true);
      // 自动结算后状态应为 roundEnd（无人 2 胜）
      expect(game.status).toBe('roundEnd');
    });

    test('双方手牌打完也应结束小局', () => {
      const game = manager.createGame('p1', 'p2');

      // 双方交替出完所有手牌，使用卡牌自身的 row 或默认 melee
      let safety = 0;
      while (game.status === 'playing' && (game.players['p1'].hand.length > 0 || game.players['p2'].hand.length > 0)) {
        const ap = game.activePlayer;
        if (game.players[ap].hand.length > 0) {
          const card = game.players[ap].hand[0];
          const row = card.row || 'melee';
          manager.playCard(game.gameId, ap, 0, row);
        } else {
          manager.passTurn(game.gameId, ap);
        }
        safety++;
        if (safety > 100) break;
      }

      expect(game.isRoundOver()).toBe(true);
    });
  });

  describe('小局自动结算', () => {
    test('双方 pass 后自动触发 endRound 并记录胜场', () => {
      const game = manager.createGame('p1', 'p2');
      const firstActive = game.activePlayer;
      const secondActive = firstActive === 'p1' ? 'p2' : 'p1';

      // 先手出一张可放 melee 的牌获得战力优势
      const hand = game.players[firstActive].hand;
      const card = hand.find(c => c.type === 'unit' && (!c.row || c.row === 'melee'));
      const idx = hand.indexOf(card);
      manager.playCard(game.gameId, firstActive, idx >= 0 ? idx : 0, 'melee');
      // 后手 pass
      manager.passTurn(game.gameId, secondActive);
      // 先手也 pass → 触发自动结算
      manager.passTurn(game.gameId, firstActive);

      expect(game.isRoundOver()).toBe(true);
      expect(game.status).toBe('roundEnd');
      expect(game.roundWinner).toBeDefined();
      expect([firstActive, secondActive]).toContain(game.roundWinner);

      // 胜场已记录
      const winner = game.players[game.roundWinner];
      expect(winner.roundsWon).toBeGreaterThanOrEqual(1);
    });

    test('handleRoundEnd 对已结算的小局幂等返回', () => {
      const game = manager.createGame('p1', 'p2');
      const firstActive = game.activePlayer;
      const secondActive = firstActive === 'p1' ? 'p2' : 'p1';

      const hand = game.players[firstActive].hand;
      const card = hand.find(c => c.type === 'unit' && (!c.row || c.row === 'melee'));
      const idx = hand.indexOf(card);
      manager.playCard(game.gameId, firstActive, idx >= 0 ? idx : 0, 'melee');
      manager.passTurn(game.gameId, secondActive);
      manager.passTurn(game.gameId, firstActive); // 自动结算

      // 再次手动调用 handleRoundEnd，应幂等
      const result = manager.handleRoundEnd(game.gameId);
      expect(result.success).toBe(true);
      expect(result.roundWinner).toBe(game.roundWinner);
      expect(result.status).toBe('roundEnd');
    });
  });

  describe('handleGameEnd (整局结算)', () => {
    test('先赢2局的玩家获得整局胜利', () => {
      const game = manager.createGame('p1', 'p2');

      // 模拟 p1 连赢 2 局
      game.players['p1'].roundsWon = 2;
      game.players['p2'].roundsWon = 0;

      const result = manager.checkGameWinner(game.gameId);
      expect(result).toBe('p1');
      expect(game.gameWinner).toBe('p1');
      expect(game.status).toBe('gameEnd');
    });

    test('打到第3局才分出胜负', () => {
      const game = manager.createGame('p1', 'p2');
      game.currentRound = 3;
      game.players['p1'].roundsWon = 1;
      game.players['p2'].roundsWon = 1;

      // 模拟 p2 赢第 3 局
      game.players['p2'].roundsWon = 2;

      const result = manager.checkGameWinner(game.gameId);
      expect(result).toBe('p2');
    });

    test('无人达到2胜时返回 null', () => {
      const game = manager.createGame('p1', 'p2');
      game.players['p1'].roundsWon = 1;
      game.players['p2'].roundsWon = 0;

      const result = manager.checkGameWinner(game.gameId);
      expect(result).toBeNull();
    });
  });

  describe('getOpponentId (获取对手ID)', () => {
    test('应返回正确的对手ID', () => {
      const game = manager.createGame('alice', 'bob');
      expect(manager.getOpponentId(game.gameId, 'alice')).toBe('bob');
      expect(manager.getOpponentId(game.gameId, 'bob')).toBe('alice');
    });

    test('不存在的游戏应返回 null', () => {
      expect(manager.getOpponentId('nonexistent', 'alice')).toBeNull();
    });
  });

  describe('特殊牌处理', () => {
    test('special 类型卡牌不进入战场排', () => {
      const game = manager.createGame('p1', 'p2');
      const ap = game.activePlayer;
      const player = game.players[ap];

      // 手动放入一张特殊牌到手牌
      player.hand.unshift({ id: 'sp1', name: '天气:霜冻', type: 'special', power: 0, faction: 'neutral', ability: 'weather_frost' });

      const result = manager.playCard(game.gameId, ap, 0, 'melee');
      expect(result.success).toBe(true);
      // 特殊牌不应出现在任何排中
      expect(player.melee).toHaveLength(0);
      expect(player.ranged).toHaveLength(0);
      expect(player.siege).toHaveLength(0);
    });
  });

  describe('重置进入下一轮', () => {
    test('小局结束后可手动重置进入下一轮', () => {
      const game = manager.createGame('p1', 'p2');
      const firstActive = game.activePlayer;
      const secondActive = firstActive === 'p1' ? 'p2' : 'p1';

      const hand = game.players[firstActive].hand;
      const card = hand.find(c => c.type === 'unit' && (!c.row || c.row === 'melee'));
      const idx = hand.indexOf(card);
      manager.playCard(game.gameId, firstActive, idx >= 0 ? idx : 0, 'melee');
      manager.passTurn(game.gameId, secondActive);
      manager.passTurn(game.gameId, firstActive);

      expect(game.status).toBe('roundEnd');

      game.resetForNextRound();
      expect(game.currentRound).toBe(2);
      expect(game.status).toBe('roundEnd'); // resetForNextRound 不改 status
      game.status = 'playing';
      expect(game.players['p1'].melee).toEqual([]);
      expect(game.players['p1'].passed).toBe(false);
    });
  });

  describe('数据库持久化 (_saveMatchToDB)', () => {
    beforeEach(() => {
      dbUtils.saveMatch.mockClear();
    });

    test('AI 对局结束时调用 saveMatch', async () => {
      const game = manager.createGame('human1', 'ai_123');

      // 让 human 已赢 1 局，且当前小局 human 分数更高
      game.players['human1'].roundsWon = 1;
      game.players['ai_123'].roundsWon = 0;
      game.players['human1'].passed = true;
      game.players['ai_123'].passed = true;

      // human 战场有牌，确保本轮 human 获胜
      game.players['human1'].melee = [{ ...n['瑞达尼亚步兵团'] }]; // 2 战力
      game.updateScores(); // 刷新分数

      manager.endRound(game);

      expect(game.status).toBe('gameEnd');

      // 等待异步 DB 写入完成
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(dbUtils.saveMatch).toHaveBeenCalledTimes(1);
      expect(dbUtils.saveMatch).toHaveBeenCalledWith(
        expect.objectContaining({
          matchUuid: game.gameId,
          player1Id: 1,
          player2Id: null,
          matchType: 'vs_ai',
          roundsPlayed: game.currentRound,
        })
      );
    });

    test('小局结束（非整局）不触发 saveMatch', async () => {
      const game = manager.createGame('p1', 'p2');
      game.players['p1'].passed = true;
      game.players['p2'].passed = true;

      manager.endRound(game);

      expect(game.status).toBe('roundEnd'); // 只有 0 胜，不会 gameEnd

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(dbUtils.saveMatch).not.toHaveBeenCalled();
    });

    test('人人对战保存正确胜场数据', async () => {
      const game = manager.createGame('alice', 'bob');

      // alice 已赢 1 局，当前小局 alice 分数更高 → 第 2 胜
      game.players['alice'].roundsWon = 1;
      game.players['bob'].roundsWon = 0;
      game.currentRound = 2;
      game.players['alice'].passed = true;
      game.players['bob'].passed = true;

      // alice 战场有牌，确保本轮 alice 获胜
      game.players['alice'].melee = [{ ...n['瑞达尼亚步兵团'] }]; // 2 战力
      game.updateScores();

      manager.endRound(game);

      expect(game.status).toBe('gameEnd');
      expect(game.gameWinner).toBe('alice');

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(dbUtils.saveMatch).toHaveBeenCalledWith(
        expect.objectContaining({
          matchType: 'casual',
          player1Score: 2,
          player2Score: 0,
        })
      );
    });

    test('AI 获胜时 winnerId 为 null', async () => {
      const game = manager.createGame('human1', 'ai_789');

      // 让 AI 赢 2 局
      game.players['human1'].roundsWon = 0;
      game.players['ai_789'].roundsWon = 2;
      game.players['human1'].passed = true;
      game.players['ai_789'].passed = true;

      manager.endRound(game);

      expect(game.status).toBe('gameEnd');

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(dbUtils.saveMatch).toHaveBeenCalledWith(
        expect.objectContaining({
          winnerId: null,
          player2Score: 2,
        })
      );
    });
  });
});
