require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const GameManager = require('./gameLogic/gameManager');
const { createAI } = require('./ai');
const aiPlayer = createAI('ollama', {
  model: process.env.OLLAMA_MODEL,
  baseUrl: process.env.OLLAMA_BASE_URL,
  temperature: process.env.OLLAMA_TEMPERATURE ? parseFloat(process.env.OLLAMA_TEMPERATURE) : undefined,
  timeout: process.env.OLLAMA_TIMEOUT ? parseInt(process.env.OLLAMA_TIMEOUT) : undefined,
});
const heuristicAI = createAI('heuristic');  // 无 Ollama 时 / Ollama 失败时的回退
const gameManager = new GameManager();

// ── AI 实例映射：多 AI 对战时按玩家 ID 使用不同模型 ──
const aiInstanceMap = new Map();  // playerId → AI instance

// ── AI 对战追踪 ──
const aiBattleGames = new Set();  // gameId 集合，标记为纯 AI 对战（无人类玩家）
// ── AI 游戏内 ID → 大厅 ID 映射（ai_<timestamp> → AI_PLAYER_ID） ──
const aiGameToLobbyId = new Map();

// ── 大厅系统 ──
const socketToPlayer = new Map();   // socketId → playerId
const lobbyPlayers = new Map();     // playerId → { id, name, status, isAI, faction }
const pendingInvites = new Map();   // inviteId → { from, to, timestamp }
const AI_PLAYER_ID = 'ai_player';       // AI哥1 → HeuristicAI
const AI_PLAYER_2_ID = 'ai_player2';   // AI哥2 → OllamaAgent
const AI_DELAY_MS = 1500;

// ── 对手行动追踪（用于 AI onTurnEnd 反馈）──
const lastOpponentAction = new Map();  // gameId → { playerId, action, cardName, row }

// AI 始终在大厅
lobbyPlayers.set(AI_PLAYER_ID,   { id: AI_PLAYER_ID,   name: '🤖 AI哥1(启发式)', status: 'idle', isAI: true, faction: 'northern' });
lobbyPlayers.set(AI_PLAYER_2_ID, { id: AI_PLAYER_2_ID, name: '🧠 AI哥2(大模型)', status: 'idle', isAI: true, faction: 'northern' });

// ═══════ AI 游戏逻辑 ═══════

// AI 决策超时上限（毫秒），超过此时间强制 pass
const AI_HARD_TIMEOUT_MS = 25000;

/** 带超时的 Promise 包装 */
function _withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`[AI] ${label || '操作'} 超时 (${ms}ms)`)), ms)
    ),
  ]);
}

