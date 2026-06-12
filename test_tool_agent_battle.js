/**
 * ToolAgent 对战测试
 * 用法: node test_tool_agent_battle.js
 */
const Module = require('module');
const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request.endsWith('/db/dbUtils') || request === '../db/dbUtils') {
    return { saveMatch: () => Promise.resolve(1) };
  }
  return origLoad.apply(this, arguments);
};

const gameManager = require('./server/gameLogic/gameManager');
const { createAI } = require('./server/ai');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  console.log('🧪 ToolAgent 对战测试');
  console.log('=' .repeat(40));

  const ai1 = createAI('heuristic');
  const ai2 = createAI('tool', { model: 'qwen2.5:7b', maxRetries: 1 });

  console.log(`AI1: ${ai1.getName()} (${ai1.constructor.name})`);
  console.log(`AI2: ${ai2.getName()} (${ai2.constructor.name})`);

  const mgr = new gameManager({ enableTrainingRecorder: false });
  const game = mgr.createGame('HeuristicAI', 'ToolAgent');

  let turnCount = 0;
  while (game.status !== 'gameEnd') {
    if (game.status === 'roundEnd') {
      const result = mgr.startNextRound(game.gameId);
      if (result.gameEnded) break;
      await sleep(100);
    }

    if (game.status !== 'playing') continue;

    const activeId = game.activePlayer;
    const ai = activeId === 'HeuristicAI' ? ai1 : ai2;
    const player = game.players[activeId];

    if (player.hand.length === 0) {
      mgr.passTurn(game.gameId, activeId);
      continue;
    }

    let decision;
    try {
      decision = await ai.decideAction(game, activeId);
      turnCount++;
    } catch (err) {
      console.error(`\n⚠️ ${activeId} 决策异常:`, err.message);
      decision = { action: 'pass' };
    }

    if (decision.action === 'pass') {
      mgr.passTurn(game.gameId, activeId);
      process.stdout.write('P');
    } else if (decision.action === 'playCard') {
      const { cardIndex, row } = decision;
      const card = player.hand[cardIndex];
      const actualRow = (card && card.row && ['melee', 'ranged', 'siege'].includes(card.row)) ? card.row : (row || 'melee');
      const r = mgr.playCard(game.gameId, activeId, cardIndex, actualRow, null);
      if (!r.success) {
        console.log(`\n⚠️ 出牌失败: ${r.error}, 放弃`);
        mgr.passTurn(game.gameId, activeId);
      }
      process.stdout.write('.');
    }

    await sleep(200);
  }

  console.log(`\n\n✅ 对局完成，共 ${turnCount} 回合`);
  console.log(`比分: HeuristicAI ${game.players['HeuristicAI'].score} - ${game.players['ToolAgent'].score} ToolAgent`);
  console.log(`胜场: HeuristicAI ${game.players['HeuristicAI'].roundsWon} - ${game.players['ToolAgent'].roundsWon} ToolAgent`);

  const winner = Object.values(game.players).find(p => p.roundsWon >= 2);
  console.log(`🏆 胜者: ${winner ? (winner.id || '?') : '平局'}`);
}

run().catch(e => console.error('❌ 测试失败:', e.message, e.stack));
