/**
 * Ollama Agent —— 基于本地大模型的 AI 对手（融合 ToolAgent 的 Tools + Skills）
 *
 * 使用 Ollama 管理本地模型，通过 HTTP API 调用 /api/generate 接口。
 * 已融合：工具调用（card_name 出牌）→ 技能注入（阵营克制/组合技/天气策略）→ 重试修正 → 回退兜底。
 *
 * 前置条件：
 *   1. 安装 Ollama: https://ollama.com
 *   2. 拉取模型:   ollama pull qwen2.5:7b   （或其他模型）
 *   3. 启动服务:   ollama serve
 *
 * 用法：
 *   const agent = new OllamaAgent({ model: 'qwen2.5:7b' });
 *   const decision = await agent.decideAction(game, playerId);
 *
 * 配置项（默认值定义见 ollama-config.json）：
 * @param {string}  options.model       - Ollama 模型名
 * @param {string}  options.baseUrl     - Ollama API 地址
 * @param {number}  options.temperature - 生成温度
 * @param {number}  options.timeout     - 请求超时 ms
 * @param {boolean} options.useSkills   - 是否启用技能注入（默认 true）
 * @param {boolean} options.useTools    - 是否启用工具调用（默认 true）
 * @param {number}  options.maxRetries  - 工具调用失败最大重试次数（默认 2）
 */

const AIInterface = require('./AIInterface');
const HeuristicAI = require('./HeuristicAI');
const path = require('path');
const { buildToolPrompt, executeTool, parseToolCall } = require('./tools');
const { collectSkills, getCounterFaction } = require('./skills');

// ── 从配置文件加载默认值，允许运行时 options 覆盖 ──
const CONFIG_PATH = path.join(__dirname, 'ollama-config.json');
let _defaultOptions = null;
function getDefaultOptions() {
  if (_defaultOptions) return _defaultOptions;
  try {
    _defaultOptions = require(CONFIG_PATH);
  } catch {
    console.warn('[OllamaAgent] 无法加载 ollama-config.json，使用内置回退');
    _defaultOptions = { model: 'qwen2.5:7b', baseUrl: 'http://localhost:11434', temperature: 0.3, timeout: 10000 };
  }
  return _defaultOptions;
}

class OllamaAgent extends AIInterface {
  constructor(options = {}) {
    super();
    // 过滤 undefined 值，防止覆盖默认配置（如 timeout: undefined → setTimeout(cb, 0) 导致立即中止）
    const filteredOptions = {};
    for (const [key, val] of Object.entries(options)) {
      if (val !== undefined) filteredOptions[key] = val;
    }
    this.options = { ...getDefaultOptions(), ...filteredOptions };
    this._history = [];
    this._maxRetries = filteredOptions.maxRetries ?? 2;
    this._useSkills = filteredOptions.useSkills !== false;
    this._useTools = filteredOptions.useTools !== false;
  }

  getName() {
    return `AI哥2(${this.options.model})`;
  }

  // ──────── 生命周期钩子 ────────

  onMatchStart(opponentName, faction, leader) {
    this._history = [];
    this._context = {
      opponentName,
      faction,
      leader: leader ? leader.name : null,
    };
  }

  onMatchEnd(won, roundsWon) {
    console.log(
      `[${this.getName()}] 对局结束 → ${won ? '胜利' : '失败'} (赢下 ${roundsWon} 局)`
    );
  }

  // ──────── 阵营选择（对局前）────────

