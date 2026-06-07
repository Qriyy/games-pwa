/**
 * 红中麻将 — 牌素材加载模块
 * 使用 FluffyStuff/riichi-mahjong-tiles (CC0) 的 SVG 牌面图
 * Man=万, Sou=条, Pin=筒, Chun=红中
 */
window.TileAssets = (function() {
  const BASE = 'https://raw.githubusercontent.com/FluffyStuff/riichi-mahjong-tiles/master/Regular/';

  // 游戏编码 → SVG 文件名映射
  const TILE_TO_SVG = {};
  for (let i = 1; i <= 9; i++)  TILE_TO_SVG[i]      = `Man${i}.svg`;   // 万 1-9
  for (let i = 10; i <= 18; i++) TILE_TO_SVG[i]      = `Sou${i-9}.svg`;  // 条 10-18
  for (let i = 19; i <= 27; i++) TILE_TO_SVG[i]      = `Pin${i-18}.svg`; // 筒 19-27
  TILE_TO_SVG[30] = 'Chun.svg';  // 红中

  // 缓存的 Image 对象
  const cache = new Map();
  let loadedCount = 0;
  let totalNeeded = Object.keys(TILE_TO_SVG).length + 1; // +1 for back
  let onAllLoaded = null;

  function loadOne(key, filename) {
    const img = new Image();
    img.onload = () => {
      loadedCount++;
      cache.set(key, img);
      if (loadedCount >= totalNeeded && onAllLoaded) {
        onAllLoaded();
      }
    };
    img.onerror = () => {
      console.warn('牌图加载失败:', filename);
      loadedCount++;
      cache.set(key, null);
      if (loadedCount >= totalNeeded && onAllLoaded) {
        onAllLoaded();
      }
    };
    img.src = BASE + filename;
  }

  function preload(callback) {
    onAllLoaded = callback;
    // 加载普通牌
    for (const [gameId, filename] of Object.entries(TILE_TO_SVG)) {
      loadOne(parseInt(gameId), filename);
    }
    // 加载牌背
    loadOne('back', 'Back.svg');
  }

  function getTile(tileId) {
    return cache.get(tileId) || null;
  }

  function getBack() {
    return cache.get('back') || null;
  }

  function isReady() {
    return loadedCount >= totalNeeded;
  }

  return { preload, getTile, getBack, isReady };
})();
