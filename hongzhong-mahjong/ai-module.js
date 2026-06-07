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
  const s = suitOf(tile);
  return s === SUIT_WAN || s === SUIT_TIAO || s === SUIT_TONG;
}

function handToCounts(hand) {
  const counts = {};
  for (const t of hand) {
    counts[t] = (counts[t] || 0) + 1;
  }
  return counts;
}

function sortHand(hand) {
  return [...hand].sort((a, b) => a - b);
}

function removeTile(hand, tile) {
  const idx = hand.indexOf(tile);
  if (idx === -1) return [...hand];
  const copy = [...hand];
  copy.splice(idx, 1);
  return copy;
}

function removeTiles(hand, tiles) {
  let copy = [...hand];
  for (const t of tiles) {
    const idx = copy.indexOf(t);
    if (idx !== -1) copy.splice(idx, 1);
  }
  return copy;
}

function countHongZhong(hand) {
  return hand.filter(t => t === HONG_ZHONG).length;
}

function nonHongZhong(hand) {
  return hand.filter(t => t !== HONG_ZHONG);
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

function findIsolatedTiles(hand) {
  var isolated = [];
  var tiles = nonHongZhong(hand);
  var counts = handToCounts(tiles);

  for (var i = 0; i < hand.length; i++) {
    var tile = hand[i];
    if (tile === HONG_ZHONG) continue;

    var s = suitOf(tile), r = rankOf(tile);
    var related = false;

    if (counts[tile] >= 2) related = true;
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
//  AI 出牌决策
// ============================================================

function getAIDecision(hand, difficulty) {
  if (hand.length === 0) return null;

  var sorted = sortHand(hand);

  if (difficulty === 'easy') {
    if (Math.random() < 0.3 && sorted.indexOf(HONG_ZHONG) !== -1) return HONG_ZHONG;
    if (Math.random() < 0.6) {
      var iso = findIsolatedTiles(sorted);
      if (iso.length > 0) return iso[Math.floor(Math.random() * iso.length)];
    }
    return sorted[Math.floor(Math.random() * sorted.length)];
  }

  // medium / hard：评估每种候选牌，选最优
  var bestTile = sorted[0], bestScore = -Infinity;
  var seen = {};
  for (var i = 0; i < sorted.length; i++) {
    var tile = sorted[i];
    if (seen[tile]) continue;
    seen[tile] = true;
    var score = evaluateDiscardFast(sorted, tile) + (Math.random() - 0.5) * 10;
    if (score > bestScore) { bestScore = score; bestTile = tile; }
  }
  return bestTile;
}

// ============================================================
//  AI 碰/胡/杠决策
// ============================================================

function shouldPeng(hand, tile, difficulty) {
  if (hand.filter(function(t){ return t === tile; }).length < 2) return false;
  if (difficulty === 'easy') return Math.random() < 0.5;

  var after = removeTiles(hand, [tile, tile]);
  var shBefore = estimateShanten(hand);
  var shAfter = estimateShanten(after);

  if (shAfter < shBefore) {
    if (tile === HONG_ZHONG) return Math.random() < 0.4;
    return Math.random() < 0.8;
  }
  if (tile === HONG_ZHONG) return Math.random() < 0.15;
  return Math.random() < 0.1;
}

function shouldHu(hand, tile) {
  return true;
}

function shouldGang(hand, tile, gangType, difficulty) {
  if (difficulty === 'easy') return Math.random() < 0.5;

  if (gangType === 'an_gang' || gangType === 'bu_gang') {
    if (tile === HONG_ZHONG) {
      if (countHongZhong(hand) === 4) return true;
      var sh = estimateShanten(removeTiles(hand, [tile, tile, tile]));
      return sh <= 0;
    }
    return true;
  }

  // 明杠
  var after = removeTiles(hand, [tile, tile, tile]);
  return estimateShanten(after) <= estimateShanten(hand);
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
