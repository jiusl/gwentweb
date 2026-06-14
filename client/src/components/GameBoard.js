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
const ABILITY_DESC = {
  hero: '英雄牌不受任何特殊牌影响（天气、烧灼、诱饵等对其无效）',
  spy: '打出到敌方战场，并从己方卡组抽2张牌',
  medic: '从己方墓地复活一张非英雄单位牌',
  muster: '打出后自动从卡组召唤所有同名牌到同一排',
  tight_bond: '同名牌相邻放置时，每张战力翻倍',
  morale_boost: '该排所有单位战力+1',
  scorch: '摧毁全场战力最高的非英雄单位',
  horn: '号角翻倍：使该排所有单位战力×2',
  decoy: '将战场上的一张己方非英雄单位收回手牌',
  commander_horn: '选择一排，使其所有单位战力翻倍',
  weather_frost: '天气·霜冻：近战排所有单位战力变为1',
  weather_fog: '天气·浓雾：远程排所有单位战力变为1',
  weather_rain: '天气·暴雨：攻城排所有单位战力变为1',
  clear_weather: '晴天：清除场上所有天气效果',
};
const WEATHER_ICON = { frost: '❄️', fog: '🌫️', rain: '🌧️' };
const WEATHER_LABEL = { frost: '霜冻', fog: '浓雾', rain: '暴雨' };
const FACTION_NAME = {
  northern: '北方领域', nilfgaard: '尼弗迦德', scoiatael: '松鼠党', monsters: '怪物',
};
const FACTION_ICON = {
  northern: '🦅', nilfgaard: '☀️', scoiatael: '🏹', monsters: '👹',
};

