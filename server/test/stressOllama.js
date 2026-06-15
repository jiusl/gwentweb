/**
 * Ollama 压力测试 —— 模拟 AI 对战的多轮并发调用
 *
 * 用法（在服务器上）:
 *   node server/test/stressOllama.js [--rounds=10]
 *
 * 测试内容:
 *   1. 连续 N 轮生成，模拟真实对局频率
 *   2. 记录每轮耗时、成功率
 *   3. 检测并发时是否会互相干扰
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const MODEL = process.env.OLLAMA_MODEL || 'qwen-gwent-agent';
const TIMEOUT_MS = parseInt(process.env.OLLAMA_TIMEOUT) || 30000;
const DEFAULT_ROUNDS = 10;

async function ollamaGenerate(prompt) {
  const url = `${BASE_URL}/api/generate`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        prompt,
        stream: false,
        format: 'json',
        options: { temperature: 0.3, num_predict: 200 },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
    }

    const data = await res.json();
    return { success: true, response: data.response, elapsed: 0 };
  } finally {
    clearTimeout(timer);
  }
}

function makePrompt(roundIdx) {
  return `你是昆特牌AI。只输出JSON: {"tool":"play_card","args":{"card_name":"步兵"}} 或 {"tool":"pass_turn"}。回合${roundIdx}。只输出JSON，不要解释。`;
}

async function main() {
  const rounds = parseInt(process.argv.find(a => a.startsWith('--rounds='))?.split('=')[1] || DEFAULT_ROUNDS, 10);

  console.log('═══════════════════════════════════════════');
  console.log(`  Ollama 压力测试 (${rounds} 轮)`);
  console.log('═══════════════════════════════════════════');
  console.log(`  BASE_URL:    ${BASE_URL}`);
  console.log(`  MODEL:       ${MODEL}`);
  console.log(`  TIMEOUT:     ${TIMEOUT_MS}ms`);
  console.log(`  Node.js:     ${process.version}`);
  console.log('');

  const results = [];
  let totalElapsed = 0;

  for (let i = 1; i <= rounds; i++) {
    process.stdout.write(`  [${String(i).padStart(3)}/${rounds}] `);

    const prompt = makePrompt(i);
    const t0 = performance.now();

    try {
      const r = await ollamaGenerate(prompt);
      const elapsed = performance.now() - t0;
      totalElapsed += elapsed;

      let jsonOk = false;
      try { JSON.parse(r.response); jsonOk = true; } catch {}

      results.push({
        round: i,
        success: true,
        elapsed: Math.round(elapsed),
        jsonValid: jsonOk,
        responseLen: r.response?.length || 0,
      });

      const icon = jsonOk ? '✅' : '⚠️';
      process.stdout.write(`${icon} ${(elapsed / 1000).toFixed(1)}s\n`);
    } catch (err) {
      const elapsed = performance.now() - t0;
      totalElapsed += elapsed;

      results.push({
        round: i,
        success: false,
        elapsed: Math.round(elapsed),
        error: err.message,
      });

      process.stdout.write(`❌ ${(elapsed / 1000).toFixed(1)}s - ${err.message.slice(0, 60)}\n`);
    }

    // 模拟对局间隔
    if (i < rounds) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  // ── 汇总 ──
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  const elapsedList = results.map(r => r.elapsed);
  const avgElapsed = elapsedList.reduce((a, b) => a + b, 0) / elapsedList.length;
  const maxElapsed = Math.max(...elapsedList);
  const minElapsed = Math.min(...elapsedList);
  const jsonOkCount = results.filter(r => r.jsonValid).length;

  console.log(`\n═══════════════════════════════════════════`);
  console.log('  压力测试汇总');
  console.log('═══════════════════════════════════════════');
  console.log(`  总轮数:     ${rounds}`);
  console.log(`  成功:       ${successCount} / ${rounds}`);
  console.log(`  失败:       ${failCount} / ${rounds}`);
  console.log(`  JSON 有效:  ${jsonOkCount} / ${successCount}`);
  console.log(`  平均耗时:   ${(avgElapsed / 1000).toFixed(1)}s`);
  console.log(`  最快:       ${(minElapsed / 1000).toFixed(1)}s`);
  console.log(`  最慢:       ${(maxElapsed / 1000).toFixed(1)}s`);
  console.log(`  总耗时:     ${(totalElapsed / 1000).toFixed(1)}s`);
  console.log('');

  // 评估
  const rate = successCount / rounds;
  if (rate === 1 && avgElapsed < 15000) {
    console.log('  🟢 评估: 优秀 - 全部成功且平均响应快');
  } else if (rate >= 0.8 && avgElapsed < 25000) {
    console.log('  🟡 评估: 一般 - 偶尔失败或响应偏慢');
  } else if (rate < 0.8 || avgElapsed >= 25000) {
    console.log('  🔴 评估: 差 - 频繁失败或响应过慢，建议:');
    if (avgElapsed >= 25000) {
      console.log('    → 模型太大/服务器性能不足，换更小的模型');
    }
    if (rate < 0.8) {
      console.log('    → Ollama 服务不稳定，检查服务器资源');
    }
  }
}

main().catch(err => {
  console.error('压力测试异常:', err);
  process.exit(1);
});
