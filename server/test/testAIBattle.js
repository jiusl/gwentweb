/**
 * AI vs AI 对战模拟测试
 * 两个启发式 AI 互相对战，完整模拟 3 局 2 胜制
 *
 * 用法: node server/test/testAIBattle.js
 *      npx jest server/test/testAIBattle.js
 */

// 模拟 dbUtils —— 必须在 require GameManager 之前设置
const Module = require('module');
const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request.endsWith('/db/dbUtils') || request === '../db/dbUtils') {
    return { saveMatch: () => Promise.resolve(1) };
  }
  return origLoad.apply(this, arguments);
};

const GameManager = require('../gameLogic/gameManager');
const { createAI } = require('../ai');

const AI_DELAY_MS = 300; // AI 思考间隔（毫秒），测试时加快

async function runAIBattle(ai1Type, ai2Type, options) {
  const mgr = new GameManager();
  const name1 = `${ai1Type}_1`;
  const name2 = `${ai2Type}_2`;

  const ai1 = createAI(ai1Type, options?.ai1Options || {});
  const ai2 = createAI(ai2Type, options?.ai2Options || {});

  const game = mgr.createGame(name1, name2);

  console.log(`\n${'='.repeat(60)}`);
  console.log(`⚔️  AI 对战: ${ai1.getName()} vs ${ai2.getName()}`);
  console.log(`${'='.repeat(60)}`);

  let turnCount = 0;
  let roundNum = game.currentRound;

  while (game.status !== 'gameEnd') {
    if (game.status === 'roundEnd') {
      console.log(`\n--- 第 ${game.currentRound} 局结束，准备下一局 ---`);
      const result = mgr.startNextRound(game.gameId);
      if (result.gameEnded) break;
      roundNum = game.currentRound;
      // 短暂延迟
      await sleep(500);
    }

    if (game.status !== 'playing') continue;

    const activeId = game.activePlayer;
    const ai = activeId === name1 ? ai1 : ai2;
    const aiName = ai.getName();

    turnCount++;
    const player = game.players[activeId];

    if (player.hand.length === 0) {
      console.log(`  [回合${turnCount}] ${aiName} 无牌可出 → pass`);
      const r = mgr.passTurn(game.gameId, activeId);
      if (!r.success) console.error(`  ❌ pass 失败: ${r.error}`);
    } else {
      // AI 决策
      let decision;
      try {
        decision = await ai.decideAction(game, activeId);
      } catch (err) {
        console.error(`  ❌ ${aiName} 决策失败: ${err.message}`);
        decision = { action: 'pass' };
      }

      if (decision.action === 'pass') {
        console.log(`  [回合${turnCount}] ${aiName} 主动放弃 (score=${player.score})`);
        const r = mgr.passTurn(game.gameId, activeId);
        if (!r.success) console.error(`  ❌ pass 失败: ${r.error}`);
      } else if (decision.action === 'playCard') {
        let { cardIndex, row, targetCardId } = decision;
        const card = player.hand[cardIndex];
        if (card && card.row && ['melee', 'ranged', 'siege'].includes(card.row)) {
          row = card.row;
        }
        const cardDesc = card ? `${card.name}(${card.power},${card.type})` : `index=${cardIndex}`;
        const targetStr = targetCardId ? ` → 目标:${targetCardId}` : '';
        console.log(`  [回合${turnCount}] ${aiName} 打出: ${cardDesc} → ${row}${targetStr}`);

        const r = mgr.playCard(game.gameId, activeId, cardIndex, row, targetCardId || null);
        if (!r.success) {
          console.error(`  ❌ playCard 失败: ${r.error}，回退 pass`);
          mgr.passTurn(game.gameId, activeId);
        }
      }
    }

    // 显示当前比分
    const p1 = game.players[name1];
    const p2 = game.players[name2];
    if (turnCount % 3 === 0 || game.status === 'roundEnd' || game.status === 'gameEnd') {
      console.log(`  📊 [${p1.score} - ${p2.score}] 手牌:${p1.hand.length}/${p2.hand.length} 胜场:${p1.roundsWon}-${p2.roundsWon}`);
    }

    await sleep(AI_DELAY_MS);
  }

  // ── 对战结果 ──
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`🏆 对战结束！`);
  console.log(`   胜者: ${game.gameWinner ? game.gameWinner : '平局'}`);
  const fp1 = game.players[name1];
  const fp2 = game.players[name2];
  console.log(`   最终比分: ${fp1.roundsWon} - ${fp2.roundsWon}`);
  console.log(`   总局数: ${game.currentRound}`);
  console.log(`   总回合数: ${turnCount}`);
  console.log(`${'─'.repeat(60)}\n`);

  return {
    winner: game.gameWinner,
    scores: { [name1]: fp1.roundsWon, [name2]: fp2.roundsWon },
    rounds: game.currentRound,
    turns: turnCount,
  };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ═══════ 主程序 ═══════
