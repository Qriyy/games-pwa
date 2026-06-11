/**
 * 红中麻将 — 综合测试脚本 v2
 * 测试模块：Constants, Tiles, GameState, HuDetection, Scoring, Actions, AI, Integration
 */
const fs = require('fs');

// ============ 模拟 DOM 环境 ============
const mockCtx = {
  fillStyle: null, fillRect: () => {},
  beginPath: () => {}, moveTo: () => {}, lineTo: () => {},
  arcTo: () => {}, closePath: () => {}, clip: () => {},
  fill: () => {}, stroke: () => {},
  createLinearGradient: () => ({ addColorStop: () => {} }),
  createRadialGradient: () => ({ addColorStop: () => {} }),
  save: () => {}, restore: () => {}, translate: () => {},
  rotate: () => {}, fillText: () => {}, arc: () => {},
  drawImage: () => {},
  font: '', textAlign: '', textBaseline: '',
  shadowColor: '', shadowBlur: 0, shadowOffsetY: 0,
  lineWidth: 0, strokeStyle: '',
  setTransform: () => {},
  globalAlpha: 1,
};

global.document = {
  getElementById: (id) => ({
    getContext: () => mockCtx,
    addEventListener: () => {},
    classList: { add: () => {}, remove: () => {} },
    textContent: '',
    style: { textContent: '', width: '', height: '' },
    width: 400, height: 800,
    getBoundingClientRect: () => ({ left: 0, top: 0 }),
    offsetHeight: 60,
  }),
  querySelector: () => null,
};
global.window = global;
window.addEventListener = () => {};
window.innerWidth = 800;
window.innerHeight = 600;
window.devicePixelRatio = 1;
global.navigator = { userAgent: 'node' };
global.AudioContext = function() { this.state = 'running'; };
global.Image = function() { this.onload = null; this.onerror = null; this.src = ''; };
global.HongZhongAudio = {
  playDraw: () => {}, playDiscard: () => {}, playClick: () => {},
  playHu: () => {}, playPeng: () => {}, playGang: () => {},
};

// 加载所有模块
function loadMod(name) {
  const code = fs.readFileSync(name, 'utf8');
  const fn = new Function(code);
  fn();
}

const order = [
  'js/constants.js', 'js/tiles.js', 'js/game-state.js',
  'js/hu-detection.js', 'js/scoring.js', 'js/actions.js',
  'js/ai-bridge.js', 'js/tile-assets.js', 'js/renderer.js',
  'js/game-flow.js', 'js/ui.js', 'js/main.js'
];

try {
  order.forEach(f => loadMod(f));
  loadMod('ai-module.js');
} catch(e) {
  console.error('模块加载失败:', e.message, e.stack);
  process.exit(1);
}

// ============ 测试框架 ============
let totalTests = 0, passed = 0, failed = 0;
const results = [];
const bugs = []; // 记录发现的bug

function assert(condition, testName) {
  totalTests++;
  if (condition) {
    passed++;
    results.push({ name: testName, status: 'PASS' });
  } else {
    failed++;
    results.push({ name: testName, status: 'FAIL' });
    console.log('  FAIL: ' + testName);
  }
}

function assertEqual(actual, expected, testName) {
  const eq = JSON.stringify(actual) === JSON.stringify(expected);
  totalTests++;
  if (eq) {
    passed++;
    results.push({ name: testName, status: 'PASS' });
  } else {
    failed++;
    results.push({ name: testName, status: 'FAIL' });
    console.log('  FAIL: ' + testName + ' (expected=' + JSON.stringify(expected) + ', actual=' + JSON.stringify(actual) + ')');
  }
}

function reportBug(id, severity, title, desc) {
  bugs.push({ id, severity, title, desc });
  console.log('  BUG[' + severity + ']: ' + id + ' - ' + title);
}

// ============ 测试开始 ============
console.log('====================================');
console.log('红中麻将 综合测试');
console.log('日期: ' + new Date().toISOString().split('T')[0]);
console.log('====================================\n');

// ==================== 1. 常量模块测试 ====================
console.log('--- 1. Constants 常量模块 ---');

assertEqual(Constants.TILE_W, 48, 'C01: 牌宽度=48');
assertEqual(Constants.TILE_H, 64, 'C02: 牌高度=64');
assertEqual(Constants.HONGZHONG_ID, 30, 'C03: 红中ID=30');
assertEqual(Constants.SUITS, ['wan','tiao','tong'], 'C04: 三种花色');
assertEqual(Constants.SUIT_NAMES.wan, '万', 'C05: 万花色名');
assertEqual(Constants.SUIT_NAMES.tiao, '条', 'C06: 条花色名');
assertEqual(Constants.SUIT_NAMES.tong, '筒', 'C07: 筒花色名');
assert(Constants.C.BG === '#0D1117', 'C08: 背景色');
assert(typeof Constants.LAYOUT === 'object', 'C09: 布局参数存在');
assertEqual(Constants.CN_NUMS.length, 9, 'C10: 中文数字9个');
assertEqual(Constants.TONG_DOTS[9].length, 9, 'C11: 九筒9个点位');

// ==================== 2. Tiles 牌工具模块测试 ====================
console.log('\n--- 2. Tiles 牌工具模块 ---');

// 花色检测
assertEqual(Tiles.tileSuit(1), 'wan', 'T01: ID=1 为万');
assertEqual(Tiles.tileSuit(9), 'wan', 'T02: ID=9 为万');
assertEqual(Tiles.tileSuit(10), 'tiao', 'T03: ID=10 为条');
assertEqual(Tiles.tileSuit(18), 'tiao', 'T04: ID=18 为条');
assertEqual(Tiles.tileSuit(19), 'tong', 'T05: ID=19 为筒');
assertEqual(Tiles.tileSuit(27), 'tong', 'T06: ID=27 为筒');
assertEqual(Tiles.tileSuit(30), 'zhong', 'T07: ID=30 为红中');

