import React, { useState, useEffect } from 'react';
import {
  Box, HStack, VStack, Text, Button, Badge, Input,
  TabsRoot, TabsList, TabsTrigger, TabsContent, TabsIndicator,
  SimpleGrid, createToaster, Toaster,
  DialogRoot, DialogBackdrop, DialogPositioner, DialogContent,
  DialogHeader, DialogTitle, DialogBody, DialogFooter, DialogCloseTrigger
} from '@chakra-ui/react';
import MouseTooltip from './MouseTooltip';

const toaster = createToaster({ placement: 'top', duration: 2000 });

const ROW_LABEL = { melee: '⚔️ 近战', ranged: '🏹 远程', siege: '🏰 攻城' };
const RARITY_COLORS = { common: 'gray', rare: 'blue', legendary: 'gold', special: 'purple' };
const RARITY_MAX = { common: 3, rare: 1, legendary: 1, special: 1 };
const ABILITY_ICON = {
  hero: '⭐', spy: '🕵️', medic: '💊', muster: '📋', tight_bond: '🔗',
  morale_boost: '📯', scorch: '🔥', horn: '📯',
  weather_frost: '❄️', weather_fog: '🌫️', weather_rain: '🌧️', clear_weather: '☀️',
  commanders_horn: '📯', decoy: '🃏', scorch_melee: '🔥', scorch_siege: '🔥',
};
const ABILITY_DESC = {
  hero: '英雄 — 不受任何特殊效果影响（天气、烧灼、号角等对其无效）',
  spy: '间谍 — 放置在对方战场上，并从牌组抽2张牌',
  medic: '医生 — 打出后从己方墓地复活一张非英雄单位',
  muster: '召集 — 从手牌和牌组中召唤所有同名卡牌到同一排',
  tight_bond: '紧黏 — 同名牌相邻放置时，每张的战力翻倍',
  morale_boost: '振奋 — 该排所有非英雄单位战力+1',
  scorch: '烧灼 — 摧毁全场战力最高的非英雄单位（敌我不分）',
  scorch_melee: '烧灼(近战) — 摧毁近战排战力最高的非英雄单位',
  scorch_siege: '烧灼(攻城) — 摧毁攻城排战力最高的非英雄单位',
  horn: '号角 — 使所在排所有非英雄单位战力翻倍',
  commanders_horn: '指挥号角 — 选择一排，使其所有非英雄单位战力翻倍',
  decoy: '诱饵 — 将己方战场上一张非英雄单位收回手牌并重新部署',
  weather_frost: '霜冻 — 双方近战排所有非英雄单位战力变为1',
  weather_fog: '浓雾 — 双方远程排所有非英雄单位战力变为1',
  weather_rain: '暴雨 — 双方攻城排所有非英雄单位战力变为1',
  clear_weather: '晴天 — 清除场上所有天气效果',
};
const LEADER_DESC = {
  '弗尔泰斯特:泰莫利亚之王': '号角 — 选择一个排，使其非英雄单位战力翻倍',
  '弗尔泰斯特:北方统帅': '晴天 — 清除场上所有天气效果',
  '弗尔泰斯特:攻城之王': '号角 — 选择一个排，使其非英雄单位战力翻倍',
};

const API_BASE = process.env.REACT_APP_API_URL || '';

