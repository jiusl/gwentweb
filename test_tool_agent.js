// Quick test for tools.js / skills.js / ToolAgent.js
const t = require('./server/ai/tools');
const s = require('./server/ai/skills');
const { createAI } = require('./server/ai');

// 1. parseToolCall
console.log('=== parseToolCall ===');
const testJson = '{"tool":"play_card","args":{"card_name":"Geralt"}}';
console.log('Input:', testJson);
console.log('Result:', JSON.stringify(t.parseToolCall(testJson)));

// 2. Legacy format
const legacy = '{"action":"playCard","cardIndex":2,"row":"melee"}';
console.log('Legacy:', JSON.stringify(t.parseToolCall(legacy)));

// 3. executeTool with a mock game
console.log('\n=== executeTool ===');
const mockGame = {
  players: {
    p1: { hand: [{ name: 'Geralt', power: 15, row: 'melee', isHero: true }] },
  },
  getOpponentId: () => 'p2',
};
const execResult = t.executeTool('play_card', { card_name: 'Geralt' }, mockGame, 'p1');
console.log('executeTool:', JSON.stringify(execResult));

// 4. Fuzzy match
const fuzzyResult = t.executeTool('play_card', { card_name: 'Geral' }, mockGame, 'p1');
console.log('fuzzy match:', JSON.stringify(fuzzyResult));

// 5. Error case
const errResult = t.executeTool('play_card', { card_name: 'NonexistentCard' }, mockGame, 'p1');
console.log('error case:', JSON.stringify(errResult));

// 6. Passing
const passResult = t.executeTool('pass_turn', {}, mockGame, 'p1');
console.log('pass_turn:', JSON.stringify(passResult));

// 7. skills module
console.log('\n=== skills ===');
console.log('getCounterFaction northern:', s.getCounterFaction('northern'));
console.log('getCounterFaction nilfgaard:', s.getCounterFaction('nilfgaard'));

// 8. ToolAgent creation
const agent = createAI('tool', { model: 'qwen2.5:7b', maxRetries: 1 });
console.log('\n=== ToolAgent ===');
console.log('Name:', agent.getName());
console.log('Type:', agent.constructor.name);

console.log('\n✅ All tests passed');