async function executeAITurn(gameId, aiId, io) {
  try {
    const game = gameManager.activeGames.get(gameId);
    if (!game || game.status !== 'playing' || game.activePlayer !== aiId) return;

    // 获取该 AI 玩家的专属实例（AI 对战用），否则回退到默认
    const ai = aiInstanceMap.get(aiId) || aiPlayer || heuristicAI;

    const decision = await _withTimeout(
      ai.decideAction(game, aiId),
      AI_HARD_TIMEOUT_MS,
      '决策'
    );
    if (!decision || !decision.action) {
      throw new Error('AI 返回无效决策');
    }

    // 旁观者/对手视角：AI 对战时 spectatorId 为对方 AI，人机对战时为人类
    const isAIBattle = aiBattleGames.has(gameId);
    const spectatorId = isAIBattle ? game.getOpponentId(aiId) : game.getOpponentId(aiId);

    if (decision.action === 'pass') {
      const result = gameManager.passTurn(gameId, aiId);
      if (result.success) {
        const oppAction = lastOpponentAction.get(gameId);
        ai.onTurnEnd({ action: 'pass' }, oppAction || null, gameManager.getClientGameState(gameId, spectatorId));
        lastOpponentAction.set(gameId, { action: 'pass', playerId: aiId });
        io.to(gameId).emit('gameStateUpdate', gameManager.getClientGameState(gameId, spectatorId));
        _checkAIPostAction(gameId, aiId, io);
      } else {
        console.error(`[AI] pass 失败: ${result.error}`);
      }
    } else if (decision.action === 'playCard') {
      let { cardIndex, row, targetCardId } = decision;
      const card = game.players[aiId].hand[cardIndex];
      // 安全兜底：如果卡牌有指定排位，强制使用卡牌的排位
      if (card && card.row && ['melee', 'ranged', 'siege'].includes(card.row)) {
        row = card.row;
      }
      console.log(`🤖${isAIBattle ? '⚔️' : ''} AI(${ai.getName()}) 打出: ${card?.name} → ${row || '?'}${targetCardId ? ' (目标:' + targetCardId + ')' : ''}`);
      const result = gameManager.playCard(gameId, aiId, cardIndex, row, targetCardId || null);
      if (result.success) {
        const oppAction = lastOpponentAction.get(gameId);
        ai.onTurnEnd(decision, oppAction || null, gameManager.getClientGameState(gameId, spectatorId));
        lastOpponentAction.set(gameId, { action: 'playCard', playerId: aiId, cardIndex, row, cardName: card?.name });
        io.to(gameId).emit('gameStateUpdate', gameManager.getClientGameState(gameId, spectatorId));
        if (result.events?.length) io.to(gameId).emit('cardEvents', result.events);
        _checkAIPostAction(gameId, aiId, io);
      } else {
        console.error(`[AI] playCard 失败: ${result.error}`, decision);
        // 出牌失败，回退到 pass
        const passResult = gameManager.passTurn(gameId, aiId);
        if (passResult.success) {
          io.to(gameId).emit('gameStateUpdate', gameManager.getClientGameState(gameId, spectatorId));
          _checkAIPostAction(gameId, aiId, io);
        }
      }
    } else {
      console.error(`[AI] 未知行动类型: ${decision.action}`);
    }
  } catch (err) {
    console.error(`[AI] executeAITurn 异常:`, err.message || err);
    // 异常时尝试 pass 兜底，避免游戏卡死
    try {
      const game = gameManager.activeGames.get(gameId);
      if (game && game.status === 'playing' && game.activePlayer === aiId) {
        const spectatorId = game.getOpponentId(aiId);
        const result = gameManager.passTurn(gameId, aiId);
        if (result.success) {
          io.to(gameId).emit('gameStateUpdate', gameManager.getClientGameState(gameId, spectatorId));
          _checkAIPostAction(gameId, aiId, io);
        }
      }
    } catch (e2) {
      console.error(`[AI] 异常恢复也失败了:`, e2.message || e2);
    }
  }
}
function _checkAIPostAction(gameId, aiId, io) {
  const game = gameManager.activeGames.get(gameId);
  if (!game) return;
  if (game.status === 'gameEnd') {
    io.to(gameId).emit('gameEnd', { winner: game.gameWinner });
    _finalizeGameEnd(gameId, io);
    return;
  }
  if (game.status === 'roundEnd') {
    // 纯 AI 对战：向旁观者广播小局结算
    if (aiBattleGames.has(gameId)) {
      io.to(gameId).emit('roundEnd', {
        roundWinner: game.roundWinner, currentRound: game.currentRound,
        scores: { [aiId]: game.players[aiId].roundsWon, [game.getOpponentId(aiId)]: game.players[game.getOpponentId(aiId)].roundsWon }
      });
    } else {
      const humanId = game.getOpponentId(aiId);
      io.to(gameId).emit('roundEnd', { roundWinner: game.roundWinner, currentRound: game.currentRound,
        scores: { [humanId]: game.players[humanId].roundsWon, [aiId]: game.players[aiId].roundsWon } });
    }
    setTimeout(() => _autoStartNextRound(gameId, io), 2000);
    return;
  }
  if (game.status === 'playing' && game.activePlayer === aiId)
    setTimeout(() => executeAITurn(gameId, aiId, io), AI_DELAY_MS);
}
/** 统一赛后处理：gameEnd/roundEnd 广播 + AI 触发 */
function _handlePostAction(gameId, playerId, io) {
  const game = gameManager.activeGames.get(gameId);
  if (!game) return;
  if (game.status === 'gameEnd') {
    io.to(gameId).emit('gameEnd', { winner: game.gameWinner });
    _finalizeGameEnd(gameId, io);
  } else if (game.status === 'roundEnd') {
    io.to(gameId).emit('roundEnd', {
      roundWinner: game.roundWinner, currentRound: game.currentRound,
      scores: { [playerId]: game.players[playerId].roundsWon, [game.getOpponentId(playerId)]: game.players[game.getOpponentId(playerId)].roundsWon }
    });
    setTimeout(() => _autoStartNextRound(gameId, io), 2000);
  }
  maybeTriggerAI(gameId, playerId, io);
}

