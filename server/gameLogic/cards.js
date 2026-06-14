/**
 * 完整昆特牌卡牌数据库 (基于 Witcher 3: Wild Hunt)
 * 数据来源: https://github.com/matt77hias/Gwent
 */

// ── 卡牌技能常量 ──
const ABILITIES = {
  HERO: 'hero',
  TIGHT_BOND: 'tight_bond',
  MORALE_BOOST: 'morale_boost',
  SPY: 'spy',
  MEDIC: 'medic',
  MUSTER: 'muster',
  SCORCH: 'scorch',
  SCORCH_MELEE: 'scorch_melee',
  SCORCH_SIEGE: 'scorch_siege',
  HORN: 'horn',
  WEATHER_FROST: 'weather_frost',
  WEATHER_FOG: 'weather_fog',
  WEATHER_RAIN: 'weather_rain',
  CLEAR_WEATHER: 'clear_weather',
  DECOY: 'decoy',
  COMMANDERS_HORN: 'commanders_horn',
};

// ── 稀有度 ──
const RARITY = { COMMON: 'common', RARE: 'rare', LEGENDARY: 'legendary', SPECIAL: 'special' };

// ── 基础卡牌类（属性存为普通字段，防浅拷贝丢失）──
class Card {
  constructor(id, name, type, power, faction, row = null, ability = null, heroAbility = null) {
    this.id = id;
    this.name = name;
    this.type = type;
    this.power = power;
    this.faction = faction;
    this.row = row;
    this.ability = ability;
    this.heroAbility = heroAbility; // 英雄牌的副技能（如叶奈法的 medic、神秘精灵的 spy）
    // 标记字段（普通属性，非 getter）
    this.isHero = ability === ABILITIES.HERO;
    this.isSpy = ability === ABILITIES.SPY || heroAbility === ABILITIES.SPY;
    this.isMedic = ability === ABILITIES.MEDIC || heroAbility === ABILITIES.MEDIC;
    this.isMuster = ability === ABILITIES.MUSTER || heroAbility === ABILITIES.MUSTER;
    this.isTightBond = ability === ABILITIES.TIGHT_BOND || heroAbility === ABILITIES.TIGHT_BOND;
    this.isMoraleBoost = ability === ABILITIES.MORALE_BOOST || heroAbility === ABILITIES.MORALE_BOOST;
    this.isScorch = ability === ABILITIES.SCORCH || heroAbility === ABILITIES.SCORCH;
    // 稀有度
    if (type === 'special') this.rarity = RARITY.SPECIAL;
    else if (this.isHero) this.rarity = RARITY.LEGENDARY;
    else if (ability && [ABILITIES.SPY, ABILITIES.MEDIC, ABILITIES.SCORCH, ABILITIES.MORALE_BOOST, ABILITIES.HORN].includes(ability)) this.rarity = RARITY.RARE;
    else this.rarity = RARITY.COMMON;
  }
}

// ── 创建辅助 ──
let _id = 0;
function mk(name, power, faction, row, ability = null, heroAbility = null) {
  _id++;
  return new Card(String(_id), name, 'unit', power, faction, row, ability, heroAbility);
}
function mkSp(name, ability) {
  _id++;
  return new Card(String(_id), name, 'special', 0, 'neutral', null, ability);
}
function mkLdr(name, faction, ability) {
  _id++;
  return new Card(String(_id), name, 'leader', 0, faction, null, ability);
}