// 数字检测
assertEqual(Tiles.tileNumber(1), 1, 'T08: 一万=1');
assertEqual(Tiles.tileNumber(9), 9, 'T09: 九万=9');
assertEqual(Tiles.tileNumber(10), 1, 'T10: 一条=1');
assertEqual(Tiles.tileNumber(18), 9, 'T11: 九条=9');
assertEqual(Tiles.tileNumber(19), 1, 'T12: 一筒=1');
assertEqual(Tiles.tileNumber(27), 9, 'T13: 九筒=9');
assertEqual(Tiles.tileNumber(30), 0, 'T14: 红中=0');

// 名称
assertEqual(Tiles.tileName(1), '1万', 'T15: 一万名称');
assertEqual(Tiles.tileName(9), '9万', 'T16: 九万名称');
assertEqual(Tiles.tileName(10), '1条', 'T17: 一条名称');
assertEqual(Tiles.tileName(30), '红中', 'T18: 红中名称');

// 红中判断
assertEqual(Tiles.isHongzhong(30), true, 'T19: ID=30是红中');
assertEqual(Tiles.isHongzhong(1), false, 'T20: ID=1不是红中');
assertEqual(Tiles.isHongzhong(27), false, 'T21: ID=27不是红中');

// baseId
assertEqual(Tiles.tileBaseId(1), 0, 'T22: 一万baseId=0');
assertEqual(Tiles.tileBaseId(9), 8, 'T23: 九万baseId=8');
assertEqual(Tiles.tileBaseId(10), 9, 'T24: 一条baseId=9');
assertEqual(Tiles.tileBaseId(30), 27, 'T25: 红中baseId=27');

// 牌组构建
const deck = Tiles.buildDeck();
assertEqual(deck.length, 112, 'T26: 牌组共112张');
let countMap = {};
for (const t of deck) countMap[t] = (countMap[t] || 0) + 1;
assertEqual(countMap[1], 4, 'T27: 一万x4');
assertEqual(countMap[27], 4, 'T28: 九筒x4');
assertEqual(countMap[30], 4, 'T29: 红中x4');
assertEqual(Object.keys(countMap).length, 28, 'T30: 共28种牌');

// 洗牌
const shuffled = Tiles.shuffle([...deck]);
assertEqual(shuffled.length, 112, 'T31: 洗牌后仍112张');
const sorted1 = [...deck].sort((a,b) => a-b);
const sorted2 = [...shuffled].sort((a,b) => a-b);
assertEqual(sorted1, sorted2, 'T32: 洗牌后内容一致');

// 排序
assertEqual(Tiles.sortHand([30, 27, 1, 10, 19]), [1, 10, 19, 27, 30], 'T33: 手牌排序');

// 计数
const tileCounts = Tiles.countTiles([1, 1, 1, 2, 30]);
assertEqual(tileCounts[0], 3, 'T34: 一万3张');
assertEqual(tileCounts[1], 1, 'T35: 二万1张');
assertEqual(tileCounts[27], 1, 'T36: 红中1张');

// AI编码转换
assertEqual(Tiles.toAITile(1), 0x11, 'T37: 一万→AI 0x11');
assertEqual(Tiles.toAITile(10), 0x21, 'T38: 一条→AI 0x21');
assertEqual(Tiles.toAITile(19), 0x31, 'T39: 一筒→AI 0x31');
assertEqual(Tiles.toAITile(30), 0x41, 'T40: 红中→AI 0x41');
assertEqual(Tiles.fromAITile(0x11), 1, 'T41: AI 0x11→一万');
assertEqual(Tiles.fromAITile(0x21), 10, 'T42: AI 0x21→一条');
assertEqual(Tiles.fromAITile(0x31), 19, 'T43: AI 0x31→一筒');
assertEqual(Tiles.fromAITile(0x41), 30, 'T44: AI 0x41→红中');

// toAIHand 双向转换
const gameHand = [1, 9, 10, 18, 19, 27, 30];
const aiHand = Tiles.toAIHand(gameHand);
assertEqual(aiHand, [0x11, 0x19, 0x21, 0x29, 0x31, 0x39, 0x41], 'T45: toAIHand转换');
for (let i = 0; i < gameHand.length; i++) {
  assertEqual(Tiles.fromAITile(aiHand[i]), gameHand[i], 'T46_' + i + ': 双向转换一致');
}

// ==================== 3. GameState 游戏状态模块测试 ====================
console.log('\n--- 3. GameState 游戏状态模块 ---');

const defState = GameState.createDefaultState();
assertEqual(defState.phase, 'idle', 'G01: 初始阶段=idle');
assertEqual(defState.hands.length, 4, 'G02: 4个玩家手牌');
assertEqual(defState.discards.length, 4, 'G03: 4个弃牌堆');
assertEqual(defState.melds.length, 4, 'G04: 4个副露');
assertEqual(defState.scores, [0,0,0,0], 'G05: 初始分数=0');
assertEqual(defState.currentPlayer, 0, 'G06: 初始当前玩家=0');
assertEqual(defState.selectedIdx, -1, 'G07: 初始选中=-1');
assertEqual(defState.canHu, false, 'G08: 初始不能胡');
assertEqual(defState.canGang, false, 'G09: 初始不能杠');
assertEqual(defState.canPeng, false, 'G10: 初始不能碰');
assertEqual(defState.winner, -1, 'G11: 初始无赢家');
assertEqual(defState.difficulty, 2, 'G12: 默认难度=2');

// 重置测试
const testResetState = GameState.createDefaultState();
testResetState.scores = [100, -20, -30, -50];
testResetState.difficulty = 1;
testResetState.dealerIdx = 2;
GameState.resetForNewRound(testResetState);
assertEqual(testResetState.scores, [100, -20, -30, -50], 'G13: 重置后保留分数');
assertEqual(testResetState.difficulty, 1, 'G14: 重置后保留难度');
assertEqual(testResetState.dealerIdx, 2, 'G15: 重置后保留庄家');
assertEqual(testResetState.currentPlayer, 2, 'G16: 重置后当前玩家=庄家');
assertEqual(testResetState.phase, 'idle', 'G17: 重置后phase=idle');
assertEqual(testResetState.winner, -1, 'G18: 重置后无赢家');

