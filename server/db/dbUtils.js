const db = require('./schema');

class DatabaseUtils {
  // ============ 用户相关 ============
  
  // 创建新用户
  createUser(username, passwordHash) {
    return new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO users (username, password_hash) VALUES (?, ?)',
        [username, passwordHash],
        function(err) {
          if (err) reject(err);
          else {
            // 同时初始化统计数据
            db.run('INSERT INTO user_stats (user_id) VALUES (?)', [this.lastID]);
            resolve({ id: this.lastID, username });
          }
        }
      );
    });
  }
  
  // 根据用户名查找用户
  findUserByUsername(username) {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT id, username, avatar, level, exp, created_at, last_login FROM users WHERE username = ?',
        [username],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }
  
  // 更新最后登录时间
  updateLastLogin(userId) {
    db.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [userId]);
  }
  
  // ============ 卡牌收藏相关 ============
  
  // 给用户添加卡牌
  addCardToUser(userId, cardId, quantity = 1) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO user_cards (user_id, card_id, quantity) 
         VALUES (?, ?, ?) 
         ON CONFLICT(user_id, card_id) DO UPDATE SET quantity = quantity + ?`,
        [userId, cardId, quantity, quantity],
        function(err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });
  }
  
  // 获取用户的所有卡牌
  getUserCards(userId) {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT card_id, quantity, is_favorite FROM user_cards WHERE user_id = ?',
        [userId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }
  
  // ============ 卡组相关 ============
  
  // 创建卡组
  createDeck(userId, name, faction, cardIds) {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        db.run(
          'INSERT INTO decks (user_id, name, faction) VALUES (?, ?, ?)',
          [userId, name, faction],
          function(err) {
            if (err) {
              db.run('ROLLBACK');
              reject(err);
              return;
            }
            
            const deckId = this.lastID;
            const stmt = db.prepare('INSERT INTO deck_cards (deck_id, card_id, quantity) VALUES (?, ?, 1)');
            
            for (const cardId of cardIds) {
              stmt.run([deckId, cardId]);
            }
            
            stmt.finalize();
            db.run('COMMIT');
            resolve(deckId);
          }
        );
      });
    });
  }
  
  // 获取用户当前使用的卡组
  getActiveDeck(userId) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT d.* FROM decks d 
         WHERE d.user_id = ? AND d.is_active = 1`,
        [userId],
        (err, deck) => {
          if (err) reject(err);
          else if (!deck) resolve(null);
          else {
            // 获取卡组中的卡牌
            db.all(
              'SELECT card_id, quantity FROM deck_cards WHERE deck_id = ?',
              [deck.id],
              (err, cards) => {
                if (err) reject(err);
                else resolve({ ...deck, cards });
              }
            );
          }
        }
      );
    });
  }
  
  // ============ 对战记录相关 ============
  
  // 保存对局记录
  async saveMatch(matchData) {
    const {
      matchUuid,
      player1Id,
      player2Id,
      winnerId,
      player1Score,
      player2Score,
      roundsPlayed,
      matchType = 'casual'
    } = matchData;
    
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO matches (
          match_uuid, player1_id, player2_id, winner_id, 
          player1_score, player2_score, rounds_played, match_type, ended_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [matchUuid, player1Id, player2Id, winnerId, player1Score, player2Score, roundsPlayed, matchType],
        function(err) {
          if (err) reject(err);
          else {
            // 更新用户统计
            if (winnerId) {
              db.run('UPDATE user_stats SET total_matches = total_matches + 1, wins = wins + 1 WHERE user_id = ?', [winnerId]);
              const loserId = player1Id === winnerId ? player2Id : player1Id;
              if (loserId) {
                db.run('UPDATE user_stats SET total_matches = total_matches + 1, losses = losses + 1 WHERE user_id = ?', [loserId]);
              }
            }
            resolve(this.lastID);
          }
        }
      );
    });
  }
  
  // 获取用户对战历史
  getMatchHistory(userId, limit = 10) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT m.*, 
          u1.username as player1_name,
          u2.username as player2_name,
          uw.username as winner_name
         FROM matches m
         LEFT JOIN users u1 ON m.player1_id = u1.id
         LEFT JOIN users u2 ON m.player2_id = u2.id
         LEFT JOIN users uw ON m.winner_id = uw.id
         WHERE m.player1_id = ? OR m.player2_id = ?
         ORDER BY m.started_at DESC
         LIMIT ?`,
        [userId, userId, limit],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }
  
  // 获取用户统计
  getUserStats(userId) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT * FROM user_stats WHERE user_id = ?`,
        [userId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row || { total_matches: 0, wins: 0, losses: 0, draws: 0 });
        }
      );
    });
  }
  
  // ============ 初始化默认数据 ============
  
  // 给新用户发初始卡牌
  async initNewUserCards(userId) {
    const starterCards = ['001', '001', '001', '002', '002', '003', '004'];  // 卡牌ID
    for (const cardId of starterCards) {
      await this.addCardToUser(userId, cardId);
    }
    console.log(`用户 ${userId} 获得初始卡牌`);
  }

  // ============ 查找或创建用户（无需密码） ============
  findOrCreateUser(username) {
    return new Promise((resolve, reject) => {
      this.findUserByUsername(username).then(user => {
        if (user) return resolve(user);
        // 创建新用户（用空占位密码）
        db.run(
          'INSERT INTO users (username, password_hash) VALUES (?, ?)',
          [username, ''],
          function(err) {
            if (err) return reject(err);
            db.run('INSERT INTO user_stats (user_id) VALUES (?)', [this.lastID]);
            resolve({ id: this.lastID, username });
          }
        );
      }).catch(reject);
    });
  }

  // ============ 获取用户所有卡组 ============
  getUserDecks(userId) {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT id, name, faction, leader_id, is_active, created_at, updated_at FROM decks WHERE user_id = ? ORDER BY updated_at DESC',
        [userId],
        (err, decks) => {
          if (err) return reject(err);
          if (!decks.length) return resolve([]);
          // 为每个卡组加载卡牌列表
          let pending = decks.length;
          decks.forEach((deck, i) => {
            db.all(
              'SELECT card_id, quantity FROM deck_cards WHERE deck_id = ?',
              [deck.id],
              (err2, cards) => {
                decks[i].cards = cards || [];
                if (--pending === 0) resolve(decks);
              }
            );
          });
        }
      );
    });
  }

  // ============ 保存新卡组 ============
  saveDeck(userId, name, faction, leaderId, cardIds) {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        db.run(
          'INSERT INTO decks (user_id, name, faction, leader_id) VALUES (?, ?, ?, ?)',
          [userId, name, faction, leaderId || null],
          function(err) {
            if (err) { db.run('ROLLBACK'); return reject(err); }
            const deckId = this.lastID;
            const stmt = db.prepare('INSERT INTO deck_cards (deck_id, card_id, quantity) VALUES (?, ?, 1)');
            for (const { id, count } of cardIds) {
              const qty = count || 1;
              for (let i = 0; i < qty; i++) stmt.run([deckId, id]);
            }
            stmt.finalize();
            db.run('COMMIT');
            resolve(deckId);
          }
        );
      });
    });
  }

  // ============ 更新卡组 ============
  updateDeck(deckId, name, faction, leaderId, cardIds) {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        db.run(
          'UPDATE decks SET name = ?, faction = ?, leader_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [name, faction, leaderId || null, deckId],
          function(err) {
            if (err) { db.run('ROLLBACK'); return reject(err); }
            // 清空旧卡牌再插入新卡牌
            db.run('DELETE FROM deck_cards WHERE deck_id = ?', [deckId]);
            const stmt = db.prepare('INSERT INTO deck_cards (deck_id, card_id, quantity) VALUES (?, ?, 1)');
            for (const { id, count } of cardIds) {
              const qty = count || 1;
              for (let i = 0; i < qty; i++) stmt.run([deckId, id]);
            }
            stmt.finalize();
            db.run('COMMIT');
            resolve(deckId);
          }
        );
      });
    });
  }

  // ============ 删除卡组 ============
  deleteDeck(deckId) {
    return new Promise((resolve, reject) => {
      db.run('DELETE FROM decks WHERE id = ?', [deckId], function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
  }
}

module.exports = new DatabaseUtils();