/**
 * 昆特牌 AI 对战训练数据生成器
 *
 * 使用两个 Ollama Agent 对战，自动收集对局数据，
 * 以偏好学习格式生成训练数据（instruction + input + output）。
 *
 * 用法: node server/test/generateTrainingData.js [--target=100]
 *
 * 原理：
 *   - 每局每个回合捕获游戏状态快照
 *   - 对局结束后，胜方的每一步出牌作为正面样本
 *   - 输出格式参考用户提供的 preference_learning 风格
 */

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
const { TrainingRecorder } = require('../gameLogic/trainingRecorder');
const fs = require('fs');
const path = require('path');

// ── 配置 ──
const TARGET_ENTRIES = parseInt(process.argv.find(a => a.startsWith('--target='))?.split('=')[1] || '100', 10);
const OUTPUT_FILE = path.join(__dirname, '..', '..', 'training_data.json');
const AI_DELAY_MS = 100; // 对战间隔（毫秒），仅用于给 Ollama 喘息

// ═══════════════════════════════════════════
// 单局对战 + 数据收集（使用独立 TrainingRecorder）
// ═══════════════════════════════════════════

async function runBattleAndCollect(ai1, ai2) {
  const mgr = new GameManager({ enableTrainingRecorder: false });
  const recorder = new TrainingRecorder(OUTPUT_FILE);
  const name1 = ai1.getName();
  const name2 = ai2.getName();

  const game = mgr.createGame(name1, name2);

  while (game.status !== 'gameEnd') {
    if (game.status === 'roundEnd') {
      const result = mgr.startNextRound(game.gameId);
      if (result.gameEnded) break;
      await sleep(200);
    }

    if (game.status !== 'playing') continue;

    const activeId = game.activePlayer;
    const ai = activeId === name1 ? ai1 : ai2;
    const player = game.players[activeId];

    if (player.hand.length === 0) {
      mgr.passTurn(game.gameId, activeId);
      continue;
    }

    // AI 决策
    let decision;
    try {
      decision = await ai.decideAction(game, activeId);
    } catch (err) {
      console.error(`\n  ⚠️ ${activeId} 决策异常:`, err.message);
      decision = { action: 'pass' };
    }

    if (decision.action === 'pass') {
      mgr.passTurn(game.gameId, activeId);
    } else if (decision.action === 'playCard') {
      let { cardIndex, row, targetCardId } = decision;
      const card = player.hand[cardIndex];
      if (card && card.row && ['melee', 'ranged', 'siege'].includes(card.row)) {
        row = card.row;
      }

      // 用自己的 recorder 记录快照（独立于 GameManager 内置的录制器）
      if (card && game.status === 'playing') {
        recorder.recordSnapshot(game, activeId, card, row, targetCardId || null);
      }

      const r = mgr.playCard(game.gameId, activeId, cardIndex, row, targetCardId || null);
      if (!r.success) {
        mgr.passTurn(game.gameId, activeId);
      }
    }

    process.stdout.write('.');
    await sleep(AI_DELAY_MS);
  }

  // 从独立 recorder 提取条目
  return recorder.collectEntries(game);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ═══════════════════════════════════════════
// 主程序
// ═══════════════════════════════════════════

let _globalAllEntries = []; // 供信号处理器使用

async function main() {
  console.log('🎯 昆特牌 AI 训练数据生成器');
  console.log(`   目标: ${TARGET_ENTRIES} 条数据`);
  console.log(`   模型: qwen-gwent-agent(微调) vs qwen2.5:7b(基础)`);
  console.log('═'.repeat(50));

  const ai1 = createAI('ollama', { model: 'qwen-gwent-agent', temperature: 0.4 });
  const ai2 = createAI('ollama', { model: 'qwen2.5:7b', temperature: 0.4 });

  const allEntries = [];
  _globalAllEntries = allEntries;
  let gameCount = 0;

  const startTime = Date.now();

  // ── 增量保存函数 ──
  function saveProgress(entries) {
    try {
      fs.writeFileSync(OUTPUT_FILE, JSON.stringify(entries, null, 2), 'utf-8');
    } catch (err) {
      console.error(`\n  ⚠️ 保存文件失败:`, err.message);
    }
  }

  while (allEntries.length < TARGET_ENTRIES) {
    gameCount++;
    process.stdout.write(`\n🎮 第 ${gameCount} 局... `);

    const entries = await runBattleAndCollect(ai1, ai2);
    allEntries.push(...entries);

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`+${entries.length}条 (累计${allEntries.length}条, 耗时${elapsed}s)`);

    // 每局结束立即保存
    saveProgress(allEntries.slice(0, TARGET_ENTRIES));

    // 防止无限循环
    if (gameCount >= 30) {
      console.log(`\n⚠️ 已达30局上限，停止收集（当前${allEntries.length}条）`);
      break;
    }
  }

  // ── 截取目标数量 ──
  const finalEntries = allEntries.slice(0, TARGET_ENTRIES);

  // ── 最终保存 ──
  saveProgress(finalEntries);

  const totalTime = Math.round((Date.now() - startTime) / 1000);
  console.log('\n' + '═'.repeat(50));
  console.log(`✅ 完成！共 ${gameCount} 局，生成 ${finalEntries.length} 条训练数据`);
  console.log(`   总耗时: ${totalTime}s (${Math.round(totalTime / 60)}分)`);
  console.log(`   输出文件: ${OUTPUT_FILE}`);

  // ── 简要统计 ──
  const avgLen = finalEntries.reduce((s, e) => s + e.input.length, 0) / finalEntries.length;
  console.log(`   平均 input 长度: ${Math.round(avgLen)} 字符`);
  console.log('═'.repeat(50));
}

// ── 信号处理：Ctrl+C 或进程终止时保存已有数据 ──
function saveOnExit() {
  if (_globalAllEntries.length > 0) {
    try {
      fs.writeFileSync(OUTPUT_FILE, JSON.stringify(_globalAllEntries.slice(0, TARGET_ENTRIES), null, 2), 'utf-8');
      console.log(`\n💾 已保存 ${Math.min(_globalAllEntries.length, TARGET_ENTRIES)} 条数据到 ${OUTPUT_FILE}`);
    } catch (_) {}
  }
}
process.on('SIGINT', () => { saveOnExit(); process.exit(0); });
process.on('SIGTERM', () => { saveOnExit(); process.exit(0); });
process.on('uncaughtException', (err) => {
  console.error('\n❌ 未捕获异常:', err.message);
  saveOnExit();
  process.exit(1);
});

main().catch(err => {
  console.error('❌ 错误:', err);
  saveOnExit();
  process.exit(1);
});