// ═══════════ 北方领域 ═══════════
const N = 'northern';
const n = {
  '蓝衣铁卫突击队':  mk('蓝衣铁卫突击队', 4, N, 'melee', ABILITIES.TIGHT_BOND),
  '可怜的步兵':       mk('可怜的步兵', 1, N, 'melee', ABILITIES.TIGHT_BOND),
  '瑞达尼亚步兵团':   mk('瑞达尼亚步兵团', 2, N, 'melee'),
  '齐格弗里德':       mk('齐格弗里德', 5, N, 'melee'),
  '亚尔潘·齐格林':   mk('亚尔潘·齐格林', 2, N, 'melee'),
  '维斯':             mk('维斯', 5, N, 'melee'),
  '迪科斯彻':         mk('迪科斯彻', 4, N, 'melee', ABILITIES.SPY),
  '斯坦尼斯王子':     mk('斯坦尼斯王子', 5, N, 'melee', ABILITIES.SPY),
  '巨龙猎人':         mk('巨龙猎人', 5, N, 'ranged', ABILITIES.TIGHT_BOND),
  '席儿·坦沙维耶':   mk('席儿·坦沙维耶', 5, N, 'ranged'),
  '萨布丽娜':         mk('萨布丽娜', 4, N, 'ranged'),
  '谢尔顿·斯卡格斯': mk('谢尔顿·斯卡格斯', 4, N, 'ranged'),
  '凯拉·梅兹':       mk('凯拉·梅兹', 5, N, 'ranged'),
  '戴斯摩':           mk('戴斯摩', 6, N, 'ranged'),
  '弩炮':             mk('弩炮', 6, N, 'siege'),
  '投石车':           mk('投石车', 8, N, 'siege', ABILITIES.TIGHT_BOND),
  '攻城塔':           mk('攻城塔', 6, N, 'siege'),
  '抛石机':           mk('抛石机', 6, N, 'siege'),
  '凯登攻城专家':     mk('凯登攻城专家', 1, N, 'siege', ABILITIES.MORALE_BOOST),
  '邓巴医疗兵':       mk('邓巴医疗兵', 5, N, 'siege', ABILITIES.MEDIC),
  '塔勒':             mk('塔勒', 1, N, 'siege', ABILITIES.SPY),
  '弗农·罗契':       mk('弗农·罗契', 10, N, 'melee', ABILITIES.HERO),
  '约翰·纳塔利斯':   mk('约翰·纳塔利斯', 10, N, 'melee', ABILITIES.HERO),
  '伊斯特拉德':       mk('伊斯特拉德', 10, N, 'melee', ABILITIES.HERO),
  '菲利帕·艾哈特':   mk('菲利帕·艾哈特', 10, N, 'ranged', ABILITIES.HERO),
};

const nLeaders = [
  mkLdr('弗尔泰斯特:泰莫利亚之王', N, ABILITIES.HORN),
  mkLdr('弗尔泰斯特:北方统帅', N, ABILITIES.CLEAR_WEATHER),
  mkLdr('弗尔泰斯特:攻城之王', N, ABILITIES.HORN),
];

// ═══════════ 尼弗迦德 ═══════════
const G = 'nilfgaard';
const gLeaders = [
  mkLdr('恩希尔:白色火焰', G, ABILITIES.HORN),
  mkLdr('恩希尔:冷酷征服者', G, ABILITIES.CLEAR_WEATHER),
];
const g = {
  '帝国旅卫':         mk('帝国旅卫', 3, G, 'melee', ABILITIES.TIGHT_BOND),
  '那乌西卡骑兵':     mk('那乌西卡骑兵', 2, G, 'melee', ABILITIES.TIGHT_BOND),
  '雷恩法':           mk('雷恩法', 4, G, 'melee'),
  '弗林姆德':         mk('弗林姆德', 2, G, 'melee'),
  '莫泰森':           mk('莫泰森', 3, G, 'melee'),
  '卡西尔':           mk('卡西尔', 4, G, 'melee'),
  '瓦提尔(间谍)':     mk('瓦提尔', 4, G, 'melee', ABILITIES.SPY),
  '史蒂芬·史凯伦':   mk('史蒂芬·史凯伦', 9, G, 'melee', ABILITIES.SPY),
  '年轻使者':         mk('年轻使者', 5, G, 'melee', ABILITIES.TIGHT_BOND),
  '黑步兵弓手':       mk('黑步兵弓手', 10, G, 'ranged'),
  '艾托利安辅助弓手': mk('艾托利安辅助弓手', 1, G, 'ranged', ABILITIES.MEDIC),
  '普特卡摩':         mk('普特卡摩', 6, G, 'ranged'),
  '辛西亚':           mk('辛西亚', 4, G, 'ranged'),
  '范厄玛':           mk('范厄玛', 4, G, 'ranged'),
  '弗林吉拉·维果':   mk('弗林吉拉·维果', 6, G, 'ranged'),
  '亚伯力奇':         mk('亚伯力奇', 2, G, 'ranged'),
  '斯维尔':           mk('斯维尔', 2, G, 'ranged'),
  '阿西尔':           mk('阿西尔', 6, G, 'ranged'),
  '雷努阿':           mk('雷努阿', 5, G, 'ranged'),
  '希拉德':           mk('希拉德', 5, G, 'ranged'),
  '泽瑞坎火蝎':       mk('泽瑞坎火蝎', 5, G, 'siege'),
  '重型火蝎':         mk('重型火蝎', 10, G, 'siege'),
  '腐坏投石机':       mk('腐坏投石机', 3, G, 'siege'),
  '攻城工程师':       mk('攻城工程师', 6, G, 'siege'),
  '攻城技师':         mk('攻城技师', 0, G, 'siege', ABILITIES.MEDIC),
  '门诺·库霍恩':     mk('门诺·库霍恩', 10, G, 'melee', ABILITIES.HERO),
  '雷索·古勒塔':     mk('雷索·古勒塔', 10, G, 'melee', ABILITIES.HERO),
  '莫尔凡·符里斯':   mk('莫尔凡·符里斯', 10, G, 'siege', ABILITIES.HERO),
  '提伯':             mk('提伯', 10, G, 'melee', ABILITIES.HERO),
};

