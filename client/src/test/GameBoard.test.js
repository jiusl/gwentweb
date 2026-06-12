import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import GameBoard from '../components/GameBoard';

// 构建 mock gameState 的工厂函数
function buildGameState(overrides = {}) {
  const base = {
    gameId: 'test-game-123',
    currentRound: 1,
    status: 'playing',
    activePlayer: 'player1',
    gameWinner: null,
    myself: {
      id: 'player1',
      hand: [
        { id: '001', name: '步兵', type: 'unit', power: 4 },
        { id: '002', name: '弓箭手', type: 'unit', power: 6 },
        { id: '004', name: '杰洛特', type: 'unit', power: 15 },
      ],
      melee: [{ id: '001', name: '步兵', type: 'unit', power: 4 }],
      ranged: [],
      siege: [],
      score: 4,
      passed: false,
      roundsWon: 0,
      handCount: 3,
    },
    opponent: {
      id: 'ai_123',
      melee: [{ id: '003', name: '骑士', type: 'unit', power: 10 }],
      ranged: [],
      siege: [],
      score: 10,
      passed: false,
      roundsWon: 0,
      handCount: 5,
    },
  };

  return deepMerge(base, overrides);
}

function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

function renderBoard(props = {}) {
  const defaults = {
    gameState: buildGameState(),
    isMyTurn: true,
    onPlayCard: jest.fn(),
    onPass: jest.fn(),
  };
  const merged = { ...defaults, ...props };
  return {
    ...render(
      <GameBoard
        gameState={merged.gameState}
        isMyTurn={merged.isMyTurn}
        onPlayCard={merged.onPlayCard}
        onPass={merged.onPass}
      />
    ),
    mocks: { playCard: merged.onPlayCard, pass: merged.onPass },
  };
}

// 辅助：通过 name 找到手牌按钮
function getHandCard(name) {
  return screen.getByTitle(new RegExp(name));
}

