/**
 * AI 模块入口
 *
 * ── 导出清单 ──
 *   AIInterface   — 抽象基类，所有 AI 实现必须继承
 *   HeuristicAI   — 启发式规则引擎（默认 AI）
 *   OllamaAgent   — 基于 Ollama 本地模型的 Agent（异步）
 *   createAI()    — 工厂函数
 *   default       — HeuristicAI 类（向后兼容）
 *
 * ── 用法示例 ──
 *   // 方式 1：直接导入具体实现
 *   const { HeuristicAI, OllamaAgent } = require('./ai');
 *   const ai = new HeuristicAI();
 *   const agent = new OllamaAgent({ model: 'qwen2.5:7b' });
 *
 *   // 方式 2：工厂函数
 *   const { createAI } = require('./ai');
 *   const ai = createAI('heuristic');
 *   const agent = createAI('ollama', { model: 'qwen2.5:7b' });
 *
 *   // 方式 3：向后兼容（默认导出）
 *   const AIPlayer = require('./ai');  // 仍是 HeuristicAI
 *   const ai = new AIPlayer();
 *
 * ── 注册自定义 AI ──
 *   const { registerAI, createAI } = require('./ai');
 *   registerAI('myAI', MyCustomAI);
 *   const ai = createAI('myAI', {...});
 */

const AIInterface = require('./AIInterface');
const HeuristicAI = require('./HeuristicAI');
const OllamaAgent = require('./OllamaAgent');
// ToolAgent 已融合进 OllamaAgent，tool/toolagent 别名指向融合后的 OllamaAgent

// ── AI 注册表 ──
const registry = {
  heuristic: HeuristicAI,
  heuristicai: HeuristicAI,  // 别名
  ollama: OllamaAgent,
  ollamaagent: OllamaAgent,  // 别名
  tool: OllamaAgent,          // 已融合 → 指向 OllamaAgent
  toolagent: OllamaAgent,     // 已融合 → 指向 OllamaAgent
};

/**
 * 注册自定义 AI 实现
 * @param {string} name    - AI 名称（用作 createAI 的 type 参数）
 * @param {class}  AIClass - 继承 AIInterface 的类
 */
function registerAI(name, AIClass) {
  if (!(AIClass.prototype instanceof AIInterface)) {
    throw new Error(`registerAI: ${name} 必须继承 AIInterface`);
  }
  registry[name.toLowerCase()] = AIClass;
}

/**
 * 工厂函数：根据 type 创建 AI 实例
 * @param {string} type     - AI 类型: 'heuristic' | 'ollama' | 已注册的自定义名称
 * @param {object} options  - 传给 AI 构造函数的配置项
 * @returns {AIInterface}
 *
 * @example
 *   const ai = createAI('heuristic');                    // 启发式
 *   const agent = createAI('ollama', { model: 'qwen2.5:7b' }); // Ollama
 *   const agent = await createAI('ollama', {...}).decideAction(game, id); // 注意异步
 */
function createAI(type = 'heuristic', options = {}) {
  const key = type.toLowerCase();
  const AIClass = registry[key];

  if (!AIClass) {
    const available = Object.keys(registry).join(', ');
    throw new Error(`createAI: 未知 AI 类型 "${type}"，可用: ${available}`);
  }

  return new AIClass(options);
}

/**
 * 列出所有已注册的 AI 类型
 */
function listAIs() {
  return [...new Set(Object.keys(registry))];
}

// ── 导出 ──
module.exports = HeuristicAI;                              // 默认导出（向后兼容）
module.exports.AIInterface = AIInterface;
module.exports.HeuristicAI = HeuristicAI;
module.exports.OllamaAgent = OllamaAgent;
module.exports.ToolAgent = OllamaAgent;                    // 已融合，指向 OllamaAgent（兼容旧引用）
module.exports.createAI = createAI;
module.exports.registerAI = registerAI;
module.exports.listAIs = listAIs;