// ═══════════ 松鼠党 ═══════════
const S = 'scoiatael';
const sLeaders = [
  mkLdr('法兰茜丝卡:山谷雏菊', S, ABILITIES.HORN),
  mkLdr('法兰茜丝卡:纯血精灵', S, ABILITIES.CLEAR_WEATHER),
];
const s = {
  '玛哈坎守卫':       mk('玛哈坎守卫', 5, S, 'melee'),
  '矮人散兵':         mk('矮人散兵', 3, S, 'melee', ABILITIES.MUSTER),
  '哈维卡走私者':     mk('哈维卡走私者', 5, S, 'melee', ABILITIES.MUSTER),
  '巴克莱·艾尔斯':   mk('巴克莱·艾尔斯', 6, S, 'melee'),
  '丹尼斯·克兰默':   mk('丹尼斯·克兰默', 6, S, 'melee'),
  '精灵散兵':         mk('精灵散兵', 2, S, 'ranged', ABILITIES.MUSTER),
  '多尔布雷坦纳弓箭手': mk('多尔布雷坦纳弓箭手', 4, S, 'ranged'),
  '多尔布雷坦纳斥候': mk('多尔布雷坦纳斥候', 6, S, 'ranged'),
  '哈维卡治疗者':     mk('哈维卡治疗者', 0, S, 'ranged', ABILITIES.MEDIC),
  '维里赫德旅新兵':   mk('维里赫德旅新兵', 4, S, 'ranged'),
  '维里赫德旅老兵':   mk('维里赫德旅老兵', 5, S, 'melee'),
  '托鲁维尔':         mk('托鲁维尔', 2, S, 'ranged'),
  '里奥丹':           mk('里奥丹', 1, S, 'ranged'),
  '夏拉韦':           mk('夏拉韦', 3, S, 'ranged'),
  '菲拉凡德芮':       mk('菲拉凡德芮', 6, S, 'ranged'),
  '伊达·艾敏':       mk('伊达·艾敏', 6, S, 'ranged'),
  '亚伊文':           mk('亚伊文', 6, S, 'ranged'),
  '米尔瓦':           mk('米尔瓦', 10, S, 'ranged', ABILITIES.MORALE_BOOST),
  '席朗':             mk('席朗', 5, S, 'siege', ABILITIES.SCORCH),
  '伊森格林':         mk('伊森格林', 10, S, 'melee', ABILITIES.HERO),
  '艾思娜':           mk('艾思娜', 10, S, 'ranged', ABILITIES.HERO),
  '伊欧菲斯':         mk('伊欧菲斯', 10, S, 'ranged', ABILITIES.HERO),
  '萨琪亚':           mk('萨琪亚', 10, S, 'ranged', ABILITIES.HERO),
};