function maybeTriggerAI(gameId, humanId, io) {
  const game = gameManager.activeGames.get(gameId);
  if (!game || game.status !== 'playing') return;
  const aiId = game.getOpponentId(humanId);
  if (aiId?.startsWith('ai_') && game.activePlayer === aiId)
    setTimeout(() => executeAITurn(gameId, aiId, io), AI_DELAY_MS);
}
function _finalizeGameEnd(gameId, io) {
  // 清理 AI 映射并重置 lobby 状态
  const game = gameManager.activeGames.get(gameId);
  if (game) {
    // 通知 AI 对局结束
    for (const pid of Object.keys(game.players || {})) {
      if (pid.startsWith('ai_')) {
        const aiInst = aiInstanceMap.get(pid);
        if (aiInst) {
          const player = game.players[pid];
          const won = game.gameWinner === pid;
          aiInst.onMatchEnd(won, player.roundsWon);
        }
      }
    }
    for (const pid of Object.keys(game.players || {})) {
      aiInstanceMap.delete(pid);
      const lobbyId = aiGameToLobbyId.get(pid) || pid;
      aiGameToLobbyId.delete(pid);
      const lp = lobbyPlayers.get(lobbyId);
      if (lp) lp.status = 'idle';
    }
  }
  lastOpponentAction.delete(gameId);
  gameManager.activeGames.delete(gameId);
  aiBattleGames.delete(gameId);
  // 通知大厅刷新玩家列表（AI 状态已恢复）
  io.emit('playerListUpdate', Array.from(lobbyPlayers.values()));
}
function _cleanupPlayerGames(playerId, socket, io) {
  const gamesToEnd = [];
  for (const [gameId, game] of gameManager.activeGames.entries()) {
    const playerIds = Object.keys(game.players || {});
    // 玩家是参与者，或玩家在 AI 对战房间中旁观
    if (playerIds.includes(playerId) || (socket && socket.rooms.has(gameId) && aiBattleGames.has(gameId))) {
      gamesToEnd.push(gameId);
    }
  }
  for (const gameId of gamesToEnd) {
    io.to(gameId).emit('gameEnd', { winner: null, reason: 'player_left' });
    _finalizeGameEnd(gameId, io);
  }
}
function _autoStartNextRound(gameId, io) {
  const game = gameManager.activeGames.get(gameId);
  if (!game || game.status !== 'roundEnd') return;
  const result = gameManager.startNextRound(gameId);
  if (!result.success) return;
  if (result.gameEnded) {
    io.to(gameId).emit('gameEnd', { winner: result.gameWinner });
    _finalizeGameEnd(gameId, io);
    return;
  }
  const playerIds = Object.keys(game.players);
  for (const pid of playerIds) {
    const state = gameManager.getClientGameState(gameId, pid);
    for (const [sid, mid] of socketToPlayer.entries()) {
      if (mid === pid) { io.to(sid).emit('gameStateUpdate', state); break; }
    }
  }
  // 若为纯 AI 对战，广播旁观者并触发下一轮 AI 行动
  if (aiBattleGames.has(gameId)) {
    io.to(gameId).emit('gameStateUpdate', gameManager.getClientGameState(gameId, playerIds[0]));
    const activeId = game.activePlayer;
    if (activeId?.startsWith('ai_'))
      setTimeout(() => executeAITurn(gameId, activeId, io), AI_DELAY_MS);
    return;
  }
  const humanId = playerIds.find(p => !p.startsWith('ai_'));
  if (humanId) maybeTriggerAI(gameId, humanId, io);
}