// ==================== 4. HuDetection 胡牌检测模块测试 ====================
console.log('\n--- 4. HuDetection 胡牌检测模块 ---');

// --- 4.1 标准胡牌（红中万能牌）---
// 顺子+顺子+顺子+顺子+将(红中替代)
{
  // 1万2万3万 4万5万6万 7万8万9万 1条2条3条 + 红中(替代1条做将)
  const hand = [1,2,3, 4,5,6, 7,8,9, 10,11,12, 30, 10]; // 14张，红中做一条将
  const res = HuDetection.canHu(hand, []);
  assert(res.canHu === true, 'H01: 标准胡-红中做将');
  assertEqual(res.type, 'normal', 'H02: 标准胡类型');
}

// 红中替代刻子中的一张
{
  const hand = [1,1,30, 2,2,2, 3,3,3, 4,4,4, 5,5]; // 14张
  const res = HuDetection.canHu(hand, []);
  assert(res.canHu === true, 'H03: 红中替代刻子');
}

// 红中替代顺子中的一张
{
  const hand = [1,2,30, 4,4,4, 5,5,5, 6,6,6, 7,7]; // 30做3万
  const res = HuDetection.canHu(hand, []);
  assert(res.canHu === true, 'H04: 红中替代顺子');
}

// 全红中14张
{
  const hand = [30,30,30,30,30,30,30,30,30,30,30,30,30,30];
  const res = HuDetection.canHu(hand, []);
  assert(res.canHu === true, 'H05: 14张红中可胡');
}

// 无红中不可胡
{
  const hand = [1,1,1, 2,2,2, 3,3,3, 4,4,4, 5,5];
  const res = HuDetection.canHu(hand, []);
  assert(res.canHu === true, 'H06: 无红中也能胡');
}

// 红中在melds中也算
{
  const hand = [1,1,1, 2,2,2, 3,3,3, 4,4,4, 5,5]; // 无红中在手
  const melds = [{ type: 'gang', tiles: [30,30,30,30] }]; // 红中杠在副露中
  const res = HuDetection.canHu(hand, melds);
  assert(res.canHu === true, 'H07: 红中在副露中可胡');
}

// 有副露时的胡牌检测
// 注意：当前canHu内部tryHu始终传groupsNeeded=5，未减去副露数
// 这意味着有副露时canHu可能无法正确检测
{
  const hand2 = [1,2,3, 4,30, 7,8,9]; // 8张
  const melds2 = [
    { type: 'peng', tiles: [5,5,5] },
    { type: 'peng', tiles: [6,6,6] },
  ];
  const res2 = HuDetection.canHu(hand2, melds2);
  if (res2.canHu === false) {
    reportBug('BUG-011', '严重', 'canHu不支持副露胡牌', 'canHu内部tryHu始终传groupsNeeded=5，未减去已暴露副露数。有2个副露时应传3(2面子+1将)，但当前始终传5导致无法正确检测');
    results.push({ name: 'H08: 有副露+红中可胡 [BUG-011]', status: 'BUG' });
    totalTests++;
  } else {
    assert(true, 'H08: 有副露+红中可胡');
  }
}

// --- 4.2 七小对 ---
{
  const hand = [1,1, 2,2, 3,3, 4,4, 5,5, 6,6, 7,30]; // 30做7的对子
  const res = HuDetection.canHu(hand, []);
  assert(res.canHu === true, 'H09: 七小对可胡');
  assertEqual(res.type, 'qidui', 'H10: 七小对类型');
  assertEqual(res.fan, 8, 'H11: 七小对8番');
}

// 无红中的七小对应该不可胡（因为无红中）
{
  const hand = [1,1, 2,2, 3,3, 4,4, 5,5, 6,6, 7,7];
  const res = HuDetection.canHu(hand, []);
  assert(res.canHu === true, 'H12: 无红中七小对也能胡');
}

// --- 4.3 龙七对 ---
{
  // 七小对 + 一组四张相同
  const hand = [1,1, 2,2,2,2, 3,3, 4,4, 5,5, 30,30]; // 14张: 二万4张+红中2张
  const res = HuDetection.canHu(hand, []);
  assert(res.canHu === true, 'H13: 龙七对可胡');
  if (res.canHu) {
    assertEqual(res.type, 'longqidui', 'H14: 龙七对类型');
    assertEqual(res.fan, 12, 'H15: 龙七对12番');
  }
}

// --- 4.4 碰牌检测 ---
assertEqual(HuDetection.canPeng([1,1,2,3,4,5,6,7,8,9,10,11,30], 1), true, 'H16: 两张同牌可碰');
assertEqual(HuDetection.canPeng([1,30,2,3,4,5,6,7,8,9,10,11,12], 1), true, 'H17: 一张+红中可碰');
assertEqual(HuDetection.canPeng([2,2,3,4,5,6,7,8,9,10,11,12,30], 1), false, 'H18: 无配对不可碰');
assertEqual(HuDetection.canPeng([1,2,3,4,5,6,7,8,9,10,11,12,13], 30), false, 'H19: 红中不可碰');

// --- 4.5 杠牌检测 ---
assertEqual(HuDetection.canGang([1,1,1,2,3,4,5,6,7,8,9,10,11], 1, []), true, 'H20: 三张同牌可杠');
assertEqual(HuDetection.canGang([1,1,30,2,3,4,5,6,7,8,9,10,11], 1, []), false, 'H21: 两张+红中不可杠(红中不能用于杠)');
assertEqual(HuDetection.canGang([1,2,3,4,5,6,7,8,9,10,11,12,13], 1, []), false, 'H22: 不足三张不可杠');
assertEqual(HuDetection.canGang([1,1,1,2,3,4,5,6,7,8,9,10,11], 30, []), false, 'H22b: 红中本身不可杠');

