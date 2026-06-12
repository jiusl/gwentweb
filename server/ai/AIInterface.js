/**
 * AI 决策接口 —— 抽象基类
 *
 * 所有 AI 实现（启发式 / Ollama Agent / 远程大模型等）必须继承此类，
 * 实现 decideAction(game, playerId) 方法。
 *
 * 返回值规范：
 *   { action: 'playCard', cardIndex: number, row: 'melee'|'ranged'|'siege'[, targetCardId?: string] }
 *   { action: 'pass' }
 */

class AIInterface {
  /**
   * 返回 AI 的名称标识，用于日志 / 调试
   * @returns {string}
   */
  getName() {
    throw new Error('AIInterface.getName() must be implemented by subclass');
  }

  /**
   * 核心决策方法
   * @param {object} game  - GameManager 实例（含 players / weather / horn / updateScores / getOpponentId）
   * @param {string} playerId - AI 玩家的 ID
   * @returns {{ action: 'playCard'|'pass', cardIndex?: number, row?: string, targetCardId?: string }}
   */
  decideAction(game, playerId) {
    throw new Error('AIInterface.decideAction() must be implemented by subclass');
  }

  /**
   * 可选的初始化钩子：在每场对局开始时调用
   * @param {string} opponentName - 对手名称
   * @param {string} faction      - AI 所属阵营
   * @param {object} leader       - 领袖牌信息
   */
  onMatchStart(opponentName, faction, leader) {
    // 默认空实现，子类可按需覆写
  }

  /**
   * 可选的对局结束钩子
   * @param {boolean} won       - 是否获胜
   * @param {number}  roundsWon - 赢下的小局数
   */
  onMatchEnd(won, roundsWon) {
    // 默认空实现，子类可按需覆写
  }

  /**
   * 每回合结束后的反馈钩子（用于学习型 Agent）
   * @param {object}  myAction    - AI 本回合决策
   * @param {object}  oppAction   - 对手本回合行动
   * @param {object}  gameState   - 行动后的游戏状态快照
   */
  onTurnEnd(myAction, oppAction, gameState) {
    // 默认空实现
  }
}

module.exports = AIInterface;