// ═══════════ 怪物 ═══════════
const M = 'monsters';
const mLeaders = [
  mkLdr('艾瑞汀:狂猎之王', M, ABILITIES.HORN),
  mkLdr('艾瑞汀:毁灭者', M, ABILITIES.CLEAR_WEATHER),
];
const m = {
  '食尸鬼':           mk('食尸鬼', 1, M, 'melee', ABILITIES.MUSTER),
  '水鬼':             mk('水鬼', 2, M, 'melee', ABILITIES.MUSTER),
  '阿拉克那':         mk('阿拉克那', 4, M, 'melee', ABILITIES.MUSTER),
  '阿拉克那巨兽':     mk('阿拉克那巨兽', 2, M, 'siege', ABILITIES.MUSTER),
  '吸血鬼:布露萨':    mk('吸血鬼:布露萨', 4, M, 'melee', ABILITIES.MUSTER),
  '吸血鬼:艾奇玛拉':  mk('吸血鬼:艾奇玛拉', 4, M, 'melee', ABILITIES.MUSTER),
  '吸血鬼:弗雷德尔':  mk('吸血鬼:弗雷德尔', 4, M, 'melee', ABILITIES.MUSTER),
  '吸血鬼:加尔坎':    mk('吸血鬼:加尔坎', 4, M, 'melee', ABILITIES.MUSTER),
  '吸血鬼:卡塔坎':    mk('吸血鬼:卡塔坎', 5, M, 'melee', ABILITIES.MUSTER),
  '老巫妪:煮婆':      mk('老巫妪:煮婆', 6, M, 'melee', ABILITIES.MUSTER),
  '老巫妪:织婆':      mk('老巫妪:织婆', 6, M, 'melee', ABILITIES.MUSTER),
  '老巫妪:呢喃婆':    mk('老巫妪:呢喃婆', 6, M, 'melee', ABILITIES.MUSTER),
  '安德莱格':         mk('安德莱格', 2, M, 'ranged'),
  '石化鸡蛇':         mk('石化鸡蛇', 2, M, 'ranged'),
  '翼手龙':           mk('翼手龙', 2, M, 'ranged'),
  '哈比':             mk('哈比', 2, M, 'ranged'),
  '人面妖鸟':         mk('人面妖鸟', 2, M, 'ranged'),
  '石像鬼':           mk('石像鬼', 2, M, 'ranged'),
  '叉尾龙':           mk('叉尾龙', 5, M, 'melee'),
  '狮鹫':             mk('狮鹫', 5, M, 'melee'),
  '恶灵':             mk('恶灵', 5, M, 'melee'),
  '小雾妖':           mk('小雾妖', 2, M, 'melee'),
  '瘟疫女妖':         mk('瘟疫女妖', 5, M, 'melee'),
  '狼人':             mk('狼人', 5, M, 'melee'),
  '巨魔':             mk('巨魔', 6, M, 'melee'),
  '墓穴女巫':         mk('墓穴女巫', 5, M, 'ranged'),
  '冰巨人':           mk('冰巨人', 5, M, 'siege'),
  '土元素':           mk('土元素', 6, M, 'siege'),
  '火元素':           mk('火元素', 6, M, 'siege'),
  '战灵':             mk('战灵', 10, M, 'melee', ABILITIES.HERO),
  '伊勒瑞斯':         mk('伊勒瑞斯', 10, M, 'melee', ABILITIES.HERO),
  '鹿首精':           mk('鹿首精', 10, M, 'ranged', ABILITIES.HERO),
  '凯尔兰':           mk('凯尔兰', 8, M, 'melee', ABILITIES.HERO),
  '蟾蜍':             mk('蟾蜍', 7, M, 'ranged', ABILITIES.SCORCH),
};