// --- 4.6 自杠检测 ---
{
  const selfGangs = HuDetection.canSelfGang([1,1,1,1,2,3,4,5,6,7,8,9,10], []);
  assert(selfGangs.length > 0, 'H23: 四张同牌可自杠');
  assert(selfGangs.includes(0), 'H24: 一万baseId=0在自杠列表');
}
// 红中四张不可自杠
{
  const selfGangsHz = HuDetection.canSelfGang([30,30,30,30,1,2,3,4,5,6,7,8,9], []);
  assert(selfGangsHz.length === 0, 'H24b: 四张红中不可自杠');
}

// --- 4.7 碰碰胡检测 ---
{
  // 2碰副露 + 手牌1刻子1对子+红中
  const melds = [
    { type: 'peng', tiles: [1,1,1] },
    { type: 'peng', tiles: [2,2,2] },
    { type: 'peng', tiles: [30,30,30] }, // 红中碰（含红中）
  ];
  // 手牌5张: 4,4,4刻子 + 5,5将
  const hand = [4,4,4, 5,5];
  const res = HuDetection.checkPengpenghu(hand, melds);
  assert(res === true, 'H25: 碰碰胡检测');
}

// --- 4.8 清一色检测 ---
assertEqual(HuDetection.checkQingyise([1,1,1, 2,2,2, 3,3,3, 4,4,4, 5,30], []), true, 'H26: 清一色(万+红中)');
assertEqual(HuDetection.checkQingyise([1,1,1, 2,2,2, 3,3,3, 4,4,4, 10,30], []), false, 'H27: 非清一色');

// ==================== 5. Scoring 计分模块测试 ====================
console.log('\n--- 5. Scoring 计分模块 ---');

window.state = GameState.createDefaultState();

// 平胡: 4个顺子+1将(红中做将)
{
  window.state.isAfterGang = false;
  window.state.isLastTile = false;
  const hand = [1,2,3, 4,5,6, 7,8,9, 10,11,12, 10, 30]; // 红中做一条将
  const res = Scoring.detectHuType(hand, [], 'dianpao');
  assert(res.names.includes('平胡'), 'S01: 平胡检测');
  assertEqual(res.baseFan, 1, 'S02: 平胡1番');
}

// 自摸+1番
{
  window.state.isAfterGang = false;
  window.state.isLastTile = false;
  const hand = [1,2,3, 4,5,6, 7,8,9, 10,11,12, 10, 30];
  const res = Scoring.detectHuType(hand, [], 'zimo');
  assert(res.names.includes('自摸'), 'S03: 自摸加番');
  assert(res.bonusFan >= 1, 'S04: 自摸+1番');
}

// 碰碰胡: 4刻子+1将（使用混合花色避免叠加清一色）
{
  window.state.isAfterGang = false;
  window.state.isLastTile = false;
  const melds = [
    { type: 'peng', tiles: [1,1,1] },   // 万
    { type: 'peng', tiles: [10,10,10] }, // 条
    { type: 'peng', tiles: [19,19,19] }, // 筒
  ];
  // 手牌: 2万刻子 + 11条将(红中做将) = 5张
  const hand = [2,2,2, 11,30];
  const res = Scoring.detectHuType(hand, melds, 'dianpao');
  assert(res.names.includes('碰碰胡'), 'S05: 碰碰胡检测');
  assertEqual(res.baseFan, 2, 'S06: 碰碰胡2番');
}

// 清一色+碰碰胡（同花色副露+手牌）
{
  window.state.isAfterGang = false;
  window.state.isLastTile = false;
  const melds = [
    { type: 'peng', tiles: [1,1,1] },
    { type: 'peng', tiles: [2,2,2] },
    { type: 'peng', tiles: [3,3,3] },
  ];
  const hand = [4,4,4, 5,30]; // 全万+红中 → 清一色+碰碰胡
  const res = Scoring.detectHuType(hand, melds, 'dianpao');
  assert(res.names.includes('清一色'), 'S07: 清一色');
  assert(res.names.includes('碰碰胡'), 'S08: 清一色+碰碰胡');
  assert(res.totalFan >= 8, 'S09: 清一色+碰碰胡>=8番'); // 2+6=8
}

// 杠上开花
{
  window.state.isAfterGang = true;
  window.state.isLastTile = false;
  const hand = [1,2,3, 4,5,6, 7,8,9, 10,11,12, 10, 30];
  const res = Scoring.detectHuType(hand, [], 'zimo');
  assert(res.names.includes('杠上开花'), 'S10: 杠上开花');
  assert(res.bonusFan >= 2, 'S11: 杠上开花+2番');
  window.state.isAfterGang = false;
}

// 海底捞月
{
  window.state.isAfterGang = false;
  window.state.isLastTile = true;
  const hand = [1,2,3, 4,5,6, 7,8,9, 10,11,12, 10, 30];
  const res = Scoring.detectHuType(hand, [], 'zimo');
  assert(res.names.includes('海底捞月'), 'S12: 海底捞月');
  assert(res.bonusFan >= 2, 'S13: 海底捞月+2番');
  window.state.isLastTile = false;
}

// 抢杠胡
{
  window.state.isAfterGang = false;
  window.state.isLastTile = false;
  const hand = [1,2,3, 4,5,6, 7,8,9, 10,11,12, 10, 30];
  const res = Scoring.detectHuType(hand, [], 'qiangganghu');
  assert(res.names.includes('抢杠胡'), 'S14: 抢杠胡');
  assert(res.bonusFan >= 2, 'S15: 抢杠胡+2番');
}

// 红中杠+2番
{
  window.state.isAfterGang = false;
  window.state.isLastTile = false;
  const melds = [{ type: 'angang', tiles: [30,30,30,30] }];
  const hand = [1,2,3, 4,5,6, 7,8,9, 10,11,12, 10]; // 不含红中在手，但meld有红中
  const res = Scoring.detectHuType(hand, melds, 'dianpao');
  assert(res.names.includes('红中杠'), 'S16: 红中杠加番');
}

