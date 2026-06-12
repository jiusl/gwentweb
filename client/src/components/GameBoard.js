import React, { useState } from 'react';
import { Box, Flex, Text, Grid, HStack } from '@chakra-ui/react';
import MouseTooltip from './MouseTooltip';

// ── 技能图标映射 ──
const ABILITY_ICON = {
  hero: '⭐',
  spy: '🕵️',
  medic: '💊',
  muster: '📋',
  tight_bond: '🔗',
  morale_boost: '📯',
  scorch: '🔥',
  scorch_melee: '🔥',
  scorch_siege: '🔥',
  horn: '📯',
  decoy: '🃏',
  commander_horn: '📯',
  weather_frost: '❄️',
  weather_fog: '🌫️',
  weather_rain: '🌧️',
  clear_weather: '☀️',
};
const ABILITY_LABEL = {
  hero: '英雄',
  spy: '间谍',
  medic: '医生',
  muster: '召集',
  tight_bond: '紧黏',
  morale_boost: '振奋',
  scorch: '烧灼',
  horn: '号角',
  decoy: '诱饵',
  commander_horn: '指挥号角',
  weather_frost: '霜冻',
  weather_fog: '浓雾',
  weather_rain: '暴雨',
  clear_weather: '晴天',
};
const WEATHER_ICON = { frost: '❄️', fog: '🌫️', rain: '🌧️' };
const WEATHER_LABEL = { frost: '霜冻', fog: '浓雾', rain: '暴雨' };

// ── 战场小卡牌 ──
function MiniCard({ card, weathered, horned }) {
  const icon = card.isHero ? '⭐' : ABILITY_ICON[card.ability] || '';
  const heroAbilityTag = card.heroAbility ? (ABILITY_LABEL[card.heroAbility] || '') : '';
  const powerColor = card.isHero ? '#d4b87a' : weathered ? '#b5343a' : '#c8a96e';
  const displayPower = card.isHero ? card.power : (weathered ? '1' : card.power);
  const tooltipText = `${card.name} · ${card.type==='special'?'特殊':icon||'普通'} · POW ${card.power}${heroAbilityTag ? ` · ${heroAbilityTag}` : ''}`;
  return (
    <MouseTooltip content={tooltipText}>
      <Flex
        align="center" justify="space-between"
        bg={horned ? 'rgba(200,169,110,0.1)' : 'rgba(255,255,255,0.04)'}
        borderRadius="3px" px={2.5} py={1} mb={1}
        border="1px solid"
        borderColor={horned ? 'rgba(200,169,110,0.2)' : 'rgba(200,169,110,0.08)'}
      >
        <HStack gap={1} maxW="65%">
          {icon && <Text fontSize="10px">{icon}</Text>}
          {card.heroAbility && <Text fontSize="9px">{ABILITY_ICON[card.heroAbility]}</Text>}
          <Text fontSize="11px" fontWeight="500" color="#e0d3b8" fontFamily="Georgia, serif" truncate>{card.name}</Text>
        </HStack>
        <Text fontSize="12px" fontWeight="700" color={powerColor} fontFamily="Georgia, serif">{displayPower}</Text>
      </Flex>
    </MouseTooltip>
  );
}

// ── 排区域 ──
function RowZone({ label, icon, cards, weather, horned }) {
  return (
    <Box p={3} minH="80px" position="relative"
      bg="rgba(34,29,22,0.85)"
      border="1px solid"
      borderColor={weather ? 'rgba(181,52,58,0.35)' : horned ? 'rgba(200,169,110,0.3)' : 'rgba(200,169,110,0.1)'}
      borderRadius="3px"
    >
      <Flex justify="space-between" mb={2}>
        <Text fontSize="11px" fontWeight="600" color="#baaa8a" textTransform="uppercase" letterSpacing="0.06em" fontFamily="Georgia, serif">
          {icon} {label}
          {horned && <Text as="span" ml={1} fontSize="10px" color="#d4b87a">📯x2</Text>}
        </Text>
        {weather && (
          <Text fontSize="10px" color="#b5343a" fontWeight="600">
            {WEATHER_ICON[weather]} {WEATHER_LABEL[weather]}
          </Text>
        )}
      </Flex>
      {cards.map((c, i) => <MiniCard key={i} card={c} weathered={!!weather} horned={horned} />)}
      {cards.length === 0 && <Text fontSize="11px" color="rgba(200,169,110,0.1)" fontStyle="italic">—</Text>}
    </Box>
  );
}