async function main() {
  console.log('🧪 昆特牌 AI 对战测试套件');
  console.log('═'.repeat(60));

  const results = [];

  // ── 命令行参数解析 ──
  const args = process.argv.slice(2);
  const mode = args[0] || 'all'; // all | ollama | heuristic
  const rounds = parseInt(args.find(a => a.startsWith('--rounds='))?.split('=')[1] || '1', 10);

  if (mode === 'all' || mode === 'heuristic') {
    // 测试 1: HeuristicAI vs HeuristicAI
    for (let i = 0; i < rounds; i++) {
      console.log(`\n📋 测试 H${i + 1}: HeuristicAI vs HeuristicAI`);
      const r = await runAIBattle('heuristic', 'heuristic');
      results.push({ name: `HeuristicAI vs HeuristicAI #${i + 1}`, ...r });
    }
  }

  if (mode === 'all' || mode === 'mixed' || mode === 'ho') {
    // 测试: HeuristicAI vs OllamaAgent
    const mixedBattles = mode === 'all' ? 1 : rounds;
    for (let i = 0; i < mixedBattles; i++) {
      console.log(`\n📋 测试 M${i + 1}: HeuristicAI vs OllamaAgent`);
      try {
        const r = await runAIBattle('heuristic', 'ollama');
        const w = r.winner
          ? (r.winner.includes('heuristic') ? 'HeuristicAI(启发式)' : 'OllamaAgent(大模型)')
          : '平局';
        console.log(`   🏆 胜者: ${w} | ${r.rounds}局 ${r.turns}回合`);
        results.push({ name: `HeuristicAI vs OllamaAgent #${i + 1}`, ...r });
      } catch (err) {
        console.error(`   ❌ 混战失败: ${err.message}`);
      }
    }
  }

  if (mode === 'all' || mode === 'ollama') {
    // ── Ollama 模型对战: 微调模型 vs 基础模型 ──
    console.log('\n📋 OllamaAgent 可用性检测...');
    const { OllamaAgent } = require('../ai');
    const agent = new OllamaAgent({ timeout: 5000 });
    console.log(`   baseUrl=${agent.options.baseUrl} | 默认model=${agent.options.model}`);
    console.log(`   微调模型: qwen-gwent-agent | 基础模型: qwen2.5:7b`);

    const ollamaResults = [];
    for (let i = 0; i < rounds; i++) {
      console.log(`\n${'▶'.repeat(30)} 第 ${i + 1}/${rounds} 局 ${'▶'.repeat(30)}`);
      console.log(`   🤖 qwen-gwent-agent(微调) ⚔️ qwen2.5:7b(基础)`);
      const startTime = Date.now();
      try {
        const r = await runAIBattle(
          'ollama',
          'ollama',
          {
            ai1Options: { model: 'qwen-gwent-agent', timeout: 30000 },
            ai2Options: { model: 'qwen2.5:7b', timeout: 30000 },
          }
        );
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const winnerLabel = r.winner
          ? (r.winner.includes('ollama_1') ? 'qwen-gwent-agent(微调)' : 'qwen2.5:7b(基础)')
          : '平局';
        console.log(`   ⏱ 耗时 ${elapsed}s | 胜者: ${winnerLabel} | 总局:${r.rounds} 回合:${r.turns}`);
        ollamaResults.push(winnerLabel);
        results.push({ name: `微调 vs 基础 #${i + 1}`, ...r });
      } catch (err) {
        console.error(`   ❌ Ollama 对战失败: ${err.message}`);
      }
    }

    // ── 中途汇总 ──
    if (ollamaResults.length > 0) {
      const fineWins = ollamaResults.filter(w => w.includes('微调')).length;
      const baseWins = ollamaResults.filter(w => w.includes('基础')).length;
      const draws = ollamaResults.filter(w => w === '平局').length;
      console.log(`\n  📊 Ollama 对战途中统计: 微调 ${fineWins}胜 - ${baseWins}负 - ${draws}平`);
    }
  }

  // ── 汇总 ──
  console.log('\n' + '═'.repeat(60));
  console.log('📊 最终测试汇总');
  console.log('═'.repeat(60));

  if (results.length === 0) {
    console.log('  (无对战结果)');
  }

  // 按类型分组
  const ollamaMatches = results.filter(r => r.name.includes('微调'));
  const mixedMatches = results.filter(r => r.name.includes('HeuristicAI vs Ollama'));
  const heuristicMatches = results.filter(r => !r.name.includes('微调') && !r.name.includes('HeuristicAI vs Ollama'));

  if (heuristicMatches.length > 0) {
    console.log('\n--- HeuristicAI 对战 ---');
    for (const r of heuristicMatches) {
      const w = r.winner ? (r.winner.includes('heuristic_1') ? 'AI-1' : 'AI-2') : '平局';
      console.log(`  ${r.name}: ${w} | ${r.rounds}局 ${r.turns}回合`);
    }
  }

  if (mixedMatches.length > 0) {
    console.log('\n--- ⚔️ 混战: HeuristicAI vs OllamaAgent ---');
    for (const r of mixedMatches) {
      const w = r.winner
        ? (r.winner.includes('heuristic') ? 'HeuristicAI' : 'OllamaAgent')
        : '平局';
      console.log(`  ${r.name}: ${w}胜 | ${r.rounds}局 ${r.turns}回合 | 比分 ${Object.values(r.scores).join('-')}`);
    }
  }

  if (ollamaMatches.length > 0) {
    console.log('\n--- 🤖 Ollama 微调模型评估 (qwen-gwent-agent vs qwen2.5:7b) ---');
    let fineW = 0, baseW = 0, draw = 0;
    for (const r of ollamaMatches) {
      const w = r.winner
        ? (r.winner.includes('ollama_1') ? '微调' : '基础')
        : '平局';
      if (w === '微调') fineW++;
      else if (w === '基础') baseW++;
      else draw++;
      console.log(`  ${r.name}: ${w}胜 | ${r.rounds}局 ${r.turns}回合 | 比分 ${Object.values(r.scores).join('-')}`);
    }
    console.log(`\n  🏆 总战绩: 微调 ${fineW}胜 - ${baseW}负 - ${draw}平`);
    const wr = ollamaMatches.length > 0 ? (fineW / ollamaMatches.length * 100).toFixed(0) : 0;
    console.log(`  📈 微调模型胜率: ${wr}% (${fineW}/${ollamaMatches.length})`);
  }

  console.log('\n✅ AI 对战测试完成！');
}

main().catch(err => {
  console.error('❌ 测试异常:', err);
  process.exit(1);
});
