import { useEffect, useRef, useState, useCallback } from 'react';
import io from 'socket.io-client';

export const useWebSocket = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [playerList, setPlayerList] = useState([]);        // 在线玩家列表（含 AI）
  const [incomingInvite, setIncomingInvite] = useState(null);
  const incomingInviteRef = useRef(null);
  const [inviteResponse, setInviteResponse] = useState(null);
  const [waitingForResponse, setWaitingForResponse] = useState(false);

  // 游戏状态
  const [gameState, setGameState] = useState(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameEnded, setGameEnded] = useState(false);
  const [winner, setWinner] = useState(null);
  const [roundResult, setRoundResult] = useState(null);
  const [cardEvents, setCardEvents] = useState([]);
  const [aiBattleInfo, setAiBattleInfo] = useState(null);  // AI 对战元信息
  const socketRef = useRef(null);

  useEffect(() => {
    socketRef.current = io();

    socketRef.current.on('connect', () => {
      console.log('WebSocket 已连接');
      setIsConnected(true);
    });

    // ── 大厅事件 ──
    socketRef.current.on('playerListUpdate', (list) => {
      setPlayerList(list || []);
    });

    socketRef.current.on('incomingInvite', (data) => {
      setIncomingInvite(data);
      incomingInviteRef.current = data;
    });

    socketRef.current.on('inviteResponse', (data) => {
      setInviteResponse(data);
      setWaitingForResponse(false);
    });

    socketRef.current.on('inviteCancelled', (data) => {
      if (incomingInviteRef.current?.inviteId === data.inviteId) {
        setIncomingInvite(null);
        incomingInviteRef.current = null;
      }
    });

    // ── 游戏事件 ──
    socketRef.current.on('gameStarted', (data) => {
      console.log('游戏开始', data);
      setGameStarted(true);
      setGameState(data.gameState);
      setAiBattleInfo(data.aiBattle || null);
      setInviteResponse(null);
      setIncomingInvite(null);
      incomingInviteRef.current = null;
    });

    socketRef.current.on('gameStateUpdate', (data) => {
      setGameState(data);
    });

    socketRef.current.on('gameEnd', (data) => {
      setGameEnded(true);
      setWinner(data.winner);
    });

    socketRef.current.on('roundEnd', (data) => {
      setRoundResult(data);
      setTimeout(() => setRoundResult(null), 2500);
    });

    socketRef.current.on('cardEvents', (events) => {
      setCardEvents(events);
      setTimeout(() => setCardEvents([]), 3000);
    });

    socketRef.current.on('error', (data) => {
      console.error('服务器错误:', data.message);
      alert(data.message);
    });

    socketRef.current.on('disconnect', () => {
      setIsConnected(false);
    });

    return () => { socketRef.current.disconnect(); };
  }, []);

  // ── 大厅操作 ──
  const joinLobby = useCallback((name) => {
    if (socketRef.current) socketRef.current.emit('joinLobby', { name });
  }, []);

  const invitePlayer = useCallback((targetId) => {
    if (socketRef.current) {
      socketRef.current.emit('invitePlayer', { targetId });
      setWaitingForResponse(true);
    }
  }, []);

  const respondInvite = useCallback((inviteId, accept) => {
    if (socketRef.current) {
      socketRef.current.emit('respondInvite', { inviteId, accept });
      setIncomingInvite(null);
      incomingInviteRef.current = null;
    }
  }, []);

  const cancelInvite = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.emit('cancelInvite');
      setWaitingForResponse(false);
      setInviteResponse(null);
    }
  }, []);

  const startMatch = useCallback((opponentId, deck, leader) => {
    if (socketRef.current) {
      socketRef.current.emit('startMatch', { opponentId, deck, leader });
    }
  }, []);

  const returnToLobby = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.emit('returnToLobby');
      setGameStarted(false);
      setGameEnded(false);
      setGameState(null);
      setWinner(null);
      setRoundResult(null);
      setAiBattleInfo(null);
    }
  }, []);

  // ── AI 对战 ──
  const startAIBattle = useCallback((model1Config = {}, model2Config = {}) => {
    if (socketRef.current) {
      socketRef.current.emit('startAIBattle', {
        model1: model1Config.model, baseUrl1: model1Config.baseUrl,
        model2: model2Config.model, baseUrl2: model2Config.baseUrl,
      });
    }
  }, []);

  // ── 游戏操作 ──
  const playCard = useCallback((cardIndex, row, targetCardId = null) => {
    if (socketRef.current && gameState) {
      socketRef.current.emit('playCard', { gameId: gameState.gameId, cardIndex, row, targetCardId });
    }
  }, [gameState]);

  const pass = useCallback(() => {
    if (socketRef.current && gameState) {
      socketRef.current.emit('pass', { gameId: gameState.gameId });
    }
  }, [gameState]);

  const useLeader = useCallback((row = null) => {
    if (socketRef.current && gameState) {
      socketRef.current.emit('useLeader', { gameId: gameState.gameId, row });
    }
  }, [gameState]);

  return {
    isConnected, playerList,
    incomingInvite, inviteResponse, waitingForResponse,
    joinLobby, invitePlayer, respondInvite, cancelInvite, startMatch, returnToLobby,
    gameStarted, gameEnded, winner, gameState, roundResult, cardEvents, aiBattleInfo,
    playCard, pass, useLeader, startAIBattle
  };
};