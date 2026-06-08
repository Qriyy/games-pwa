/**
 * 红中麻将 AI 模块（重写版）
 * 全部使用贪心估算，零深度递归，手机端也能瞬间响应
 *
 * 牌面编码：
 *   万=0x10+rank  条=0x20+rank  筒=0x30+rank
 *   红中=0x41 (万能牌/癞子)
 */

// ============================================================
//  常量
// ============================================================

const SUIT_WAN  = 0x10;
const SUIT_TIAO = 0x20;
const SUIT_TONG = 0x30;
const SUIT_ZI   = 0x40;
const HONG_ZHONG = 0x41;

const ALL_SUITS = [SUIT_WAN, SUIT_TIAO, SUIT_TONG];

const TILE_NAMES = {
  0x11:'一万',0x12:'二万',0x13:'三万',0x14:'四万',0x15:'五万',
  0x16:'六万',0x17:'七万',0x18:'八万',0x19:'九万',
  0x21:'一条',0x22:'二条',0x23:'三条',0x24:'四条',0x25:'五条',
  0x26:'六条',0x27:'七条',0x28:'八条',0x29:'九条',
  0x31:'一筒',0x32:'二筒',0x33:'三筒',0x34:'四筒',0x35:'五筒',
  0x36:'六筒',0x37:'七筒',0x38:'八筒',0x39:'九筒',
  0x41:'红中'
};

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

function handToCounts(hand) {
  var counts = {};
  for (var i = 0; i < hand.length; i++) {
    var t = hand[i];
    counts[t] = (counts[t] || 0) + 1;
  }
  return counts;
}

function sortHand(hand) {
  return hand.slice().sort(function(a, b) { return a - b; });
}