// ── 战场小卡牌 ──
function MiniCard({ card, weathered, horned }) {
  const icon = card.isHero ? '⭐' : ABILITY_ICON[card.ability] || '';
  const abilityDesc = card.ability ? ABILITY_DESC[card.ability] : null;
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
          {icon ? (
            abilityDesc ? (
              <MouseTooltip content={abilityDesc} maxW="180px">
                <Text fontSize="10px" cursor="help">{icon}</Text>
              </MouseTooltip>
            ) : (
              <Text fontSize="10px">{icon}</Text>
            )
          ) : null}
          {card.heroAbility && (
            <MouseTooltip content={ABILITY_DESC[card.heroAbility] || ABILITY_LABEL[card.heroAbility]} maxW="180px">
              <Text fontSize="9px" cursor="help">{ABILITY_ICON[card.heroAbility]}</Text>
            </MouseTooltip>
          )}
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
            {opponent.faction && (
              <Text fontSize="11px" color="#baaa8a" fontFamily="Georgia, serif">
                {FACTION_ICON[opponent.faction] || ''} {FACTION_NAME[opponent.faction] || opponent.faction}
              </Text>
            )}
            {opponent.leader && (
              <MouseTooltip content={`领袖: ${opponent.leader.name} · ${ABILITY_DESC[opponent.leader.ability] || ABILITY_LABEL[opponent.leader.ability] || '技能'}`} maxW="220px">
                <Box cursor="help" fontSize="11px" color="#d4b87a" fontFamily="Georgia, serif" bg="rgba(200,169,110,0.08)" borderRadius="2px" px={2} py={0.5}
                  border="1px solid rgba(200,169,110,0.15)">
                  👑 {opponent.leader.name}
                  {opponent.leaderUsed && <Text as="span" ml={1} color="#555">(已用)</Text>}
                </Box>
              </MouseTooltip>
            )}
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
        <Flex gap={4} wrap="wrap" justify="center">
          {(myself.hand || []).map((card, idx) => {
            const isSelected = selectedCardIndex === idx;
            const abilityIcon = ABILITY_ICON[card.ability];
            const abilityLabel = ABILITY_LABEL[card.ability];
            const isSpecial = card.type === 'special';
            const isHero = card.ability === 'hero';
            const isSpy = card.ability === 'spy';

            // 卡牌颜色主题
            const cardTheme = isHero
              ? { outer: '#8b7236', inner: '#c8a96e', bg: 'linear-gradient(160deg, #3a3020 0%, #2d2418 40%, #3a2e1a 100%)', powerBg: 'rgba(200,169,110,0.25)', powerColor: '#d4b87a' }
              : isSpy
              ? { outer: '#5a3a4a', inner: '#8b5a6a', bg: 'linear-gradient(160deg, #2d1e24 0%, #22171c 40%, #2d1e24 100%)', powerBg: 'rgba(180,100,120,0.2)', powerColor: '#c88a9a' }
              : isSpecial
              ? { outer: '#3a2a5a', inner: '#6a5a9a', bg: 'linear-gradient(160deg, #24202d 0%, #1e1a26 40%, #272030 100%)', powerBg: 'rgba(130,110,180,0.2)', powerColor: '#b0a0d0' }
              : { outer: '#3a3428', inner: '#5a5240', bg: 'linear-gradient(160deg, #2d2820 0%, #221d16 40%, #2d2618 100%)', powerBg: 'rgba(200,169,110,0.12)', powerColor: '#c8a96e' };

            // 中央图标：单位牌显示阵营，特殊牌显示✨，英雄显示⭐
            const centerIcon = isSpecial ? '✨' : isHero ? '⭐' : (FACTION_ICON[card.faction] || '🛡️');

            return (
              <Box key={idx} as="button" onClick={() => handleCardClick(idx, card)}
                disabled={!myTurnActive}
                w="130px" h="180px" borderRadius="6px"
                position="relative"
                cursor={myTurnActive ? 'pointer' : 'default'} opacity={myTurnActive ? 1 : 0.35}
                transform={isSelected ? 'translateY(-10px) rotate(-1deg)' : 'none'}
                transition="all 0.3s cubic-bezier(0.25, 0.1, 0.25, 1)"
                _hover={myTurnActive ? { transform: 'translateY(-8px) rotate(-0.5deg)', boxShadow: `0 12px 40px rgba(0,0,0,0.55), 0 0 0 2px ${cardTheme.inner}, 0 0 20px ${cardTheme.inner}40` } : {}}
                display="flex" flexDirection="column"
                bg={cardTheme.bg}
                border="2px solid"
                borderColor={isSelected ? '#d4b87a' : cardTheme.outer}
                boxShadow={isSelected
                  ? `0 12px 40px rgba(0,0,0,0.5), 0 0 0 1px ${cardTheme.inner}, 0 0 24px ${cardTheme.inner}60, inset 0 0 0 2px ${cardTheme.inner}30`
                  : `0 4px 16px rgba(0,0,0,0.4), 0 0 0 1px ${cardTheme.inner}50, inset 0 0 0 2px ${cardTheme.inner}20`
                }
              >
                {/* ── 内边框装饰 ── */}
                <Box position="absolute" inset="4px" borderRadius="3px" border={`1px solid ${cardTheme.inner}25`} pointerEvents="none" />

                {/* ── 顶部：战力 + 排图标 ── */}
                <Flex justify="space-between" align="flex-start" px="10px" pt="8px" position="relative" zIndex={1}>
                  <Box bg={cardTheme.powerBg} borderRadius="3px" px="8px" py="2px" minW="28px" textAlign="center"
                    border={`1px solid ${cardTheme.inner}30`}>
                    <Text fontSize="15px" fontWeight="700" color={cardTheme.powerColor} fontFamily="Georgia, serif" lineHeight="1">
                      {card.power}
                    </Text>
                  </Box>
                  <Flex direction="column" align="flex-end" gap="2px">
                    {card.row && (
                      <Text fontSize="13px" lineHeight="1">
                        {{melee:'⚔️',ranged:'🏹',siege:'🏰'}[card.row]}
                      </Text>
                    )}
                    {abilityIcon && (
                      <MouseTooltip content={ABILITY_DESC[card.ability] || `${abilityLabel}`} maxW="180px">
                        <Text fontSize="13px" cursor="help" lineHeight="1">{abilityIcon}</Text>
                      </MouseTooltip>
                    )}
                  </Flex>
                </Flex>

                {/* ── 上部装饰线 ── */}
                <Flex align="center" px="12px" mt="6px" gap="6px">
                  <Box flex={1} h="1px" bg={`${cardTheme.inner}30`} />
                  <Box w="4px" h="4px" borderRadius="50%" bg={`${cardTheme.inner}40`} />
                  <Box flex={1} h="1px" bg={`${cardTheme.inner}30`} />
                </Flex>

                {/* ── 中央图标 ── */}
                <Flex flex={1} align="center" justify="center" position="relative" zIndex={1}>
                  <Text fontSize="40px" opacity={0.75} lineHeight="1"
                    filter={isHero ? 'drop-shadow(0 0 8px rgba(200,169,110,0.5))' : 'none'}>
                    {centerIcon}
                  </Text>
                </Flex>

                {/* ── 下部装饰线 ── */}
                <Flex align="center" px="12px" mb="4px" gap="6px">
                  <Box flex={1} h="1px" bg={`${cardTheme.inner}30`} />
                  <Box w="4px" h="4px" borderRadius="50%" bg={`${cardTheme.inner}40`} />
                  <Box flex={1} h="1px" bg={`${cardTheme.inner}30`} />
                </Flex>

                {/* ── 卡名 ── */}
                <Text fontSize="11px" fontWeight="600" color="#e0d3b8" fontFamily="Georgia, serif"
                  textAlign="center" lineHeight="1.25" px="8px" mb="6px" noOfLines={2} position="relative" zIndex={1}>
                  {card.name}
                </Text>

                {/* ── 底部阵营标签 ── */}
                <Box flexShrink={0} pb="6px" px="10px" position="relative" zIndex={1}>
                  <Box bg={`${cardTheme.inner}12`} borderRadius="2px" py="2px" px="6px"
                    border={`1px solid ${cardTheme.inner}18`}>
                    <Text fontSize="9px" fontWeight="500" color={cardTheme.inner} fontFamily="Georgia, serif" textAlign="center" letterSpacing="0.03em" textTransform="uppercase">
                      {isHero ? 'HERO' : isSpecial ? 'SPECIAL' : (FACTION_NAME[card.faction] || card.faction || 'UNIT')}
                    </Text>
                  </Box>
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