// ═══════ 邀请处理 ═══════
function _sendInvite(io, fromId, targetId) {
  const inviteId = `${fromId}_${targetId}_${Date.now()}`;
  pendingInvites.set(inviteId, { from: fromId, to: targetId, timestamp: Date.now() });
  // 发给目标
  const fromPlayer = lobbyPlayers.get(fromId);
  for (const [sid, pid] of socketToPlayer.entries()) {
    if (pid === targetId) {
      io.to(sid).emit('incomingInvite', { inviteId, from: fromId, fromName: fromPlayer?.name || 'Unknown' });
      return;
    }
  }
  // 目标是 AI：自动接受
  if (targetId === AI_PLAYER_ID || targetId === AI_PLAYER_2_ID) {
    setTimeout(() => _acceptInvite(io, inviteId, targetId, fromId), 800);
  }
}
function _acceptInvite(io, inviteId, targetId, fromId) {
  const inv = pendingInvites.get(inviteId);
  if (!inv) { console.log(`⚠️ _acceptInvite: 邀请 ${inviteId} 不存在`); return; }
  pendingInvites.delete(inviteId);
  console.log(`✅ 邀请已接受: ${fromId} ← ${targetId}, inviteId=${inviteId}`);
  // 通知发起人
  for (const [sid, pid] of socketToPlayer.entries()) {
    if (pid === fromId) {
      io.to(sid).emit('inviteResponse', { accepted: true, from: targetId, fromName: lobbyPlayers.get(targetId)?.name });
      console.log(`  → inviteResponse 已发送到 ${fromId}`);
      return;
    }
  }
  console.log(`⚠️ _acceptInvite: 未找到发起人 ${fromId} 的 socket`);
}
function _rejectInvite(io, inviteId, targetId, fromId) {
  const inv = pendingInvites.get(inviteId);
  if (!inv) return;
  pendingInvites.delete(inviteId);
  for (const [sid, pid] of socketToPlayer.entries()) {
    if (pid === fromId)
      io.to(sid).emit('inviteResponse', { accepted: false, from: targetId, fromName: lobbyPlayers.get(targetId)?.name });
  }
}

// ═══════ 开始对战 ═══════
function _startMatch(io, player1Id, player2Id, deck1, leader1) {
  const p1 = lobbyPlayers.get(player1Id);
  const p2 = lobbyPlayers.get(player2Id);
  if (p1) p1.status = 'playing';
  if (p2) p2.status = 'playing';
  io.emit('playerListUpdate', Array.from(lobbyPlayers.values()));

  const isAI = player2Id === AI_PLAYER_ID || player2Id === AI_PLAYER_2_ID;
  const actualP2Id = isAI ? `ai_${Date.now()}` : player2Id;
  // 根据对手选 AI 实例：AI哥1 → heuristic，AI哥2 → ollama
  if (player2Id === AI_PLAYER_ID) {
    aiInstanceMap.set(actualP2Id, heuristicAI);
  } else if (player2Id === AI_PLAYER_2_ID) {
    aiInstanceMap.set(actualP2Id, aiPlayer);
  }
  if (isAI) {
    aiGameToLobbyId.set(actualP2Id, player2Id);
  }
  // 检测玩家阵营 → 为 AI 选择克制阵营
  let aiFaction = 'northern';
  if (isAI) {
    const playerFaction = leader1?.faction || 'northern';
    const { getCounterFaction } = require('./ai/skills');
    aiFaction = getCounterFaction(playerFaction);
    console.log(`🧠 AI 根据玩家阵营 ${playerFaction} → 选择克制阵营 ${aiFaction}`);
  }
  // 传 leader2=aiFaction（string 类型，gameManager 据此自动选卡组+领袖）
  const game = gameManager.createGame(player1Id, actualP2Id, deck1, null, leader1, isAI ? aiFaction : null);
  game.humanName = p1?.name;  // 存储玩家名，供 DB 持久化时查找用户

  // 通知 AI 对局开始（设置阵营上下文等）
  if (isAI) {
    const aiInst = aiInstanceMap.get(actualP2Id);
    if (aiInst) {
      const aiLeader = game.players[actualP2Id].leader;
      aiInst.onMatchStart(p1?.name || '玩家', aiFaction, aiLeader);
    }
  }

  // 通知玩家1（发起者）
  for (const [sid, pid] of socketToPlayer.entries()) {
    if (pid === player1Id) {
      io.to(sid).socketsJoin(game.gameId);
      io.to(sid).emit('gameStarted', { gameId: game.gameId, gameState: gameManager.getClientGameState(game.gameId, player1Id) });
      break;
    }
  }
  // 通知玩家2（人类对手）
  if (!isAI) {
    for (const [sid, pid] of socketToPlayer.entries()) {
      if (pid === player2Id) {
        io.to(sid).socketsJoin(game.gameId);
        io.to(sid).emit('gameStarted', { gameId: game.gameId, gameState: gameManager.getClientGameState(game.gameId, player2Id) });
        break;
      }
    }
  }

  maybeTriggerAI(game.gameId, player1Id, io);
}

