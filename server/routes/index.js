const express = require('express');
const router = express.Router();
const dbUtils = require('../db/dbUtils');
const { allCards, factions, nLeaders, sp, neu } = require('../gameLogic/cards');

// ==================== 卡牌数据 ====================

router.get('/cards', (req, res) => {
  // 返回所有卡牌 + 阵营信息（供前端卡组配置使用）
  const cardsList = Object.values(allCards).map(c => ({
    id: c.id, name: c.name, type: c.type, power: c.power,
    faction: c.faction, row: c.row, ability: c.ability,
    heroAbility: c.heroAbility,
    rarity: c.rarity, isHero: c.isHero, isSpy: c.isSpy,
    isMedic: c.isMedic, isMuster: c.isMuster,
    isTightBond: c.isTightBond, isMoraleBoost: c.isMoraleBoost,
    isScorch: c.isScorch, isAgile: c.isAgile, agileRows: c.agileRows,
  }));
  // 阵营信息（含领袖）
  const factionInfo = {};
  for (const [key, val] of Object.entries(factions)) {
    factionInfo[key] = { name: val.name, leaders: val.leaders.map(l => ({ id: l.id, name: l.name, ability: l.ability, faction: l.faction })) };
  }
  res.json({ success: true, cards: cardsList, factions: factionInfo });
});

// ==================== 健康检查 ====================

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ==================== 对局历史 ====================

// GET /api/matches/:userId?limit=10
router.get('/matches/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    if (isNaN(userId) || userId <= 0) {
      return res.status(400).json({ error: '无效的用户 ID' });
    }

    const rawLimit = parseInt(req.query.limit, 10);
    const limit = isNaN(rawLimit) || rawLimit < 1 ? 10 : Math.min(rawLimit, 50);
    const matches = await dbUtils.getMatchHistory(userId, limit);

    res.json({
      success: true,
      data: matches,
      count: matches.length,
    });
  } catch (err) {
    console.error('获取对局历史失败:', err.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// ==================== 用户统计 ====================

// GET /api/stats/:userId
router.get('/stats/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    if (isNaN(userId) || userId <= 0) {
      return res.status(400).json({ error: '无效的用户 ID' });
    }

    const stats = await dbUtils.getUserStats(userId);
    const safeStats = stats || { total_matches: 0, wins: 0, losses: 0, draws: 0 };

    // 计算胜率
    const total = safeStats.total_matches || 0;
    const winRate = total > 0 ? ((safeStats.wins || 0) / total * 100).toFixed(1) : '0.0';

    res.json({
      success: true,
      data: {
        ...safeStats,
        winRate: `${winRate}%`,
      },
    });
  } catch (err) {
    console.error('获取用户统计失败:', err.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// ==================== 卡组保存/加载 ====================

// POST /api/decks/save
router.post('/decks/save', async (req, res) => {
  try {
    const { username, deckName, faction, leaderId, cards, deckId } = req.body || {};
    if (!username || !deckName || !faction || !cards || !cards.length) {
      return res.status(400).json({ error: '缺少必要字段: username, deckName, faction, cards' });
    }

    // 验证阵营合法性
    const validFactions = ['northern', 'nilfgaard', 'scoiatael', 'monsters', 'neutral'];
    if (!validFactions.includes(faction)) {
      return res.status(400).json({ error: `无效的阵营: ${faction}，可选: ${validFactions.join(', ')}` });
    }

    // 验证卡牌数组结构
    if (!Array.isArray(cards) || cards.some(c => !c.id)) {
      return res.status(400).json({ error: 'cards 格式错误，每项需包含 id' });
    }

    // 验证 deckId（更新时）
    if (deckId !== undefined && deckId !== null) {
      const parsedId = parseInt(deckId, 10);
      if (isNaN(parsedId) || parsedId <= 0) {
        return res.status(400).json({ error: '无效的 deckId' });
      }
    }

    const user = await dbUtils.findOrCreateUser(username);

    // 将客户端卡牌数组转换为 cardIds 格式 [{id, count}]
    const cardCounts = {};
    for (const card of cards) {
      cardCounts[card.id] = (cardCounts[card.id] || 0) + 1;
    }
    const cardIds = Object.entries(cardCounts).map(([id, count]) => ({ id, count }));

    let resultId;
    if (deckId) {
      // 更新已有卡组
      await dbUtils.updateDeck(deckId, deckName, faction, leaderId, cardIds);
      resultId = deckId;
    } else {
      // 新建卡组
      resultId = await dbUtils.saveDeck(user.id, deckName, faction, leaderId, cardIds);
    }
    res.json({ success: true, deckId: resultId });
  } catch (err) {
    console.error('保存卡组失败:', err.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// GET /api/decks/:username
router.get('/decks/:username', async (req, res) => {
  try {
    const { username } = req.params;
    if (!username) return res.status(400).json({ error: '缺少用户名' });

    const user = await dbUtils.findOrCreateUser(username);
    const decks = await dbUtils.getUserDecks(user.id);

    // 将数据库格式转为客户端格式
    const result = decks.map(d => ({
      id: d.id,
      name: d.name,
      faction: d.faction,
      leaderId: d.leader_id,
      cardIds: (d.cards || []).map(c => ({ id: c.card_id, count: c.quantity })),
      createdAt: d.created_at,
      updatedAt: d.updated_at
    }));
    res.json({ success: true, decks: result });
  } catch (err) {
    console.error('获取卡组失败:', err.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// DELETE /api/decks/:id
router.delete('/decks/:deckId', async (req, res) => {
  try {
    const deckId = parseInt(req.params.deckId, 10);
    if (isNaN(deckId) || deckId <= 0) {
      return res.status(400).json({ error: '无效的卡组 ID' });
    }
    await dbUtils.deleteDeck(deckId);
    res.json({ success: true });
  } catch (err) {
    console.error('删除卡组失败:', err.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

module.exports = router;