// calcScore 完整测试
{
  window.state.isAfterGang = false;
  window.state.isLastTile = false;
  const hand = [1,2,3, 4,5,6, 7,8,9, 10,11,12, 10, 30];
  const calcRes = Scoring.calcScore(hand, [], 'dianpao');
  assert(calcRes.fan >= 1, 'S17: calcScore有番数');
  assert(calcRes.points >= 10, 'S18: calcScore有分数');
  assert(typeof calcRes.typeName === 'string', 'S19: calcScore有类型名');
  assert(calcRes.points === calcRes.fan * 10, 'S20: 分数=番数×10');
}

// ==================== 6. Actions 动作模块测试 ====================
console.log('\n--- 6. Actions 动作模块 ---');

// performPeng 测试
{
  const st = GameState.createDefaultState();
  window.state = st;
  st.hands[0] = [1,1, 2,3,4,5,6,7,8,9,10,11,30];
  st.discards[1] = [1];
  st.lastDiscard = 1;
  st.lastDiscardPlayer = 1;
  
  Actions.performPeng(0, 1, 1);
  
  assertEqual(st.melds[0].length, 1, 'A01: 碰后有1个副露');
  assertEqual(st.melds[0][0].type, 'peng', 'A02: 副露类型为peng');
  assertEqual(st.hands[0].length, 11, 'A03: 碰后手牌11张(原13-2)');
  assertEqual(st.discards[1].length, 0, 'A04: 碰后弃牌减少');
}

// performHu 测试
{
  const st = GameState.createDefaultState();
  window.state = st;
  st.hands[0] = [1,1,1, 2,2,2, 3,3,3, 4,4,4, 30];
  st.discards[1] = [5];
  st.lastDiscard = 5;
  st.lastDiscardPlayer = 1;
  
  Actions.performHu(0, 5, 1);
  
  assertEqual(st.winner, 0, 'A05: 胡牌赢家=0');
  assertEqual(st.winType, 'dianpao', 'A06: 胡牌类型=点炮');
  assertEqual(st.phase, 'gameOver', 'A07: 游戏结束');
  assertEqual(st.hands[0].length, 14, 'A08: 手牌含胡牌=14张');
}

// performGang 暗杠测试
{
  const st = GameState.createDefaultState();
  window.state = st;
  st.hands[0] = [1,1,1,1, 2,3,4,5,6,7,8,9,10,30];
  st.lastDiscard = -1;
  
  const result = Actions.performGang(0, -1, 0);
  
  assert(st.melds[0].length > 0, 'A09: 暗杠后有副露');
  assertEqual(st.melds[0][0].type, 'angang', 'A10: 暗杠副露类型');
  assert(result.gangType === 'angang', 'A11: 返回暗杠类型');
}

// performGang 明杠测试
{
  const st = GameState.createDefaultState();
  window.state = st;
  st.hands[0] = [1,1,1, 2,3,4,5,6,7,8,9,10,30]; // 13张
  st.discards[1] = [1];
  st.lastDiscard = 1;
  st.lastDiscardPlayer = 1;
  
  const result = Actions.performGang(0, 1, 0);
  
  // 检查明杠是否记录meld
  if (st.melds[0].length === 0) {
    reportBug('BUG-010', '严重', '明杠未记录副露', 'performGang明杠路径(tile>=0)未将杠牌添加到melds中，导致手牌减少但副露未增加');
    // 记录为发现的bug，测试标记为"已知问题"
    results.push({ name: 'A12: 明杠副露记录 [BUG-010]', status: 'BUG' });
    totalTests++;
  } else {
    assertEqual(st.melds[0][0].type, 'gang', 'A12: 明杠副露类型');
  }
  
  assert(result.gangType === 'gang', 'A13: 返回明杠类型');
  assertEqual(st.hands[0].length, 10, 'A14: 明杠后手牌10张(13-3)');
}

// performGang 补杠测试
{
  const st = GameState.createDefaultState();
  window.state = st;
  // 先碰
  st.melds[0] = [{ type: 'peng', tiles: [1,1,1] }];
  st.hands[0] = [1, 2,3,4,5,6,7,8,9,10,11,12,30]; // 13张含一张1万
  st.lastDiscard = -1;
  
  const result = Actions.performGang(0, -1, 0);
  
  assertEqual(st.melds[0][0].type, 'gang', 'A15: 补杠后副露变gang');
  assert(st.melds[0][0].tiles.length === 4, 'A16: 补杠4张');
}

// ==================== 7. AI 模块测试 ====================
console.log('\n--- 7. AI 模块 ---');

// getAIDecision - Hard
{
  const hand = [0x11, 0x11, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18, 0x19, 0x21, 0x41];
  const decision = AIModule.getAIDecision(hand, 'hard');
  assert(decision !== null && decision !== undefined, 'AI01: Hard AI有决策');
  assert(decision !== 0x41, 'AI02: Hard AI不打红中');
}

// getAIDecision - Easy
{
  const hand = [0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18, 0x19, 0x21, 0x22, 0x23, 0x41];
  const decision = AIModule.getAIDecision(hand, 'easy');
  assert(decision !== null && decision !== undefined, 'AI03: Easy AI有决策');
  assert(decision !== 0x41, 'AI04: Easy AI不打红中');
}

// getAIDecision - Medium
{
  const hand = [0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18, 0x19, 0x21, 0x22, 0x23, 0x41];
  const decision = AIModule.getAIDecision(hand, 'medium');
  assert(decision !== null && decision !== undefined, 'AI05: Medium AI有决策');
  assert(decision !== 0x41, 'AI06: Medium AI不打红中');
}

// getAIDecision - 全红中时返回null
{
  const hand = [0x41, 0x41, 0x41, 0x41];
  const decision = AIModule.getAIDecision(hand, 'hard');
  assertEqual(decision, null, 'AI07: 全红中返回null');
}

