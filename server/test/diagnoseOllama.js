/**
 * Ollama 连通性诊断脚本
 *
 * 用法（在服务器上）:
 *   cd server
 *   node test/diagnoseOllama.js
 *
 * 功能:
 *   1. 检查 Ollama 服务是否存活
 *   2. 检查模型是否已拉取
 *   3. 执行一次简单生成测试
 *   4. 输出耗时与完整响应
 */

const http = require('http');
const https = require('https');

// ── 读取配置 ──
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const MODEL = process.env.OLLAMA_MODEL || 'qwen-gwent-agent';
const TIMEOUT_MS = 60000;

console.log('═══════════════════════════════════════════');
console.log('  Ollama 连通性诊断');
console.log('═══════════════════════════════════════════');
console.log(`  BASE_URL: ${BASE_URL}`);
console.log(`  MODEL:    ${MODEL}`);
console.log(`  Node.js:  ${process.version}`);
console.log(`  平台:     ${process.platform} ${process.arch}`);
console.log('');

// ── 辅助: fetch 封装 ──
function ollamaFetch(endpoint, options = {}) {
  const url = new URL(endpoint, BASE_URL);
  const isHttps = url.protocol === 'https:';
  const lib = isHttps ? https : http;

  return new Promise((resolve, reject) => {
    const req = lib.request(
      url,
      {
        method: options.method || 'GET',
        headers: { 'Content-Type': 'application/json', ...options.headers },
        timeout: TIMEOUT_MS,
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(body), raw: body });
          } catch {
            resolve({ status: res.statusCode, data: null, raw: body });
          }
        });
      }
    );
    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`请求超时 (${TIMEOUT_MS}ms)`));
    });
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

// ── 辅助: 计时 ──
function hrTime() {
  return Number(process.hrtime.bigint() / 1000000n);
}

