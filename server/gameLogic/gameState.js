const { ABILITIES } = require('./cards');

class GameState {
  constructor(player1Id, player2Id) {
    this.gameId = `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const mk = (id) => ({
      id, deck: [], hand: [], graveyard: [],
      melee: [], ranged: [], siege: [],
      leader: null, leaderUsed: false,
      score: 0, passed: false, roundsWon: 0,
    });
    this.players = { [player1Id]: mk(player1Id), [player2Id]: mk(player2Id) };
    // 全局天气: { melee, ranged, siege } -> 'frost'|'fog'|'rain'|null
    this.weather = { melee: null, ranged: null, siege: null };
    // 号角: this.horn[playerId][row] = true/false
    this.horn = {};
    for (const pid of [player1Id, player2Id]) {
      this.horn[pid] = { melee: false, ranged: false, siege: false };
    }
    this.currentRound = 1;
    this.activePlayer = null;
    this.roundWinner = null;
    this.gameWinner = null;
    this.status = 'waiting';
  }

  // ── 单卡有效战力（含 TightBond / 天气） ──
  _cardPower(card, row, rowCards) {
    if (card.isHero) return card.power;
    if (this.weather[row]) return 1;
    let p = card.power;
    if (card.ability === ABILITIES.TIGHT_BOND || card.heroAbility === ABILITIES.TIGHT_BOND) {
      const cnt = rowCards.filter(c => c.name === card.name && !c.isHero).length;
      if (cnt >= 2) p = Math.floor(p * 2);
    }
    return p;
  }

  // ── 一排总战力 ──
  _rowScore(playerId, row) {
    const cards = this.players[playerId][row];
    if (cards.length === 0) return 0;
    const heroSum = cards.filter(c => c.isHero).reduce((s, c) => s + c.power, 0);
    const regSum = cards.filter(c => !c.isHero).reduce((s, c) => s + this._cardPower(c, row, cards), 0);
    const morale = cards.some(c => c.ability === ABILITIES.MORALE_BOOST || c.heroAbility === ABILITIES.MORALE_BOOST);
    let total = heroSum + regSum + (morale ? cards.filter(c => !c.isHero).length : 0);
    if (this.horn[playerId][row]) {
      const regDoubled = regSum * 2 + (morale ? cards.filter(c => !c.isHero).length * 2 : 0);
      total = heroSum + regDoubled;
    }
    return total;
  }

  calculateScore(playerId) {
    return ['melee', 'ranged', 'siege'].reduce((s, r) => s + this._rowScore(playerId, r), 0);
  }

  updateScores() {
    for (const pid of Object.keys(this.players))
      this.players[pid].score = this.calculateScore(pid);
  }

  getBattlefieldUnits(playerId) {
    const p = this.players[playerId];
    return [...p.melee, ...p.ranged, ...p.siege];
  }

  isRoundOver() {
    const arr = Object.values(this.players);
    return arr.every(p => p.passed) || arr.every(p => p.hand.length === 0);
  }

  getRoundWinner() {
    const [a, b] = Object.values(this.players);
    if (a.score > b.score) return a.id;
    if (b.score > a.score) return b.id;
    return null;
  }

  getOpponentId(pid) {
    return Object.keys(this.players).find(p => p !== pid) || null;
  }

  switchActivePlayer() {
    const ids = Object.keys(this.players);
    const other = ids.find(p => p !== this.activePlayer);
    // 如果对方已 pass，不切换（让当前玩家连续行动）
    if (other && !this.players[other].passed) {
      this.activePlayer = other;
    }
  }

  resetForNextRound() {
    for (const p of Object.values(this.players)) {
      for (const r of ['melee', 'ranged', 'siege']) {
        p.graveyard.push(...p[r]);
        p[r] = [];
      }
      p.passed = false;
      if (p.deck.length > 0 && p.hand.length < 10) {
        const n = Math.min(2, p.deck.length, 10 - p.hand.length);
        p.hand.push(...p.deck.splice(0, n));
      }
    }
    this.weather = { melee: null, ranged: null, siege: null };
    for (const pid of Object.keys(this.players))
      this.horn[pid] = { melee: false, ranged: false, siege: false };
    this.currentRound++;
    this.updateScores();
  }

  // Scorch: 摧毁所有最强非英雄单位
  applyScorch() {
    const units = [];
    for (const pid of Object.keys(this.players)) {
      for (const row of ['melee', 'ranged', 'siege']) {
        for (const card of this.players[pid][row]) {
          if (!card.isHero) units.push({ pid, row, card, pow: this._cardPower(card, row, this.players[pid][row]) });
        }
      }
    }
    if (!units.length) return [];
    units.sort((a, b) => b.pow - a.pow);
    const max = units[0].pow;
    const dead = [];
    for (const u of units.filter(x => x.pow === max)) {
      const arr = this.players[u.pid][u.row];
      const idx = arr.indexOf(u.card);
      if (idx >= 0) { arr.splice(idx, 1); this.players[u.pid].graveyard.push(u.card); dead.push(u.card); }
    }
    this.updateScores();
    return dead;
  }
}

module.exports = GameState;