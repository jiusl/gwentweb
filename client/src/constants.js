// 技能图标
export const ABILITY_ICON = {
  hero: '⭐', spy: '🕵️', medic: '💊', muster: '📋', tight_bond: '🔗',
  morale_boost: '📯', scorch: '🔥', horn: '📯',
  weather_frost: '❄️', weather_fog: '🌫️', weather_rain: '🌧️', clear_weather: '☀️',
  commanders_horn: '📯', decoy: '🃏', scorch_melee: '🔥', scorch_siege: '🔥',
};

// 技能标签（简短）
export const ABILITY_LABEL = {
  hero: '英雄', spy: '间谍', medic: '医生', muster: '召集',
  tight_bond: '紧黏', morale_boost: '振奋', scorch: '烧灼',
  horn: '号角', decoy: '诱饵', commander_horn: '指挥号角',
  weather_frost: '霜冻', weather_fog: '浓雾', weather_rain: '暴雨',
  clear_weather: '晴天', scorch_melee: '烧灼', scorch_siege: '烧灼',
};

// 技能描述
export const ABILITY_DESC = {
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

// 排标签
export const ROW_LABEL = { melee: '⚔️ 近战', ranged: '🏹 远程', siege: '🏰 攻城' };

// 稀有度
export const RARITY_COLORS = { common: 'gray', rare: 'blue', legendary: 'gold', special: 'purple' };
export const RARITY_MAX = { common: 3, rare: 1, legendary: 1, special: 1 };

// 阵营
export const FACTION_NAME = {
  northern: '北方领域', nilfgaard: '尼弗迦德', scoiatael: '松鼠党', monsters: '怪物',
};
export const FACTION_ICON = {
  northern: '🦅', nilfgaard: '☀️', scoiatael: '🏹', monsters: '👹',
};
export const FACTION_COLOR = {
  northern: '#4a7ab5', nilfgaard: '#b54a4a', scoiatael: '#5a8a4a', monsters: '#b54a2a',
};

// 天气
export const WEATHER_ICON = { frost: '❄️', fog: '🌫️', rain: '🌧️' };
export const WEATHER_LABEL = { frost: '霜冻', fog: '浓雾', rain: '暴雨' };

// 领袖描述
export const LEADER_DESC = {
  '弗尔泰斯特:泰莫利亚之王': '号角 — 选择一个排，使其非英雄单位战力翻倍',
  '弗尔泰斯特:北方统帅': '晴天 — 清除场上所有天气效果',
  '弗尔泰斯特:攻城之王': '号角 — 选择一个排，使其非英雄单位战力翻倍',
};