async function main() {
  // ═══════════════════════════════════════════
  // 测试 1: 连通性检查
  // ═══════════════════════════════════════════
  console.log('📡 测试 1/4: Ollama 服务连通性...');
  try {
    const t0 = hrTime();
    const r = await ollamaFetch('/api/tags');
    const elapsed = hrTime() - t0;
    if (r.status === 200 && r.data?.models) {
      console.log(`  ✅ 服务可达 (${elapsed.toFixed(0)}ms, 状态码 ${r.status})`);
      const models = r.data.models.map(m => m.name).join(', ') || '(无)';
      console.log(`  已安装模型: ${models}`);
    } else {
      console.log(`  ⚠️ 收到响应但状态码异常: ${r.status}`);
      console.log(`  ${r.raw.slice(0, 300)}`);
    }
  } catch (err) {
    console.error(`  ❌ 连接失败: ${err.message}`);
    console.error('  → 请检查:');
    console.error('    1. Ollama 服务是否已启动? (ollama serve)');
    console.error(`    2. 端口是否正确? (当前: ${BASE_URL})`);
    console.error('    3. 防火墙是否拦截?');
    console.error('    4. 如果是 Docker 部署，是否映射了 11434 端口?');
    console.error('');
    console.error('  尝试手动验证:');
    console.error(`    curl ${BASE_URL}/api/tags`);
    // 连通性失败就没必要继续了
    process.exit(1);
  }

  // ═══════════════════════════════════════════
  // 测试 2: 模型存在性
  // ═══════════════════════════════════════════
  console.log(`\n🔍 测试 2/4: 检查模型 "${MODEL}" 是否存在...`);
  try {
    const r = await ollamaFetch('/api/tags');
    const models = r.data?.models || [];
    const found = models.find(
      m => m.name === MODEL || m.name === `${MODEL}:latest` || m.name.startsWith(`${MODEL}:`)
    );
    if (found) {
      console.log(`  ✅ 模型 "${MODEL}" 已安装 (${found.name}, ${found.size ? (found.size / 1e9).toFixed(1) + ' GB' : '未知大小'})`);
    } else {
      console.log(`  ❌ 模型 "${MODEL}" 未找到！`);
      console.log(`  已安装的模型: ${models.map(m => m.name).join(', ') || '(无)'}`);
      console.log('');
      console.log('  → 拉取模型:');
      console.log(`    ollama pull ${MODEL}`);
      console.log('');
      console.log('  → 或者创建自定义 Modelfile:');
      console.log('    ollama create qwen-gwent-agent -f ./Modelfile');
      process.exit(1);
    }
  } catch (err) {
    console.error(`  ❌ 检查失败: ${err.message}`);
  }

  // ═══════════════════════════════════════════
  // 测试 3: 简单生成测试（短 prompt）
  // ═══════════════════════════════════════════
  console.log(`\n🧠 测试 3/4: 简单生成测试（短 prompt）...`);
  let shortGenOk = false;
  try {
    const t0 = hrTime();
    const r = await ollamaFetch('/api/generate', {
      method: 'POST',
      body: {
        model: MODEL,
        prompt: '请回复一个 JSON: {"tool":"play_card","args":{"card_name":"步兵"}}。只输出JSON，不要解释。',
        stream: false,
        format: 'json',
        options: { temperature: 0.1, num_predict: 100 },
      },
    });
    const elapsed = hrTime() - t0;
    console.log(`  状态码: ${r.status}`);
    console.log(`  耗时:   ${elapsed.toFixed(0)}ms (${(elapsed / 1000).toFixed(1)}s)`);

    if (r.data?.response) {
      const resp = r.data.response.trim();
      console.log(`  响应:   ${resp.slice(0, 200)}`);
      // 尝试验证 JSON
      try {
        const parsed = JSON.parse(resp);
        console.log(`  ✅ JSON 解析成功: ${JSON.stringify(parsed)}`);
        shortGenOk = true;
      } catch {
        console.log(`  ⚠️ 响应不是合法 JSON（提取: ${resp.slice(0, 100)}）`);
      }
    } else {
      console.log(`  ⚠️ 未收到 response 字段`);
      console.log(`  原始响应: ${r.raw.slice(0, 500)}`);
    }
  } catch (err) {
    console.error(`  ❌ 生成失败: ${err.message}`);
  }

  // ═══════════════════════════════════════════
  // 测试 4: 实战 prompt 生成测试（模拟真实 AI 决策）
  // ═══════════════════════════════════════════
  console.log(`\n🎯 测试 4/4: 实战 prompt 生成测试（长 prompt，模拟一回合决策）...`);
  try {
    const gamePrompt = `你是昆特牌（Gwent）游戏的AI对手。你必须使用工具来执行操作，只输出JSON格式的工具调用，不要添加任何解释。

【你的阵营】northern
【你的领袖】无

【当前比分】你 15 - 10 对手
【当前轮次】第1局
【小局胜场】你 0 - 0 对手

【对手战场】
  近战: 帝国步兵(8)
  远程: 无
  攻城: 无
  手牌: 8张  牌组剩余: 7张  墓地: 0张

【你的战场】
  近战: 步兵(4), 投石机(6)
  远程: 无
  攻城: 无
  墓地: 0张

【你的手牌（共3张）】
  - 弓箭手 | 战力6 | 远程排
  - 杰洛特 | 战力15 | 近战排 | 英雄
  - 霜冻 | 战力0 | 特殊牌 | 近战排

【可用工具】
- play_card: 从手牌打出一张卡牌到战场（参数: "card_name": 要打出的卡牌名称，必须与手牌中的卡牌名完全一致）
- pass_turn: 放弃本轮跟牌，本局不再出牌

【重要约束】你只能从以下手牌名中选择 card_name 参数: "弓箭手"、"杰洛特"、"霜冻"
【重要规则】
- 英雄牌免疫天气/号角/烧灼
- 天气牌影响双方同排非英雄单位

请选择最优工具调用：`;

    const t0 = hrTime();
    const r = await ollamaFetch('/api/generate', {
      method: 'POST',
      body: {
        model: MODEL,
        prompt: gamePrompt,
        stream: false,
        format: 'json',
        options: { temperature: 0.3 },
      },
    });
    const elapsed = hrTime() - t0;
    console.log(`  状态码: ${r.status}`);
    console.log(`  耗时:   ${elapsed.toFixed(0)}ms (${(elapsed / 1000).toFixed(1)}s)`);

    if (r.data?.response) {
      const resp = r.data.response.trim();
      console.log(`  响应:   ${resp.slice(0, 300)}`);
      try {
        const parsed = JSON.parse(resp);
        console.log(`  ✅ JSON 解析成功: tool=${parsed.tool}, args=${JSON.stringify(parsed.args)}`);
      } catch {
        console.log(`  ⚠️ 响应不是合法 JSON`);
        console.log(`  完整响应: ${resp}`);
      }
    } else {
      console.log(`  ❌ 未收到 response 字段`);
    }

    // 评估
    if (r.status === 200 && elapsed < 25000) {
      console.log(`\n  📊 评估: 生成耗时 ${(elapsed / 1000).toFixed(1)}s，在 AI_HARD_TIMEOUT (25s) 之内 → ✅ 可接受`);
    } else if (elapsed >= 25000) {
      console.log(`\n  📊 评估: 生成耗时 ${(elapsed / 1000).toFixed(1)}s，超过 AI_HARD_TIMEOUT (25s) → ❌ 需要优化`);
    }
  } catch (err) {
    console.error(`  ❌ 生成失败: ${err.message}`);
    if (err.message.includes('timeout') || err.message.includes('超时')) {
      console.error('  → 模型响应太慢，可能需要:');
      console.error('    1. 使用更小的模型（如 qwen2.5:3b）');
      console.error('    2. 增加服务器 CPU/内存');
      console.error('    3. 考虑使用 GPU 加速');
    }
  }

  // ═══════════════════════════════════════════
  // 环境信息汇总
  // ═══════════════════════════════════════════
  console.log(`\n═══════════════════════════════════════════`);
  console.log('  诊断完成');
  console.log('═══════════════════════════════════════════');
  console.log('');
  console.log('  如果所有测试通过但仍无法正常对战，请检查:');
  console.log(`  1. 服务器 .env 文件是否位于项目根目录 (${require('path').resolve(__dirname, '..', '..', '.env')})`);
  console.log('  2. .env 中 OLLAMA_TIMEOUT 建议设为 20000');
  console.log('  3. 服务器 Node.js 版本 >= 18 (当前: ' + process.version + ')');
  console.log('  4. fetch API 是否可用: ' + (typeof fetch === 'function' ? '✅' : '❌ 需要 Node 18+'));
  console.log('');
}

main().catch((err) => {
  console.error('诊断脚本异常:', err);
  process.exit(1);
});
