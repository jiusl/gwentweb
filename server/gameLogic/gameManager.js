const GameState = require('./gameState');
const { starterDeck, aiDefaultDeck, ABILITIES } = require('./cards');
const dbUtils = require('../db/dbUtils');
const { TrainingRecorder } = require('./trainingRecorder');

class GameManager {
  /**
   * @param {object} options
   * @param {boolean} options.enableTrainingRecorder - 是否启用训练数据录制（默认 true）
   */
  constructor(options = {}) {
    this.activeGames = new Map();
    this.trainingRecorder = options.enableTrainingRecorder !== false
      ? new TrainingRecorder()
      : { recordSnapshot() {}, onGameEnd() {}, collectEntries() { return []; }, snapshotCount() { return 0; } };
  }

  // 创建新游戏（支持自定义卡组 + 领袖）
  createGame(player1Id, player2Id, deck1 = null, deck2 = null, leader1 = null, leader2 = null) {
    const game = new GameState(player1Id, player2Id);

    // 玩家1卡组
    game.players[player1Id].deck = this.copyDeck(deck1 || starterDeck);
    game.players[player1Id].leader = leader1 || null;
    // 玩家2卡组（AI 用 faction 参数自动选择阵营）
    if (deck2) {
      game.players[player2Id].deck = this.copyDeck(deck2);
      game.players[player2Id].leader = leader2 || null;
    } else if (leader2) {
      // leader2 为 string 类型时 = 阵营 key，AI 据此自动选卡组+领袖
      const factionKey = leader2;
      game.players[player2Id].deck = this.copyDeck(aiDefaultDeck(factionKey));
      const { defaultLeader } = require('./cards');
      game.players[player2Id].leader = defaultLeader(factionKey);
    } else {
      // 完全未指定时回退到北方领域
      game.players[player2Id].deck = this.copyDeck(aiDefaultDeck('northern'));
      const { defaultLeader } = require('./cards');
      game.players[player2Id].leader = defaultLeader('northern');
    }

    this.shuffleAndDraw(game.players[player1Id]);
    this.shuffleAndDraw(game.players[player2Id]);
    game.activePlayer = Math.random() > 0.5 ? player1Id : player2Id;
    game.status = 'playing';
    this.activeGames.set(game.gameId, game);
    return game;
  }

  copyDeck(deck) {
    return deck.map(card => ({ ...card }));
  }

  shuffleAndDraw(player) {
    // 简单的洗牌（Fisher-Yates）
    const deck = player.deck;
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    // 抽10张手牌
    player.hand = deck.splice(0, 10);
  }

  // 获取对手ID
  getOpponentId(gameId, playerId) {
    const game = this.activeGames.get(gameId);
    if (!game) return null;
    return game.getOpponentId(playerId);
  }