describe('GameBoard 组件', () => {
  // ============ 基础渲染 ============

  test('无 gameState 时显示加载中', () => {
    render(<GameBoard gameState={null} isMyTurn={false} onPlayCard={jest.fn()} onPass={jest.fn()} />);
    expect(screen.getByText('加载中...')).toBeInTheDocument();
  });

  test('正确渲染回合信息', () => {
    renderBoard();
    expect(screen.getByText(/Round 1/)).toBeInTheDocument();
    expect(screen.getByText(/Round \d · You/)).toBeInTheDocument();
  });

  test('对手回合时显示 Opponent', () => {
    renderBoard({ gameState: buildGameState({ activePlayer: 'ai_123' }), isMyTurn: false });
    expect(screen.getByText(/Opponent/)).toBeInTheDocument();
  });

  // ============ 手牌渲染 ============

  test('渲染所有手牌，显示卡名和战力', () => {
    renderBoard();
    // 手牌 + 战场都有"步兵"
    expect(screen.getAllByText('步兵').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('弓箭手')).toBeInTheDocument();
    expect(screen.getByText('杰洛特')).toBeInTheDocument();
    // 战力以数字 badge 显示
    expect(screen.getAllByText('4').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('6')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
  });

  test('手牌为空时显示提示', () => {
    renderBoard({
      gameState: buildGameState({ myself: { hand: [], handCount: 0 } }),
    });
    expect(screen.getByText('No cards in hand')).toBeInTheDocument();
  });

  test('手牌为 undefined 时不崩溃', () => {
    const gs = buildGameState();
    delete gs.myself.hand;
    gs.myself.handCount = 0;
    expect(() => renderBoard({ gameState: gs })).not.toThrow();
    expect(screen.getByText('No cards in hand')).toBeInTheDocument();
  });

  // ============ 战场显示 ============

  test('显示我方战场单位', () => {
    renderBoard();
    // 我方 melee 有 1 个步兵 → MiniCard 渲染名称
    const infantryElements = screen.getAllByText('步兵');
    // 手牌 + 战场 各显示"步兵"
    expect(infantryElements.length).toBeGreaterThanOrEqual(2);
  });

  test('显示对手战场单位', () => {
    renderBoard();
    expect(screen.getByText('骑士')).toBeInTheDocument();
    // "10" 出现在战力 badge 和对手分数两处
    expect(screen.getAllByText('10').length).toBeGreaterThanOrEqual(1);
  });

  test('空战场显示"—"', () => {
    const gs = buildGameState({
      myself: { melee: [], ranged: [], siege: [] },
      opponent: { melee: [], ranged: [], siege: [] },
    });
    renderBoard({ gameState: gs });
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBe(6);
  });

  // ============ 分数和状态 ============

  test('显示双方分数和手牌数', () => {
    renderBoard();
    expect(screen.getByText('我')).toBeInTheDocument();
    expect(screen.getByText(/AI 对手/)).toBeInTheDocument();
    expect(screen.getByText('3 cards')).toBeInTheDocument();
    expect(screen.getByText('5 cards')).toBeInTheDocument();
    // 分数数字可能出现在多处（手牌战力、战场单位），用 getAllByText
    expect(screen.getAllByText('4').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('10').length).toBeGreaterThanOrEqual(1);
  });

  test('已放弃跟牌时显示 PASSED', () => {
    const gs = buildGameState({
      myself: { passed: true },
      opponent: { passed: true },
    });
    renderBoard({ gameState: gs });
    const badges = screen.getAllByText('PASSED');
    expect(badges.length).toBe(2);
  });

  // ============ 交互 - 出牌 (两步流程) ============

  test('点击手牌选中后显示排选择器', () => {
    renderBoard();
    fireEvent.click(getHandCard('步兵'));

    // 排选择器出现
    expect(screen.getByText(/Place/)).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    // 排按钮（在 selector 容器内，与战场行标签重复）
    const selector = screen.getByText(/Place/).closest('.glass-card');
    expect(within(selector).getByText('⚔️ 近战')).toBeInTheDocument();
    expect(within(selector).getByText('🏹 远程')).toBeInTheDocument();
    expect(within(selector).getByText('🏰 攻城')).toBeInTheDocument();
  });

  // 辅助：获取排选择器容器
  function getRowSelector() {
    return screen.getByText(/Place/).closest('.glass-card');
  }

  test('选中牌后点击排按钮调用 onPlayCard 并清除选择', () => {
    const { mocks } = renderBoard();
    fireEvent.click(getHandCard('步兵'));
    fireEvent.click(within(getRowSelector()).getByText('⚔️ 近战'));
    expect(mocks.playCard).toHaveBeenCalledWith(0, 'melee');
    expect(screen.queryByText(/Place/)).not.toBeInTheDocument();
  });

  test('选中牌后点击远程排调用 onPlayCard', () => {
    const { mocks } = renderBoard();
    fireEvent.click(getHandCard('步兵'));
    fireEvent.click(within(getRowSelector()).getByText('🏹 远程'));
    expect(mocks.playCard).toHaveBeenCalledWith(0, 'ranged');
  });

  test('选中牌后点击攻城排调用 onPlayCard', () => {
    const { mocks } = renderBoard();
    fireEvent.click(getHandCard('步兵'));
    fireEvent.click(within(getRowSelector()).getByText('🏰 攻城'));
    expect(mocks.playCard).toHaveBeenCalledWith(0, 'siege');
  });

  test('点击 Cancel 清除选择', () => {
    const { mocks } = renderBoard();
    fireEvent.click(getHandCard('步兵'));
    expect(screen.getByText(/Place/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByText(/Place/)).not.toBeInTheDocument();
    expect(mocks.playCard).not.toHaveBeenCalled();
  });

  test('点击已选中的牌取消选择', () => {
    const { mocks } = renderBoard();
    const card = getHandCard('步兵');
    fireEvent.click(card);
    expect(screen.getByText(/Place/)).toBeInTheDocument();

    fireEvent.click(card);
    expect(screen.queryByText(/Place/)).not.toBeInTheDocument();
    expect(mocks.playCard).not.toHaveBeenCalled();
  });

  test('特殊牌直接打出无需选择排', () => {
    const gs = buildGameState({
      myself: {
        hand: [
          { id: '005', name: '天气:霜冻', type: 'special', power: 0 },
          { id: '001', name: '步兵', type: 'unit', power: 4 },
        ],
        handCount: 2,
      },
    });
    const { mocks } = renderBoard({ gameState: gs });

    fireEvent.click(getHandCard('天气:霜冻'));
    expect(mocks.playCard).toHaveBeenCalledWith(0, 'melee');
    expect(screen.queryByText(/Place/)).not.toBeInTheDocument();
  });

  test('点击第三张手牌选中后选排传递正确索引', () => {
    const { mocks } = renderBoard();
    fireEvent.click(getHandCard('杰洛特'));
    fireEvent.click(within(getRowSelector()).getByText('⚔️ 近战'));
    expect(mocks.playCard).toHaveBeenCalledWith(2, 'melee');
  });

  test('非自己回合时手牌禁用', () => {
    renderBoard({ isMyTurn: false });
    const card = getHandCard('步兵');
    expect(card).toBeDisabled();
    fireEvent.click(card);
    expect(screen.queryByText(/Place/)).not.toBeInTheDocument();
  });

  test('已放弃时手牌禁用', () => {
    const gs = buildGameState({ myself: { passed: true } });
    renderBoard({ gameState: gs });
    const card = getHandCard('步兵');
    expect(card).toBeDisabled();
    fireEvent.click(card);
    expect(screen.queryByText(/Place/)).not.toBeInTheDocument();
  });

  test('禁用状态下点击不触发 onPlayCard', () => {
    const { mocks } = renderBoard({ isMyTurn: false });
    fireEvent.click(getHandCard('步兵'));
    expect(mocks.playCard).not.toHaveBeenCalled();
  });

  // ============ 交互 - 放弃跟牌 ============

  test('点击 Pass 按钮调用 onPass', () => {
    const { mocks } = renderBoard();
    fireEvent.click(screen.getByText('Pass'));
    expect(mocks.pass).toHaveBeenCalledTimes(1);
  });

  test('非自己回合时 Pass 按钮禁用', () => {
    renderBoard({ isMyTurn: false });
    expect(screen.getByText('Pass')).toBeDisabled();
  });

  test('已放弃时 Pass 按钮禁用', () => {
    const gs = buildGameState({ myself: { passed: true } });
    renderBoard({ gameState: gs });
    expect(screen.getByText('Pass')).toBeDisabled();
  });

  // ============ 边界情况 ============

  test('对手手牌数正确显示', () => {
    const gs = buildGameState({ opponent: { handCount: 7 } });
    renderBoard({ gameState: gs });
    expect(screen.getByText('7 cards')).toBeInTheDocument();
  });

  test('分数为 0 时正确显示', () => {
    const gs = buildGameState({
      myself: { score: 0, melee: [], ranged: [], siege: [] },
      opponent: { score: 0, melee: [], ranged: [], siege: [] },
    });
    renderBoard({ gameState: gs });
    // 双方分数都是 0，都渲染为 "0"
    const zeros = screen.getAllByText('0');
    expect(zeros.length).toBe(2);
  });

  test('多单位在同一排正确渲染', () => {
    const gs = buildGameState({
      opponent: {
        melee: [
          { id: '001', name: '步兵', type: 'unit', power: 4 },
          { id: '003', name: '骑士', type: 'unit', power: 10 },
        ],
      },
    });
    renderBoard({ gameState: gs });
    const infantry = screen.getAllByText('步兵');
    const knight = screen.getAllByText('骑士');
    expect(infantry.length + knight.length).toBeGreaterThanOrEqual(3);
  });
});
