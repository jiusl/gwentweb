const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'gwent.db');
const db = new sqlite3.Database(dbPath);

// 开启外键约束
db.run('PRAGMA foreign_keys = ON');

// 创建所有表
db.serialize(() => {
  // 1. 用户表
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      avatar TEXT DEFAULT 'default.png',
      level INTEGER DEFAULT 1,
      exp INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME
    )
  `);

  // 2. 卡牌收藏表（用户拥有哪些卡牌）
  db.run(`
    CREATE TABLE IF NOT EXISTS user_cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      card_id TEXT NOT NULL,        -- 对应 cards.js 中的卡牌ID
      quantity INTEGER DEFAULT 1,   -- 拥有数量（最多2张铜卡，1张金卡）
      is_favorite BOOLEAN DEFAULT 0,
      obtained_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, card_id)
    )
  `);

  // 3. 卡组表（玩家预设的卡组）
  db.run(`
    CREATE TABLE IF NOT EXISTS decks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      faction TEXT NOT NULL,        -- northern, nilfgaard, monsters, scoiatael
      is_active BOOLEAN DEFAULT 0,  -- 是否为当前使用的卡组
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 4. 卡组详情表（卡组中包含哪些卡牌）
  db.run(`
    CREATE TABLE IF NOT EXISTS deck_cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      deck_id INTEGER NOT NULL,
      card_id TEXT NOT NULL,
      quantity INTEGER DEFAULT 1,
      FOREIGN KEY (deck_id) REFERENCES decks(id) ON DELETE CASCADE
    )
  `);

  // 5. 对战记录表
  db.run(`
    CREATE TABLE IF NOT EXISTS matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_uuid TEXT UNIQUE NOT NULL,  -- 与 GameState.gameId 对应
      player1_id INTEGER NOT NULL,
      player2_id INTEGER,               -- NULL 表示对 AI
      winner_id INTEGER,
      player1_score INTEGER,            -- 赢了几小局（0-2）
      player2_score INTEGER,
      rounds_played INTEGER,            -- 实际进行的小局数
      match_type TEXT DEFAULT 'casual', -- casual, ranked, vs_ai
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ended_at DATETIME,
      FOREIGN KEY (player1_id) REFERENCES users(id),
      FOREIGN KEY (player2_id) REFERENCES users(id),
      FOREIGN KEY (winner_id) REFERENCES users(id)
    )
  `);

  // 6. 单局详情表（每一小局的详细数据，用于复盘）
  db.run(`
    CREATE TABLE IF NOT EXISTS rounds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id INTEGER NOT NULL,
      round_number INTEGER NOT NULL,
      winner_id INTEGER,
      player1_score INTEGER,            -- 这一小局的战场分数
      player2_score INTEGER,
      replay_data TEXT,                 -- JSON 格式的回合记录
      FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE
    )
  `);

  // 7. 统计数据表（用户总胜场等，避免每次都实时计算）
  db.run(`
    CREATE TABLE IF NOT EXISTS user_stats (
      user_id INTEGER PRIMARY KEY,
      total_matches INTEGER DEFAULT 0,
      wins INTEGER DEFAULT 0,
      losses INTEGER DEFAULT 0,
      draws INTEGER DEFAULT 0,
      total_points INTEGER DEFAULT 0,    -- 累计造成伤害/得分
      favorite_faction TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 8. 数据库迁移: 为卡组表添加 leader_id 字段（兼容已有表）
  db.run(`ALTER TABLE decks ADD COLUMN leader_id TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.warn('⚠️ 添加 leader_id 字段失败:', err.message);
    }
  });

  console.log('✅ 数据库表结构初始化完成');
});

module.exports = db;