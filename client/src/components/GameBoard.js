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

// ── 阵营边框色 ──
const FACTION_COLOR = { northern: '#4a7ab5', nilfgaard: '#b54a4a', scoiatael: '#5a8a4a', monsters: '#b54a2a' };
const getFactionColor = (card) => FACTION_COLOR[card.faction] || '#5a5240';

// ── 战场小卡牌 ──
function MiniCard({ card, weathered, horned }) {
  const icon = card.isHero ? '⭐' : ABILITY_ICON[card.ability] || '';
  const abilityDesc = card.ability ? ABILITY_DESC[card.ability] : null;
  const heroAbilityTag = card.heroAbility ? (ABILITY_LABEL[card.heroAbility] || '') : '';
  const factionColor = card.isHero ? '#d4b87a' : getFactionColor(card);
  const powerColor = card.isHero ? '#d4b87a' : weathered ? '#b5343a' : '#c8a96e';
  const displayPower = card.isHero ? card.power : (weathered ? '1' : card.power);
  const tooltipText = `${card.name} · ${card.type==='special'?'特殊':ABILITY_LABEL[card.ability]||'普通'} · POW ${card.power}${heroAbilityTag ? ` · ${heroAbilityTag}` : ''}`;
  return (
    <MouseTooltip content={tooltipText}>
      <Flex
        align="center" justify="space-between"
        bg={horned ? 'rgba(200,169,110,0.1)' : 'rgba(255,255,255,0.04)'}
        borderRadius="2px" px={2.5} py={1.5} mb={0.5}
        border="1px solid"
        borderColor={horned ? 'rgba(200,169,110,0.25)' : 'rgba(200,169,110,0.1)'}
        borderLeft={`3px solid ${factionColor}80`}
        position="relative"
        minH="28px"
      >
        <HStack gap={1.5} maxW="65%">
          {icon ? (
            abilityDesc ? (
              <MouseTooltip content={abilityDesc} maxW="180px">
                <Text fontSize="11px" cursor="help">{icon}</Text>
              </MouseTooltip>
            ) : (
              <Text fontSize="11px">{icon}</Text>
            )
          ) : null}
          {card.heroAbility && (
            <MouseTooltip content={ABILITY_DESC[card.heroAbility] || ABILITY_LABEL[card.heroAbility]} maxW="180px">
              <Text fontSize="10px" cursor="help">{ABILITY_ICON[card.heroAbility]}</Text>
            </MouseTooltip>
          )}
          <Text fontSize="11px" fontWeight="500" color="#e0d3b8" fontFamily="Georgia, serif" truncate>{card.name}</Text>
        </HStack>
        <Text fontSize="13px" fontWeight="700" color={powerColor} fontFamily="Georgia, serif">{displayPower}</Text>
      </Flex>
    </MouseTooltip>
  );
}