  // 出牌：从手牌打出一张卡到指定排。targetCardId 用于 Decoy/Medic 选择目标（可选）
  playCard(gameId, playerId, cardIndex, row, targetCardId = null) {
    const game = this.activeGames.get(gameId);
    if (!game) return { success: false, error: '游戏不存在' };
    if (game.status !== 'playing') return { success: false, error: '游戏未在进行中' };
    if (game.activePlayer !== playerId) return { success: false, error: '不是你的回合' };

    const player = game.players[playerId];
    if (player.passed) return { success: false, error: '你已经放弃跟牌' };
    if (cardIndex < 0 || cardIndex >= player.hand.length) {
      return { success: false, error: '无效的卡牌索引' };
    }

    const card = player.hand[cardIndex];
    const opponentId = game.getOpponentId(playerId);
    const opponent = game.players[opponentId];
    let events = []; // 记录技能触发事件，返回给前端展示

    // ── 训练数据录制：记录出牌前快照 ──
    this.trainingRecorder.recordSnapshot(game, playerId, card, row, targetCardId);

    // ═══════════ 特殊牌处理 ═══════════
    if (card.type === 'special') {
      player.hand.splice(cardIndex, 1);
      player.graveyard.push(card);

      switch (card.ability) {
        case ABILITIES.WEATHER_FROST:
          game.weather.melee = 'frost';
          events.push({ type: 'weather', row: 'melee', weather: 'frost' });
          break;
        case ABILITIES.WEATHER_FOG:
          game.weather.ranged = 'fog';
          events.push({ type: 'weather', row: 'ranged', weather: 'fog' });
          break;
        case ABILITIES.WEATHER_RAIN:
          game.weather.siege = 'rain';
          events.push({ type: 'weather', row: 'siege', weather: 'rain' });
          break;
        case ABILITIES.CLEAR_WEATHER:
          game.weather = { melee: null, ranged: null, siege: null };
          events.push({ type: 'clearWeather' });
          break;
        case ABILITIES.SCORCH:
          events.push({ type: 'scorch', destroyed: game.applyScorch().map(c => c.name) });
          break;
        case ABILITIES.COMMANDERS_HORN:
          if (['melee', 'ranged', 'siege'].includes(row)) {
            game.horn[playerId][row] = true;
            events.push({ type: 'horn', player: playerId, row });
          }
          break;
        case ABILITIES.DECOY:
          // 从己方战场收回一张单位牌
          if (targetCardId) {
            const returned = this._removeFromBattlefield(game, playerId, targetCardId);
            if (returned) {
              player.hand.push(returned);
              events.push({ type: 'decoy', card: returned.name });
            }
          }
          break;
        default:
          break;
      }

      game.updateScores();
      game.switchActivePlayer();
      if (game.isRoundOver()) this.endRound(game);
      return { success: true, gameState: this.getClientGameState(gameId, playerId), events };
    }

    // ═══════════ 单位牌处理 ═══════════
    const validRows = ['melee', 'ranged', 'siege'];
    if (!validRows.includes(row)) return { success: false, error: '无效的排类型' };

    if (card.row && card.row !== row) {
      // 敏捷卡牌可放在 agileRows 指定的任意排
      if (card.isAgile && card.agileRows && card.agileRows.includes(row)) {
        // 允许放置
      } else {
        const rowNames = { melee: '近战', ranged: '远程', siege: '攻城' };
        return { success: false, error: `「${card.name}」只能放在${rowNames[card.row]}排` };
      }
    }

    // 从手牌移除
    player.hand.splice(cardIndex, 1);

    // ── 间谍：放到对方场上，己方抽2张 ──
    if (card.isSpy) {
      const spyRow = card.isAgile ? row : (card.row || row);
      opponent[spyRow].push(card);
      events.push({ type: 'spy', card: card.name, target: opponentId });

      const draw = Math.min(2, player.deck.length);
      if (draw > 0) {
        const drawn = player.deck.splice(0, draw);
        player.hand.push(...drawn);
        events.push({ type: 'draw', count: draw });
      }
    }
    // ── 召集：从手牌+牌组拉出所有同名卡 ──
    else if (card.isMuster) {
      player[row].push(card);
      const mustered = [card.name];

      // 从手牌拉
      const handMatches = player.hand.filter(c => c.name === card.name);
      for (const mc of handMatches) {
        const idx = player.hand.indexOf(mc);
        player.hand.splice(idx, 1);
        player[row].push(mc);
        mustered.push(mc.name);
      }
      // 从牌组拉
      const deckMatches = player.deck.filter(c => c.name === card.name);
      for (const mc of deckMatches) {
        const idx = player.deck.indexOf(mc);
        player.deck.splice(idx, 1);
        player[row].push(mc);
        mustered.push(mc.name);
      }
      events.push({ type: 'muster', cards: mustered });
    }
    // ── 医生：从己方墓地复活一张非英雄单位 ──
    else if (card.isMedic) {
      player[row].push(card);
      const reviveTargets = player.graveyard.filter(c => c.type === 'unit' && !c.isHero);
      if (reviveTargets.length > 0) {
        // 优先复活指定目标，否则选战力最高的
        let toRevive;
        if (targetCardId) {
          toRevive = reviveTargets.find(c => c.id === targetCardId);
        }
        if (!toRevive) {
          reviveTargets.sort((a, b) => b.power - a.power);
          toRevive = reviveTargets[0];
        }
        const gIdx = player.graveyard.indexOf(toRevive);
        player.graveyard.splice(gIdx, 1);
        // 敏捷卡牌复活到其敏捷排位之一（优先近战），普通卡复活到原排位
        const reviveRow = toRevive.row || (toRevive.agileRows ? toRevive.agileRows[0] : 'melee');
        player[reviveRow].push(toRevive);
        events.push({ type: 'medic', revived: toRevive.name });
      }
    }
    // ── 普通单位（含英雄、TightBond、MoraleBoost）──
    else {
      player[row].push(card);
    }

    // ── 打出后触发 Scorch（某些单位自带烧灼效果，含英雄副技能）──
    if (card.ability === ABILITIES.SCORCH || card.ability === ABILITIES.SCORCH_MELEE ||
        card.ability === ABILITIES.SCORCH_SIEGE || card.heroAbility === ABILITIES.SCORCH) {
      const destroyed = game.applyScorch();
      if (destroyed.length > 0) {
        events.push({ type: 'scorch', destroyed: destroyed.map(c => c.name) });
      }
    }

    // ── 打出后触发号角（丹德里恩 / 英雄副技能）──
    if (card.ability === ABILITIES.HORN || card.heroAbility === ABILITIES.HORN) {
      const hornRow = card.isAgile ? row : (card.row || 'melee');
      game.horn[playerId][hornRow] = true;
      events.push({ type: 'horn', player: playerId, row: hornRow });
    }

    game.updateScores();
    game.switchActivePlayer();
    if (game.isRoundOver()) this.endRound(game);
    return { success: true, gameState: this.getClientGameState(gameId, playerId), events };
  }

