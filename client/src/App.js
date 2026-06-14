import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Heading, Text, VStack, HStack, Spinner, Button, Input,
  Flex, Badge, createToaster, Toaster
} from '@chakra-ui/react';
import MouseTooltip from './components/MouseTooltip';
import { useWebSocket } from './hooks/useWebSocket';
import GameBoard from './components/GameBoard';
import DeckBuilder from './components/DeckBuilder';
import PlayerList from './components/PlayerList';
import { ABILITY_ICON, ABILITY_DESC } from './constants';

const toaster = createToaster({ placement: 'top', duration: 2000 });

function App() {
  const {
    isConnected, playerList,
    incomingInvite, inviteResponse, waitingForResponse,
    joinLobby, invitePlayer, respondInvite, cancelInvite, startMatch, returnToLobby,
    gameStarted, gameEnded, winner, gameState, roundResult, cardEvents, aiBattleInfo,
    playCard, pass, useLeader, startAIBattle
  } = useWebSocket();

  // ── 本地状态 ──
  const [playerName, setPlayerName] = useState('');
  const [nameSubmitted, setNameSubmitted] = useState(false);
  const [deck, setDeck] = useState([]);
  const [leader, setLeader] = useState(null);
  const [selectedFaction, setSelectedFaction] = useState('');
  const [myId, setMyId] = useState(null);

  // 连接后自动加入大厅
  useEffect(() => {
    if (isConnected && nameSubmitted) {
      joinLobby(playerName);
    }
  }, [isConnected, nameSubmitted, joinLobby, playerName]);

  // 跟踪自己的 ID
  useEffect(() => {
    const me = playerList.find(p => p.name === playerName);
    if (me) setMyId(me.id);
  }, [playerList, playerName]);

  const isMyTurn = gameState && !aiBattleInfo && gameState.activePlayer === gameState.myself?.id;

  const handleNameSubmit = () => {
    if (playerName.trim()) setNameSubmitted(true);
  };

  const handleInvite = (targetId) => {
    const unitCount = deck.filter(c => c.type === 'unit').length;
    console.log('[handleInvite] targetId:', targetId, 'unitCount:', unitCount, 'leader:', leader);
    if (unitCount < 22) {
      toaster.create({ title: '卡组不足', description: `至少需要22张单位卡才能对战（当前${unitCount}张）`, type: 'warning' });
      return;
    }
    if (!leader) {
      toaster.create({ title: '请选择领袖', description: '需要选择一位领袖卡', type: 'warning' });
      return;
    }
    console.log('[handleInvite] emitting invitePlayer to', targetId);
    invitePlayer(targetId);
  };

  const handleAcceptInvite = (inviteId) => {
    const unitCount = deck.filter(c => c.type === 'unit').length;
    if (unitCount < 22) {
      toaster.create({ title: '卡组不足', description: '至少需要22张单位卡才能接受对战', type: 'warning' });
      return;
    }
    respondInvite(inviteId, true);
  };

  const handleRejectInvite = (inviteId) => {
    respondInvite(inviteId, false);
  };

  const handleStartMatch = useCallback((opponentId) => {
    if (deck.filter(c => c.type === 'unit').length < 22 || !leader) {
      toaster.create({ title: '卡组无效', description: '请配置完整的卡组', type: 'warning' });
      return;
    }
    startMatch(opponentId, deck, leader);
  }, [deck, leader, startMatch]);

  // AI 邀请自动开始对战（无需手动点"开始对战"按钮）
  const prevInviteResponseRef = React.useRef(null);
  useEffect(() => {
    if (inviteResponse && inviteResponse.accepted && inviteResponse.from?.startsWith('ai_player')) {
      // 防止重复触发
      if (prevInviteResponseRef.current?.from === inviteResponse.from &&
          prevInviteResponseRef.current?.accepted === inviteResponse.accepted) return;
      prevInviteResponseRef.current = inviteResponse;
      // 短暂延迟让玩家看到提示
      toaster.create({ title: 'AI 已接受邀请，开始对战...', type: 'info' });
      setTimeout(() => {
        handleStartMatch(inviteResponse.from);
      }, 600);
    }
  }, [inviteResponse, handleStartMatch]);

  // ── 连接中 ──
  if (!isConnected) {
  // ── 确定当前界面 ──
  let screen;
  if (!isConnected) {
    screen = 'connecting';
  } else if (!nameSubmitted) {
    screen = 'nameInput';
  } else if (gameEnded && gameState) {
    screen = 'gameOver';
  } else if (gameStarted && gameState) {
    screen = 'game';
  } else {
    screen = 'lobby';
  }

  // ── 游戏结束数据 ──
  const isAIBattle = !!aiBattleInfo;
  let won, winnerModel;
  if (screen === 'gameOver') {
    if (isAIBattle) {
      won = false;
      winnerModel = winner === gameState.myself?.id ? aiBattleInfo.model1 : aiBattleInfo.model2;
    } else {
      won = winner === gameState?.myself?.id;
    }
  }

  return (
    <>
      {/* ── 连接中 ── */}
      {screen === 'connecting' && (
        <Box minH="100vh" display="flex" alignItems="center" justifyContent="center" bg="#12100c">
          <VStack gap={6}>
            <Spinner w="48px" h="48px" color="#c8a96e" borderWidth="2px" />
            <Text fontSize="17px" fontWeight="500" color="#baaa8a" fontFamily="Georgia, serif">
              正在连接服务器...
            </Text>
          </VStack>
        </Box>
      )}

      {/* ── 输入玩家名 ── */}
      {screen === 'nameInput' && (
        <Box minH="100vh" display="flex" alignItems="center" justifyContent="center" bg="#12100c">
          <VStack gap={6} className="animate-in">
            <Text fontSize="56px">🃏</Text>
            <Heading fontSize="36px" fontWeight="400" color="#e0d3b8" fontFamily="Georgia, serif" letterSpacing="0.06em">
              昆特牌
            </Heading>
            <Box className="ornament-divider" w="200px" />
            <Text color="#baaa8a" fontFamily="Georgia, serif">输入你的昵称进入大厅</Text>
            <Input
              placeholder="玩家昵称"
              value={playerName}
              onChange={e => setPlayerName(e.target.value)}
              maxW="300px"
              bg="#2d261d"
              color="#e0d3b8"
              border="1px solid rgba(200,169,110,0.25)"
              borderRadius="3px"
              fontFamily="Georgia, serif"
              _placeholder={{ color: '#8a7a5a' }}
              onKeyDown={e => e.key === 'Enter' && handleNameSubmit()}
            />
            <Button
              onClick={handleNameSubmit}
              disabled={!playerName.trim()}
              bg="linear-gradient(180deg, #c8a96e 0%, #a08040 100%)"
              color="#1a1410"
              fontWeight="600"
              fontFamily="Georgia, serif"
              _hover={{ bg: 'linear-gradient(180deg, #d4b87a 0%, #b09050 100%)' }}
              borderRadius="3px" h="48px" px={8}
              border="1px solid rgba(200,169,110,0.5)"
            >
              进入大厅
            </Button>
          </VStack>
        </Box>
      )}

      {/* ── 对局结束 ── */}
      {screen === 'gameOver' && (
        <Box minH="100vh" display="flex" alignItems="center" justifyContent="center" bg="#12100c">
          <VStack gap={8} className="animate-in">
            {isAIBattle ? (
              <>
                <Text fontSize="72px">🤖⚔️🤖</Text>
                <Heading fontSize={{ base: '32px', md: '44px' }} fontWeight="400" color="#e0d3b8" fontFamily="Georgia, serif">
                  AI 对战结束
                </Heading>
                <Box className="ornament-divider" w="250px" />
                <Text fontSize="21px" color="#baaa8a" fontFamily="Georgia, serif">
                  获胜模型: <Badge colorPalette="yellow" fontSize="lg" borderRadius="3px" variant="surface">{winnerModel}</Badge>
                </Text>
                <HStack gap={6} fontSize="16px" color="#8a7a5a" fontFamily="Georgia, serif">
                  <Text>{aiBattleInfo.model1} ({aiBattleInfo.faction1})</Text>
                  <Text>vs</Text>
                  <Text>{aiBattleInfo.model2} ({aiBattleInfo.faction2})</Text>
                </HStack>
              </>
            ) : (
              <>
                <Text fontSize="72px">{won ? '🏆' : '💫'}</Text>
                <Heading fontSize={{ base: '40px', md: '56px' }} fontWeight="400" color="#e0d3b8" fontFamily="Georgia, serif">
                  {won ? 'Victory' : 'Defeat'}
                </Heading>
                <Box className="ornament-divider" w="250px" />
                <Text fontSize="21px" color="#baaa8a" fontFamily="Georgia, serif">
                  {won ? '恭喜，你赢得了这场比赛' : '别灰心，再来一局吧'}
                </Text>
              </>
            )}
            <Button
              onClick={returnToLobby}
              bg="linear-gradient(180deg, #c8a96e 0%, #a08040 100%)"
              color="#1a1410" fontWeight="600"
              fontFamily="Georgia, serif"
              _hover={{ bg: 'linear-gradient(180deg, #d4b87a 0%, #b09050 100%)' }}
              _active={{ bg: 'linear-gradient(180deg, #b09050 0%, #8a6830 100%)' }}
              borderRadius="3px" h="48px" px={8} fontSize="17px"
              border="1px solid rgba(200,169,110,0.5)"
            >
              返回大厅
            </Button>
          </VStack>
        </Box>
      )}

      {/* ── 游戏中 ── */}
      {screen === 'game' && (
        <Box minH="100vh" bg="#12100c" py={{ base: 4, md: 8 }} px={{ base: 3, md: 6 }} position="relative">
          {roundResult && (
            <Box
              position="fixed" top="0" left="0" right="0" bottom="0"
              bg="rgba(10,8,5,0.85)" zIndex={100}
              display="flex" alignItems="center" justifyContent="center"
              className="animate-in"
            >
              <VStack gap={4}>
                <Text fontSize="56px">
                  {roundResult.roundWinner
                    ? (aiBattleInfo
                        ? '🤖'
                        : (roundResult.roundWinner === gameState?.myself?.id ? '🏆' : '💫'))
                    : '🤝'}
                </Text>
                <Heading fontSize="32px" fontWeight="400" color="#e0d3b8" fontFamily="Georgia, serif">
                  {roundResult.roundWinner
                    ? (aiBattleInfo
                        ? `AI 赢得此局 (${roundResult.roundWinner === gameState.myself?.id ? aiBattleInfo.model1 : aiBattleInfo.model2})`
                        : (roundResult.roundWinner === gameState?.myself?.id ? '你赢了这一局！' : '对手赢了这一局'))
                    : '平局！'}
                </Heading>
                <Text fontSize="18px" color="#baaa8a" fontFamily="Georgia, serif">
                  Round {roundResult.currentRound} · 准备下一局...
                </Text>
              </VStack>
            </Box>
          )}
          <Box maxW="960px" mx="auto">
            <HStack justify="space-between" mb={4}>
              <HStack>
                <Heading fontSize={{ base: '24px', md: '32px' }} fontWeight="400" color="#e0d3b8" fontFamily="Georgia, serif" letterSpacing="0.04em">
                  昆特牌
                </Heading>
                {aiBattleInfo && (
                  <Badge colorPalette="yellow" variant="surface" borderRadius="3px" fontSize="sm" px={2} py={1}>
                    🤖 AI 对战 · 观战模式
                  </Badge>
                )}
              </HStack>
              <Button size="sm" variant="outline"
                color="#baaa8a" borderColor="rgba(200,169,110,0.25)"
                bg="#221d16" fontFamily="Georgia, serif"
                _hover={{ bg: '#2d261d', borderColor: 'rgba(200,169,110,0.4)' }}
                onClick={returnToLobby}>
                返回大厅
              </Button>
            </HStack>
            {aiBattleInfo && (
              <HStack justify="center" mb={3} gap={6} fontSize="14px" color="#baaa8a" fontFamily="Georgia, serif">
                <Text><Badge colorPalette="blue" variant="surface" borderRadius="2px">{aiBattleInfo.model1}</Badge> ({aiBattleInfo.faction1})</Text>
                <Text color="#8a7a5a">⚔️ vs</Text>
                <Text><Badge colorPalette="red" variant="surface" borderRadius="2px">{aiBattleInfo.model2}</Badge> ({aiBattleInfo.faction2})</Text>
              </HStack>
            )}
            <GameBoard
              gameState={gameState}
              isMyTurn={isMyTurn}
              onPlayCard={playCard}
              onPass={pass}
              onUseLeader={useLeader}
              cardEvents={cardEvents}
            />
          </Box>
        </Box>
      )}

      {/* ── 大厅界面 ── */}
      {screen === 'lobby' && (
        <Box minH="100vh" bg="#12100c" p={4}>
          <Flex maxW="1400px" mx="auto" justify="space-between" align="center" mb={4}>
            <HStack>
              <Text fontSize="32px">🃏</Text>
              <Heading fontSize="24px" fontWeight="400" color="#e0d3b8" fontFamily="Georgia, serif" letterSpacing="0.05em">昆特牌 大厅</Heading>
            </HStack>
            <HStack>
              <Button
                size="sm"
                onClick={() => startAIBattle()}
                bg="#2d261d" color="#d4b87a" border="1px solid rgba(200,169,110,0.35)"
                fontFamily="Georgia, serif"
                borderRadius="3px"
                _hover={{ bg: '#3d3428', borderColor: 'rgba(200,169,110,0.6)' }}
              >
                🤖⚔️ AI 对战
              </Button>
              <Badge colorPalette="green" fontSize="sm" px={3} py={1} borderRadius="3px" variant="surface">
                ● 已连接
              </Badge>
              <Text color="#baaa8a" fontSize="sm" fontFamily="Georgia, serif">{playerName}</Text>
            </HStack>
          </Flex>
          <Flex maxW="1400px" mx="auto" gap={4} h="calc(100vh - 100px)">
            <Box flex="3" className="glass-card" p={4} display="flex" flexDirection="column" minH={0}>
              <Heading fontSize="lg" fontWeight="400" color="#e0d3b8" mb={3} fontFamily="Georgia, serif">
                📦 卡组配置
              </Heading>
              <HStack mb={3} gap={4} fontSize="sm" color="#baaa8a" fontFamily="Georgia, serif">
                <Text>单位: <Badge colorPalette={deck.filter(c => c.type === 'unit').length >= 22 ? 'green' : 'red'} variant="surface" borderRadius="2px">
                  {deck.filter(c => c.type === 'unit').length}/22
                </Badge></Text>
                <Text>特殊: <Badge colorPalette={deck.filter(c => c.type === 'special').length <= 7 ? 'green' : 'red'} variant="surface" borderRadius="2px">
                  {deck.filter(c => c.type === 'special').length}/7
                </Badge></Text>
                <Text>总计: <Badge variant="surface" borderRadius="2px">{deck.length}</Badge></Text>
                <Text>领袖: <Badge colorPalette={leader ? 'yellow' : 'gray'} variant="surface" borderRadius="2px">{leader ? leader.name : '未选择'}</Badge></Text>
              </HStack>
              {deck.length > 0 && (
                <HStack wrap="wrap" mb={3} gap={1}>
                  {deck.map((card, i) => {
                    const icon = card.ability ? ABILITY_ICON[card.ability] : null;
                    const desc = card.ability ? ABILITY_DESC[card.ability] : null;
                    const heroIcon = card.heroAbility ? ABILITY_ICON[card.heroAbility] : null;
                    const heroDesc = card.heroAbility ? ABILITY_DESC[card.heroAbility] : null;
                    return (
                      <MouseTooltip key={i} content={
                        <>
                          <Text fontWeight="bold">{card.name}</Text>
                          <Text color="#baaa8a">{card.type === 'special' ? '✨特殊牌' : card.isHero ? '⭐英雄' : '单位'} · {card.power}⚡</Text>
                          {desc && <Text color="#d4b87a" mt={1}>{desc}</Text>}
                          {heroDesc && <Text color="#e2c88a" mt={1}>副技能·{heroDesc}</Text>}
                          <Text color="#8a7a5a" mt={1}>点击移除</Text>
                        </>
                      }>
                        <Badge
                          colorPalette={card.isHero ? 'yellow' : card.type === 'special' ? 'purple' : 'blue'}
                          variant="surface" borderRadius="2px"
                          cursor="pointer" onClick={() => {
                            const newDeck = [...deck];
                            newDeck.splice(i, 1);
                            setDeck(newDeck);
                          }}
                        >
                          {icon && `${icon} `}{heroIcon && `${heroIcon} `}{card.name} {card.power > 0 ? card.power : ''}
                        </Badge>
                      </MouseTooltip>
                    );
                  })}
                </HStack>
              )}
              <Box className="ornament-divider" />
              <DeckBuilder
                deck={deck} setDeck={setDeck}
                leader={leader} setLeader={setLeader}
                selectedFaction={selectedFaction} setSelectedFaction={setSelectedFaction}
                playerName={playerName}
                toaster={toaster}
              />
            </Box>
            <Box flex="2" className="glass-card" p={4} overflowY="auto">
              <PlayerList
                playerList={playerList}
                myId={myId}
                playerName={playerName}
                onInvite={handleInvite}
                waitingForResponse={waitingForResponse}
                inviteResponse={inviteResponse}
                incomingInvite={incomingInvite}
                onAcceptInvite={handleAcceptInvite}
                onRejectInvite={handleRejectInvite}
                onStartMatch={handleStartMatch}
                onCancelInvite={cancelInvite}
                deck={deck}
                leader={leader}
              />
            </Box>
          </Flex>
        </Box>
      )}

      {/* ── 全局 Toast 容器（仅此一处） ── */}
      <Toaster toaster={toaster}>
        {(toast) => (
          <Box bg="#2d261d" color="#e0d3b8" p={3} borderRadius="3px" border="1px solid rgba(200,169,110,0.25)" fontFamily="Georgia, serif">
            <Text fontWeight="bold">{toast.title}</Text>
            {toast.description && <Text fontSize="sm" color="#baaa8a">{toast.description}</Text>}
          </Box>
        )}
      </Toaster>
    </>
  );
}

export default App;
