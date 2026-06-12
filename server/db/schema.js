const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'gwent.db');
const db = new Database(dbPath);

// 开启 WAL 模式提升并发性能 + 外键约束
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// 创建所有表
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    avatar TEXT DEFAULT 'default.png',
    level INTEGER DEFAULT 1,
    exp INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
  );

  CREATE TABLE IF NOT EXISTS user_cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    card_id TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    is_favorite BOOLEAN DEFAULT 0,
    obtained_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, card_id)
  );

  CREATE TABLE IF NOT EXISTS decks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    faction TEXT NOT NULL,
    leader_id TEXT,
    is_active BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS deck_cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    deck_id INTEGER NOT NULL,
    card_id TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    FOREIGN KEY (deck_id) REFERENCES decks(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_uuid TEXT UNIQUE NOT NULL,
    player1_id INTEGER NOT NULL,
    player2_id INTEGER,
    winner_id INTEGER,
    player1_score INTEGER,
    player2_score INTEGER,
    rounds_played INTEGER,
    match_type TEXT DEFAULT 'casual',
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ended_at DATETIME,
    FOREIGN KEY (player1_id) REFERENCES users(id),
    FOREIGN KEY (player2_id) REFERENCES users(id),
    FOREIGN KEY (winner_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS rounds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id INTEGER NOT NULL,
    round_number INTEGER NOT NULL,
    winner_id INTEGER,
    player1_score INTEGER,
    player2_score INTEGER,
    replay_data TEXT,
    FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS user_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE NOT NULL,
    total_matches INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    draws INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

// 数据库迁移: 为卡组表添加 leader_id 字段（兼容已有表）
try {
  db.exec('ALTER TABLE decks ADD COLUMN leader_id TEXT');
} catch (err) {
  if (!err.message.includes('duplicate column')) {
    console.warn('⚠️ 添加 leader_id 字段失败:', err.message);
  }
}

console.log('✅ 数据库表结构初始化完成');

module.exports = db;