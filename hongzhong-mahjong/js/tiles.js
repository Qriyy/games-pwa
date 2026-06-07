/**
 * 红中麻将 — 牌工具模块
 * 使用统一简单 id 编码：
 *   万 1-9 = id 1-9
 *   条 1-9 = id 10-18
 *   筒 1-9 = id 19-27
 *   红中   = id 30
 */
window.Tiles = (function() {
  const { HONGZHONG_ID, SUIT_NAMES } = window.Constants;
  const SUITS = ['wan','tiao','tong'];

  // ============== 基本牌工具 ==============

  function createTile(id) { return id; }

  function tileSuit(id) {
    if (id === HONGZHONG_ID) return 'zhong';
    if (id >= 1 && id <= 9) return 'wan';
    if (id >= 10 && id <= 18) return 'tiao';
    return 'tong'; // 19-27
  }

  function tileNumber(id) {
    if (id === HONGZHONG_ID) return 0;
    if (id <= 9) return id;
    if (id <= 18) return id - 9;
    return id - 18;
  }

  function tileName(id) {
    if (id === HONGZHONG_ID) return '红中';
    const s = tileSuit(id), n = tileNumber(id);
    return n + SUIT_NAMES[s];
  }

  function tileBaseId(id) {
    if (id === HONGZHONG_ID) return 27;
    return id - 1;
  }

  function isHongzhong(id) { return id === HONGZHONG_ID; }

  function buildDeck() {
    const deck = [];
    for (let i = 1; i <= 27; i++) {
      for (let c = 0; c < 4; c++) deck.push(i);
    }
    for (let c = 0; c < 4; c++) deck.push(HONGZHONG_ID);
    return deck; // 112 tiles
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function sortHand(hand) {
    return hand.slice().sort((a, b) => tileBaseId(a) - tileBaseId(b));
  }

  function countTiles(hand) {
    const counts = {};
    for (const t of hand) {
      const b = tileBaseId(t);
      counts[b] = (counts[b] || 0) + 1;
    }
    return counts;
  }

  // ============== AI 编码转换 ==============
  // AI 模块使用 0x 编码:
  //   万 = 0x10 + rank, 条 = 0x20 + rank, 筒 = 0x30 + rank, 红中 = 0x41

  function toAITile(gameId) {
    if (gameId === HONGZHONG_ID) return 0x41;
    if (gameId >= 1 && gameId <= 9) return 0x10 + gameId;
    if (gameId >= 10 && gameId <= 18) return 0x20 + (gameId - 9);
    return 0x30 + (gameId - 18); // 19-27
  }

  function fromAITile(aiId) {
    if (aiId === 0x41) return HONGZHONG_ID;
    const suit = aiId & 0xF0;
    const rank = aiId & 0x0F;
    if (suit === 0x10) return rank;           // 万 1-9
    if (suit === 0x20) return 9 + rank;       // 条 10-18
    if (suit === 0x30) return 18 + rank;      // 筒 19-27
    return HONGZHONG_ID; // fallback
  }

  function toAIHand(gameHand) {
    return gameHand.map(t => toAITile(t));
  }

  function fromAIResult(aiResult) {
    // aiResult is an ai-encoded tile value
    return fromAITile(aiResult);
  }

  return {
    createTile, tileSuit, tileNumber, tileName, tileBaseId, isHongzhong,
    buildDeck, shuffle, sortHand, countTiles,
    toAITile, fromAITile, toAIHand, fromAIResult,
  };
})();