  /**
   * 在创建对局前，AI 选择阵营卡组
   * @param {string} opponentFaction - 对手阵营
   * @returns {{ faction: string }} 选择的阵营
   */
  async selectDeck(opponentFaction) {
    const skillRecommendation = getCounterFaction(opponentFaction);

    const prompt = `你是昆特牌游戏AI。对手阵营是 ${opponentFaction}。

${collectSkills(
  { players: { ai: {}, [opponentFaction]: {} }, getOpponentId: () => opponentFaction },
  'ai',
  { isPreGame: true, opponentFaction }
)}

【可用工具】
- select_deck: 选择你的阵营卡组（参数: faction="northern"/"nilfgaard"/"scoiatael"/"monsters"）

输出格式（只输出 JSON）：
{"tool":"select_deck","args":{"faction":"nilfgaard"}}`;

    try {
      const raw = await this._callOllama(prompt);
      const parsed = parseToolCall(raw);

      if (parsed?.legacyAction) {
        return { faction: skillRecommendation };
      }

      if (parsed?.tool === 'select_deck' && parsed?.args?.faction) {
        const validFactions = ['northern', 'nilfgaard', 'scoiatael', 'monsters'];
        const faction = parsed.args.faction.toLowerCase();
        if (validFactions.includes(faction)) {
          return { faction };
        }
      }
    } catch (err) {
      console.log(`  ⚠ [${this.getName()}] 选牌失败，使用技能推荐: ${err.message}`);
    }

    return { faction: skillRecommendation };
  }

  // ──────── 核心决策 ────────

  /**
   * @override
   * 工具+技能驱动决策：构建 prompt → API 调用 → 解析工具调用 → 重试修正 → 回退兜底
   */
  async decideAction(game, playerId) {
    const player = game.players[playerId];
    if (!player || player.hand.length === 0) {
      return { action: 'pass' };
    }

    const prompt = this._buildPrompt(game, playerId);

    let lastError = null;

    for (let attempt = 0; attempt <= this._maxRetries; attempt++) {
      try {
        const retryHint = attempt > 0 && lastError
          ? `\n\n【上一次调用失败】${lastError}\n请修正你的工具调用，确保参数正确。`
          : '';

        const fullPrompt = prompt + retryHint;
        const raw = await this._callOllama(fullPrompt);

        // ── 解析工具调用 ──
        const parsed = parseToolCall(raw);

        // 兼容旧格式（LLM 输出了 { action: "playCard", cardIndex: ... }）
        if (parsed?.legacyAction) {
          try {
            return this._parseLegacyResponse(parsed.legacyAction, game, playerId);
          } catch (err) {
            lastError = err.message;
            if (attempt < this._maxRetries) {
              console.log(`  🔄 [${this.getName()}] 旧格式解析失败，重试 (${attempt + 1}/${this._maxRetries}): ${err.message}`);
            }
            continue;
          }
        }

        if (!parsed || !parsed.tool) {
          lastError = `无法解析工具调用，原始输出: ${raw.slice(0, 150)}`;
          if (attempt < this._maxRetries) {
            console.log(`  🔄 [${this.getName()}] 工具解析失败，重试 (${attempt + 1}/${this._maxRetries})`);
          }
          continue;
        }

        // ── 执行工具 ──
        const { executeTool } = require('./tools');
        const result = executeTool(parsed.tool, parsed.args, game, playerId);

        if (result.error) {
          lastError = result.error;
          if (attempt < this._maxRetries) {
            console.log(`  🔄 [${this.getName()}] 工具调用失败，重试 (${attempt + 1}/${this._maxRetries}): ${result.error}`);
          }
          continue;
        }

        return result;
      } catch (err) {
        lastError = err.message;
        if (attempt < this._maxRetries) {
          console.log(`  🔄 [${this.getName()}] API 异常，重试 (${attempt + 1}/${this._maxRetries}): ${err.message}`);
        }
      }
    }

    // ── 全部重试失败 → 回退 ──
    console.log(`  ⚠ [${this.getName()}] 工具调用全部失败，回退到规则决策`);
    return this._fallbackDecision(game, playerId);
  }

  // ──────── Prompt 构建 ────────