// ── 事件通知 ──
function EventToast({ events }) {
  if (!events || events.length === 0) return null;
  return (
    <Flex position="fixed" top="80px" left="50%" transform="translateX(-50%)" zIndex={200}
      direction="column" align="center" gap={2} className="animate-in">
      {events.map((ev, i) => (
        <Box key={i} bg="rgba(26,22,18,0.95)" borderRadius="3px"
          px={5} py={2} border="1px solid rgba(200,169,110,0.25)">
          <Text fontSize="13px" fontWeight="500" color="#e0d3b8" fontFamily="Georgia, serif">
            {ev.type === 'spy' && `🕵️ 间谍「${ev.card}」潜入敌阵！`}
            {ev.type === 'draw' && `🃏 抽取 ${ev.count} 张牌`}
            {ev.type === 'muster' && `📋 召集: ${ev.cards.join('、')}`}
            {ev.type === 'medic' && `💊 医生复活:「${ev.revived}」`}
            {ev.type === 'scorch' && `🔥 烧灼摧毁: ${ev.destroyed.join('、')}`}
            {ev.type === 'horn' && `📯 号角 ×2`}
            {ev.type === 'weather' && `${WEATHER_ICON[ev.weather]} ${WEATHER_LABEL[ev.weather]}`}
            {ev.type === 'clearWeather' && `☀️ 晴空万里`}
            {ev.type === 'decoy' && `🃏 诱饵收回:「${ev.card}」`}
          </Text>
        </Box>
      ))}
    </Flex>
  );
}

