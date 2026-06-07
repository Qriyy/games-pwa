/**
 * 红中麻将 — 牌素材加载模块
 * 使用 lietxia/mahjong_graphic (CC0) 的 SVG 牌面图
 * 命名: m=万, s=条, p=筒, 7z=红中
 */
window.TileAssets = (function() {
  const BASE = 'https://raw.githubusercontent.com/lietxia/mahjong_graphic/main/Vectors%20%E7%9F%A2%E9%87%8F%E5%9B%BE/SVG%28%E9%80%8F%E6%98%8E%E8%83%8C%E6%99%AF%20Transparent%20background%29/';

  // 游戏编码 → SVG 文件名映射
  const TILE_TO_SVG = {};
  for (let i = 1; i <= 9; i++)  TILE_TO_SVG[i]      = `${i}m.svg`;   // 万 1-9
  for (let i = 10; i <= 18; i++) TILE_TO_SVG[i]      = `${i-9}s.svg`;  // 条 10-18
  for (let i = 19; i <= 27; i++) TILE_TO_SVG[i]      = `${i-18}p.svg`; // 筒 19-27
  TILE_TO_SVG[30] = '7z.svg';  // 红中

  // 缓存的 Image 对象
  const cache = new Map();
  let loadedCount = 0;
  const totalNeeded = Object.keys(TILE_TO_SVG).length;
  let onAllLoaded = null;

  function loadOne(key, filename) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      loadedCount++;
      cache.set(key, img);
      if (loadedCount >= totalNeeded && onAllLoaded) {
        onAllLoaded();
      }
    };
    img.onerror = () => {
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
    loadedCount = 0;
    cache.clear();
    for (const [gameId, filename] of Object.entries(TILE_TO_SVG)) {
      loadOne(parseInt(gameId), filename);
    }
  }

  function getTile(tileId) {
    return cache.get(tileId) || null;
  }

  function getBack() {
    return null; // 无素材，使用Canvas绘制的牌背
  }

  function isReady() {
    return loadedCount >= totalNeeded;
  }

  return { preload, getTile, getBack, isReady };
})();