export default function DeckBuilder({ deck, setDeck, leader, setLeader, selectedFaction, setSelectedFaction, playerName }) {
  const [allCards, setAllCards] = useState([]);
  const [factions, setFactions] = useState({});
  const [tabValue, setTabValue] = useState('units');
  const [deckName, setDeckName] = useState('');
  const [savedDecks, setSavedDecks] = useState([]);
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/cards`)
      .then(r => r.json())
      .then(data => {
        if (data.success) { setAllCards(data.cards); setFactions(data.factions); }
      })
      .catch(() => { setAllCards([]); setFactions({}); });
  }, []);

  // 加载已保存的卡组列表
  useEffect(() => {
    if (playerName) {
      fetch(`${API_BASE}/api/decks/${encodeURIComponent(playerName)}`)
        .then(r => r.json())
        .then(data => { if (data.success) setSavedDecks(data.decks); })
        .catch(() => {});
    }
  }, [playerName]);

  const handleSaveDeck = async () => {
    if (!playerName) return;
    if (!deckName.trim()) {
      toaster.create({ title: '请输入卡组名称', type: 'warning' });
      return;
    }
    if (!selectedFaction) {
      toaster.create({ title: '请先选择阵营', type: 'warning' });
      return;
    }
    if (deck.filter(c => c.type === 'unit').length < 22) {
      toaster.create({ title: '至少需要22张单位卡', type: 'warning' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/decks/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: playerName,
          deckName: deckName.trim(),
          faction: selectedFaction,
          leaderId: leader?.id || null,
          cards: deck
        })
      });
      const data = await res.json();
      if (data.success) {
        toaster.create({ title: '卡组已保存！', type: 'success' });
        setSavedDecks(prev => {
          const updated = prev.filter(d => d.id !== data.deckId);
          return [{ id: data.deckId, name: deckName.trim(), faction: selectedFaction, leaderId: leader?.id, cardIds: [] }, ...updated];
        });
      }
    } catch {
      toaster.create({ title: '保存失败，请检查服务器', type: 'error' });
    } finally { setSaving(false); }
  };

  const handleLoadDeck = async (deckId) => {
    const saved = savedDecks.find(d => d.id === deckId);
    if (!saved) return;
    // 先关闭对话框，让关闭动画开始
    setShowLoadDialog(false);
    setDeckName(saved.name);
    // 重新从服务器加载完整卡组数据
    try {
      const res = await fetch(`${API_BASE}/api/decks/${encodeURIComponent(playerName)}`);
      const data = await res.json();
      if (data.success) {
        const full = data.decks.find(d => d.id === deckId);
        if (full) {
          // 根据 cardIds 构建完整卡牌数组
          const loadedCards = [];
          for (const { id, count } of full.cardIds) {
            const cardTemplate = allCards.find(c => c.id === id);
            if (cardTemplate) {
              for (let i = 0; i < count; i++) loadedCards.push({ ...cardTemplate });
            }
          }
          setDeck(loadedCards);
          setSelectedFaction(full.faction);
          if (full.leaderId) {
            const leaderCard = allCards.find(c => c.id === full.leaderId);
            if (leaderCard) setLeader(leaderCard);
          } else { setLeader(null); }
          toaster.create({ title: `已加载「${full.name}」`, type: 'success' });
        }
      }
    } catch {
      toaster.create({ title: '加载失败', type: 'error' });
    }
  };

  const handleDeleteDeck = async (deckId) => {
    try {
      await fetch(`${API_BASE}/api/decks/${deckId}`, { method: 'DELETE' });
      setSavedDecks(prev => prev.filter(d => d.id !== deckId));
      toaster.create({ title: '卡组已删除', type: 'info' });
    } catch {
      toaster.create({ title: '删除失败', type: 'error' });
    }
  };

  const handleFactionChange = (key) => { setSelectedFaction(key); setDeck([]); setLeader(null); };

  const canAdd = (card) => {
    if (card.type === 'leader') return false;
    if (card.type === 'special' && deck.filter(c => c.type === 'special').length >= 7) return false;
    const sameCardCount = deck.filter(c => c.id === card.id).length;
    if (sameCardCount >= (RARITY_MAX[card.rarity] || 3)) return false;
    if (card.faction !== 'neutral' && card.faction !== selectedFaction) return false;
    return true;
  };

  const addCard = (card) => {
    if (!canAdd(card)) {
      toaster.create({ title: '无法加入', description: '超出数量限制或阵营不符', type: 'warning' });
      return;
    }
    setDeck([...deck, { ...card }]);
  };

  const filterCards = (tab) => {
    if (!selectedFaction) return [];
    if (tab === 'units') return allCards.filter(c => c.type === 'unit' && !c.isHero && (c.faction === selectedFaction || c.faction === 'neutral'));
    if (tab === 'heroes') return allCards.filter(c => c.isHero && (c.faction === selectedFaction || c.faction === 'neutral'));
    if (tab === 'specials') return allCards.filter(c => c.type === 'special');
    return [];
  };

  const groupByRow = (cards) => {
    const groups = { melee: [], ranged: [], siege: [] };
    cards.forEach(c => { if (groups[c.row]) groups[c.row].push(c); else groups.melee.push(c); });
    return groups;
  };

  const currentLeaders = selectedFaction ? (factions[selectedFaction]?.leaders || []) : [];

  // 渲染卡牌网格（带技能提示）
  const renderCardGrid = (cards) => {
    if (!cards.length) return <Text fontSize="xs" color="#8a7a5a" p={2} fontFamily="Georgia, serif">暂无可用卡牌</Text>;
    return (
      <SimpleGrid columns={3} gap={1}>
        {cards.map(card => {
          const abilityIcon = card.ability ? ABILITY_ICON[card.ability] : null;
          const abilityDesc = card.ability ? ABILITY_DESC[card.ability] : null;
          const heroAbilityIcon = card.heroAbility ? ABILITY_ICON[card.heroAbility] : null;
          const heroAbilityDesc = card.heroAbility ? ABILITY_DESC[card.heroAbility] : null;
          const rowLabel = card.row ? ROW_LABEL[card.row] : '';
          const typeLabel = card.isHero ? '⭐英雄' : card.type === 'special' ? '✨特殊' : '单位';
          const can = canAdd(card);
          return (
            <MouseTooltip key={card.id} content={
              <>
                <Text fontWeight="bold" mb={1}>
                  {abilityIcon && `${abilityIcon} `}{card.name} · {typeLabel} · {card.power}⚡
                </Text>
                {rowLabel && <Text color="#baaa8a">📌 {rowLabel}</Text>}
                {abilityDesc && <Text color="#d4b87a" mt={1}>{abilityDesc}</Text>}
                {heroAbilityDesc && <Text color="#e2c88a" mt={1}>{heroAbilityDesc.replace(/^([^-]+—)/, '副技能·$1')}</Text>}
                {!abilityDesc && !card.isHero && card.type === 'unit' && !heroAbilityDesc && (
                  <Text color="#8a7a5a" mt={1}>无特殊技能</Text>
                )}
              </>
            }>
              <Button
                size="xs" h="34px" w="100%" minW={0} px={2}
                fontSize="2xs"
                fontFamily="Georgia, 'Times New Roman', serif"
                bg={can ? '#2d261d' : '#1a1612'}
                color={can ? '#e0d3b8' : '#6b6050'}
                borderColor={can ? 'rgba(200,169,110,0.25)' : 'rgba(200,169,110,0.08)'}
                variant="outline"
                borderRadius="3px"
                disabled={!can}
                _hover={can ? { bg: '#3a3024', borderColor: 'rgba(200,169,110,0.4)' } : {}}
                onClick={() => addCard(card)}
              >
                {abilityIcon && <Text as="span" mr={0.5} fontSize="9px" flexShrink={0}>{abilityIcon}</Text>}
                {heroAbilityIcon && <Text as="span" mr={0.5} fontSize="9px" flexShrink={0}>{heroAbilityIcon}</Text>}
                <Text truncate flex="1" minW={0} textAlign="left">{card.name}</Text>
                <Badge ml={1} fontSize="2xs" flexShrink={0} variant="surface" borderRadius="2px" colorPalette={RARITY_COLORS[card.rarity]}>{card.power}</Badge>
              </Button>
            </MouseTooltip>
          );
        })}
      </SimpleGrid>
    );
  };

  if (!allCards.length) {
    return <Box p={4}><Text color="#baaa8a" fontFamily="Georgia, serif">正在加载卡牌数据...</Text></Box>;
  }

  return (
    <Box flex="1" display="flex" flexDirection="column" minH={0}>
      {/* 保存/加载卡组 */}
      <HStack mb={2} gap={1} flexShrink={0}>
        <Input
          placeholder="卡组名称"
          value={deckName}
          onChange={e => setDeckName(e.target.value)}
          size="xs" h="28px" maxW="140px"
          bg="#2d261d" color="#e0d3b8"
          borderColor="rgba(200,169,110,0.25)"
          fontFamily="Georgia, serif"
          _placeholder={{ color: '#8a7a5a' }}
        />
        <Button size="xs" h="28px"
          fontFamily="Georgia, serif"
          bg="rgba(107,138,58,0.12)" color="#6b8a3a"
          border="1px solid rgba(107,138,58,0.25)"
          _hover={{ bg: 'rgba(107,138,58,0.22)' }}
          disabled={saving || !playerName}
          onClick={handleSaveDeck}
        >{saving ? '⋯' : '💾 保存'}</Button>
        {savedDecks.length > 0 && (
          <Button size="xs" h="28px"
            fontFamily="Georgia, serif"
            bg="rgba(200,169,110,0.1)" color="#d4b87a"
            border="1px solid rgba(200,169,110,0.25)"
            _hover={{ bg: 'rgba(200,169,110,0.2)' }}
            onClick={() => setShowLoadDialog(true)}
          >📂 加载</Button>
        )}
      </HStack>

      {/* 阵营选择 */}
      <HStack mb={3} gap={2} flexShrink={0}>
        <Text fontWeight="bold" fontSize="sm" color="#e0d3b8" fontFamily="Georgia, serif">阵营:</Text>
        {Object.entries(factions).map(([key, val]) => (
          <Button key={key} size="xs"
            fontFamily="Georgia, serif"
            bg={selectedFaction === key ? '#3d2e1f' : '#221d16'}
            color={selectedFaction === key ? '#e2c88a' : '#baaa8a'}
            borderColor={selectedFaction === key ? 'rgba(200,169,110,0.4)' : 'rgba(200,169,110,0.15)'}
            variant="outline"
            borderRadius="3px"
            _hover={{ bg: '#3a3024', borderColor: 'rgba(200,169,110,0.35)' }}
            onClick={() => handleFactionChange(key)}
          >{val.name}</Button>
        ))}
      </HStack>

      {selectedFaction && (
        <>
          {/* 领袖选择 */}
          <Box mb={3} flexShrink={0}>
            <Text fontWeight="bold" fontSize="sm" mb={1} color="#e0d3b8" fontFamily="Georgia, serif">领袖:</Text>
            <HStack gap={1} flexWrap="wrap">
              {currentLeaders.map(l => (
                <MouseTooltip key={l.id} content={
                  <>
                    <Text fontWeight="bold" mb={1}>👑 {l.name}</Text>
                    <Text color="#d4b87a">{LEADER_DESC[l.name] || (l.ability ? `技能: ${ABILITY_DESC[l.ability] || l.ability}` : '无特殊技能')}</Text>
                    <Text color="#8a7a5a" mt={1} fontSize="10px">领袖牌不占牌组位置，全局仅可使用一次</Text>
                  </>
                }>
                  <Button size="xs"
                    fontFamily="Georgia, serif"
                    bg={leader?.id === l.id ? '#3d2e1f' : '#221d16'}
                    color={leader?.id === l.id ? '#e2c88a' : '#baaa8a'}
                    borderColor={leader?.id === l.id ? 'rgba(200,169,110,0.45)' : 'rgba(200,169,110,0.15)'}
                    variant="outline"
                    borderRadius="3px"
                    _hover={{ bg: '#3a3024', borderColor: 'rgba(200,169,110,0.35)' }}
                    onClick={() => setLeader(l)}
                  >⭐{l.name}</Button>
                </MouseTooltip>
              ))}
            </HStack>
          </Box>

          {/* 卡池标签页 */}
          <TabsRoot
            value={tabValue}
            onValueChange={(e) => setTabValue(e.value)}
            variant="line"
            size="sm"
            flex="1"
            display="flex"
            flexDirection="column"
            minH={0}
          >
            <TabsList flexShrink={0}>
              <TabsTrigger value="units" fontFamily="Georgia, serif">单位</TabsTrigger>
              <TabsTrigger value="heroes" fontFamily="Georgia, serif">英雄</TabsTrigger>
              <TabsTrigger value="specials" fontFamily="Georgia, serif">特殊</TabsTrigger>
              <TabsIndicator bg="#c8a96e" />
            </TabsList>

            <TabsContent value="units" p={1} flex="1" minH={0} overflow="visible">
              <Box overflowY="auto" h="100%" pr={1}>
              {['melee', 'ranged', 'siege'].map(row => {
                const rowCards = groupByRow(filterCards('units'))[row];
                if (!rowCards.length) return null;
                return (
                  <Box key={row} mb={2}>
                    <Text fontSize="xs" fontWeight="bold" color="#baaa8a" mb={1} fontFamily="Georgia, serif">{ROW_LABEL[row]}</Text>
                    {renderCardGrid(rowCards)}
                  </Box>
                );
              })}
              </Box>
            </TabsContent>

            <TabsContent value="heroes" p={1} flex="1" minH={0} overflow="visible">
              <Box overflowY="auto" h="100%" pr={1}>
              {renderCardGrid(filterCards('heroes'))}
              </Box>
            </TabsContent>

            <TabsContent value="specials" p={1} flex="1" minH={0} overflow="visible">
              <Box overflowY="auto" h="100%" pr={1}>
              {renderCardGrid(filterCards('specials'))}
              </Box>
            </TabsContent>
          </TabsRoot>
        </>
      )}

      {/* 加载卡组对话框 — 始终渲染，用 open 控制，避免条件卸载与 portal 生命周期冲突 */}
      <DialogRoot open={showLoadDialog} onOpenChange={(e) => setShowLoadDialog(e.open)}>
        <DialogBackdrop />
        <DialogPositioner>
          <DialogContent bg="#221d16" border="1px solid rgba(200,169,110,0.2)" borderRadius="3px" maxW="400px">
            <DialogHeader>
              <DialogTitle fontFamily="Georgia, serif" color="#e0d3b8">📂 加载卡组</DialogTitle>
              <DialogCloseTrigger />
            </DialogHeader>
            <DialogBody>
              {savedDecks.length === 0 ? (
                <Text color="#8a7a5a" fontFamily="Georgia, serif">暂无保存的卡组</Text>
              ) : (
                <VStack gap={2}>
                  {savedDecks.map(d => (
                    <HStack key={d.id} w="100%" p={2} bg="rgba(34,29,22,0.8)" borderRadius="3px"
                      justify="space-between" border="1px solid rgba(200,169,110,0.08)">
                      <Box flex="1" onClick={() => handleLoadDeck(d.id)} cursor="pointer"
                        _hover={{ opacity: 0.8 }}>
                        <Text fontSize="sm" fontWeight="bold" color="#e0d3b8" fontFamily="Georgia, serif">{d.name}</Text>
                        <Text fontSize="xs" color="#baaa8a" fontFamily="Georgia, serif">{d.faction}</Text>
                      </Box>
                      <Button size="2xs" h="22px" minW={0} px={2}
                        fontFamily="Georgia, serif" fontSize="10px"
                        bg="rgba(181,52,58,0.1)" color="#b5343a"
                        border="1px solid rgba(181,52,58,0.2)"
                        _hover={{ bg: 'rgba(181,52,58,0.2)' }}
                        onClick={() => handleDeleteDeck(d.id)}
                      >删除</Button>
                    </HStack>
                  ))}
                </VStack>
              )}
            </DialogBody>
            <DialogFooter>
              <Button size="sm" variant="outline"
                fontFamily="Georgia, serif"
                bg="#221d16" color="#baaa8a"
                borderColor="rgba(200,169,110,0.25)"
                _hover={{ bg: '#2d261d' }}
                onClick={() => setShowLoadDialog(false)}
              >关闭</Button>
            </DialogFooter>
          </DialogContent>
        </DialogPositioner>
      </DialogRoot>
      <Toaster toaster={toaster}>
        {(toast) => (
          <Box bg="#2d261d" color="#e0d3b8" p={3} borderRadius="3px" border="1px solid rgba(200,169,110,0.25)" fontFamily="Georgia, serif">
            <Text fontWeight="bold">{toast.title}</Text>
            {toast.description && <Text fontSize="sm" color="#baaa8a">{toast.description}</Text>}
          </Box>
        )}
      </Toaster>
    </Box>
  );
}