function GameBoard({ gameState, isMyTurn, onPlayCard, onPass, onUseLeader, cardEvents }) {
  const [selectedCardIndex, setSelectedCardIndex] = useState(null);
  const [leaderRowSelect, setLeaderRowSelect] = useState(false);
  // 诱饵 / 医生目标选择状态
  const [decoyCardIndex, setDecoyCardIndex] = useState(null);         // 选中诱饵牌，等待选择战场目标
  const [medicPending, setMedicPending] = useState(null);             // { cardIndex, row } 医生待选墓地目标
  if (!gameState) return <Flex justify="center" py={20}><Text fontSize="15px" color="#86868b">加载中...</Text></Flex>;

  const { myself, opponent, activePlayer, currentRound, weather, horn } = gameState;
  const opponentTurn = activePlayer === opponent.id && !opponent.passed;
  const myTurnActive = isMyTurn && !myself.passed;

  const handleCardClick = (idx, card) => {
    if (!myTurnActive) return;
    setLeaderRowSelect(false);
    setDecoyCardIndex(null);
    setMedicPending(null);
    // 诱饵牌：直接进入战场目标选择，不需要选排
    if (card.type === 'special' && card.ability === 'decoy') {
      setDecoyCardIndex(idx);
      setSelectedCardIndex(null);
      return;
    }
    // 特殊牌处理：号角需要选排，其余直接打出
    if (card.type === 'special') {
      if (card.ability === 'commanders_horn') {
        setSelectedCardIndex(idx);
      } else {
        onPlayCard(idx, 'melee');
      }
      return;
    }
    setSelectedCardIndex(selectedCardIndex === idx ? null : idx);
  };

  const handleRowSelect = (row) => {
    if (selectedCardIndex === null) return;
    const card = myself.hand[selectedCardIndex];
    // 医生（Medic）：先出牌到排上，再让玩家选墓地目标
    if (card.isMedic) {
      const reviveTargets = myself.graveyard?.filter(c => c.type === 'unit' && !c.isHero) || [];
      if (reviveTargets.length > 0) {
        setMedicPending({ cardIndex: selectedCardIndex, row });
        setSelectedCardIndex(null);
        return;
      }
      // 墓地无可用目标，直接打出
      onPlayCard(selectedCardIndex, row);
      setSelectedCardIndex(null);
      return;
    }
    onPlayCard(selectedCardIndex, row);
    setSelectedCardIndex(null);
  };

  const roundDots = [1, 2, 3].map(r => (
    <Box key={r} w="10px" h="10px" borderRadius="2px"
      bg={r <= currentRound
        ? (r <= myself.roundsWon ? '#c8a96e' : r <= opponent.roundsWon ? '#b5343a' : '#6b8a3a')
        : 'rgba(200,169,110,0.1)'}
      transition="background 0.4s" />
  ));

  const getCardIcon = (card) => {
    if (card.type === 'special') return '✨';
    if (card.ability === 'hero') return '⭐';
    return '🛡️';
  };

  return (
    <Box w="100%" className="animate-in">
      <EventToast events={cardEvents} />

      {/* ── 顶部状态栏 ── */}
      <Flex justify="center" align="center" gap={6} mb={6}>
        <Flex align="center" gap={2}>
          <Box className={`dot-indicator ${myTurnActive ? 'dot-active' : 'dot-waiting'}`} />
          <Text fontSize="13px" fontWeight="600" color="#baaa8a" letterSpacing="0.04em" textTransform="uppercase" fontFamily="Georgia, serif">
            Round {currentRound} · {opponentTurn ? 'Opponent' : 'You'}
          </Text>
        </Flex>
        <Flex gap={1.5}>{roundDots}</Flex>
      </Flex>

      {/* ── 对手区域 ── */}
      <Box mb={4}>
        <Flex justify="space-between" align="center" mb={2} px={1}>
          <Flex align="center" gap={2}>
            <Text fontSize="14px" fontWeight="600" color="#e0d3b8" fontFamily="Georgia, serif">
              {opponent.id.startsWith('ai_') ? '🤖 AI' : '对手'}
            </Text>
            {opponent.passed && <Text fontSize="11px" fontWeight="600" color="#b5343a" fontFamily="Georgia, serif">PASSED</Text>}
          </Flex>
          <HStack gap={4}>
            <Text fontSize="11px" color="#baaa8a" fontFamily="Georgia, serif">🃏{opponent.deckCount||0} 💀{opponent.graveyard?.length||0} ✋{opponent.handCount}</Text>
            <Text fontSize="28px" fontWeight="400" color="#e0d3b8" letterSpacing="0.02em" fontFamily="Georgia, serif">{opponent.score}</Text>
          </HStack>
        </Flex>
        <Grid templateColumns="repeat(3, 1fr)" gap={2}>
          <RowZone label="近战" icon="⚔️" cards={opponent.melee} weather={weather?.melee} horned={horn?.opponent?.melee} />
          <RowZone label="远程" icon="🏹" cards={opponent.ranged} weather={weather?.ranged} horned={horn?.opponent?.ranged} />
          <RowZone label="攻城" icon="🏰" cards={opponent.siege} weather={weather?.siege} horned={horn?.opponent?.siege} />
        </Grid>
      </Box>

      <Box className="ornament-divider" my={5} />

      {/* ── 我方区域 ── */}
      <Box mb={6}>
        <Flex justify="space-between" align="center" mb={2} px={1}>
          <Flex align="center" gap={2}>
            <Text fontSize="14px" fontWeight="600" color="#e0d3b8" fontFamily="Georgia, serif">我</Text>
            {myself.passed && <Text fontSize="11px" fontWeight="600" color="#b5343a" fontFamily="Georgia, serif">PASSED</Text>}
          </Flex>
          <HStack gap={4}>
            <Text fontSize="11px" color="#baaa8a" fontFamily="Georgia, serif">🃏{myself.deckCount||0} 💀{myself.graveyard?.length||0} ✋{myself.handCount}</Text>
            <Text fontSize="28px" fontWeight="400" color={myTurnActive ? '#d4b87a' : '#e0d3b8'} letterSpacing="0.02em" fontFamily="Georgia, serif">{myself.score}</Text>
          </HStack>
        </Flex>
        <Grid templateColumns="repeat(3, 1fr)" gap={2}>
          <RowZone label="近战" icon="⚔️" cards={myself.melee} weather={weather?.melee} horned={horn?.mine?.melee} />
          <RowZone label="远程" icon="🏹" cards={myself.ranged} weather={weather?.ranged} horned={horn?.mine?.ranged} />
          <RowZone label="攻城" icon="🏰" cards={myself.siege} weather={weather?.siege} horned={horn?.mine?.siege} />
        </Grid>
      </Box>

      {/* ── 手牌区 ── */}
      <Box mb={4}>
        <Text fontSize="11px" fontWeight="600" color="#baaa8a" textTransform="uppercase" letterSpacing="0.06em" mb={3} fontFamily="Georgia, serif">
          Your Hand · {myself.handCount} cards
          {myself.leader && (
            <Text as="span" ml={2} color={myself.leaderUsed ? '#555' : '#d4b87a'}>
              👑 {myself.leader.name}
              {myself.leaderUsed ? ' (已用)' : ''}
            </Text>
          )}
        </Text>
        {/* ── 领袖技能按钮 ── */}
        {myself.leader && !myself.leaderUsed && myTurnActive && (
          <Flex mb={3} gap={2} align="center">
            <Box as="button" onClick={() => {
              if (myself.leader.ability === 'horn') {
                setLeaderRowSelect(true);
              } else {
                onUseLeader(null);
              }
            }}
              bg="rgba(200,169,110,0.12)" color="#d4b87a"
              border="1px solid rgba(200,169,110,0.25)" borderRadius="3px"
              px={3} py={1.5} fontSize="12px" fontWeight="600"
              fontFamily="Georgia, serif" cursor="pointer"
              _hover={{ bg: 'rgba(200,169,110,0.2)' }}
              transition="all 0.2s">
              👑 使用领袖技能
              <Text as="span" fontSize="10px" ml={1} color="#baaa8a">
                ({myself.leader.ability === 'horn' ? '号角×2' : myself.leader.ability === 'clear_weather' ? '晴空' : '技能'})
              </Text>
            </Box>
            {leaderRowSelect && myself.leader.ability === 'horn' && (
              <>
                {['melee', 'ranged', 'siege'].map(row => (
                  <Box key={row} as="button"
                    onClick={() => { onUseLeader(row); setLeaderRowSelect(false); }}
                    bg="rgba(45,38,29,0.8)" color="#e0d3b8"
                    border="1px solid rgba(200,169,110,0.15)" borderRadius="3px"
                    px={2.5} py={1.5} fontSize="12px" fontWeight="500"
                    fontFamily="Georgia, serif" cursor="pointer"
                    _hover={{ bg: 'rgba(200,169,110,0.15)', borderColor: 'rgba(200,169,110,0.3)' }}
                    transition="all 0.2s">
                    {{melee:'⚔️ 近战',ranged:'🏹 远程',siege:'🏰 攻城'}[row]}
                  </Box>
                ))}
                <Box as="button"
                  onClick={() => setLeaderRowSelect(false)}
                  bg="transparent" color="#8a7a5a"
                  border="1px solid rgba(200,169,110,0.08)" borderRadius="3px"
                  px={2} py={1.5} fontSize="11px"
                  fontFamily="Georgia, serif" cursor="pointer"
                  _hover={{ color: '#e0d3b8' }} transition="all 0.2s">
                  取消
                </Box>
              </>
            )}
          </Flex>
        )}
        <Flex gap={3} wrap="wrap">
          {(myself.hand || []).map((card, idx) => {
            const isSelected = selectedCardIndex === idx;
            const abilityIcon = ABILITY_ICON[card.ability];
            const abilityLabel = ABILITY_LABEL[card.ability];

            return (
              <Box key={idx} as="button" onClick={() => handleCardClick(idx, card)}
                disabled={!myTurnActive}
                w="100px" h="140px" borderRadius="3px"
                border={isSelected ? '2px solid #d4b87a' : card.isHero ? '1px solid rgba(200,169,110,0.3)' : '1px solid rgba(200,169,110,0.1)'}
                bg={isSelected ? 'rgba(200,169,110,0.12)' : card.isHero ? 'rgba(200,169,110,0.06)' : 'rgba(45,38,29,0.8)'}
                display="flex" flexDirection="column" alignItems="center" justifyContent="center" gap={1.5}
                cursor={myTurnActive ? 'pointer' : 'default'} opacity={myTurnActive ? 1 : 0.35}
                transform={isSelected ? 'translateY(-8px)' : 'none'}
                transition="all 0.25s cubic-bezier(0.25, 0.1, 0.25, 1)"
                _hover={myTurnActive ? { bg: 'rgba(200,169,110,0.1)', transform: 'translateY(-6px)', boxShadow: '0 8px 30px rgba(0,0,0,0.5), 0 0 0 1px rgba(200,169,110,0.2)' } : {}}
                position="relative"
              >
                {abilityIcon && (
                  <Box position="absolute" top="4px" right="4px" fontSize="14px" title={abilityLabel}>
                    {abilityIcon}
                  </Box>
                )}
                {card.row && (
                  <Box position="absolute" top="4px" left="4px" fontSize="10px" color="#baaa8a">
                    {{melee:'⚔️',ranged:'🏹',siege:'🏰'}[card.row]}
                  </Box>
                )}
                <Text fontSize="24px">{getCardIcon(card)}</Text>
                <Text fontSize="11px" fontWeight="600" color="#e0d3b8" fontFamily="Georgia, serif" textAlign="center" lineHeight="1.2" noOfLines={2}>
                  {card.name}
                </Text>
                <Box bg={card.isHero ? 'rgba(200,169,110,0.2)' : 'rgba(200,169,110,0.1)'}
                  color={card.isHero ? '#d4b87a' : '#c8a96e'} borderRadius="2px" px={2.5} py={0.5}>
                  <Text fontSize="13px" fontWeight="700" fontFamily="Georgia, serif">{card.power}</Text>
                </Box>
              </Box>
            );
          })}
          {(!myself.hand || myself.hand.length === 0) && (
            <Text fontSize="13px" color="rgba(200,169,110,0.15)" fontStyle="italic" fontFamily="Georgia, serif">No cards in hand</Text>
          )}
        </Flex>
      </Box>

      {/* ── 排选择器 ── */}
      {selectedCardIndex !== null && (() => {
        const card = myself.hand[selectedCardIndex];
        const allRows = [
          { row: 'melee', label: '⚔️ 近战', desc: 'Melee' },
          { row: 'ranged', label: '🏹 远程', desc: 'Ranged' },
          { row: 'siege', label: '🏰 攻城', desc: 'Siege' },
        ];
        const isHorn = card?.type === 'special' && card?.ability === 'commanders_horn';
        const availableRows = card?.type === 'unit' && card?.row
          ? allRows.filter(r => r.row === card.row)
          : allRows;

        return (
        <Box mb={4} p={5} borderRadius="3px" border="1px solid rgba(200,169,110,0.2)" bg="rgba(34,29,22,0.9)">
          <Text fontSize="14px" fontWeight="500" color="#e0d3b8" mb={4} textAlign="center" fontFamily="Georgia, serif">
            {isHorn ? '📯 号角加强哪一排？' : <>Place <Text as="span" fontWeight="700" color="#d4b87a">「{card?.name}」</Text> on...</>}
          </Text>
          <Flex gap={3} justify="center" wrap="wrap">
            {availableRows.map(({ row, label, desc }) => (
              <Box key={row} as="button" onClick={() => handleRowSelect(row)}
                bg="rgba(45,38,29,0.8)" color="#e0d3b8" border="1px solid rgba(200,169,110,0.1)"
                borderRadius="3px" h="60px" px={6} fontSize="14px" fontWeight="500"
                fontFamily="Georgia, serif" cursor="pointer"
                _hover={{ bg: 'rgba(200,169,110,0.1)', borderColor: 'rgba(200,169,110,0.3)' }}
                _active={{ bg: 'rgba(200,169,110,0.15)' }} transition="all 0.2s"
                display="flex" flexDirection="column" alignItems="center" justifyContent="center" gap={0.5}>
                <Text fontSize="16px">{label}</Text>
                <Text fontSize="10px" color="#baaa8a" fontWeight="400">{desc}</Text>
              </Box>
            ))}
            <Box as="button" onClick={() => setSelectedCardIndex(null)}
              bg="transparent" color="#8a7a5a" border="1px solid rgba(200,169,110,0.08)"
              borderRadius="3px" h="60px" px={5} fontSize="13px" fontWeight="400"
              fontFamily="Georgia, serif" cursor="pointer"
              _hover={{ color: '#e0d3b8', borderColor: 'rgba(200,169,110,0.2)' }} transition="all 0.2s">
              Cancel
            </Box>
          </Flex>
        </Box>
        );
      })()}

      {/* ── 诱饵：战场目标选择 ── */}
      {decoyCardIndex !== null && (() => {
        const allBattlefield = [
          ...myself.melee.map(c => ({...c, _row: 'melee', _rowLabel: '⚔️近战'})),
          ...myself.ranged.map(c => ({...c, _row: 'ranged', _rowLabel: '🏹远程'})),
          ...myself.siege.map(c => ({...c, _row: 'siege', _rowLabel: '🏰攻城'})),
        ].filter(c => !c.isHero);
        return (
        <Box mb={4} p={5} borderRadius="3px" border="1px solid rgba(200,169,110,0.25)" bg="rgba(34,29,22,0.92)">
          <Text fontSize="14px" fontWeight="500" color="#e0d3b8" mb={3} textAlign="center" fontFamily="Georgia, serif">
            🃏 选择一张战场单位收回手牌
          </Text>
          {allBattlefield.length === 0 ? (
            <Text color="#8a7a5a" textAlign="center" fontFamily="Georgia, serif">战场上没有可收回的单位</Text>
          ) : (
            <Flex gap={2} wrap="wrap" justify="center">
              {allBattlefield.map(c => (
                <Box key={c.id} as="button"
                  onClick={() => { onPlayCard(decoyCardIndex, 'melee', c.id); setDecoyCardIndex(null); }}
                  bg="rgba(45,38,29,0.8)" color="#e0d3b8"
                  border="1px solid rgba(200,169,110,0.15)" borderRadius="3px"
                  px={3} py={2} fontSize="13px" fontWeight="500"
                  fontFamily="Georgia, serif" cursor="pointer"
                  _hover={{ bg: 'rgba(200,169,110,0.15)', borderColor: 'rgba(200,169,110,0.3)' }}
                  transition="all 0.2s" display="flex" alignItems="center" gap={2}>
                  <Text fontSize="11px" color="#baaa8a">{c._rowLabel}</Text>
                  <Text>{c.name}</Text>
                  <Box bg="rgba(200,169,110,0.1)" color="#c8a96e" borderRadius="2px" px={1.5} py={0.5}>
                    <Text fontSize="11px" fontWeight="700">{c.power}</Text>
                  </Box>
                </Box>
              ))}
            </Flex>
          )}
          <Flex justify="center" mt={3}>
            <Box as="button" onClick={() => setDecoyCardIndex(null)}
              bg="transparent" color="#8a7a5a" border="1px solid rgba(200,169,110,0.08)"
              borderRadius="3px" px={4} py={1.5} fontSize="12px"
              fontFamily="Georgia, serif" cursor="pointer"
              _hover={{ color: '#e0d3b8' }} transition="all 0.2s">
              取消
            </Box>
          </Flex>
        </Box>
        );
      })()}

      {/* ── 医生：墓地目标选择 ── */}
      {medicPending !== null && (() => {
        const graveUnits = (myself.graveyard || []).filter(c => c.type === 'unit' && !c.isHero);
        return (
        <Box mb={4} p={5} borderRadius="3px" border="1px solid rgba(107,138,58,0.25)" bg="rgba(34,29,22,0.92)">
          <Text fontSize="14px" fontWeight="500" color="#e0d3b8" mb={3} textAlign="center" fontFamily="Georgia, serif">
            💊 选择一张墓地单位复活到战场
          </Text>
          {graveUnits.length === 0 ? (
            <Text color="#8a7a5a" textAlign="center" fontFamily="Georgia, serif">墓地中没有可复活的单位</Text>
          ) : (
            <Flex gap={2} wrap="wrap" justify="center">
              {graveUnits.map(c => (
                <Box key={c.id} as="button"
                  onClick={() => { onPlayCard(medicPending.cardIndex, medicPending.row, c.id); setMedicPending(null); }}
                  bg="rgba(45,38,29,0.8)" color="#e0d3b8"
                  border="1px solid rgba(107,138,58,0.2)" borderRadius="3px"
                  px={3} py={2} fontSize="13px" fontWeight="500"
                  fontFamily="Georgia, serif" cursor="pointer"
                  _hover={{ bg: 'rgba(107,138,58,0.12)', borderColor: 'rgba(107,138,58,0.35)' }}
                  transition="all 0.2s" display="flex" alignItems="center" gap={2}>
                  <Text>{c.name}</Text>
                  <Box bg="rgba(107,138,58,0.12)" color="#6b8a3a" borderRadius="2px" px={1.5} py={0.5}>
                    <Text fontSize="11px" fontWeight="700">{c.power}</Text>
                  </Box>
                </Box>
              ))}
            </Flex>
          )}
          <Flex justify="center" mt={3}>
            <Box as="button" onClick={() => setMedicPending(null)}
              bg="transparent" color="#8a7a5a" border="1px solid rgba(200,169,110,0.08)"
              borderRadius="3px" px={4} py={1.5} fontSize="12px"
              fontFamily="Georgia, serif" cursor="pointer"
              _hover={{ color: '#e0d3b8' }} transition="all 0.2s">
              取消
            </Box>
          </Flex>
        </Box>
        );
      })()}

      {/* ── Pass ── */}
      <Flex justify="center">
        <Box as="button" onClick={onPass} disabled={!myTurnActive}
          bg="transparent" color={myTurnActive ? '#b5343a' : 'rgba(181,52,58,0.2)'}
          border="1px solid" borderColor={myTurnActive ? 'rgba(181,52,58,0.3)' : 'rgba(181,52,58,0.1)'}
          borderRadius="3px" h="44px" px={8} fontSize="14px" fontWeight="600" letterSpacing="0.06em"
          fontFamily="Georgia, serif" cursor={myTurnActive ? 'pointer' : 'default'}
          opacity={myTurnActive ? 1 : 0.3}
          _hover={myTurnActive ? { bg: 'rgba(181,52,58,0.1)', borderColor: 'rgba(181,52,58,0.5)' } : {}}
          transition="all 0.2s">
          Pass
        </Box>
      </Flex>
    </Box>
  );
}

export default GameBoard;
