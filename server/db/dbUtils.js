const db = require('./schema');

// 预编译常用语句（性能优化）
const stmts = {
  createUser: db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)'),
  initStats: db.prepare('INSERT INTO user_stats (user_id) VALUES (?)'),
  findUserByUsername: db.prepare(
    'SELECT id, username, avatar, level, exp, created_at, last_login FROM users WHERE username = ?'
  ),
  updateLastLogin: db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?'),
  addCardToUser: db.prepare(
    `INSERT INTO user_cards (user_id, card_id, quantity)
     VALUES (?, ?, ?)
     ON CONFLICT(user_id, card_id) DO UPDATE SET quantity = quantity + ?`
  ),
  getUserCards: db.prepare('SELECT card_id, quantity, is_favorite FROM user_cards WHERE user_id = ?'),
  getUserDecks: db.prepare(
    'SELECT id, name, faction, leader_id, is_active, created_at, updated_at FROM decks WHERE user_id = ? ORDER BY updated_at DESC'
  ),
  getDeckCards: db.prepare('SELECT card_id, quantity FROM deck_cards WHERE deck_id = ?'),
  getActiveDeck: db.prepare(
    'SELECT id, name, faction, leader_id, is_active, created_at, updated_at FROM decks WHERE user_id = ? AND is_active = 1'
  ),
  insertMatch: db.prepare(
    `INSERT INTO matches (match_uuid, player1_id, player2_id, winner_id,
      player1_score, player2_score, rounds_played, match_type, ended_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
  ),
  incrementWin: db.prepare(
    'UPDATE user_stats SET total_matches = total_matches + 1, wins = wins + 1 WHERE user_id = ?'
  ),
  incrementLoss: db.prepare(
    'UPDATE user_stats SET total_matches = total_matches + 1, losses = losses + 1 WHERE user_id = ?'
  ),
  getMatchHistory: db.prepare(
    `SELECT m.*, u1.username as player1_name, u2.username as player2_name, uw.username as winner_name
     FROM matches m
     LEFT JOIN users u1 ON m.player1_id = u1.id
     LEFT JOIN users u2 ON m.player2_id = u2.id
     LEFT JOIN users uw ON m.winner_id = uw.id
     WHERE m.player1_id = ? OR m.player2_id = ?
     ORDER BY m.started_at DESC LIMIT ?`
  ),
  getUserStats: db.prepare('SELECT * FROM user_stats WHERE user_id = ?'),
  insertDeck: db.prepare('INSERT INTO decks (user_id, name, faction, leader_id) VALUES (?, ?, ?, ?)'),
  insertDeckCard: db.prepare('INSERT INTO deck_cards (deck_id, card_id, quantity) VALUES (?, ?, 1)'),
  updateDeckMeta: db.prepare(
    'UPDATE decks SET name = ?, faction = ?, leader_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ),
  deleteDeckCards: db.prepare('DELETE FROM deck_cards WHERE deck_id = ?'),
  deleteDeck: db.prepare('DELETE FROM decks WHERE id = ?'),
};

class DatabaseUtils {
  // ============ 用户相关 ============

  /** 创建新用户，返回 { id, username } */
  createUser(username, passwordHash) {
    const result = stmts.createUser.run(username, passwordHash);
    const id = result.lastInsertRowid;
    stmts.initStats.run(id);
    return { id, username };
  }

  /** 根据用户名查找用户，返回用户对象或 null */
  findUserByUsername(username) {
    return stmts.findUserByUsername.get(username) || null;
  }

  /** 更新最后登录时间 */
  updateLastLogin(userId) {
    stmts.updateLastLogin.run(userId);
  }

  // ============ 卡牌收藏相关 ============

  /** 给用户添加卡牌，返回 affected rows */
  addCardToUser(userId, cardId, quantity = 1) {
    return stmts.addCardToUser.run(userId, cardId, quantity, quantity).changes;
  }

  /** 获取用户的所有卡牌 */
  getUserCards(userId) {
    return stmts.getUserCards.all(userId);
  }

  // ============ 卡组相关 ============

  /** 创建卡组（事务包装） */
  createDeck(userId, name, faction, cardIds) {
    const txn = db.transaction(() => {
      const result = db.prepare('INSERT INTO decks (user_id, name, faction) VALUES (?, ?, ?)').run(userId, name, faction);
      const deckId = result.lastInsertRowid;
      const ins = db.prepare('INSERT INTO deck_cards (deck_id, card_id, quantity) VALUES (?, ?, 1)');
      for (const cardId of cardIds) ins.run(deckId, cardId);
      return deckId;
    });
    return txn();
  }

  /** 获取用户当前使用的卡组（含卡牌列表） */
  getActiveDeck(userId) {
    const deck = stmts.getActiveDeck.get(userId);
    if (!deck) return null;
    deck.cards = stmts.getDeckCards.all(deck.id);
    return deck;
  }

  // ============ 对战记录相关 ============

  /**
   * 保存对局记录。
   * 返回 Promise<matchId> 以保持与 gameManager 中 await 的兼容性。
   */
  saveMatch(matchData) {
    const { matchUuid, player1Id, player2Id, winnerId, player1Score, player2Score, roundsPlayed, matchType = 'casual' } = matchData;
    const matchId = db.transaction(() => {
      const result = stmts.insertMatch.run(matchUuid, player1Id, player2Id, winnerId, player1Score, player2Score, roundsPlayed, matchType);
      if (winnerId) {
        stmts.incrementWin.run(winnerId);
        const loserId = player1Id === winnerId ? player2Id : player1Id;
        if (loserId) stmts.incrementLoss.run(loserId);
      }
      return result.lastInsertRowid;
    })();
    return Promise.resolve(matchId);
  }

  /** 获取用户对战历史 */
  getMatchHistory(userId, limit = 10) {
    return stmts.getMatchHistory.all(userId, userId, limit);
  }

  /** 获取用户统计 */
  getUserStats(userId) {
    return stmts.getUserStats.get(userId) || { total_matches: 0, wins: 0, losses: 0, draws: 0 };
  }

  // ============ 初始化默认数据 ============

  /** 给新用户发初始卡牌。保持 async 兼容旧调用者 */
  initNewUserCards(userId) {
    const starterCards = ['001', '001', '001', '002', '002', '003', '004'];
    for (const cardId of starterCards) this.addCardToUser(userId, cardId);
    console.log(`用户 ${userId} 获得初始卡牌`);
    return Promise.resolve();
  }

  // ============ 查找或创建用户（无需密码）============

  findOrCreateUser(username) {
    const existing = this.findUserByUsername(username);
    if (existing) return existing;
    return this.createUser(username, '');
  }

  // ============ 获取用户所有卡组 ============

  getUserDecks(userId) {
    const decks = stmts.getUserDecks.all(userId);
    for (const deck of decks) {
      deck.cards = stmts.getDeckCards.all(deck.id);
    }
    return decks;
  }

  // ============ 保存新卡组（含 leaderId）============

  saveDeck(userId, name, faction, leaderId, cardIds) {
    return db.transaction(() => {
      const result = stmts.insertDeck.run(userId, name, faction, leaderId || null);
      const deckId = result.lastInsertRowid;
      for (const { id, count } of cardIds) {
        const qty = count || 1;
        for (let i = 0; i < qty; i++) stmts.insertDeckCard.run(deckId, id);
      }
      return deckId;
    })();
  }

  // ============ 更新卡组 ============

  updateDeck(deckId, name, faction, leaderId, cardIds) {
    return db.transaction(() => {
      stmts.updateDeckMeta.run(name, faction, leaderId || null, deckId);
      stmts.deleteDeckCards.run(deckId);
      for (const { id, count } of cardIds) {
        const qty = count || 1;
        for (let i = 0; i < qty; i++) stmts.insertDeckCard.run(deckId, id);
      }
      return deckId;
    })();
  }

  // ============ 删除卡组 ============

  deleteDeck(deckId) {
    return stmts.deleteDeck.run(deckId).changes;
  }
}

module.exports = new DatabaseUtils();