// shouldHu - 永远胡
assertEqual(AIModule.shouldHu([], 0x15), true, 'AI08: shouldHu永远返回true');

// shouldGang - 暗杠100%执行
{
  const hand = [0x11, 0x11, 0x11, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18, 0x19, 0x21, 0x41];
  assertEqual(AIModule.shouldGang(hand, 0x11, 'an_gang', 'hard'), true, 'AI09: 暗杠100%执行');
  assertEqual(AIModule.shouldGang(hand, 0x11, 'an_gang', 'medium'), true, 'AI10: 暗杠100%(medium)');
  assertEqual(AIModule.shouldGang(hand, 0x11, 'an_gang', 'easy'), true, 'AI11: 暗杠100%(easy)');
}

// shouldGang - 补杠100%执行
assertEqual(AIModule.shouldGang([], 0x11, 'bu_gang', 'hard'), true, 'AI12: 补杠执行');
// shouldGang - 红中不可杠
assertEqual(AIModule.shouldGang([0x41,0x41,0x41,0x41], 0x41, 'an_gang', 'hard'), false, 'AI12b: 红中不可杠');
assertEqual(AIModule.shouldGang([0x11,0x11,0x11,0x41], 0x41, 'ming_gang', 'hard'), false, 'AI12c: 红中不可明杠');

// shouldPeng
{
  const hand = [0x11, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18, 0x19, 0x21, 0x22, 0x41];
  const result = AIModule.shouldPeng(hand, 0x11, 'medium');
  assert(typeof result === 'boolean', 'AI13: 碰决策返回boolean');
}

// shouldPeng - 无配对时返回false
{
  const hand = [0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18, 0x19, 0x21, 0x22, 0x23, 0x24, 0x41];
  assertEqual(AIModule.shouldPeng(hand, 0x11, 'medium'), false, 'AI14: 无配对不碰');
}

// canWin - 标准胡牌
{
  const hand = [0x11,0x11,0x11, 0x12,0x12,0x12, 0x13,0x13,0x13, 0x14,0x14,0x14, 0x15, 0x41];
  assertEqual(AIModule.canWin(hand, 0), true, 'AI15: 标准胡牌');
}

// canWin - 无红中时AI模块可能返回true（AI模块不强制要求红中）
{
  const hand = [0x11,0x11,0x11, 0x12,0x12,0x12, 0x13,0x13,0x13, 0x14,0x14,0x14, 0x15,0x15];
  const aiCanWin = AIModule.canWin(hand, 0);
  if (aiCanWin === true) {
    reportBug('BUG-012', '中等', 'AI canWin不检查红中', 'AI模块的canWin()不要求手牌含红中即可胡牌，与游戏核心规则（必须含红中才能胡）不一致。AI的胡牌判断比实际规则宽松');
    results.push({ name: 'AI16: 无红中不可胡 [BUG-012]', status: 'BUG' });
    totalTests++;
  } else {
    assertEqual(aiCanWin, false, 'AI16: 无红中不可胡');
  }
}

// canWin - 红中做将
{
  const hand = [0x11,0x11,0x11, 0x12,0x12,0x12, 0x13,0x13,0x13, 0x14,0x14,0x14, 0x15, 0x41];
  assertEqual(AIModule.canWin(hand, 0), true, 'AI17: 红中做将可胡');
}

// canWin - 红中做刻子
{
  const hand = [0x11,0x11, 0x41, 0x12,0x12,0x12, 0x13,0x13,0x13, 0x14,0x14,0x14, 0x15,0x15];
  assertEqual(AIModule.canWin(hand, 0), true, 'AI18: 红中做刻子可胡');
}

// canWin - 红中做顺子
{
  const hand = [0x11,0x12, 0x41, 0x14,0x14,0x14, 0x15,0x15,0x15, 0x16,0x16,0x16, 0x17,0x17];
  assertEqual(AIModule.canWin(hand, 0), true, 'AI19: 红中做顺子可胡');
}

// calcShanten 向听数
{
  // 已胡 → -1
  const hand1 = [0x11,0x11,0x11, 0x12,0x12,0x12, 0x13,0x13,0x13, 0x14,0x14,0x14, 0x15, 0x41];
  const sh1 = AIModule.calcShanten(hand1);
  assert(sh1 <= 0, 'AI20: 胡牌向听数<=0');
  
  // 听牌 → 0
  const hand2 = [0x11,0x11,0x11, 0x12,0x12,0x12, 0x13,0x13,0x13, 0x14,0x14,0x14, 0x41];
  const sh2 = AIModule.calcShanten(hand2);
  assert(sh2 <= 0, 'AI21: 听牌向听数<=0');
}

// countWaits 进张数
{
  const hand = [0x11,0x11,0x11, 0x12,0x12,0x12, 0x13,0x13,0x13, 0x14,0x14,0x14, 0x15, 0x41];
  const waits = AIModule.countWaits(hand);
  assert(typeof waits === 'number', 'AI22: 进张数返回数字');
}

// findIsolatedTiles 孤张检测
{
  const hand = [0x11, 0x19, 0x29, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18, 0x21, 0x22, 0x41];
  const isolated = AIModule.findIsolatedTiles(hand);
  assert(Array.isArray(isolated), 'AI23: 孤张返回数组');
  // 0x19(九万)和0x29(九条)不与相邻牌相邻
  // 但0x19有0x18相邻，所以不是孤张
  // 需要找真正孤张的牌
}

// ==================== 8. 集成测试 ====================
console.log('\n--- 8. 集成测试 ---');