  // 从战场移除指定卡牌（用于 Decoy），返回被移除的卡牌或 null
  _removeFromBattlefield(game, playerId, cardId) {
    const player = game.players[playerId];
    for (const row of ['melee', 'ranged', 'siege']) {
      const idx = player[row].findIndex(c => c.id === cardId);
      if (idx >= 0) {
        return player[row].splice(idx, 1)[0];
      }
    }
    return null;
  }

  // 使用领袖技能
  useLeaderAbility(gameId, playerId, row = null) {
    const game = this.activeGames.get(gameId);
    if (!game) return { success: false, error: '游戏不存在' };
    if (game.status !== 'playing') return { success: false, error: '游戏未在进行中' };
    if (game.activePlayer !== playerId) return { success: false, error: '不是你的回合' };

    const player = game.players[playerId];
    if (!player.leader) return { success: false, error: '没有领袖牌' };
    if (player.leaderUsed) return { success: false, error: '领袖技能已使用过' };
    if (player.passed) return { success: false, error: '你已经放弃跟牌' };

    const ability = player.leader.ability;
    const events = [];

    switch (ability) {
      case ABILITIES.HORN:
        if (row && ['melee', 'ranged', 'siege'].includes(row)) {
          game.horn[playerId][row] = true;
          events.push({ type: 'horn', player: playerId, row });
        } else {
          return { success: false, error: '请选择一个排位' };
        }
        break;
      case ABILITIES.CLEAR_WEATHER:
        game.weather = { melee: null, ranged: null, siege: null };
        events.push({ type: 'clearWeather' });
        break;
      default:
        return { success: false, error: '未支持的领袖技能' };
    }

    player.leaderUsed = true;
    game.updateScores();
    // 使用领袖技能也算一次行动，切换回合
    game.switchActivePlayer();
    if (game.isRoundOver()) this.endRound(game);

    return { success: true, gameState: this.getClientGameState(gameId, playerId), events };
  }

  // 放弃跟牌
  passTurn(gameId, playerId) {
    const game = this.activeGames.get(gameId);
    if (!game) return { success: false, error: '游戏不存在' };
    if (game.status !== 'playing') return { success: false, error: '游戏未在进行中' };
    if (game.activePlayer !== playerId) return { success: false, error: '不是你的回合' };

    const player = game.players[playerId];
    if (player.passed) return { success: false, error: '你已经放弃跟牌' };

    player.passed = true;

    // 切换回合
    game.switchActivePlayer();

    // 自动检查小局是否结束
    if (game.isRoundOver()) {
      this.endRound(game);
    }

    return { success: true, gameState: this.getClientGameState(gameId, playerId) };
  }

