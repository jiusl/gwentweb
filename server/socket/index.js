/**
 * Socket.IO 事件处理模块
 * 当前事件已整合到 app.js 中直接处理。
 * 本文件保留供后续拆分多人匹配、观战等功能时使用。
 */

const GameManager = require('../gameLogic/gameManager');

module.exports = (io, gameManager, socketToPlayer) => {
  io.on('connection', (socket) => {
    console.log('玩家已连接:', socket.id);

    socket.on('findMatch', () => {
      const playerId = socket.id;
      const aiId = `ai_${Date.now()}`;
      socketToPlayer.set(socket.id, playerId);

      const game = gameManager.createGame(playerId, aiId);
      socket.join(game.gameId);

      const gameState = gameManager.getClientGameState(game.gameId, playerId);
      socket.emit('gameStarted', { gameId: game.gameId, gameState });
    });

    socket.on('playCard', (data) => {
      const { gameId, cardIndex, row } = data;
      const playerId = socketToPlayer.get(socket.id);
      if (!playerId) return;

      const result = gameManager.playCard(gameId, playerId, cardIndex, row);
      if (result.success) {
        io.to(gameId).emit('gameStateUpdate', result.gameState);
        const game = gameManager.activeGames.get(gameId);
        if (game && game.status === 'gameEnd') {
          io.to(gameId).emit('gameEnd', { winner: game.gameWinner });
        } else if (game && game.status === 'roundEnd') {
          io.to(gameId).emit('roundEnd', {
            roundWinner: game.roundWinner,
            currentRound: game.currentRound,
          });
        }
      } else {
        socket.emit('error', { message: result.error });
      }
    });

    socket.on('pass', (data) => {
      const { gameId } = data;
      const playerId = socketToPlayer.get(socket.id);
      if (!playerId) return;

      const result = gameManager.passTurn(gameId, playerId);
      if (result.success) {
        io.to(gameId).emit('gameStateUpdate', result.gameState);
        const game = gameManager.activeGames.get(gameId);
        if (game && game.status === 'gameEnd') {
          io.to(gameId).emit('gameEnd', { winner: game.gameWinner });
        } else if (game && game.status === 'roundEnd') {
          io.to(gameId).emit('roundEnd', {
            roundWinner: game.roundWinner,
            currentRound: game.currentRound,
          });
        }
      } else {
        socket.emit('error', { message: result.error });
      }
    });

    socket.on('disconnect', () => {
      console.log('玩家已断开:', socket.id);
      socketToPlayer.delete(socket.id);
    });
  });
};