  _buildPrompt(game, playerId) {
    const p = game.players[playerId];
    const oppId = game.getOpponentId(playerId);
    const opp = game.players[oppId];

    const fmtCards = (cards) =>
      cards.map(c => `${c.name}(${c.power}${c.isHero ? '/英雄' : ''})`).join(', ') || '无';

    const fmtRow = (label, cards) => `  ${label}: ${fmtCards(cards)}`;

    // ── 基本信息 ──
    let prompt = `你是昆特牌（Gwent）游戏的AI对手。你必须使用工具来执行操作，只输出JSON格式的工具调用，不要添加任何解释。

【你的阵营】${this._context?.faction || '未知'}
【你的领袖】${this._context?.leader || '无'}

【当前比分】你 ${p.score} - ${opp.score} 对手
【当前轮次】第${game.currentRound || '?'}局
【小局胜场】你 ${p.roundsWon} - ${opp.roundsWon} 对手
${opp.passed ? '【注意】对手已放弃本轮\n' : ''}${p.passed ? '【注意】你已放弃本轮\n' : ''}
【对手战场】
${fmtRow('近战', opp.melee)}
${fmtRow('远程', opp.ranged)}
${fmtRow('攻城', opp.siege)}
  手牌: ${opp.hand.length}张  牌组剩余: ${opp.deck.length}张  墓地: ${opp.graveyard.length}张

【你的战场】
${fmtRow('近战', p.melee)}
${fmtRow('远程', p.ranged)}
${fmtRow('攻城', p.siege)}
  墓地: ${p.graveyard.length}张

【你的手牌（共${p.hand.length}张）】
${p.hand.map((c, i) => `  - ${c.name} | 战力${c.power} | ${c.type === 'special' ? '特殊牌' : c.row || '任意'}排${c.isHero ? ' | 英雄' : ''}${c.ability ? ' | ' + c.ability : ''}${c.isSpy ? ' | 间谍' : ''}${c.isMedic ? ' | 医生' : ''}${c.isMuster ? ' | 召集' : ''}`).join('\n')}
`;

    // ── 技能注入 ──
    if (this._useSkills) {
      const skillsText = collectSkills(game, playerId);
      if (skillsText) {
        prompt += '\n' + skillsText + '\n';
      }
    }

    // ── 工具定义 ──
    if (this._useTools) {
      prompt += '\n' + buildToolPrompt() + '\n';
    }

    // ── 可用卡牌名（防 LLM 幻觉）──
    const cardNames = p.hand.map(c => `"${c.name}"`).join('、');
    prompt += `\n【重要约束】你只能从以下手牌名中选择 card_name 参数: ${cardNames}`;

    // ── 特殊规则 ──
    prompt += `
【重要规则】
- 英雄牌免疫天气/号角/烧灼
- 间谍牌打到对方场上，我方抽2张牌
- 医生牌打出后自动复活己方墓地最高战力非英雄单位
- 召集牌打出后自动拉出所有同名卡
- 诱饵牌收回己方一张非英雄单位
- 天气牌影响双方同排非英雄单位
- 烧灼摧毁全场最高战力非英雄单位（含己方！）

请选择最优工具调用：`;

    return prompt;
  }

  // ──────── API 调用 ────────

