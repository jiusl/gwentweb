/**
 * 昆特牌 AI 工具注册表
 *
 * 将游戏操作封装为 LLM 可调用的 "工具"（Tools），
 * AI 只需输出工具名 + 参数，由执行器映射到具体的游戏操作。
 *
 * 设计理念：
 *   - AI 不需要知道 cardIndex，只需知道 card_name
 *   - AI 不需要知道 row 限制，工具自动处理
 *   - 工具执行返回标准化决策供 GameManager 使用
 */

const { allCards } = require('../gameLogic/cards');

// ═══════════════════════════════════════════
// 工具定义（供 prompt 使用）
// ═══════════════════════════════════════════

const TOOL_DEFINITIONS = {
  play_card: {
    name: 'play_card',
    description: '从手牌打出一张卡牌到战场',
    parameters: {
      card_name: {
        type: 'string',
        description: '要打出的卡牌名称，必须与手牌中的卡牌名完全一致',
        required: true,
      },
    },
  },
  pass_turn: {
    name: 'pass_turn',
    description: '放弃本轮跟牌，本局不再出牌',
    parameters: {},
  },
  select_deck: {
    name: 'select_deck',
    description: '选择对局使用的阵营卡组（仅在对局开始前有效）',
    parameters: {
      faction: {
        type: 'string',
        description: '阵营名称：northern(北方领域)、nilfgaard(尼弗迦德)、scoiatael(松鼠党)、monsters(怪物)',
        required: true,
      },
    },
  },
};

/**
 * 生成工具列表的 prompt 描述
 */
function buildToolPrompt() {
  const lines = ['【可用工具】'];
  for (const [name, def] of Object.entries(TOOL_DEFINITIONS)) {
    const params = def.parameters;
    const paramDesc = Object.entries(params)
      .map(([k, v]) => `"${k}": ${v.description}`)
      .join('、');
    lines.push(`- ${name}: ${def.description}${paramDesc ? `（参数: ${paramDesc}）` : ''}`);
  }
  lines.push('');
  lines.push('输出格式（必须严格遵守，只输出一行 JSON）：');
  lines.push('{"tool":"play_card","args":{"card_name":"杰洛特"}}');
  lines.push('或 {"tool":"pass_turn","args":{}}');
  return lines.join('\n');
}

// ═══════════════════════════════════════════
// 工具执行器
// ═══════════════════════════════════════════

/**
 * 执行工具调用，返回标准化决策
 *
 * @param {string} toolName - 工具名
 * @param {object} args - 工具参数
 * @param {object} game - 游戏状态
 * @param {string} playerId - 玩家 ID
 * @returns {{ action: 'playCard'|'pass'|'selectDeck', cardIndex?: number, row?: string, targetCardId?: string, faction?: string, error?: string }}
 */
function executeTool(toolName, args, game, playerId) {
  const player = game.players[playerId];

  switch (toolName) {
    case 'play_card': {
      if (!args.card_name || typeof args.card_name !== 'string') {
        return { error: 'play_card 缺少 card_name 参数' };
      }

      const cardName = args.card_name.trim();
      const idx = player.hand.findIndex(c => c.name === cardName);
      if (idx === -1) {
        // 模糊匹配：尝试部分匹配
        const fuzzyIdx = player.hand.findIndex(c =>
          c.name.includes(cardName) || cardName.includes(c.name)
        );
        if (fuzzyIdx === -1) {
          return { error: `手牌中没有 "${cardName}"，可用卡牌: ${player.hand.map(c => c.name).join('、')}` };
        }
        const card = player.hand[fuzzyIdx];
        return {
          action: 'playCard',
          cardIndex: fuzzyIdx,
          row: card.row || 'melee',
          cardName: card.name,
        };
      }

      const card = player.hand[idx];
      return {
        action: 'playCard',
        cardIndex: idx,
        row: card.row || 'melee',
        cardName: card.name,
      };
    }

    case 'pass_turn': {
      return { action: 'pass' };
    }

    case 'select_deck': {
      const validFactions = ['northern', 'nilfgaard', 'scoiatael', 'monsters'];
      const faction = (args.faction || 'northern').toLowerCase();
      if (!validFactions.includes(faction)) {
        return { error: `无效阵营 "${faction}"，可选: ${validFactions.join('、')}` };
      }
      return { action: 'selectDeck', faction };
    }

    default:
      return { error: `未知工具: ${toolName}` };
  }
}

/**
 * 从 LLM 原始输出解析工具调用
 *
 * @param {string} raw - LLM 原始输出
 * @returns {{ tool?: string, args?: object, rawJson?: object }}
 */
function parseToolCall(raw) {
  if (!raw || typeof raw !== 'string') return null;

  // 清理 markdown 代码块
  let cleaned = raw.replace(/```(?:json)?\s*([\s\S]*?)```/g, '$1').trim();

  // 尝试解析 JSON
  let parsed = null;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const jsonMatch = cleaned.match(/\{[\s\S]*?"tool"[\s\S]*?\}/);
    if (!jsonMatch) return null;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      return null;
    }
  }

  if (!parsed) return null;

  // 兼容旧格式: { action: "playCard", cardIndex: 0, row: "melee" }
  if (parsed.action && !parsed.tool) {
    return { legacyAction: parsed };
  }

  // 新格式: { tool: "play_card", args: { card_name: "杰洛特" } }
  return {
    tool: parsed.tool,
    args: parsed.args || {},
    rawJson: parsed,
  };
}

/**
 * 获取一个针对当前手牌的可用工具列表（含具体参数提示）
 */
function getAvailableTools(player, isPreGame = false) {
  const tools = [];

  if (isPreGame) {
    tools.push({
      tool: 'select_deck',
      args: { faction: 'northern(northern/北方领域, nilfgaard/尼弗迦德, scoiatael/松鼠党, monsters/怪物)' },
    });
    return tools;
  }

  // play_card — 每张手牌都是可用的
  for (const card of player.hand) {
    tools.push({
      tool: 'play_card',
      args: { card_name: card.name },
      cardInfo: {
        power: card.power,
        type: card.type,
        row: card.row || '任意',
        ability: card.ability || null,
        isHero: card.isHero || false,
        isSpy: card.isSpy || false,
        isMedic: card.isMedic || false,
        isMuster: card.isMuster || false,
        isTightBond: card.isTightBond || false,
      },
    });
  }

  // pass_turn — 始终可用
  tools.push({ tool: 'pass_turn', args: {} });

  return tools;
}

module.exports = {
  TOOL_DEFINITIONS,
  buildToolPrompt,
  executeTool,
  parseToolCall,
  getAvailableTools,
};