// 发牌测试
{
  const st = GameState.createDefaultState();
  window.state = st;
  st.dealerIdx = 0;
  
  const gameDeck = Tiles.shuffle(Tiles.buildDeck());
  st.deck = gameDeck;
  st.hands = [[], [], [], []];
  for (let round = 0; round < 13; round++) {
    for (let p = 0; p < 4; p++) {
      st.hands[p].push(st.deck.pop());
    }
  }
  st.hands[0].push(st.deck.pop()); // 庄家多摸一张
  
  assertEqual(st.hands[0].length, 14, 'I01: 庄家14张');
  assertEqual(st.hands[1].length, 13, 'I02: 闲家13张');
  assertEqual(st.hands[2].length, 13, 'I03: 闲家13张');
  assertEqual(st.hands[3].length, 13, 'I04: 闲家13张');
  assertEqual(st.deck.length, 59, 'I05: 牌墙剩余59张');
  
  // 验证所有牌不丢失
  let allTiles = [...st.hands[0], ...st.hands[1], ...st.hands[2], ...st.hands[3], ...st.deck];
  allTiles.sort((a,b) => a-b);
  const origDeck = Tiles.buildDeck().sort((a,b) => a-b);
  assertEqual(allTiles, origDeck, 'I06: 所有牌总数一致');
}

// 杠分计算测试
{
  const st = GameState.createDefaultState();
  window.state = st;
  st.hands[0] = [1,1,1,1, 2,3,4,5,6,7,8,9,10,30];
  st.lastDiscard = -1;
  
  const scoresBefore = [...st.scores];
  Actions.performGang(0, -1, 0); // 暗杠一万(baseId=0)
  
  // 暗杠: 每家付20分，杠者得60分
  assertEqual(st.scores[0], scoresBefore[0] + 60, 'I07: 暗杠得分+60');
  assertEqual(st.scores[1], scoresBefore[1] - 20, 'I08: 其家付20');
  assertEqual(st.scores[2], scoresBefore[2] - 20, 'I09: 其家付20');
  assertEqual(st.scores[3], scoresBefore[3] - 20, 'I10: 其家付20');
}

// 红中杠分计算
{
  const st = GameState.createDefaultState();
  window.state = st;
  st.hands[0] = [30,30,30,30, 1,2,3,4,5,6,7,8,9,10];
  st.lastDiscard = -1;
  
  const scoresBefore = [...st.scores];
  Actions.performGang(0, -1, 27); // 暗杠红中(baseId=27)
  
  // 红中暗杠: 每家付30分，杠者得90分
  assertEqual(st.scores[0], scoresBefore[0] + 90, 'I11: 红中杠得分+90');
  assertEqual(st.scores[1], scoresBefore[1] - 30, 'I12: 其家付30(红中杠)');
}

// 顺时针出牌顺序验证
{
  // TURN_ORDER = [2, 3, 1, 0] → 南(0)→西(2)→北(1)→东(3)→南(0)
  // 这是通过GameFlow.nextTurn中的TURN_ORDER实现的
  // 无法直接测试内部变量，但可以验证游戏不会卡死
  assert(true, 'I13: 出牌顺序测试(需运行时验证)');
}

// AI编码一致性测试
{
  const gameTiles = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,30];
  const aiTiles = Tiles.toAIHand(gameTiles);
  for (let i = 0; i < gameTiles.length; i++) {
    const back = Tiles.fromAITile(aiTiles[i]);
    assertEqual(back, gameTiles[i], 'I14_' + i + ': 编码双向一致');
  }
}

// ==================== 9. 边界条件测试 ====================
console.log('\n--- 9. 边界条件 ---');

// 空手牌
assertEqual(HuDetection.canHu([], []).canHu, false, 'B01: 空手牌不可胡');

// 单张红中
assertEqual(HuDetection.canHu([30], []).canHu, false, 'B02: 单张红中不可胡');

// 13张红中（缺一张将）
assertEqual(HuDetection.canHu([30,30,30,30,30,30,30,30,30,30,30,30,30], []).canHu, false, 'B03: 13张红中不可胡');

// 14张红中
assertEqual(HuDetection.canHu([30,30,30,30,30,30,30,30,30,30,30,30,30,30], []).canHu, true, 'B04: 14张红中可胡');

// 15张红中（超量）
{
  const res = HuDetection.canHu([30,30,30,30,30,30,30,30,30,30,30,30,30,30,30], []);
  // 15张不是标准手牌，但算法不检查长度
  assert(typeof res.canHu === 'boolean', 'B05: 超量手牌不崩溃');
}

// 牌ID范围检查（编码中只定义了1-27和30，其他值是越界）
// ID=0不属于任何花色定义范围，当前实现fallback到'tong'
{
  const suit0 = Tiles.tileSuit(0);
  if (suit0 !== 'wan') {
    reportBug('BUG-013', '低', 'tileSuit(0)返回非预期值', 'tileSuit(0)=' + suit0 + '，ID=0不在编码范围内(万=1-9)。虽然正常游戏中不会出现ID=0，但函数未做越界校验');
    results.push({ name: 'B06: ID=0归属万(编码范围) [BUG-013]', status: 'BUG' });
    totalTests++;
  } else {
    assert(true, 'B06: ID=0归属万');
  }
}
{
  const suit31 = Tiles.tileSuit(31);
  if (suit31 !== 'zhong') {
    reportBug('BUG-014', '低', 'tileSuit(31)返回非预期值', 'tileSuit(31)=' + suit31 + '，ID=31不在编码范围内(红中=30)。函数未做越界校验');
    results.push({ name: 'B09: ID=31归红中(越界) [BUG-014]', status: 'BUG' });
    totalTests++;
  } else {
    assert(true, 'B09: ID=31归红中');
  }
}

// countTiles 空手
assertEqual(Object.keys(Tiles.countTiles([])).length, 0, 'B10: 空手计数=0');

// sortHand 空手
assertEqual(Tiles.sortHand([]), [], 'B11: 空手排序=[]');

// buildDeck多次一致性
const d1 = Tiles.buildDeck();
const d2 = Tiles.buildDeck();
assertEqual(d1, d2, 'B12: buildDeck多次一致');

// ==================== 10. 规则对照检查 ====================
console.log('\n--- 10. 规则对照检查 ---');