  async _callOllama(prompt) {
    const { baseUrl, model, temperature, timeout } = this.options;

    // 安全兜底：确保 timeout 是有效正整数，避免 undefined/0 导致立即中止
    const safeTimeout = (typeof timeout === 'number' && timeout > 0) ? timeout : 30000;

    const fullUrl = `${baseUrl}/api/generate`;
    const t0 = Date.now();
    console.log(`  📡 [${this.getName()}] → Ollama ${fullUrl} (timeout=${safeTimeout}ms, model=${model})`);

    const controller = new AbortController();
    const timer = setTimeout(() => {
      console.log(`  ⏰ [${this.getName()}] 请求超时 (${safeTimeout}ms)，中止 fetch`);
      controller.abort();
    }, safeTimeout);

    try {
      const res = await fetch(fullUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt,
          stream: false,
          format: 'json',
          options: { temperature },
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errBody = await res.text().catch(() => '(无法读取响应体)');
        console.log(`  ❌ [${this.getName()}] Ollama HTTP ${res.status}: ${errBody.slice(0, 300)}`);
        throw new Error(`Ollama HTTP ${res.status}: ${errBody.slice(0, 200)}`);
      }

      const data = await res.json();
      const elapsed = Date.now() - t0;

      // qwen3 系列模型把实际输出放在 thinking 字段而非 response 字段
      // 优先取 response，若为空/纯空白则回退到 thinking
      const respRaw = (data.response || '').trim();
      const thinkRaw = (data.thinking || '').trim();
      let response;
      if (respRaw.length > 0) {
        response = respRaw;
      } else if (thinkRaw.length > 0) {
        response = thinkRaw;
        console.log(`  💭 [${this.getName()}] 使用 thinking 字段 (response 为空)`);
      } else {
        response = '';
      }
      console.log(`  ✅ [${this.getName()}] Ollama 响应 (${elapsed}ms, ${response.length}字符): ${response.slice(0, 120)}`);
      return response;
    } catch (err) {
      const elapsed = Date.now() - t0;
      if (err.name === 'AbortError') {
        console.log(`  ❌ [${this.getName()}] 请求被中止 (${elapsed}ms, timeout=${safeTimeout}ms)`);
        throw new Error(`Ollama 请求超时 (${safeTimeout}ms)`);
      }
      // 其他网络错误（ECONNREFUSED, ENOTFOUND 等）
      if (err.cause) {
        console.log(`  ❌ [${this.getName()}] 网络错误 (${elapsed}ms): ${err.cause.code || err.cause.message || err.cause}`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  // ──────── 响应解析（兼容旧格式）────────

  /**
   * 解析 LLM 输出的旧格式（{ action: "playCard", cardIndex: 0, row: "melee" }）
   */
  _parseLegacyResponse(decision, game, playerId) {
    // ── 天气行动映射 ──
    const weatherMap = {
      weather_frost: '霜冻', weather_fog: '浓雾', weather_rain: '暴雨',
      weather_clear: '晴天', weather_storm: '风暴',
      frost: '霜冻', fog: '浓雾', rain: '暴雨', clear: '晴天',
    };
    if (weatherMap[decision.action]) {
      const weatherName = weatherMap[decision.action];
      const hand = game.players[playerId].hand;
      const idx = hand.findIndex(c => c.name === weatherName || (c.name || '').includes(weatherName));
      if (idx >= 0) {
        console.log(`  ↪ [${this.getName()}] 天气行动 ${decision.action} → playCard[${idx}] ${hand[idx].name}`);
        decision = { action: 'playCard', cardIndex: idx, row: hand[idx].row || 'melee' };
      } else {
        throw new Error(`天气行动 ${decision.action} 但手牌中没有 ${weatherName}`);
      }
    }

    if (decision.action !== 'playCard' && decision.action !== 'pass') {
      throw new Error(`未知行动: ${decision.action}`);
    }

    if (decision.action === 'playCard') {
      const hand = game.players[playerId].hand;
      if (typeof decision.cardIndex !== 'number' || decision.cardIndex < 0 || decision.cardIndex >= hand.length) {
        throw new Error(`无效 cardIndex: ${decision.cardIndex} (手牌共 ${hand.length} 张)`);
      }
      const card = hand[decision.cardIndex];
      if (card && card.row && ['melee', 'ranged', 'siege'].includes(card.row)) {
        decision.row = card.row;
      } else if (!['melee', 'ranged', 'siege'].includes(decision.row)) {
        decision.row = (card && card.row) || 'melee';
      }
    }

    // 转换为工具调用格式的返回值
    if (decision.action === 'playCard') {
      const card = game.players[playerId].hand[decision.cardIndex];
      return {
        action: 'playCard',
        cardIndex: decision.cardIndex,
        row: decision.row || card.row || 'melee',
        cardName: card.name,
      };
    }
    return { action: 'pass' };
  }

  // ──────── 回退逻辑 ────────

  _fallbackDecision(game, playerId) {
    // 回退到优化后的 HeuristicAI（三层决策 + 9级效用 + 阵营策略）
    console.log('  ♟ [OllamaAgent] 回退到 HeuristicAI 决策');
    const h = new HeuristicAI();
    return h.decideAction(game, playerId);
  }

  // ──────── 回合反馈 ────────

  onTurnEnd(myAction, oppAction, gameState) {
    this._history.push({ myAction, oppAction, gameState });
  }
}

module.exports = OllamaAgent;