// ═══════════ 中立单位 ═══════════
const neu = {
  '杰洛特':           mk('杰洛特', 15, 'neutral', 'melee', ABILITIES.HERO),
  '希里':             mk('希里', 15, 'neutral', 'melee', ABILITIES.HERO),
  '叶奈法':           mk('叶奈法', 7, 'neutral', 'ranged', ABILITIES.HERO, ABILITIES.MEDIC),
  '特莉丝':           mk('特莉丝', 7, 'neutral', 'melee', ABILITIES.HERO),
  '神秘精灵':         mk('神秘精灵', 0, 'neutral', 'melee', ABILITIES.HERO, ABILITIES.SPY),
  '维瑟米尔':         mk('维瑟米尔', 6, 'neutral', 'melee'),
  '艾米尔·雷吉斯':   mk('艾米尔·雷吉斯', 5, 'neutral', 'melee'),
  '卓尔坦':           mk('卓尔坦', 5, 'neutral', 'melee'),
  '丹德里恩':         mk('丹德里恩', 2, 'neutral', 'melee', ABILITIES.HORN),
  '刚特·欧迪姆':      mk('刚特·欧迪姆', 2, 'neutral', 'melee', ABILITIES.MUSTER),
  '刚特·欧迪姆:黑暗': mk('刚特·欧迪姆:黑暗', 2, 'neutral', 'siege', ABILITIES.MUSTER),
  '欧吉尔德':         mk('欧吉尔德', 6, 'neutral', 'melee', ABILITIES.MORALE_BOOST),
  '奶牛':             mk('奶牛', 0, 'neutral', 'melee'),
  '维兰特雷坦梅斯':   mk('维兰特雷坦梅斯', 7, 'neutral', 'melee', ABILITIES.HERO, ABILITIES.SCORCH),
};

// ═══════════ 特殊牌 ═══════════
const sp = {
  '霜冻':         mkSp('霜冻', ABILITIES.WEATHER_FROST),
  '浓雾':         mkSp('浓雾', ABILITIES.WEATHER_FOG),
  '暴雨':         mkSp('暴雨', ABILITIES.WEATHER_RAIN),
  '晴天':         mkSp('晴天', ABILITIES.CLEAR_WEATHER),
  '烧灼':         mkSp('烧灼', ABILITIES.SCORCH),
  '指挥号角':     mkSp('指挥号角', ABILITIES.COMMANDERS_HORN),
  '诱饵':         mkSp('诱饵', ABILITIES.DECOY),
};

// ── 组装 ──
function add(coll) { Object.values(coll).forEach(c => allCards[c.id] = c); }
const allCards = {};
add(n); add(g); add(s); add(m); add(neu); add(sp);
nLeaders.forEach(c => allCards[c.id] = c);
gLeaders.forEach(c => allCards[c.id] = c);
sLeaders.forEach(c => allCards[c.id] = c);
mLeaders.forEach(c => allCards[c.id] = c);

// ═══════════ 预设卡组: 北方领域 ═══════════
const starterDeck = [
  n['蓝衣铁卫突击队'], n['蓝衣铁卫突击队'],
  n['可怜的步兵'], n['可怜的步兵'], n['可怜的步兵'],
  n['瑞达尼亚步兵团'], n['瑞达尼亚步兵团'],
  n['齐格弗里德'], n['维斯'], n['亚尔潘·齐格林'],
  n['巨龙猎人'], n['巨龙猎人'], n['巨龙猎人'],
  n['席儿·坦沙维耶'], n['凯拉·梅兹'], n['戴斯摩'],
  n['弩炮'], n['弩炮'],
  n['投石车'], n['投石车'],
  n['攻城塔'], n['凯登攻城专家'], n['邓巴医疗兵'],
  n['弗农·罗契'], n['菲利帕·艾哈特'],
  neu['杰洛特'],
  sp['霜冻'], sp['晴天'], sp['指挥号角'], sp['指挥号角'],
  sp['烧灼'], sp['诱饵'],
];
/** 根据阵营 key 获取默认领袖 */
function defaultLeader(factionKey) {
  const leaders = {
    northern: nLeaders,
    nilfgaard: gLeaders,
    scoiatael: sLeaders,
    monsters: mLeaders,
  };
  return (leaders[factionKey] || nLeaders)[0];
}

// 阵营信息（供前端卡组配置使用）
const factions = {
  northern: { name: '北方领域', leaders: nLeaders, units: n },
  nilfgaard: { name: '尼弗迦德', leaders: gLeaders, units: g },
  scoiatael: { name: '松鼠党', leaders: sLeaders, units: s },
  monsters: { name: '怪物', leaders: mLeaders, units: m },
};