  // 内部小局结算（playCard / passTurn 自动触发）
  endRound(game) {
    // 防止重复结算
    if (game.status === 'roundEnd' || game.status === 'gameEnd') return;
    if (!game.isRoundOver()) return;

    game.updateScores();
    const roundWinner = game.getRoundWinner();
    game.roundWinner = roundWinner;

    // 记录胜场（平局则双方都不加分）
    if (roundWinner) {
      game.players[roundWinner].roundsWon += 1;
    }

    console.log(
      `🏁 第 ${game.currentRound} 小局结束 | ` +
      `胜者: ${roundWinner ? game.players[roundWinner].id : '平局'} | ` +
      `比分: ${Object.values(game.players).map(p => p.roundsWon).join(' - ')}`
    );

    // 检查整局是否结束（有人先赢2局，或打完3局）
    const gameWinner = this._findGameWinner(game);

    if (gameWinner) {
      game.gameWinner = gameWinner;
      game.status = 'gameEnd';

      // 💾 异步将对局结果写入数据库（不阻塞游戏循环）
      this._saveMatchToDB(game).catch(err => {
        console.error('保存对局记录失败:', err.message);
      });

      // 📝 训练数据录制：胜方出牌写入 training_data.json
      try {
        this.trainingRecorder.onGameEnd(game);
      } catch (err) {
        console.error('录制训练数据失败:', err.message);
      }
    } else {
      game.status = 'roundEnd';
    }
  }

  // 开始下一小局
  startNextRound(gameId) {
    const game = this.activeGames.get(gameId);
    if (!game) return { success: false, error: '游戏不存在' };
    if (game.status !== 'roundEnd') return { success: false, error: '当前不是小局结束状态' };

    game.resetForNextRound();

    // 检查是否无牌可打（双方手牌+牌组都为空）
    const players = Object.values(game.players);
    const noCardsLeft = players.every(p => p.hand.length === 0 && p.deck.length === 0);

    if (noCardsLeft) {
      // 没有卡牌了，根据当前胜场判断最终赢家
      game.gameWinner = this._findGameWinner(game);
      if (!game.gameWinner) {
        // 真正平局：比较总小局胜场，仍平局则 null
        game.gameWinner = null;
      }
      game.status = 'gameEnd';

      // 💾 保存对局记录 + 训练数据
      this._saveMatchToDB(game).catch(err => {
        console.error('保存对局记录失败:', err.message);
      });
      try {
        this.trainingRecorder.onGameEnd(game);
      } catch (err) {
        console.error('录制训练数据失败:', err.message);
      }

      return { success: true, gameEnded: true, gameWinner: game.gameWinner };
    }

    // 设置新的先手（小局败者先手，平局则轮流）
    if (game.roundWinner) {
      game.activePlayer = game.getOpponentId(game.roundWinner);
    } else {
      // 平局：轮换先手
      game.activePlayer = game.getOpponentId(game.activePlayer);
    }

    game.status = 'playing';
    game.roundWinner = null;
    return { success: true, gameEnded: false };
  }

  // 将对局结果持久化到数据库
  async _saveMatchToDB(game) {
    const playerIds = Object.keys(game.players);
    const isAIGame = playerIds.some(pid => pid.startsWith('ai_'));

    if (isAIGame) {
      // 人机对战：单个真人玩家 + AI
      const humanPlayerId = playerIds.find(pid => !pid.startsWith('ai_'));
      const aiPlayerId = playerIds.find(pid => pid.startsWith('ai_'));

      const humanP = game.players[humanPlayerId];
      const aiP = aiPlayerId ? game.players[aiPlayerId] : null;

      const humanWon = game.gameWinner === humanPlayerId;

      const humanName = game.humanName || 'anonymous';
      const dbUser = dbUtils.findOrCreateUser(humanName);
      const humanDbId = dbUser ? dbUser.id : 1;

      await dbUtils.saveMatch({
        matchUuid: game.gameId,
        player1Id: humanDbId,
        player2Id: null,
        winnerId: humanWon ? humanDbId : null,
        player1Score: humanP ? humanP.roundsWon : 0,
        player2Score: aiP ? aiP.roundsWon : 0,
        roundsPlayed: game.currentRound,
        matchType: 'vs_ai',
      });

      console.log(`💾 对局 ${game.gameId} 已保存 (vs_ai, 用户: ${humanName})`);
    } else {
      // PvP：两个真人玩家
      const [p1Id, p2Id] = playerIds;
      const p1 = game.players[p1Id];
      const p2 = game.players[p2Id];

      const p1Name = game.humanName || 'player1';
      const p2Name = game.humanName2 || 'player2';
      const dbUser1 = dbUtils.findOrCreateUser(p1Name);
      const dbUser2 = dbUtils.findOrCreateUser(p2Name);
      const dbId1 = dbUser1 ? dbUser1.id : 1;
      const dbId2 = dbUser2 ? dbUser2.id : 2;

      let winnerDbId = null;
      if (game.gameWinner === p1Id) winnerDbId = dbId1;
      else if (game.gameWinner === p2Id) winnerDbId = dbId2;

      await dbUtils.saveMatch({
        matchUuid: game.gameId,
        player1Id: dbId1,
        player2Id: dbId2,
        winnerId: winnerDbId,
        player1Score: p1.roundsWon,
        player2Score: p2.roundsWon,
        roundsPlayed: game.currentRound,
        matchType: 'casual',
      });

      console.log(`💾 对局 ${game.gameId} 已保存 (casual, ${p1Name} vs ${p2Name})`);
    }
  }