// ═══════ Express + Socket.IO ═══════
const app = express();
const server = http.createServer(app);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:3000';
const io = new Server(server, { cors: { origin: CLIENT_ORIGIN, methods: ['GET', 'POST'] } });
app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json());
app.use('/api', require('./routes'));

// ── 生产环境：托管前端静态资源 ──
const clientBuildPath = path.join(__dirname, '..', 'client', 'build');
const fs = require('fs');
if (fs.existsSync(clientBuildPath)) {
  // 静态资源托管（带 hash 的文件缓存 1 年，index.html 不缓存）
  app.use(express.static(clientBuildPath, {
    maxAge: '1y',
    immutable: true,
    setHeaders: (res, filePath) => {
      // index.html 禁止缓存，确保浏览器总获取最新版本
      if (filePath.endsWith('index.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.removeHeader('Expires');
        res.removeHeader('Pragma');
      }
    }
  }));
  // SPA fallback：非 API/WebSocket 路径返回 index.html
  app.use((req, res, next) => {
    // 只处理 GET/HEAD 请求，跳过 API 和 Socket.IO
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) return next();
    // 如果静态中间件已经处理（文件存在），不会走到这里
    // 走到这里说明文件不存在，返回 index.html 走前端路由
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  });
  console.log('📦 已启用前端静态资源托管:', clientBuildPath);
} else {
  console.warn('⚠️ 前端构建产物不存在:', clientBuildPath);
  console.warn('   请在部署前运行: npm run build');
}