// AI 预置卡组（简化版，各阵营通用）
// AI 精选卡组（每个阵营 ~30-32 张），模拟合理配卡
const aiDecks = {
  northern: [
    n['蓝衣铁卫突击队'], n['蓝衣铁卫突击队'], n['蓝衣铁卫突击队'],
    n['可怜的步兵'], n['可怜的步兵'], n['可怜的步兵'],
    n['巨龙猎人'], n['巨龙猎人'], n['巨龙猎人'],
    n['投石车'], n['投石车'],
    n['瑞达尼亚步兵团'], n['瑞达尼亚步兵团'],
    n['齐格弗里德'], n['亚尔潘·齐格林'], n['维斯'],
    n['席儿·坦沙维耶'], n['凯拉·梅兹'], n['戴斯摩'],
    n['弩炮'], n['弩炮'], n['攻城塔'],
    n['凯登攻城专家'], n['邓巴医疗兵'],
    n['迪科斯彻'],
    n['弗农·罗契'], n['菲利帕·艾哈特'],
    neu['杰洛特'],
    sp['霜冻'], sp['晴天'], sp['指挥号角'], sp['指挥号角'], sp['烧灼'], sp['诱饵'],
  ],
  nilfgaard: [
    g['帝国旅卫'], g['帝国旅卫'], g['帝国旅卫'],
    g['那乌西卡骑兵'], g['那乌西卡骑兵'], g['那乌西卡骑兵'],
    g['年轻使者'], g['年轻使者'], g['年轻使者'],
    g['雷恩法'], g['弗林姆德'], g['莫泰森'], g['卡西尔'],
    g['黑步兵弓手'],
    g['艾托利安辅助弓手'],
    g['普特卡摩'], g['辛西亚'], g['范厄玛'],
    g['弗林吉拉·维果'], g['亚伯力奇'], g['斯维尔'],
    g['泽瑞坎火蝎'], g['攻城工程师'],
    g['瓦提尔(间谍)'], g['史蒂芬·史凯伦'],
    g['门诺·库霍恩'], g['提伯'],
    neu['杰洛特'],
    sp['霜冻'], sp['晴天'], sp['指挥号角'], sp['指挥号角'], sp['烧灼'], sp['诱饵'],
  ],
  scoiatael: [
    s['多尔布雷坦纳弓箭手'], s['多尔布雷坦纳弓箭手'], s['多尔布雷坦纳弓箭手'],
    s['矮人散兵'], s['矮人散兵'], s['矮人散兵'],
    s['维里赫德旅新兵'], s['维里赫德旅新兵'],
    s['维里赫德旅老兵'], s['维里赫德旅老兵'],
    s['玛哈坎守卫'], s['玛哈坎守卫'],
    s['巴克莱·艾尔斯'], s['丹尼斯·克兰默'],
    s['多尔布雷坦纳斥候'], s['多尔布雷坦纳斥候'],
    s['哈维卡治疗者'],
    s['托鲁维尔'], s['里奥丹'], s['夏拉韦'],
    s['菲拉凡德芮'], s['伊达·艾敏'], s['亚伊文'],
    s['米尔瓦'], s['席朗'],
    s['伊森格林'], s['伊欧菲斯'],
    neu['杰洛特'],
    sp['霜冻'], sp['晴天'], sp['指挥号角'], sp['指挥号角'], sp['烧灼'], sp['诱饵'],
  ],
  monsters: [
    m['食尸鬼'], m['食尸鬼'], m['食尸鬼'],
    m['水鬼'], m['水鬼'], m['水鬼'],
    m['安德莱格'], m['安德莱格'], m['安德莱格'],
    m['翼手龙'], m['翼手龙'],
    m['石化鸡蛇'], m['石化鸡蛇'],
    m['人面妖鸟'], m['人面妖鸟'],
    m['小雾妖'], m['小雾妖'],
    m['瘟疫女妖'], m['狼人'], m['巨魔'],
    m['墓穴女巫'], m['冰巨人'],
    m['叉尾龙'], m['狮鹫'], m['恶灵'],
    m['土元素'], m['火元素'],
    m['战灵'], m['伊勒瑞斯'], m['鹿首精'],
    neu['杰洛特'],
    sp['霜冻'], sp['浓雾'], sp['暴雨'], sp['晴天'], sp['指挥号角'], sp['烧灼'], sp['诱饵'],
  ],
};

function aiDefaultDeck(factionKey) {
  return aiDecks[factionKey] || aiDecks['northern'];
}

module.exports = { Card, ABILITIES, RARITY, allCards, sp, neu, n, nLeaders, g, gLeaders, s, sLeaders, m, mLeaders,
  factions, starterDeck, defaultLeader, aiDefaultDeck };