// ── 排区域 ──
function RowZone({ label, icon, cards, weather, horned }) {
  return (
    <Box p={2.5} minH="60px" position="relative"
      bg="rgba(34,29,22,0.85)"
      border="1px solid"
      borderColor={weather ? 'rgba(181,52,58,0.35)' : horned ? 'rgba(200,169,110,0.3)' : 'rgba(200,169,110,0.1)'}
      borderRadius="3px"
    >
      <Flex justify="space-between" mb={1.5}>
        <Text fontSize="10px" fontWeight="600" color="#baaa8a" textTransform="uppercase" letterSpacing="0.06em" fontFamily="Georgia, serif">
          {icon} {label}
          {horned && <Text as="span" ml={1} fontSize="9px" color="#d4b87a">📯x2</Text>}
        </Text>
        {weather && (
          <Text fontSize="9px" color="#b5343a" fontWeight="600">
            {WEATHER_ICON[weather]} {WEATHER_LABEL[weather]}
          </Text>
        )}
      </Flex>
      {cards.map((c, i) => <MiniCard key={i} card={c} weathered={!!weather} horned={horned} />)}
      {cards.length === 0 && <Text fontSize="10px" color="rgba(200,169,110,0.08)" fontStyle="italic">—</Text>}
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
  const [decoyCardIndex, setDecoyCardIndex] = useState(null);
  const [medicPending, setMedicPending] = useState(null);
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
      <Flex justify="center" align="center" gap={4} mb={2}>
        <Flex align="center" gap={2}>
          <Box className={`dot-indicator ${myTurnActive ? 'dot-active' : 'dot-waiting'}`} />
          <Text fontSize="12px" fontWeight="600" color="#baaa8a" letterSpacing="0.04em" textTransform="uppercase" fontFamily="Georgia, serif">
            Round {currentRound} · {opponentTurn ? 'Opponent' : 'You'}
          </Text>
        </Flex>
        <Flex gap={1.5}>{roundDots}</Flex>
      </Flex>

      {/* ── 对手区域 ── */}
      <Box mb={2}>
        <Flex justify="space-between" align="center" mb={1.5} px={1}>
          <Flex align="center" gap={2}>
            <Text fontSize="13px" fontWeight="600" color="#e0d3b8" fontFamily="Georgia, serif">
              {opponent.id.startsWith('ai_') ? '🤖 AI' : '对手'}
            </Text>
            {opponent.faction && (
              <Text fontSize="10px" color="#baaa8a" fontFamily="Georgia, serif">
                {FACTION_ICON[opponent.faction] || ''} {FACTION_NAME[opponent.faction] || opponent.faction}
              </Text>
            )}
            {opponent.leader && (
              <MouseTooltip content={`领袖: ${opponent.leader.name} · ${ABILITY_DESC[opponent.leader.ability] || ABILITY_LABEL[opponent.leader.ability] || '技能'}`} maxW="220px">
                <Box cursor="help" fontSize="10px" color="#d4b87a" fontFamily="Georgia, serif" bg="rgba(200,169,110,0.08)" borderRadius="2px" px={1.5} py={0.5}
                  border="1px solid rgba(200,169,110,0.15)">
                  👑 {opponent.leader.name}
                  {opponent.leaderUsed && <Text as="span" ml={1} color="#555">(已用)</Text>}
                </Box>
              </MouseTooltip>
            )}
            {opponent.passed && <Text fontSize="11px" fontWeight="600" color="#b5343a" fontFamily="Georgia, serif">PASSED</Text>}
          </Flex>
          <HStack gap={3}>
            <Text fontSize="10px" color="#baaa8a" fontFamily="Georgia, serif">🃏{opponent.deckCount||0} 💀{opponent.graveyard?.length||0} ✋{opponent.handCount}</Text>
            <Text fontSize="24px" fontWeight="400" color="#e0d3b8" letterSpacing="0.02em" fontFamily="Georgia, serif">{opponent.score}</Text>
          </HStack>
        </Flex>
        <Grid templateColumns="repeat(3, 1fr)" gap={2}>
          <RowZone label="近战" icon="⚔️" cards={opponent.melee} weather={weather?.melee} horned={horn?.opponent?.melee} />
          <RowZone label="远程" icon="🏹" cards={opponent.ranged} weather={weather?.ranged} horned={horn?.opponent?.ranged} />
          <RowZone label="攻城" icon="🏰" cards={opponent.siege} weather={weather?.siege} horned={horn?.opponent?.siege} />
        </Grid>
      </Box>

      <Box className="ornament-divider" my={2.5} />

      {/* ── 我方区域 ── */}
      <Box mb={2}>
        <Flex justify="space-between" align="center" mb={1.5} px={1}>
          <Flex align="center" gap={2}>
            <Text fontSize="13px" fontWeight="600" color="#e0d3b8" fontFamily="Georgia, serif">我</Text>
            {myself.passed && <Text fontSize="11px" fontWeight="600" color="#b5343a" fontFamily="Georgia, serif">PASSED</Text>}
          </Flex>
          <HStack gap={3}>
            <Text fontSize="10px" color="#baaa8a" fontFamily="Georgia, serif">🃏{myself.deckCount||0} 💀{myself.graveyard?.length||0} ✋{myself.handCount}</Text>
            <Text fontSize="24px" fontWeight="400" color={myTurnActive ? '#d4b87a' : '#e0d3b8'} letterSpacing="0.02em" fontFamily="Georgia, serif">{myself.score}</Text>
          </HStack>
        </Flex>
        <Grid templateColumns="repeat(3, 1fr)" gap={2}>
          <RowZone label="近战" icon="⚔️" cards={myself.melee} weather={weather?.melee} horned={horn?.mine?.melee} />
          <RowZone label="远程" icon="🏹" cards={myself.ranged} weather={weather?.ranged} horned={horn?.mine?.ranged} />
          <RowZone label="攻城" icon="🏰" cards={myself.siege} weather={weather?.siege} horned={horn?.mine?.siege} />
        </Grid>
      </Box>

      {/* ── 手牌区 ── */}
      <Box>
        <Flex justify="space-between" align="center" mb={1.5}>
          <Flex align="center" gap={3}>
            <Text fontSize="11px" fontWeight="600" color="#baaa8a" textTransform="uppercase" letterSpacing="0.06em" fontFamily="Georgia, serif">
              Your Hand · {myself.handCount} cards
              {myself.leader && (
                <Text as="span" ml={2} color={myself.leaderUsed ? '#555' : '#d4b87a'}>
                  👑 {myself.leader.name}
                  {myself.leaderUsed ? ' (已用)' : ''}
                </Text>
              )}
            </Text>
            {/* ── 领袖技能按钮 (紧凑) ── */}
            {myself.leader && !myself.leaderUsed && myTurnActive && (
              <Box as="button" onClick={() => {
                if (myself.leader.ability === 'horn') {
                  setLeaderRowSelect(true);
                } else {
                  onUseLeader(null);
                }
              }}
                bg="rgba(200,169,110,0.1)" color="#d4b87a"
                border="1px solid rgba(200,169,110,0.2)" borderRadius="2px"
                px={2} py={0.5} fontSize="10px" fontWeight="600"
                fontFamily="Georgia, serif" cursor="pointer"
                _hover={{ bg: 'rgba(200,169,110,0.18)' }}
                transition="all 0.15s">
                👑 {myself.leader.ability === 'horn' ? '号角×2' : myself.leader.ability === 'clear_weather' ? '晴空' : '技能'}
              </Box>
            )}
            {leaderRowSelect && myself.leader.ability === 'horn' && (
              <>
                {['melee', 'ranged', 'siege'].map(row => (
                  <Box key={row} as="button"
                    onClick={() => { onUseLeader(row); setLeaderRowSelect(false); }}
                    bg="rgba(45,38,29,0.8)" color="#e0d3b8"
                    border="1px solid rgba(200,169,110,0.15)" borderRadius="2px"
                    px={1.5} py={0.5} fontSize="10px" fontWeight="500"
                    fontFamily="Georgia, serif" cursor="pointer"
                    _hover={{ bg: 'rgba(200,169,110,0.15)' }}
                    transition="all 0.15s">
                    {{melee:'⚔️',ranged:'🏹',siege:'🏰'}[row]}
                  </Box>
                ))}
                <Box as="button" onClick={() => setLeaderRowSelect(false)}
                  bg="transparent" color="#8a7a5a" fontSize="10px" cursor="pointer"
                  _hover={{ color: '#e0d3b8' }}>取消</Box>
              </>
            )}
          </Flex>
          {/* ── Pass 按钮内联在手牌标题行 ── */}
          <Box as="button" onClick={onPass} disabled={!myTurnActive}
            bg="transparent" color={myTurnActive ? '#b5343a' : 'rgba(181,52,58,0.2)'}
            border="1px solid" borderColor={myTurnActive ? 'rgba(181,52,58,0.3)' : 'rgba(181,52,58,0.1)'}
            borderRadius="3px" h="30px" px={4} fontSize="11px" fontWeight="600" letterSpacing="0.06em"
            fontFamily="Georgia, serif" cursor={myTurnActive ? 'pointer' : 'default'}
            opacity={myTurnActive ? 1 : 0.3}
            _hover={myTurnActive ? { bg: 'rgba(181,52,58,0.1)', borderColor: 'rgba(181,52,58,0.5)' } : {}}
            transition="all 0.15s">
            PASS
          </Box>
        </Flex>
        <Flex gap={2.5} wrap="wrap" justify="center">
          {(myself.hand || []).map((card, idx) => {
            const isSelected = selectedCardIndex === idx;
            const abilityIcon = ABILITY_ICON[card.ability];
            const abilityLabel = ABILITY_LABEL[card.ability];
            const isSpecial = card.type === 'special';
            const isHero = card.ability === 'hero';
            const isSpy = card.ability === 'spy';

            const cardTheme = isHero
              ? { outer: '#8b7236', inner: '#c8a96e', bg: 'linear-gradient(160deg, #3a3020 0%, #2d2418 40%, #3a2e1a 100%)', powerBg: 'rgba(200,169,110,0.25)', powerColor: '#d4b87a' }
              : isSpy
              ? { outer: '#5a3a4a', inner: '#8b5a6a', bg: 'linear-gradient(160deg, #2d1e24 0%, #22171c 40%, #2d1e24 100%)', powerBg: 'rgba(180,100,120,0.2)', powerColor: '#c88a9a' }
              : isSpecial
              ? { outer: '#3a2a5a', inner: '#6a5a9a', bg: 'linear-gradient(160deg, #24202d 0%, #1e1a26 40%, #272030 100%)', powerBg: 'rgba(130,110,180,0.2)', powerColor: '#b0a0d0' }
              : { outer: '#3a3428', inner: '#5a5240', bg: 'linear-gradient(160deg, #2d2820 0%, #221d16 40%, #2d2618 100%)', powerBg: 'rgba(200,169,110,0.12)', powerColor: '#c8a96e' };

            const centerIcon = isSpecial ? '✨' : isHero ? '⭐' : (FACTION_ICON[card.faction] || '🛡️');

            return (
              <Box key={idx} position="relative" display="inline-flex">
              <Box as="button" onClick={() => handleCardClick(idx, card)}
                disabled={!myTurnActive}
                w="115px" h="155px" borderRadius="5px"
                position="relative"
                cursor={myTurnActive ? 'pointer' : 'default'} opacity={myTurnActive ? 1 : 0.35}
                transform={isSelected ? 'translateY(-8px) rotate(-1deg)' : 'none'}
                transition="all 0.3s cubic-bezier(0.25, 0.1, 0.25, 1)"
                _hover={myTurnActive ? { transform: 'translateY(-6px) rotate(-0.5deg)', boxShadow: `0 10px 32px rgba(0,0,0,0.55), 0 0 0 2px ${cardTheme.inner}, 0 0 16px ${cardTheme.inner}40` } : {}}
                display="flex" flexDirection="column"
                bg={cardTheme.bg}
                border="2px solid"
                borderColor={isSelected ? '#d4b87a' : cardTheme.outer}
                boxShadow={isSelected
                  ? `0 10px 32px rgba(0,0,0,0.5), 0 0 0 1px ${cardTheme.inner}, 0 0 20px ${cardTheme.inner}60, inset 0 0 0 2px ${cardTheme.inner}30`
                  : `0 3px 12px rgba(0,0,0,0.4), 0 0 0 1px ${cardTheme.inner}50, inset 0 0 0 1px ${cardTheme.inner}20`
                }
              >
                <Box position="absolute" inset="3px" borderRadius="3px" border={`1px solid ${cardTheme.inner}20`} pointerEvents="none" />

                {/* 顶部：战力 + 图标 */}
                <Flex justify="space-between" align="flex-start" px="8px" pt="6px" position="relative" zIndex={1}>
                  <Box bg={cardTheme.powerBg} borderRadius="2px" px="6px" py="1px" minW="22px" textAlign="center"
                    border={`1px solid ${cardTheme.inner}25`}>
                    <Text fontSize="13px" fontWeight="700" color={cardTheme.powerColor} fontFamily="Georgia, serif" lineHeight="1">
                      {card.power}
                    </Text>
                  </Box>
                  <Flex direction="column" align="flex-end" gap="1px">
                    {card.row && <Text fontSize="11px" lineHeight="1">{{melee:'⚔️',ranged:'🏹',siege:'🏰'}[card.row]}</Text>}
                    {abilityIcon && (
                      <MouseTooltip content={ABILITY_DESC[card.ability] || `${abilityLabel}`} maxW="160px">
                        <Text fontSize="11px" cursor="help" lineHeight="1">{abilityIcon}</Text>
                      </MouseTooltip>
                    )}
                  </Flex>
                </Flex>

                {/* 装饰线 */}
                <Flex align="center" px="10px" mt="4px" gap="4px">
                  <Box flex={1} h="1px" bg={`${cardTheme.inner}25`} />
                  <Box w="3px" h="3px" borderRadius="50%" bg={`${cardTheme.inner}35`} />
                  <Box flex={1} h="1px" bg={`${cardTheme.inner}25`} />
                </Flex>

                {/* 中央图标 */}
                <Flex flex={1} align="center" justify="center" position="relative" zIndex={1}>
                  <Text fontSize="32px" opacity={0.75} lineHeight="1"
                    filter={isHero ? 'drop-shadow(0 0 6px rgba(200,169,110,0.5))' : 'none'}>
                    {centerIcon}
                  </Text>
                </Flex>

                {/* 装饰线 */}
                <Flex align="center" px="10px" mb="3px" gap="4px">
                  <Box flex={1} h="1px" bg={`${cardTheme.inner}25`} />
                  <Box w="3px" h="3px" borderRadius="50%" bg={`${cardTheme.inner}35`} />
                  <Box flex={1} h="1px" bg={`${cardTheme.inner}25`} />
                </Flex>

                {/* 卡名 */}
                <Text fontSize="10px" fontWeight="600" color="#e0d3b8" fontFamily="Georgia, serif"
                  textAlign="center" lineHeight="1.2" px="6px" mb="4px" noOfLines={2} position="relative" zIndex={1}>
                  {card.name}
                </Text>

                {/* 底部阵营标签 */}
                <Box flexShrink={0} pb="5px" px="8px" position="relative" zIndex={1}>
                  <Box bg={`${cardTheme.inner}10`} borderRadius="2px" py="1px" px="5px"
                    border={`1px solid ${cardTheme.inner}15`}>
                    <Text fontSize="8px" fontWeight="500" color={cardTheme.inner} fontFamily="Georgia, serif" textAlign="center" letterSpacing="0.03em" textTransform="uppercase">
                      {isHero ? 'HERO' : isSpecial ? 'SPECIAL' : (FACTION_NAME[card.faction] || card.faction || 'UNIT')}
                    </Text>
                  </Box>
                </Box>
              </Box>
              {/* ── 排选择器：嵌入卡牌右侧 ── */}
              {isSelected && myTurnActive && (() => {
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
                  <Box
                    position="absolute" left="calc(100% + 10px)" top="0"
                    zIndex={100}
                    p={3.5} borderRadius="4px" border="1px solid rgba(200,169,110,0.25)" bg="rgba(24,20,14,0.96)"
                    w="175px" boxShadow="0 8px 40px rgba(0,0,0,0.7)">
                    <Text fontSize="13px" fontWeight="500" color="#e0d3b8" mb={2.5} textAlign="center" fontFamily="Georgia, serif">
                      {isHorn ? '📯 号角加强' : <><Text as="span" fontWeight="700" color="#d4b87a">「{card?.name}」</Text></>}
                    </Text>
                    <Flex direction="column" gap={1.5}>
                      {availableRows.map(({ row, label, desc }) => (
                        <Box key={row} as="button" onClick={(e) => { e.stopPropagation(); handleRowSelect(row); }}
                          bg="rgba(45,38,29,0.8)" color="#e0d3b8" border="1px solid rgba(200,169,110,0.1)"
                          borderRadius="3px" px={3} py={2} fontSize="12px" fontWeight="500"
                          fontFamily="Georgia, serif" cursor="pointer"
                          _hover={{ bg: 'rgba(200,169,110,0.1)', borderColor: 'rgba(200,169,110,0.3)' }}
                          _active={{ bg: 'rgba(200,169,110,0.15)' }} transition="all 0.15s"
                          display="flex" alignItems="center" gap={2}>
                          <Text>{label}</Text>
                          <Text fontSize="9px" color="#baaa8a">{desc}</Text>
                        </Box>
                      ))}
                      <Box as="button" onClick={(e) => { e.stopPropagation(); setSelectedCardIndex(null); }}
                        bg="transparent" color="#8a7a5a" border="1px solid rgba(200,169,110,0.08)"
                        borderRadius="3px" px={3} py={1.5} fontSize="11px" textAlign="center"
                        fontFamily="Georgia, serif" cursor="pointer"
                        _hover={{ color: '#e0d3b8', borderColor: 'rgba(200,169,110,0.2)' }} transition="all 0.15s">
                        取消
                      </Box>
                    </Flex>
                  </Box>
                );
              })()}
              </Box>
            );
          })}
          {(!myself.hand || myself.hand.length === 0) && (
            <Text fontSize="13px" color="rgba(200,169,110,0.15)" fontStyle="italic" fontFamily="Georgia, serif">No cards in hand</Text>
          )}
        </Flex>
      </Box>

      {/* ── 诱饵目标选择 ── */}
      {decoyCardIndex !== null && (() => {
        const allBattlefield = [
          ...myself.melee.map(c => ({...c, _row: 'melee', _rowLabel: '⚔️近战'})),
          ...myself.ranged.map(c => ({...c, _row: 'ranged', _rowLabel: '🏹远程'})),
          ...myself.siege.map(c => ({...c, _row: 'siege', _rowLabel: '🏰攻城'})),
        ].filter(c => !c.isHero);
        return (
        <Box position="fixed" top="50%" right="16px" transform="translateY(-50%)" zIndex={101}
          p={3.5} borderRadius="4px" border="1px solid rgba(200,169,110,0.3)" bg="rgba(24,20,14,0.96)"
          maxW="215px" maxH="50vh" overflowY="auto" boxShadow="0 8px 40px rgba(0,0,0,0.7)">
          <Text fontSize="13px" fontWeight="500" color="#e0d3b8" mb={2} textAlign="center" fontFamily="Georgia, serif">
            🃏 选择单位收回手牌
          </Text>
          {allBattlefield.length === 0 ? (
            <Text color="#8a7a5a" textAlign="center" fontSize="11px">无单位可收回</Text>
          ) : (
            <Flex direction="column" gap={1}>
              {allBattlefield.map(c => (
                <Box key={c.id} as="button"
                  onClick={() => { onPlayCard(decoyCardIndex, 'melee', c.id); setDecoyCardIndex(null); }}
                  bg="rgba(45,38,29,0.8)" color="#e0d3b8"
                  border="1px solid rgba(200,169,110,0.15)" borderRadius="3px"
                  px={2.5} py={1.5} fontSize="12px" fontWeight="500"
                  fontFamily="Georgia, serif" cursor="pointer"
                  _hover={{ bg: 'rgba(200,169,110,0.15)', borderColor: 'rgba(200,169,110,0.3)' }}
                  transition="all 0.15s" display="flex" alignItems="center" gap={2}>
                  <Text fontSize="10px" color="#baaa8a">{c._rowLabel}</Text>
                  <Text flex={1} truncate>{c.name}</Text>
                  <Text fontSize="11px" fontWeight="700" color="#c8a96e">{c.power}</Text>
                </Box>
              ))}
            </Flex>
          )}
          <Flex justify="center" mt={2}>
            <Box as="button" onClick={() => setDecoyCardIndex(null)}
              bg="transparent" color="#8a7a5a" border="1px solid rgba(200,169,110,0.08)"
              borderRadius="3px" px={3} py={1} fontSize="11px"
              fontFamily="Georgia, serif" cursor="pointer"
              _hover={{ color: '#e0d3b8' }}>取消</Box>
          </Flex>
        </Box>
        );
      })()}

      {/* ── 医生目标选择 ── */}
      {medicPending !== null && (() => {
        const graveUnits = (myself.graveyard || []).filter(c => c.type === 'unit' && !c.isHero);
        return (
        <Box position="fixed" top="50%" right="16px" transform="translateY(-50%)" zIndex={101}
          p={3.5} borderRadius="4px" border="1px solid rgba(107,138,58,0.3)" bg="rgba(24,20,14,0.96)"
          maxW="215px" maxH="50vh" overflowY="auto" boxShadow="0 8px 40px rgba(0,0,0,0.7)">
          <Text fontSize="13px" fontWeight="500" color="#e0d3b8" mb={2} textAlign="center" fontFamily="Georgia, serif">
            💊 复活墓地单位
          </Text>
          {graveUnits.length === 0 ? (
            <Text color="#8a7a5a" textAlign="center" fontSize="11px">无单位可复活</Text>
          ) : (
            <Flex direction="column" gap={1}>
              {graveUnits.map(c => (
                <Box key={c.id} as="button"
                  onClick={() => { onPlayCard(medicPending.cardIndex, medicPending.row, c.id); setMedicPending(null); }}
                  bg="rgba(45,38,29,0.8)" color="#e0d3b8"
                  border="1px solid rgba(107,138,58,0.2)" borderRadius="3px"
                  px={2.5} py={1.5} fontSize="12px" fontWeight="500"
                  fontFamily="Georgia, serif" cursor="pointer"
                  _hover={{ bg: 'rgba(107,138,58,0.12)', borderColor: 'rgba(107,138,58,0.35)' }}
                  transition="all 0.15s" display="flex" alignItems="center" gap={2}>
                  <Text flex={1} truncate>{c.name}</Text>
                  <Text fontSize="11px" fontWeight="700" color="#6b8a3a">{c.power}</Text>
                </Box>
              ))}
            </Flex>
          )}
          <Flex justify="center" mt={2}>
            <Box as="button" onClick={() => setMedicPending(null)}
              bg="transparent" color="#8a7a5a" border="1px solid rgba(200,169,110,0.08)"
              borderRadius="3px" px={3} py={1} fontSize="11px"
              fontFamily="Georgia, serif" cursor="pointer"
              _hover={{ color: '#e0d3b8' }}>取消</Box>
          </Flex>
        </Box>
        );
      })()}

    </Box>
  );
}

export default GameBoard;