io.on('connection', (socket) => {
  console.log('新连接:', socket.id);

  // ── 加入大厅 ──
  socket.on('joinLobby', (data) => {
    const { name } = data || {};
    const playerId = socket.id;
    const displayName = name || `玩家 ${playerId.slice(-4)}`;
    socketToPlayer.set(socket.id, playerId);
    lobbyPlayers.set(playerId, { id: playerId, name: displayName, status: 'idle', isAI: false, faction: 'northern' });
    // 广播玩家列表更新
    io.emit('playerListUpdate', Array.from(lobbyPlayers.values()));
    console.log(`🏠 ${displayName} 进入大厅`);
  });

  // ── 获取玩家列表 ──
  socket.on('getPlayerList', () => {
    socket.emit('playerListUpdate', Array.from(lobbyPlayers.values()));
  });

  // ── 邀请玩家 ──
  socket.on('invitePlayer', (data) => {
    const { targetId } = data || {};
    const fromId = socketToPlayer.get(socket.id);
    if (!fromId) { console.log('⚠️ invitePlayer: 未找到发起人 socket'); return; }
    const fromPlayer = lobbyPlayers.get(fromId);
    if (!fromPlayer) { console.log('⚠️ invitePlayer: 发起人不在大厅'); return; }
    if (fromPlayer.status !== 'idle') {
      console.log(`⚠️ invitePlayer: ${fromPlayer.name} 状态为 ${fromPlayer.status}，无法邀请`);
      socket.emit('error', { message: '你当前无法发起邀请' });
      return;
    }
    const target = lobbyPlayers.get(targetId);
    if (!target) { console.log(`⚠️ invitePlayer: 目标 ${targetId} 不在大厅`); return; }
    if (target.status !== 'idle') {
      console.log(`⚠️ invitePlayer: 目标 ${target.name} 状态为 ${target.status}`);
      socket.emit('error', { message: `${target.name} 当前无法接受邀请` });
      return;
    }
    if (targetId === fromId) return;

    fromPlayer.status = 'pending';
    target.status = 'pending';
    io.emit('playerListUpdate', Array.from(lobbyPlayers.values()));
    _sendInvite(io, fromId, targetId);
    console.log(`📨 ${fromPlayer.name} → ${target.name} 邀请对战`);
  });

  // ── 响应邀请 ──
  socket.on('respondInvite', (data) => {
    const { inviteId, accept } = data || {};
    const myId = socketToPlayer.get(socket.id);
    const inv = pendingInvites.get(inviteId);
    if (!inv || inv.to !== myId) return;
    if (accept) {
      _acceptInvite(io, inviteId, myId, inv.from);
    } else {
      _rejectInvite(io, inviteId, myId, inv.from);
      const p = lobbyPlayers.get(inv.from);
      if (p) p.status = 'idle';
      const me = lobbyPlayers.get(myId);
      if (me) me.status = 'idle';
      io.emit('playerListUpdate', Array.from(lobbyPlayers.values()));
    }
  });

  // ── 发起人确认开始对战（收到 inviteResponse accepted 后）──
  socket.on('startMatch', (data) => {
    const { opponentId, deck, leader } = data || {};
    const playerId = socketToPlayer.get(socket.id);
    if (!playerId) return;
    _startMatch(io, playerId, opponentId, deck, leader);
    io.emit('playerListUpdate', Array.from(lobbyPlayers.values()));
  });

  // ── 取消邀请 ──
  socket.on('cancelInvite', () => {
    const playerId = socketToPlayer.get(socket.id);
    if (!playerId) return;
    // 清理该玩家相关的待处理邀请
    for (const [iid, inv] of pendingInvites.entries()) {
      if (inv.from === playerId) {
        pendingInvites.delete(iid);
        for (const [sid, pid] of socketToPlayer.entries()) {
          if (pid === inv.to) io.to(sid).emit('inviteCancelled', { inviteId: iid });
        }
      }
    }
    const p = lobbyPlayers.get(playerId);
    if (p) p.status = 'idle';
    io.emit('playerListUpdate', Array.from(lobbyPlayers.values()));
  });

  // ═══════ 游戏中事件 ═══════
  socket.on('playCard', (data) => {
    const { gameId, cardIndex, row, targetCardId } = data;
    const playerId = socketToPlayer.get(socket.id);
    if (!playerId) return;
    // 记录玩家行动（供 AI onTurnEnd 反馈）
    const preGame = gameManager.activeGames.get(gameId);
    const preCard = preGame?.players[playerId]?.hand[cardIndex];
    const result = gameManager.playCard(gameId, playerId, cardIndex, row, targetCardId || null);
    if (result.success) {
      lastOpponentAction.set(gameId, { action: 'playCard', playerId, cardIndex, row, cardName: preCard?.name });
      io.to(gameId).emit('gameStateUpdate', result.gameState);
      if (result.events?.length) io.to(gameId).emit('cardEvents', result.events);
      _handlePostAction(gameId, playerId, io);
    } else socket.emit('error', { message: result.error });
  });

  socket.on('pass', (data) => {
    const { gameId } = data;
    const playerId = socketToPlayer.get(socket.id);
    if (!playerId) return;
    const result = gameManager.passTurn(gameId, playerId);
    if (result.success) {
      lastOpponentAction.set(gameId, { action: 'pass', playerId });
      io.to(gameId).emit('gameStateUpdate', result.gameState);
      _handlePostAction(gameId, playerId, io);
    } else socket.emit('error', { message: result.error });
  });

  socket.on('useLeader', (data) => {
    const { gameId, row } = data || {};
    const playerId = socketToPlayer.get(socket.id);
    if (!playerId) return;
    const result = gameManager.useLeaderAbility(gameId, playerId, row || null);
    if (result.success) {
      io.to(gameId).emit('gameStateUpdate', result.gameState);
      if (result.events?.length) io.to(gameId).emit('cardEvents', result.events);
      _handlePostAction(gameId, playerId, io);
    } else socket.emit('error', { message: result.error });
  });

  // ── AI 对战：两个 AI 模型互博，人类旁观 ──
  socket.on('startAIBattle', (data) => {
    const { model1, model2, baseUrl1, baseUrl2 } = data || {};
    const playerId = socketToPlayer.get(socket.id);
    if (!playerId) return;

    const p1Id = `ai_battle_1_${Date.now()}`;
    const p2Id = `ai_battle_2_${Date.now()}`;

    // AI1：本地 Ollama 大模型
    const ai1 = createAI('ollama', {
      model: model1 || process.env.OLLAMA_MODEL || 'qwen2.5:7b',
      baseUrl: baseUrl1 || process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    });
    // AI2：启发式规则 AI
    const ai2 = createAI('heuristic');
    aiInstanceMap.set(p1Id, ai1);
    aiInstanceMap.set(p2Id, ai2);

    // 随机选阵营创建游戏
    const factions = ['northern', 'nilfgaard', 'scoiatael', 'monsters'];
    const f1 = factions[Math.floor(Math.random() * factions.length)];
    let f2 = factions[Math.floor(Math.random() * factions.length)];
    if (f2 === f1) f2 = factions[(factions.indexOf(f1) + 1) % factions.length];

    const { aiDefaultDeck, defaultLeader } = require('./gameLogic/cards');
    const deck1 = gameManager.copyDeck(aiDefaultDeck(f1));
    const deck2 = gameManager.copyDeck(aiDefaultDeck(f2));
    const leader1 = defaultLeader(f1);
    const leader2 = defaultLeader(f2);

    const game = gameManager.createGame(p1Id, p2Id, deck1, deck2, leader1, leader2);
    game.humanName = lobbyPlayers.get(playerId)?.name;  // 旁观者名，供 DB 持久化
    aiBattleGames.add(game.gameId);

    // 通知 AI 对局开始
    ai1.onMatchStart(ai2.getName(), f1, leader1);
    ai2.onMatchStart(ai1.getName(), f2, leader2);

    // 广播 AI 对战信息
    console.log(`🤖⚔️ AI 对战开始: ${ai1.getName()}(${f1}) vs ${ai2.getName()}(${f2})`);

    // 旁观者加入房间
    socket.join(game.gameId);
    socket.emit('gameStarted', {
      gameId: game.gameId,
      gameState: gameManager.getClientGameState(game.gameId, p1Id),
      aiBattle: { model1: ai1.getName(), model2: ai2.getName(), faction1: f1, faction2: f2 },
    });

    // 广播玩家列表更新（发起人算作"观战中"）
    const p = lobbyPlayers.get(playerId);
    if (p) p.status = 'playing';
    io.emit('playerListUpdate', Array.from(lobbyPlayers.values()));

    // 启动第一回合 AI 行动
    const activeId = game.activePlayer;
    setTimeout(() => executeAITurn(game.gameId, activeId, io), 1000);
  });

  // ── 返回大厅 ──
  socket.on('returnToLobby', () => {
    const playerId = socketToPlayer.get(socket.id);
    if (!playerId) return;
    const p = lobbyPlayers.get(playerId);
    if (p) p.status = 'idle';

    // 先离开所有游戏房间，避免收到清理时产生的 gameEnd 事件
    for (const room of socket.rooms) {
      if (room !== socket.id) socket.leave(room);
    }

    // 再清理该玩家相关的所有游戏（含 AI 对战旁观）
    _cleanupPlayerGames(playerId, socket, io);

    io.emit('playerListUpdate', Array.from(lobbyPlayers.values()));
  });

  // ── 断线 ──
  socket.on('disconnect', () => {
    console.log('断开:', socket.id);
    const playerId = socketToPlayer.get(socket.id);
    socketToPlayer.delete(socket.id);
    if (playerId) {
      // 清理该玩家相关的所有游戏（含 AI 对战）
      _cleanupPlayerGames(playerId, socket, io);
      lobbyPlayers.delete(playerId);
      // 清理该玩家的邀请
      for (const [iid, inv] of pendingInvites.entries()) {
        if (inv.from === playerId || inv.to === playerId) pendingInvites.delete(iid);
      }
      io.emit('playerListUpdate', Array.from(lobbyPlayers.values()));
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🃏 Gwent Server running on port ${PORT}`));