  // 小局结算（对外 API，可手动调用）
  handleRoundEnd(gameId) {
    const game = this.activeGames.get(gameId);
    if (!game) return { success: false, error: '游戏不存在' };
    if (!game.isRoundOver()) return { success: false, error: '小局尚未结束' };

    // 还未结算过则执行结算
    if (game.status === 'playing') {
      this.endRound(game);
    }

    return {
      success: true,
      roundWinner: game.roundWinner,
      gameWinner: game.gameWinner,
      status: game.status,
    };
  }

  // 内部查找整局胜者（不修改状态）
  _findGameWinner(game) {
    const playerIds = Object.keys(game.players);
    for (const pid of playerIds) {
      if (game.players[pid].roundsWon >= 2) {
        return pid;
      }
    }

    // 已打完3局但仍无人达到2胜（例如平局导致），以胜场多者为准
    if (game.currentRound >= 3) {
      const [p1, p2] = playerIds;
      if (game.players[p1].roundsWon > game.players[p2].roundsWon) return p1;
      if (game.players[p2].roundsWon > game.players[p1].roundsWon) return p2;
      // 完全平局 → 比较总分
      game.updateScores();
      if (game.players[p1].score > game.players[p2].score) return p1;
      if (game.players[p2].score > game.players[p1].score) return p2;
      return null; // 真正平局
    }

    return null;
  }

  // 检查整局游戏胜者（3局2胜，对外 API）
  checkGameWinner(gameId) {
    const game = this.activeGames.get(gameId);
    if (!game) return null;

    const winner = this._findGameWinner(game);
    if (winner) {
      game.gameWinner = winner;
      game.status = 'gameEnd';
    }
    return winner;
  }

  // 获取游戏状态（用于发送给客户端）
  getClientGameState(gameId, playerId) {
    const game = this.activeGames.get(gameId);
    if (!game) return null;

    const opponentId = game.getOpponentId(playerId);
    const me = game.players[playerId];
    const op = game.players[opponentId];

    return {
      gameId: game.gameId,
      currentRound: game.currentRound,
      activePlayer: game.activePlayer,
      status: game.status,
      gameWinner: game.gameWinner,
      weather: game.weather,
      horn: { mine: game.horn[playerId], opponent: game.horn[opponentId] },
      myself: {
        id: me.id,
        hand: me.hand,
        melee: me.melee,
        ranged: me.ranged,
        siege: me.siege,
        graveyard: me.graveyard,
        score: me.score,
        passed: me.passed,
        roundsWon: me.roundsWon,
        handCount: me.hand.length,
        deckCount: me.deck.length,
        leader: me.leader,
        leaderUsed: me.leaderUsed,
      },
      opponent: {
        id: op.id,
        faction: op.leader?.faction || null,
        melee: op.melee,
        ranged: op.ranged,
        siege: op.siege,
        graveyard: op.graveyard,
        score: op.score,
        passed: op.passed,
        roundsWon: op.roundsWon,
        handCount: op.hand.length,
        deckCount: op.deck.length,
        leader: op.leader,
        leaderUsed: op.leaderUsed,
      },
    };
  }
}

module.exports = GameManager;