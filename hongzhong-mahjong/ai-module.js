/**
 * 红中麻将 AI 模块 v2（重写版）
 *
 * 牌面编码：万=0x11-0x19, 条=0x21-0x29, 筒=0x31-0x39, 红中=0x41
 * 红中为万能牌（癞子），永远不主动打出。
 *
 * difficulty: 'easy' | 'medium' | 'hard'
 *
 * 策略层次：
 *   easy   → 孤张→边张→随机，偶尔犯错
 *   medium → 牌价值评估，打最低价值牌
 *   hard   → 向听数 + 进张数(ukeire)联合优化
 */

;(function (root) {
'use strict';

// ============================================================
//  常量
// ============================================================

var SUIT_WAN   = 0x10;
var SUIT_TIAO  = 0x20;
var SUIT_TONG  = 0x30;
var SUIT_ZI    = 0x40;
var HONG_ZHONG = 0x41;

var ALL_SUITS  = [SUIT_WAN, SUIT_TIAO, SUIT_TONG];
var ALL_RANKS  = [1, 2, 3, 4, 5, 6, 7, 8, 9];

var TILE_NAMES = {
  0x11:'一万',0x12:'二万',0x13:'三万',0x14:'四万',0x15:'五万',
  0x16:'六万',0x17:'七万',0x18:'八万',0x19:'九万',
  0x21:'一条',0x22:'二条',0x23:'三条',0x24:'四条',0x25:'五条',
  0x26:'六条',0x27:'七条',0x28:'八条',0x29:'九条',
  0x31:'一筒',0x32:'二筒',0x33:'三筒',0x34:'四筒',0x35:'五筒',
  0x36:'六筒',0x37:'七筒',0x38:'八筒',0x39:'九筒',
  0x41:'红中'
};

// 所有合法数牌 tile 值（用于迭代）
var ALL_TILES = [];
for (var _si = 0; _si < ALL_SUITS.length; _si++) {
  for (var _ri = 1; _ri <= 9; _ri++) {
    ALL_TILES.push(ALL_SUITS[_si] + _ri);
  }
}

// ============================================================
//  工具函数
// ============================================================

function suitOf(tile) {
  if (tile === HONG_ZHONG) return SUIT_ZI;
  return tile & 0xF0;
}

function rankOf(tile) {
  return tile & 0x0F;
}

function isNumberTile(tile) {
  var s = suitOf(tile);
  return s === SUIT_WAN || s === SUIT_TIAO || s === SUIT_TONG;
}

/** 手牌转计数表 {tileValue: count} */
function handToCounts(hand) {
  var counts = {};
  for (var i = 0; i < hand.length; i++) {
    counts[hand[i]] = (counts[hand[i]] || 0) + 1;
  }
  return counts;
}

function sortHand(hand) {
  return hand.slice().sort(function (a, b) { return a - b; });
}

function removeTile(hand, tile) {
  var copy = hand.slice();
  var idx = copy.indexOf(tile);
  if (idx !== -1) copy.splice(idx, 1);
  return copy;
}

function removeTiles(hand, tiles) {
  var copy = hand.slice();
  for (var i = 0; i < tiles.length; i++) {
    var idx = copy.indexOf(tiles[i]);
    if (idx !== -1) copy.splice(idx, 1);
  }
  return copy;
}

function countHongZhong(hand) {
  var c = 0;
  for (var i = 0; i < hand.length; i++) {
    if (hand[i] === HONG_ZHONG) c++;
  }
  return c;
}

function nonHongZhong(hand) {
  var result = [];
  for (var i = 0; i < hand.length; i++) {
    if (hand[i] !== HONG_ZHONG) result.push(hand[i]);
  }
  return result;
}

/** 获取手牌中可打出的非红中牌（去重） */
function getPlayableTiles(hand) {
  var seen = {};
  var result = [];
  for (var i = 0; i < hand.length; i++) {
    var t = hand[i];
    if (t === HONG_ZHONG) continue;
    if (!seen[t]) { seen[t] = true; result.push(t); }
  }
  return result;
}

/** 深拷贝一个 counts 对象 */
function cloneCounts(counts) {
  var c = {};
  for (var k in counts) { if (counts.hasOwnProperty(k)) c[k] = counts[k]; }
  return c;
}

// ============================================================
//  胡牌检测（递归 + 深度限制）
// ============================================================

/**
 * 检查手牌（含红中）是否能胡。
 * hand: 数组，长度应为 14 - 已暴露面子数×3
 * exposedMeldCount: 已暴露的面子(碰/杠)数量
 */
function canWin(hand, exposedMeldCount) {
  if (exposedMeldCount === undefined) exposedMeldCount = 0;
  var total = hand.length + exposedMeldCount * 3;
  if (total !== 14) return false;

  var hzCount = countHongZhong(hand);
  var tiles = nonHongZhong(hand);
  var counts = handToCounts(tiles);
  var meldsNeeded = 4 - exposedMeldCount;
  var uniqueTiles = [];
  for (var k in counts) { if (counts.hasOwnProperty(k)) uniqueTiles.push(Number(k)); }

  // 将 = 两张普通牌
  for (var idx = 0; idx < uniqueTiles.length; idx++) {
    var pairTile = uniqueTiles[idx];
    if (counts[pairTile] >= 2) {
      var nc = cloneCounts(counts);
      nc[pairTile] -= 2;
      if (nc[pairTile] === 0) delete nc[pairTile];
      if (_canFormMelds(nc, meldsNeeded, hzCount, 0)) return true;
    }
  }
  // 将 = 1普通 + 1红中
  if (hzCount >= 1) {
    for (var idx2 = 0; idx2 < uniqueTiles.length; idx2++) {
      var pt2 = uniqueTiles[idx2];
      var nc2 = cloneCounts(counts);
      nc2[pt2] -= 1;
      if (nc2[pt2] === 0) delete nc2[pt2];
      if (_canFormMelds(nc2, meldsNeeded, hzCount - 1, 0)) return true;
    }
  }
  // 将 = 2红中
  if (hzCount >= 2) {
    if (_canFormMelds(cloneCounts(counts), meldsNeeded, hzCount - 2, 0)) return true;
  }
  return false;
}

/** 递归检测能否组成 meldsNeeded 个面子 */
function _canFormMelds(counts, meldsNeeded, wilds, depth) {
  if (depth > 40) return false;
  if (meldsNeeded === 0 && wilds === 0) return true;
  if (meldsNeeded === 0) return wilds % 3 === 0;

  var totalTiles = 0;
  for (var tk in counts) { if (counts.hasOwnProperty(tk)) totalTiles += counts[tk]; }
  if (totalTiles + wilds < meldsNeeded * 3) return false;

  var tileKeys = [];
  for (var kk in counts) { if (counts.hasOwnProperty(kk)) tileKeys.push(Number(kk)); }
  tileKeys.sort(function (a, b) { return a - b; });

  if (tileKeys.length === 0) return wilds >= meldsNeeded * 3;

  var firstTile = tileKeys[0];
  var cnt = counts[firstTile];

  // --- 刻子 ---
  if (cnt >= 3) {
    var nc = cloneCounts(counts);
    nc[firstTile] -= 3;
    if (nc[firstTile] === 0) delete nc[firstTile];
    if (_canFormMelds(nc, meldsNeeded - 1, wilds, depth + 1)) return true;
  }
  if (cnt >= 2 && wilds >= 1) {
    var nc2 = cloneCounts(counts);
    nc2[firstTile] -= 2;
    if (nc2[firstTile] === 0) delete nc2[firstTile];
    if (_canFormMelds(nc2, meldsNeeded - 1, wilds - 1, depth + 1)) return true;
  }
  if (cnt >= 1 && wilds >= 2) {
    var nc3 = cloneCounts(counts);
    nc3[firstTile] -= 1;
    if (nc3[firstTile] === 0) delete nc3[firstTile];
    if (_canFormMelds(nc3, meldsNeeded - 1, wilds - 2, depth + 1)) return true;
  }

  // --- 顺子（仅数牌） ---
  if (isNumberTile(firstTile)) {
    var s = suitOf(firstTile);
    var r = rankOf(firstTile);
    if (r <= 7) {
      var t2 = s + (r + 1), t3 = s + (r + 2);
      var c2 = counts[t2] || 0, c3 = counts[t3] || 0;
      // 完整顺子
      if (c2 > 0 && c3 > 0) {
        var ncs = cloneCounts(counts);
        ncs[firstTile]--; if (ncs[firstTile] === 0) delete ncs[firstTile];
        ncs[t2]--; if (ncs[t2] === 0) delete ncs[t2];
        ncs[t3]--; if (ncs[t3] === 0) delete ncs[t3];
        if (_canFormMelds(ncs, meldsNeeded - 1, wilds, depth + 1)) return true;
      }
      // 缺一张，红中补
      if (c2 > 0 && wilds >= 1 && c3 === 0) {
        var nc4 = cloneCounts(counts);
        nc4[firstTile]--; if (nc4[firstTile] === 0) delete nc4[firstTile];
        nc4[t2]--; if (nc4[t2] === 0) delete nc4[t2];
        if (_canFormMelds(nc4, meldsNeeded - 1, wilds - 1, depth + 1)) return true;
      }
      if (c3 > 0 && wilds >= 1 && c2 === 0) {
        var nc5 = cloneCounts(counts);
        nc5[firstTile]--; if (nc5[firstTile] === 0) delete nc5[firstTile];
        nc5[t3]--; if (nc5[t3] === 0) delete nc5[t3];
        if (_canFormMelds(nc5, meldsNeeded - 1, wilds - 1, depth + 1)) return true;
      }
      // 只有首张，两红中补
      if (wilds >= 2 && c2 === 0 && c3 === 0) {
        var nc6 = cloneCounts(counts);
        nc6[firstTile]--; if (nc6[firstTile] === 0) delete nc6[firstTile];
        if (_canFormMelds(nc6, meldsNeeded - 1, wilds - 2, depth + 1)) return true;
      }
    }
  }

  // --- 3红中做刻子 ---
  if (wilds >= 3) {
    if (_canFormMelds(cloneCounts(counts), meldsNeeded - 1, wilds - 3, depth + 1)) return true;
  }

  return false;
}

// ============================================================
//  向听数计算（贪心估算，零深度递归）
// ============================================================

/**
 * 贪心估算向听数。
 * -1 = 已胡, 0 = 听牌, 1+ = 还差
 * 使用固定公式: shanten = 8 - 2×面子 - 搭子 - (有将?1:0)
 */
function estimateShanten(hand) {
  if (hand.length === 0) return -1;

  var hz = countHongZhong(hand);
  var tiles = nonHongZhong(hand);
  var counts = handToCounts(tiles);
  var keys = [];
  for (var k in counts) { if (counts.hasOwnProperty(k)) keys.push(Number(k)); }

  // 全红中手牌
  if (keys.length === 0) {
    return Math.max(-1, 8 - 2 * Math.floor(hz / 3) - (hz % 3 >= 2 ? 1 : 0));
  }

  var used = {};  // 已分配到面子的牌数
  var melds = 0;
  var partials = 0;
  var hasPair = false;

  // ---- 第1轮: 刻子 ----
  for (var i = 0; i < keys.length; i++) {
    var t = keys[i];
    var c = counts[t] - (used[t] || 0);
    while (c >= 3 && melds + partials < 4) {
      used[t] = (used[t] || 0) + 3;
      melds++;
      c -= 3;
    }
  }

  // ---- 第2轮: 顺子 ----
  for (var si = 0; si < ALL_SUITS.length; si++) {
    var s = ALL_SUITS[si];
    for (var r = 1; r <= 7; r++) {
      var a = s + r, b = s + r + 1, c2 = s + r + 2;
      var ca = (counts[a] || 0) - (used[a] || 0);
      var cb = (counts[b] || 0) - (used[b] || 0);
      var cc = (counts[c2] || 0) - (used[c2] || 0);
      while (ca > 0 && cb > 0 && cc > 0 && melds + partials < 4) {
        used[a] = (used[a] || 0) + 1;
        used[b] = (used[b] || 0) + 1;
        used[c2] = (used[c2] || 0) + 1;
        melds++;
        ca--; cb--; cc--;
      }
    }
  }

  // ---- 第3轮: 红中补面子 ----
  var hzLeft = hz;
  // 2同牌 + 1红中 → 刻子
  for (var pi = 0; pi < keys.length && hzLeft > 0; pi++) {
    var pk = keys[pi];
    var rem = (counts[pk] || 0) - (used[pk] || 0);
    if (rem >= 2 && melds + partials < 4) {
      used[pk] = (used[pk] || 0) + 2;
      hzLeft--;
      melds++;
    }
  }
  // 2连/间隔数牌 + 1红中 → 顺子
  for (var si2 = 0; si2 < ALL_SUITS.length && hzLeft > 0; si2++) {
    var ss = ALL_SUITS[si2];
    for (var rr = 1; rr <= 7 && hzLeft > 0; rr++) {
      var ta = ss + rr, tb = ss + rr + 1, tc = ss + rr + 2;
      var ra = (counts[ta] || 0) - (used[ta] || 0);
      var rb = (counts[tb] || 0) - (used[tb] || 0);
      var rc = (counts[tc] || 0) - (used[tc] || 0);
      if (ra > 0 && rb > 0 && rc === 0) {
        used[ta] = (used[ta] || 0) + 1; used[tb] = (used[tb] || 0) + 1;
        hzLeft--; melds++;
      } else if (ra > 0 && rb === 0 && rc > 0) {
        used[ta] = (used[ta] || 0) + 1; used[tc] = (used[tc] || 0) + 1;
        hzLeft--; melds++;
      } else if (ra === 0 && rb > 0 && rc > 0) {
        used[tb] = (used[tb] || 0) + 1; used[tc] = (used[tc] || 0) + 1;
        hzLeft--; melds++;
      }
    }
  }
  // 1牌 + 2红中 → 顺子
  for (var si3 = 0; si3 < ALL_SUITS.length && hzLeft >= 2; si3++) {
    var s3 = ALL_SUITS[si3];
    for (var rr3 = 1; rr3 <= 9 && hzLeft >= 2; rr3++) {
      var tt = s3 + rr3;
      var rt = (counts[tt] || 0) - (used[tt] || 0);
      if (rt > 0 && melds + partials < 4) {
        used[tt] = (used[tt] || 0) + 1;
        hzLeft -= 2;
        melds++;
      }
    }
  }
  // 3红中 → 刻子
  while (hzLeft >= 3 && melds + partials < 4) {
    hzLeft -= 3;
    melds++;
  }

  // ---- 第4轮: 找对子 ----
  for (var hi = 0; hi < keys.length; hi++) {
    var ht = keys[hi];
    var hrem = (counts[ht] || 0) - (used[ht] || 0);
    if (hrem >= 2) { hasPair = true; break; }
  }
  if (!hasPair && hzLeft >= 2) hasPair = true;
  if (!hasPair && hzLeft >= 1) {
    for (var gi = 0; gi < keys.length; gi++) {
      if ((counts[keys[gi]] || 0) - (used[keys[gi]] || 0) >= 1) { hasPair = true; break; }
    }
  }

  // ---- 第5轮: 找搭子 ----
  var usedForPartial = {};
  for (var pi2 = 0; pi2 < keys.length; pi2++) {
    var pt = keys[pi2];
    if (!isNumberTile(pt)) continue;
    var ps = suitOf(pt), pr = rankOf(pt);
    var pRem = (counts[pt] || 0) - (used[pt] || 0) - (usedForPartial[pt] || 0);
    if (pRem <= 0) continue;
    // 相邻搭子
    if (pr <= 8) {
      var next = ps + pr + 1;
      var nRem = (counts[next] || 0) - (used[next] || 0) - (usedForPartial[next] || 0);
      if (nRem > 0 && melds + partials < 4) {
        partials++;
        usedForPartial[pt] = (usedForPartial[pt] || 0) + 1;
        usedForPartial[next] = (usedForPartial[next] || 0) + 1;
        continue;
      }
    }
    // 隔一搭子
    if (pr <= 7) {
      var skip = ps + pr + 2;
      var sRem = (counts[skip] || 0) - (used[skip] || 0) - (usedForPartial[skip] || 0);
      if (sRem > 0 && melds + partials < 4) {
        partials++;
        usedForPartial[pt] = (usedForPartial[pt] || 0) + 1;
        usedForPartial[skip] = (usedForPartial[skip] || 0) + 1;
      }
    }
  }
  // 红中 + 1牌 → 搭子
  if (hzLeft >= 1 && melds + partials < 4) {
    for (var wi = 0; wi < keys.length; wi++) {
      var wt = keys[wi];
      if (!isNumberTile(wt)) continue;
      var wRem = (counts[wt] || 0) - (used[wt] || 0) - (usedForPartial[wt] || 0);
      if (wRem > 0) {
        partials++;
        hzLeft--;
        break;
      }
    }
  }

  return Math.max(-1, 8 - 2 * melds - (hasPair ? 1 : 0) - partials);
}

var calcShanten = estimateShanten;

// ============================================================
//  进张(ukeire)计算
// ============================================================

/**
 * 计算打出某张牌后，剩余手牌的进张数。
 * 进张 = 还有哪些牌摸进来能减少向听数或接近胡牌。
 * 为了性能，只在向听数<=2时精确计算，否则用快速估算。
 */
function countUkeire(hand) {
  var currentShanten = estimateShanten(hand);
  if (currentShanten <= -1) return 0;

  var hz = countHongZhong(hand);
  var tiles = nonHongZhong(hand);
  var counts = handToCounts(tiles);
  var totalUkeire = 0;
  var checked = {};

  // 检查所有数牌
  for (var si = 0; si < ALL_SUITS.length; si++) {
    var s = ALL_SUITS[si];
    for (var r = 1; r <= 9; r++) {
      var t = s + r;
      if (checked[t]) continue;
      checked[t] = true;
      if ((counts[t] || 0) >= 4) continue; // 已经4张了
      var newHand = hand.concat([t]);
      var newShanten = estimateShanten(newHand);
      if (newShanten < currentShanten) {
        totalUkeire += 4 - (counts[t] || 0);
      }
    }
  }

  // 红中进张
  if (hz < 4) {
    var newHandHz = hand.concat([HONG_ZHONG]);
    var newShHz = estimateShanten(newHandHz);
    if (newShHz < currentShanten) {
      totalUkeire += 4 - hz;
    }
  }

  return totalUkeire;
}

/**
 * 快速进张估算（不精确计算每张牌摸进来后的向听数，
 * 而是基于手牌结构估算潜在有用的牌数）
 */
function countWaitsFast(hand) {
  var hz = countHongZhong(hand);
  var tiles = nonHongZhong(hand);
  var counts = handToCounts(tiles);
  var usefulSet = {};

  for (var i = 0; i < tiles.length; i++) {
    var tile = tiles[i];
    var s = suitOf(tile), r = rankOf(tile);

    if (isNumberTile(tile)) {
      // 相邻 ±1, ±2 的牌都有可能有用
      for (var dr = -2; dr <= 2; dr++) {
        if (dr === 0) continue;
        var nr = r + dr;
        if (nr >= 1 && nr <= 9) {
          var nt = s + nr;
          if ((counts[nt] || 0) < 4) usefulSet[nt] = true;
        }
      }
    }
    // 同牌（凑刻子/对子）
    if ((counts[tile] || 0) < 4) usefulSet[tile] = true;
  }

  var total = 0;
  for (var uk in usefulSet) {
    if (usefulSet.hasOwnProperty(uk)) {
      total += 4 - (counts[Number(uk)] || 0);
    }
  }
  // 红中也是有用进张
  if (hz < 4) total += 4 - hz;

  return total;
}

// ============================================================
//  牌价值评估
// ============================================================

/**
 * 评估 hand 中某张 tile 的价值。价值越高 = 越不想打出。
 * 红中永远返回 9999（不打）。
 *
 * 评估维度：
 *   - 对子/刻子贡献
 *   - 顺子/搭子贡献
 *   - 孤立度惩罚
 *   - 位置偏移（中张>边张）
 */
function tileValue(hand, tile) {
  if (tile === HONG_ZHONG) return 9999;

  var counts = handToCounts(hand);
  var cnt = counts[tile] || 0;
  var value = 0;

  // 重复张价值
  if (cnt >= 3) value += 10;
  else if (cnt >= 2) value += 6;

  if (!isNumberTile(tile)) return value;

  var s = suitOf(tile);
  var r = rankOf(tile);

  // 相邻牌 +4 每个（搭子贡献）
  var adjL = (r >= 2) ? (counts[s + (r - 1)] || 0) : 0;
  var adjR = (r <= 8) ? (counts[s + (r + 1)] || 0) : 0;
  value += adjL * 4 + adjR * 4;

  // 隔一张（卡张搭子）+2
  if (r >= 3) value += (counts[s + (r - 2)] || 0) * 2;
  if (r <= 7) value += (counts[s + (r + 2)] || 0) * 2;

  // 完成顺子 +6
  if (r >= 3 && counts[s + (r - 2)] && counts[s + (r - 1)]) value += 6;
  if (r >= 2 && r <= 8 && counts[s + (r - 1)] && counts[s + (r + 1)]) value += 6;
  if (r <= 7 && counts[s + (r + 1)] && counts[s + (r + 2)]) value += 6;

  // 中张加成（3-7 比边张更有用）
  if (r >= 3 && r <= 7) value += 1;
  // 边张惩罚（1, 9 孤立时更易打出）
  if ((r === 1 || r === 9) && cnt === 1 && adjL === 0 && adjR === 0) value -= 2;

  return value;
}

/**
 * 综合评分：打掉 tile 后手牌的整体质量。
 * 返回分数越高 = 打这张越好。
 */
function discardScore(hand, tile, difficulty) {
  var remaining = removeTile(hand, tile);
  var shanten = estimateShanten(remaining);

  if (difficulty === 'hard') {
    // hard 模式用精确 ukeire
    var ukeire = countUkeire(remaining);
    // 向听数低 + 进张多 = 好
    return -shanten * 100 + ukeire;
  }

  // medium 模式用快速估算
  var waits = countWaitsFast(remaining);
  return -shanten * 80 + waits;
}

// ============================================================
//  找孤张（Easy AI）
// ============================================================

function findIsolatedTiles(hand) {
  var isolated = [];
  var seen = {};
  var counts = handToCounts(hand);

  for (var i = 0; i < hand.length; i++) {
    var tile = hand[i];
    if (tile === HONG_ZHONG) continue;
    if (seen[tile]) continue;
    seen[tile] = true;

    var s = suitOf(tile), r = rankOf(tile);
    var related = false;

    // 有对子或以上
    if (counts[tile] >= 2) related = true;

    // 有相邻/隔一牌
    if (!related && isNumberTile(tile)) {
      for (var dr = -2; dr <= 2; dr++) {
        if (dr === 0) continue;
        var nr = r + dr;
        if (nr >= 1 && nr <= 9 && (counts[s + nr] || 0) > 0) { related = true; break; }
      }
    }

    if (!related) isolated.push(tile);
  }
  return isolated;
}

// ============================================================
//  找边张（rank 1 或 9，Easy AI 备选）
// ============================================================

function findEdgeTiles(hand) {
  var edges = [];
  var seen = {};
  for (var i = 0; i < hand.length; i++) {
    var tile = hand[i];
    if (tile === HONG_ZHONG) continue;
    if (seen[tile]) continue;
    seen[tile] = true;
    if (isNumberTile(tile)) {
      var r = rankOf(tile);
      if (r === 1 || r === 9) edges.push(tile);
    }
  }
  return edges;
}

// ============================================================
//  AI 出牌决策（核心函数）
// ============================================================

/**
 * getAIDecision(hand, difficulty) → 牌值(不是索引)
 * 永远不返回红中(0x41)。
 */
function getAIDecision(hand, difficulty) {
  if (!hand || hand.length === 0) return null;

  var playable = getPlayableTiles(hand);
  if (playable.length === 0) return null;

  // ========== Easy ==========
  if (difficulty === 'easy') {
    // 30% 概率犯错：直接随机打
    if (Math.random() < 0.3) {
      return playable[Math.floor(Math.random() * playable.length)];
    }
    // 孤张
    var iso = findIsolatedTiles(hand);
    if (iso.length > 0) {
      return iso[Math.floor(Math.random() * iso.length)];
    }
    // 边张
    var edges = findEdgeTiles(hand);
    if (edges.length > 0) {
      return edges[Math.floor(Math.random() * edges.length)];
    }
    // 随机
    return playable[Math.floor(Math.random() * playable.length)];
  }

  // ========== Medium ==========
  if (difficulty === 'medium') {
    var bestTile = playable[0];
    var bestVal = Infinity;
    for (var i = 0; i < playable.length; i++) {
      var v = tileValue(hand, playable[i]);
      if (v < bestVal) { bestVal = v; bestTile = playable[i]; }
    }
    // 10% 概率随机（不完美）
    if (Math.random() < 0.1 && playable.length > 1) {
      return playable[Math.floor(Math.random() * playable.length)];
    }
    return bestTile;
  }

  // ========== Hard ==========
  // 向听数 + 进张数联合优化
  var bestTileH = playable[0];
  var bestScoreH = -Infinity;

  for (var j = 0; j < playable.length; j++) {
    var th = playable[j];
    var score = discardScore(hand, th, 'hard');
    // 额外：如果手牌中有多张该牌，稍微倾向保留（有更好的结构）
    var cnt = 0;
    for (var c = 0; c < hand.length; c++) { if (hand[c] === th) cnt++; }
    if (cnt >= 2) score -= 2; // 微调，倾向拆散孤张

    if (score > bestScoreH) {
      bestScoreH = score;
      bestTileH = th;
    }
  }
  return bestTileH;
}

// ============================================================
//  AI 碰决策
// ============================================================

/**
 * shouldPeng(hand, tile, difficulty) → boolean
 */
function shouldPeng(hand, tile, difficulty) {
  // 前置：手牌中要有至少2张该牌
  var pairCount = 0;
  for (var i = 0; i < hand.length; i++) {
    if (hand[i] === tile) pairCount++;
  }
  if (pairCount < 2) return false;

  // ========== Easy ==========
  if (difficulty === 'easy') {
    return Math.random() < 0.55;
  }

  // ========== Medium / Hard ==========
  var after = removeTiles(hand, [tile, tile]);
  var shBefore = estimateShanten(hand);
  var shAfter = estimateShanten(after);

  if (difficulty === 'hard') {
    if (shAfter < shBefore) return true;
    if (shAfter === shBefore) {
      // 向听数不变，比较进张数
      var wBefore = countWaitsFast(hand);
      var wAfter = countWaitsFast(after);
      return wAfter >= wBefore;
    }
    // 向听数增加，不碰
    // 特殊情况：如果已经是听牌(0)，碰后变1，坚决不碰
    if (shBefore <= 0) return false;
    return false;
  }

  // Medium: 向听数减少才碰
  return shAfter < shBefore;
}

// ============================================================
//  AI 胡牌决策
// ============================================================

/**
 * shouldHu(hand, tile) → boolean
 * 能胡就胡。
 */
function shouldHu(hand, tile) {
  return true;
}

// ============================================================
//  AI 杠决策
// ============================================================

/**
 * shouldGang(hand, tile, gangType, difficulty) → boolean
 * gangType: 'an_gang' | 'bu_gang' | 'ming_gang'
 */
function shouldGang(hand, tile, gangType, difficulty) {
  // 暗杠、补杠：100% 执行
  if (gangType === 'an_gang' || gangType === 'bu_gang') {
    return true;
  }

  // 明杠：评估后决定
  if (difficulty === 'easy') {
    // Easy 直接杠
    return true;
  }

  // Medium / Hard：评估杠后的向听数变化
  var after = removeTiles(hand, [tile, tile, tile]);
  var shBefore = estimateShanten(hand);
  var shAfter = estimateShanten(after);

  if (difficulty === 'hard') {
    // 如果已听牌，杠了会破坏听牌，不杠
    if (shBefore <= 0 && shAfter > shBefore) return false;
    // 向听数不增加才杠
    if (shAfter <= shBefore) return true;
    return false;
  }

  // Medium: 向听数减少或不变才杠
  return shAfter <= shBefore;
}

// ============================================================
//  AI 延迟（模拟思考时间）
// ============================================================

function getAIDelay(difficulty) {
  if (difficulty === 'easy') return 300 + Math.random() * 400;
  if (difficulty === 'hard') return 600 + Math.random() * 800;
  return 400 + Math.random() * 600;
}

// ============================================================
//  导出
// ============================================================

var exports = {
  // 核心 API
  getAIDecision:  getAIDecision,
  shouldPeng:     shouldPeng,
  shouldHu:       shouldHu,
  shouldGang:     shouldGang,
  getAIDelay:     getAIDelay,

  // 胡牌检测
  canWin:         canWin,
  calcShanten:    estimateShanten,
  countWaits:     countWaitsFast,

  // 工具函数
  handToCounts:   handToCounts,
  sortHand:       sortHand,
  removeTile:     removeTile,
  countHongZhong: countHongZhong,
  nonHongZhong:   nonHongZhong,
  findIsolatedTiles: findIsolatedTiles,

  // 常量
  HONG_ZHONG:  HONG_ZHONG,
  SUIT_WAN:    SUIT_WAN,
  SUIT_TIAO:   SUIT_TIAO,
  SUIT_TONG:   SUIT_TONG,
  SUIT_ZI:     SUIT_ZI,
  TILE_NAMES:  TILE_NAMES
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = exports;
} else {
  root.AIModule = exports;
}

})(typeof window !== 'undefined' ? window : globalThis);