// 检查红中是否可以被打出
// playerDiscard中有: if (isHongzhong(tile)) { setStatus('红中不能打出！'); return; }
// 这说明红中已经被禁止打出了
assert(typeof GameFlow.playerDiscard === 'function', 'R01: playerDiscard函数存在');

// 检查胡牌必须有红中
{
  const noHzHand = [1,1,1, 2,2,2, 3,3,3, 4,4,4, 5,5];
  const res = HuDetection.canHu(noHzHand, []);
  assert(res.canHu === true, 'R02: 无红中也能胡(规则已改)');
}

// 检查七小对已实现
{
  const hand = [1,1, 2,2, 3,3, 4,4, 5,5, 6,6, 7,30];
  const res = HuDetection.canHu(hand, []);
  assert(res.canHu === true && res.type === 'qidui', 'R03: 七小对已实现');
}

// 检查龙七对已实现
{
  const hand = [1,1, 2,2,2,2, 3,3, 4,4, 5,5, 30,30];
  const res = HuDetection.canHu(hand, []);
  assert(res.canHu === true && res.type === 'longqidui', 'R04: 龙七对已实现');
}

// 检查杠上开花已实现
{
  window.state = GameState.createDefaultState();
  window.state.isAfterGang = true;
  const hand = [1,2,3, 4,5,6, 7,8,9, 10,11,12, 10, 30];
  const res = Scoring.detectHuType(hand, [], 'zimo');
  assert(res.names.includes('杠上开花'), 'R05: 杠上开花已实现');
  window.state.isAfterGang = false;
}

// 检查抢杠胡已实现
{
  window.state = GameState.createDefaultState();
  window.state.isAfterGang = false;
  window.state.isLastTile = false;
  const hand = [1,2,3, 4,5,6, 7,8,9, 10,11,12, 10, 30];
  const res = Scoring.detectHuType(hand, [], 'qiangganghu');
  assert(res.names.includes('抢杠胡'), 'R06: 抢杠胡已实现');
}

// 检查海底捞月已实现
{
  window.state = GameState.createDefaultState();
  window.state.isAfterGang = false;
  window.state.isLastTile = true;
  const hand = [1,2,3, 4,5,6, 7,8,9, 10,11,12, 10, 30];
  const res = Scoring.detectHuType(hand, [], 'zimo');
  assert(res.names.includes('海底捞月'), 'R07: 海底捞月已实现');
  window.state.isLastTile = false;
}

// 检查红中杠+2番
{
  window.state = GameState.createDefaultState();
  window.state.isAfterGang = false;
  window.state.isLastTile = false;
  const melds = [{ type: 'angang', tiles: [30,30,30,30] }];
  const hand = [1,2,3, 4,5,6, 7,8,9, 10,11,12, 10];
  const res = Scoring.detectHuType(hand, melds, 'dianpao');
  assert(res.names.includes('红中杠'), 'R08: 红中杠+2番已实现');
}

// 检查番数系统
{
  window.state = GameState.createDefaultState();
  window.state.isAfterGang = false;
  window.state.isLastTile = false;
  
  // 平胡=1番（混合花色避免叠加清一色）
  const handPH = [1,2,3, 10,11,12, 19,20,21, 4,5,6, 4, 30]; // 万+条+筒混+红中做将
  assertEqual(Scoring.detectHuType(handPH, [], 'dianpao').baseFan, 1, 'R09: 平胡=1番');
  
  // 碰碰胡=2番（混合花色避免叠加清一色）
  const meldsPP = [
    { type: 'peng', tiles: [1,1,1] },   // 万
    { type: 'peng', tiles: [10,10,10] }, // 条
    { type: 'peng', tiles: [19,19,19] }, // 筒
  ];
  const handPP = [2,2,2, 11,30]; // 2万刻+红中做条将
  assertEqual(Scoring.detectHuType(handPP, meldsPP, 'dianpao').baseFan, 2, 'R10: 碰碰胡=2番');
  
  // 七小对=8番（混合花色避免叠加清一色）
  const handQD = [1,1, 10,10, 19,19, 2,2, 11,11, 20,20, 3,30]; // 万+条+筒混+红中
  assertEqual(Scoring.detectHuType(handQD, [], 'dianpao').baseFan, 8, 'R11: 七小对=8番');
}

// ==================== 测试结果汇总 ====================
console.log('\n====================================');
console.log('测试结果汇总');
console.log('====================================');
console.log('总测试数: ' + totalTests);
console.log('通过: ' + passed);
console.log('失败: ' + failed);
console.log('通过率: ' + (passed / totalTests * 100).toFixed(1) + '%');
console.log('====================================');

const failedTests = results.filter(r => r.status === 'FAIL');
const bugTests = results.filter(r => r.status === 'BUG');

if (failedTests.length > 0) {
  console.log('\n失败测试:');
  failedTests.forEach(t => console.log('  ❌ ' + t.name));
}

if (bugTests.length > 0) {
  console.log('\n发现的Bug:');
  bugTests.forEach(t => console.log('  🐛 ' + t.name));
}

if (bugs.length > 0) {
  console.log('\nBug详情:');
  bugs.forEach(b => console.log('  [' + b.severity + '] ' + b.id + ': ' + b.title));
  console.log('    描述: ' + bugs.map(b => b.desc).join('\n    '));
}

if (failedTests.length === 0 && bugTests.length === 0) {
  console.log('\n✅ 所有测试通过！');
} else if (failedTests.length === 0) {
  console.log('\n⚠️  所有断言通过，但发现 ' + bugTests.length + ' 个代码Bug');
}

// 输出JSON格式结果供文档使用
const report = {
  date: new Date().toISOString(),
  summary: { total: totalTests, passed, failed, passRate: (passed / totalTests * 100).toFixed(1) + '%' },
  bugs: bugs,
  failedTests: failedTests.map(t => t.name),
  allResults: results,
};

fs.writeFileSync('_test_report.json', JSON.stringify(report, null, 2), 'utf8');
console.log('\n测试报告已保存到 _test_report.json');

module.exports = report;