function removeTile(hand, tile) {
  var idx = hand.indexOf(tile);
  if (idx === -1) return hand.slice();
  var copy = hand.slice();
  copy.splice(idx, 1);
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

/** 获取手牌中所有可以打出的非红中牌（去重） */
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

// ============================================================
//  胡牌检测（递归但有深度限制，仅用于最终判定）
// ============================================================

function canWin(hand, exposedMeldCount) {
  if (exposedMeldCount === undefined) exposedMeldCount = 0;
  if (hand.length + exposedMeldCount * 3 !== 14) return false;

  var hzCount = countHongZhong(hand);
  var tiles = nonHongZhong(hand);
  var counts = handToCounts(tiles);
  var meldsNeeded = 4 - exposedMeldCount;

  var uniqueTiles = Object.keys(counts).map(Number);

  // 情况1：将由两张普通牌组成
  for (var idx = 0; idx < uniqueTiles.length; idx++) {
    var pairTile = uniqueTiles[idx];
    if (counts[pairTile] >= 2) {
      var nc = {};
      for (var k in counts) nc[k] = counts[k];
      nc[pairTile] -= 2;
      if (nc[pairTile] === 0) delete nc[pairTile];
      if (canFormMelds(nc, meldsNeeded, hzCount)) return true;
    }
  }

  // 情况2：将由1张普通牌+1张红中组成
  if (hzCount >= 1) {
    for (var idx2 = 0; idx2 < uniqueTiles.length; idx2++) {
      var pt2 = uniqueTiles[idx2];
      var nc2 = {};
      for (var k2 in counts) nc2[k2] = counts[k2];
      nc2[pt2] -= 1;
      if (nc2[pt2] === 0) delete nc2[pt2];
      if (canFormMelds(nc2, meldsNeeded, hzCount - 1)) return true;
    }
  }

  // 情况3：将由2张红中组成
  if (hzCount >= 2) {
    var nc3 = {};
    for (var k3 in counts) nc3[k3] = counts[k3];
    if (canFormMelds(nc3, meldsNeeded, hzCount - 2)) return true;
  }

  return false;
}

/** 递归检测能否组成指定数量的面子（有深度限制） */
function canFormMelds(counts, meldsNeeded, wilds, depth) {
  if (depth === undefined) depth = 0;
  if (depth > 30) return false; // 安全限制
  if (meldsNeeded === 0 && wilds === 0) return true;
  if (meldsNeeded === 0) return wilds % 3 === 0;

  var totalTiles = 0;
  for (var tk in counts) totalTiles += counts[tk];
  if (totalTiles + wilds < meldsNeeded * 3) return false;

  var tileKeys = Object.keys(counts).map(Number).sort(function(a,b){ return a - b; });
  if (tileKeys.length === 0) return wilds >= meldsNeeded * 3;

  var firstTile = tileKeys[0];
  var cnt = counts[firstTile];

  // 刻子：3张相同
  if (cnt >= 3) {
    var nc = {}; for (var k in counts) nc[k] = counts[k];
    nc[firstTile] -= 3;
    if (nc[firstTile] === 0) delete nc[firstTile];
    if (canFormMelds(nc, meldsNeeded - 1, wilds, depth + 1)) return true;
  }
  if (cnt >= 2 && wilds >= 1) {
    var nc2 = {}; for (var k2 in counts) nc2[k2] = counts[k2];
    nc2[firstTile] -= 2;
    if (nc2[firstTile] === 0) delete nc2[firstTile];
    if (canFormMelds(nc2, meldsNeeded - 1, wilds - 1, depth + 1)) return true;
  }
  if (cnt >= 1 && wilds >= 2) {
    var nc3 = {}; for (var k3 in counts) nc3[k3] = counts[k3];
    nc3[firstTile] -= 1;
    if (nc3[firstTile] === 0) delete nc3[firstTile];
    if (canFormMelds(nc3, meldsNeeded - 1, wilds - 2, depth + 1)) return true;
  }

  // 顺子：连续三张数牌
  if (isNumberTile(firstTile)) {
    var s = suitOf(firstTile);
    var r = rankOf(firstTile);
    if (r <= 7) {
      var t2 = s + (r + 1), t3 = s + (r + 2);
      if (counts[t2] > 0 && counts[t3] > 0) {
        var ncs = {}; for (var ks in counts) ncs[ks] = counts[ks];
        ncs[firstTile]--; if (ncs[firstTile] === 0) delete ncs[firstTile];
        ncs[t2]--; if (ncs[t2] === 0) delete ncs[t2];
        ncs[t3]--; if (ncs[t3] === 0) delete ncs[t3];
        if (canFormMelds(ncs, meldsNeeded - 1, wilds, depth + 1)) return true;
      }
      // 红中补缺
      if (counts[t2] > 0 && wilds >= 1 && (!counts[t3] || counts[t3] === 0)) {
        var nc4 = {}; for (var k4 in counts) nc4[k4] = counts[k4];
        nc4[firstTile]--; if (nc4[firstTile] === 0) delete nc4[firstTile];
        nc4[t2]--; if (nc4[t2] === 0) delete nc4[t2];
        if (canFormMelds(nc4, meldsNeeded - 1, wilds - 1, depth + 1)) return true;
      }
      if (counts[t3] > 0 && wilds >= 1 && (!counts[t2] || counts[t2] === 0)) {
        var nc5 = {}; for (var k5 in counts) nc5[k5] = counts[k5];
        nc5[firstTile]--; if (nc5[firstTile] === 0) delete nc5[firstTile];
        nc5[t3]--; if (nc5[t3] === 0) delete nc5[t3];
        if (canFormMelds(nc5, meldsNeeded - 1, wilds - 1, depth + 1)) return true;
      }
      if (wilds >= 2) {
        var nc6 = {}; for (var k6 in counts) nc6[k6] = counts[k6];
        nc6[firstTile]--; if (nc6[firstTile] === 0) delete nc6[firstTile];
        if (canFormMelds(nc6, meldsNeeded - 1, wilds - 2, depth + 1)) return true;
      }
    }
  }

  // 3张红中做刻子
  if (wilds >= 3) {
    if (canFormMelds({ }, meldsNeeded - 1, wilds - 3, depth + 1)) return true;
    // 重新构建空对象
    var nc7 = {}; for (var k7 in counts) nc7[k7] = counts[k7];
    if (canFormMelds(nc7, meldsNeeded - 1, wilds - 3, depth + 1)) return true;
  }

  return false;
}

// ============================================================
//  贪心向听数估算（零递归，瞬间完成）
// ============================================================

/**
 * 贪心估算向听数，完全无递归
 * -1 = 已胡, 0 = 听牌, 1+ = 还差
 */
function estimateShanten(hand) {
  if (hand.length === 0) return -1;

  var hz = countHongZhong(hand);
  var tiles = nonHongZhong(hand);
  var counts = handToCounts(tiles);

  // 贪心：先取刻子，再取顺子
  var melds = 0;
  var used = {};

  // 第一轮：找刻子
  var keys = Object.keys(counts).map(Number);
  for (var i = 0; i < keys.length; i++) {
    var tile = keys[i];
    while ((counts[tile] - (used[tile] || 0)) >= 3) {
      used[tile] = (used[tile] || 0) + 3;
      melds++;
    }
  }

  // 第二轮：找顺子
  for (var si = 0; si < ALL_SUITS.length; si++) {
    var s = ALL_SUITS[si];
    for (var r = 1; r <= 7; r++) {
      var t1 = s + r, t2 = s + r + 1, t3 = s + r + 2;
      var c1 = (counts[t1] || 0) - (used[t1] || 0);
      var c2 = (counts[t2] || 0) - (used[t2] || 0);
      var c3 = (counts[t3] || 0) - (used[t3] || 0);
      while (c1 > 0 && c2 > 0 && c3 > 0) {
        used[t1] = (used[t1] || 0) + 1;
        used[t2] = (used[t2] || 0) + 1;
        used[t3] = (used[t3] || 0) + 1;
        melds++;
        c1--; c2--; c3--;
      }
    }
  }

  // 第三轮：红中补面子（1-2张牌 + 红中组成刻子/顺子）
  var hzLeft = hz;
  // 补刻子：2张相同 + 1红中
  for (var pi = 0; pi < keys.length && hzLeft > 0; pi++) {
    var pk = keys[pi];
    var rem = (counts[pk] || 0) - (used[pk] || 0);
    if (rem >= 2) { used[pk] = (used[pk] || 0) + 2; hzLeft--; melds++; }
  }
  // 补顺子
  for (var si2 = 0; si2 < ALL_SUITS.length && hzLeft > 0; si2++) {
    var ss = ALL_SUITS[si2];
    for (var rr = 1; rr <= 7 && hzLeft > 0; rr++) {
      var a = ss + rr, b = ss + rr + 1, c = ss + rr + 2;
      var ca = (counts[a] || 0) - (used[a] || 0);
      var cb = (counts[b] || 0) - (used[b] || 0);
      var cc = (counts[c] || 0) - (used[c] || 0);
      // 缺1张
      if (ca > 0 && cb > 0 && cc === 0 && hzLeft > 0) {
        used[a] = (used[a] || 0) + 1; used[b] = (used[b] || 0) + 1;
        hzLeft--; melds++;
      } else if (ca > 0 && cb === 0 && cc > 0 && hzLeft > 0) {
        used[a] = (used[a] || 0) + 1; used[c] = (used[c] || 0) + 1;
        hzLeft--; melds++;
      } else if (ca === 0 && cb > 0 && cc > 0 && hzLeft > 0) {
        used[b] = (used[b] || 0) + 1; used[c] = (used[c] || 0) + 1;
        hzLeft--; melds++;
      }
    }
  }

  // 找对子（优先级最高，因为需要1对才能胡）
  var hasPair = false;
  // 普通对子
  for (var hi = 0; hi < keys.length; hi++) {
    var ht = keys[hi];
    var hrem = (counts[ht] || 0) - (used[ht] || 0);
    if (hrem >= 2) { hasPair = true; break; }
  }
  // 红中做对
  if (!hasPair && hzLeft >= 2) hasPair = true;
  if (!hasPair && hzLeft >= 1) {
    // 1张剩余牌 + 1红中做对
    for (var gi = 0; gi < keys.length; gi++) {
      var gt = keys[gi];
      if ((counts[gt] || 0) - (used[gt] || 0) >= 1) { hasPair = true; break; }
    }
  }

  // 找搭子（两张相邻/隔一的数牌）
  var partials = 0;
  var usedForPartial = {};
  for (var pi2 = 0; pi2 < keys.length; pi2++) {
    var pt = keys[pi2];
    if (!isNumberTile(pt)) continue;
    var ps = suitOf(pt), pr = rankOf(pt);
    var pRem = (counts[pt] || 0) - (used[pt] || 0) - (usedForPartial[pt] || 0);
    if (pRem <= 0) continue;

    // 相邻搭子 (r, r+1)
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
    // 隔一搭子 (r, r+2)
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

  // 红中做搭子
  if (hzLeft >= 1 && melds + partials < 4) {
    for (var wi = 0; wi < keys.length && hzLeft > 0 && melds + partials < 4; wi++) {
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

  // 全红中特殊处理
  if (tiles.length === 0) {
    var extraMelds = Math.floor(hz / 3);
    var remain = hz % 3;
    return Math.max(-1, 8 - 2 * extraMelds - (remain >= 2 ? 1 : 0) - (remain === 1 ? 1 : 0));
  }

  return Math.max(-1, 8 - 2 * melds - (hasPair ? 1 : 0) - partials);
}

// 保持原有 API 名称
var calcShanten = estimateShanten;

// ============================================================
//  快速进张估算（仅检查手牌相关花色，不穷举全部 112 张）
// ============================================================

function countWaitsFast(hand) {
  var waits = 0;
  var hz = countHongZhong(hand);
  var tiles = nonHongZhong(hand);
  var counts = handToCounts(tiles);
  var checked = {};

  for (var i = 0; i < tiles.length; i++) {
    var tile = tiles[i];
    if (checked[tile]) continue;
    checked[tile] = true;

    var s = suitOf(tile), r = rankOf(tile);

    // 检查相邻牌是否能让手牌进步
    if (isNumberTile(tile)) {
      for (var dr = -2; dr <= 2; dr++) {
        if (dr === 0) continue;
        var nr = r + dr;
        if (nr >= 1 && nr <= 9) {
          var nt = s + nr;
          if (!checked[nt]) { checked[nt] = true; waits++; }
        }
      }
    }
    // 同牌
    if (counts[tile] < 4) waits++;
  }

  // 红中也是有效进张
  if (hz < 4) waits++;

  return waits;
}

// ============================================================
//  评估单张牌的价值（用于 Medium / Hard AI）
// ============================================================

/**
 * 评估手牌中某张牌的价值。价值越高 = 越不想打出。
 * 不考虑红中（红中永远不打）。
 */
function tileValue(hand, tile) {
  if (tile === HONG_ZHONG) return 9999;

  var counts = handToCounts(hand);
  var cnt = counts[tile] || 0;
  var value = 0;

  // 对子/刻子价值
  if (cnt >= 3) value += 8;
  else if (cnt >= 2) value += 5;

  if (isNumberTile(tile)) {
    var s = suitOf(tile);
    var r = rankOf(tile);

    // 相邻牌 +3 每个
    if (r >= 2 && counts[s + (r - 1)]) value += 3;
    if (r <= 8 && counts[s + (r + 1)]) value += 3;

    // 顺子完成 +5（检查是否能和两边组成顺子）
    // r-2, r-1, r
    if (r >= 3 && counts[s + (r - 2)] && counts[s + (r - 1)]) value += 5;
    // r-1, r, r+1
    if (r >= 2 && r <= 8 && counts[s + (r - 1)] && counts[s + (r + 1)]) value += 5;
    // r, r+1, r+2
    if (r <= 7 && counts[s + (r + 1)] && counts[s + (r + 2)]) value += 5;

    // 边张（1或9）价值稍低，更容易被打出
    if (r === 1 || r === 9) value -= 1;
  }

  return value;
}

// ============================================================
//  找孤张（Easy AI 专用）
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

    // 有相邻牌
    if (!related && isNumberTile(tile)) {
      for (var dr = -2; dr <= 2; dr++) {
        if (dr === 0) continue;
        var nr = r + dr;
        if (nr >= 1 && nr <= 9 && counts[s + nr] > 0) { related = true; break; }
      }
    }

    if (!related) isolated.push(tile);
  }
  return isolated;
}

// ============================================================
//  找边张（rank 1 或 9 的非红中牌，Easy AI 备选）
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
//  出牌候选评分（纯贪心，无递归）
// ============================================================

function evaluateDiscardFast(hand, candidate) {
  var remaining = removeTile(hand, candidate);
  var shanten = estimateShanten(remaining);
  var waits = countWaitsFast(remaining);
  var score = waits * 10 - shanten * 50;
  if (candidate === HONG_ZHONG) score -= 80;
  return score;
}

// ============================================================
//  AI 出牌决策（核心函数，重写）
// ============================================================

/**
 * 返回要打出的牌的值（不是索引）。
 * 绝对不会返回 HONG_ZHONG (0x41)。
 */
function getAIDecision(hand, difficulty) {
  if (hand.length === 0) return null;

  // 获取所有可打的牌（排除红中）
  var playable = getPlayableTiles(hand);
  if (playable.length === 0) return null; // 只剩红中，无法出牌

  // ---- Easy ----
  if (difficulty === 'easy') {
    // 第一优先：找孤张
    var iso = findIsolatedTiles(hand);
    if (iso.length > 0) {
      return iso[Math.floor(Math.random() * iso.length)];
    }
    // 第二优先：找边张（1或9）
    var edges = findEdgeTiles(hand);
    if (edges.length > 0) {
      return edges[Math.floor(Math.random() * edges.length)];
    }
    // 兜底：随机打一张非红中
    return playable[Math.floor(Math.random() * playable.length)];
  }

  // ---- Medium ----
  if (difficulty === 'medium') {
    var bestTile = playable[0];
    var bestValue = Infinity;

    for (var i = 0; i < playable.length; i++) {
      var t = playable[i];
      var val = tileValue(hand, t);
      if (val < bestValue) {
        bestValue = val;
        bestTile = t;
      }
    }
    return bestTile;
  }

  // ---- Hard ----
  // 用向听数 + 进张数精确评估，选最优出牌
  var bestTileH = playable[0];
  var bestScoreH = -Infinity;

  for (var j = 0; j < playable.length; j++) {
    var th = playable[j];
    var remaining = removeTile(hand, th);
    var shanten = estimateShanten(remaining);
    var waits = countWaitsFast(remaining);
    // 综合评分：向听数越小越好，进张数越多越好
    var score = -shanten * 100 + waits;
    if (score > bestScoreH) {
      bestScoreH = score;
      bestTileH = th;
    }
  }
  return bestTileH;
}

// ============================================================
//  AI 碰决策（重写）
// ============================================================

function shouldPeng(hand, tile, difficulty) {
  // 前置检查：手牌中要有2张该牌才能碰
  if (hand.filter(function(t){ return t === tile; }).length < 2) return false;

  // ---- Easy ----
  if (difficulty === 'easy') {
    return Math.random() < 0.6;
  }

  // ---- Medium / Hard ----
  // 碰后手牌减少2张
  var after = removeTiles(hand, [tile, tile]);
  var shBefore = estimateShanten(hand);
  var shAfter = estimateShanten(after);

  if (difficulty === 'hard') {
    // Hard: 向听数减少就碰，相等时看进张数变化
    if (shAfter < shBefore) return true;
    if (shAfter === shBefore) {
      // 向听数没变，比较进张数
      var waitsBefore = countWaitsFast(hand);
      var waitsAfter = countWaitsFast(after);
      return waitsAfter >= waitsBefore;
    }
    return false;
  }

  // Medium: 向听数减少就碰，否则不碰
  return shAfter < shBefore;
}

// ============================================================
//  AI 胡牌决策
// ============================================================

function shouldHu(hand, tile) {
  // 能胡就胡，永远返回 true
  return true;
}

// ============================================================
//  AI 杠决策（重写）
// ============================================================

function shouldGang(hand, tile, gangType, difficulty) {
  // 暗杠 (an_gang) 和 补杠 (bu_gang)：100% 执行
  if (gangType === 'an_gang' || gangType === 'bu_gang') {
    return true;
  }

  // 明杠 (ming_gang)：评估后决定
  // Easy: 简单起见也直接杠
  if (difficulty === 'easy') {
    return true;
  }

  // Medium / Hard: 评估杠后的向听数变化
  var after = removeTiles(hand, [tile, tile, tile]);
  var shBefore = estimateShanten(hand);
  var shAfter = estimateShanten(after);
  return shAfter <= shBefore;
}

// ============================================================
//  导出
// ============================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    calcShanten: estimateShanten,
    getAIDecision, shouldPeng, shouldHu, shouldGang,
    canWin, countWaits: countWaitsFast,
    findIsolatedTiles, getAIDelay: function(){ return 500 + Math.random() * 500; },
    HONG_ZHONG, SUIT_WAN, SUIT_TIAO, SUIT_TONG, SUIT_ZI, TILE_NAMES,
    handToCounts, sortHand, removeTile, countHongZhong, nonHongZhong,
  };
} else {
  window.AIModule = {
    calcShanten: estimateShanten,
    getAIDecision, shouldPeng, shouldHu, shouldGang,
    canWin, countWaits: countWaitsFast,
    findIsolatedTiles, getAIDelay: function(){ return 500 + Math.random() * 500; },
    HONG_ZHONG, SUIT_WAN, SUIT_TIAO, SUIT_TONG, SUIT_ZI, TILE_NAMES,
    handToCounts, sortHand, removeTile, countHongZhong, nonHongZhong,
  };
}
