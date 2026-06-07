/**
 * 红中麻将 AI 模块
 * 实现三级难度（easy / medium / hard）的 AI 决策
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

/** 获取花色 */
function suitOf(tile) {
  if (tile === HONG_ZHONG) return SUIT_ZI;
  return tile & 0xF0;
}

/** 获取点数 (1-9) */
function rankOf(tile) {
  return tile & 0x0F;
}

/** 是否为数牌（万/条/筒） */
function isNumberTile(tile) {
  const s = suitOf(tile);
  return s === SUIT_WAN || s === SUIT_TIAO || s === SUIT_TONG;
}

/** 将手牌转为计数 map: {tileCode: count} */
function handToCounts(hand) {
  const counts = {};
  for (const t of hand) {
    counts[t] = (counts[t] || 0) + 1;
  }
  return counts;
}

/** 从 counts 中取出手牌数组 */
function countsToHand(counts) {
  const arr = [];
  for (const [tile, cnt] of Object.entries(counts)) {
    for (let i = 0; i < cnt; i++) arr.push(Number(tile));
  }
  return arr;
}

/** 手牌排序 */
function sortHand(hand) {
  return [...hand].sort((a, b) => a - b);
}

/** 从手牌中移除一张指定牌（返回新数组，不修改原数组） */
function removeTile(hand, tile) {
  const idx = hand.indexOf(tile);
  if (idx === -1) return [...hand];
  const copy = [...hand];
  copy.splice(idx, 1);
  return copy;
}

/** 从 hand 数组中移除多张牌 */
function removeTiles(hand, tiles) {
  let copy = [...hand];
  for (const t of tiles) {
    const idx = copy.indexOf(t);
    if (idx !== -1) copy.splice(idx, 1);
  }
  return copy;
}

/** 统计手牌中红中数量 */
function countHongZhong(hand) {
  return hand.filter(t => t === HONG_ZHONG).length;
}

/** 获取手牌中非红中的牌 */
function nonHongZhong(hand) {
  return hand.filter(t => t !== HONG_ZHONG);
}

/** 生成标准牌组 */
function generateDeck() {
  const deck = [];
  for (const suit of ALL_SUITS) {
    for (let rank = 1; rank <= 9; rank++) {
      for (let copy = 0; copy < 4; copy++) {
        deck.push(suit + rank);
      }
    }
  }
  for (let i = 0; i < 4; i++) deck.push(HONG_ZHONG);
  return deck;
}

// ============================================================
//  胡牌检测（含红中万能牌）
// ============================================================

/**
 * 检测手牌是否可以胡牌（4面子+1将）
 * @param {number[]} hand - 14张手牌
 * @param {object} [exposedMelds] - 已暴露的面子数量（默认0）
 * @returns {boolean}
 */
function canWin(hand, exposedMeldCount = 0) {
  if (hand.length + exposedMeldCount * 3 !== 14) return false;

  const hzCount = countHongZhong(hand);
  const tiles = nonHongZhong(hand);
  const counts = handToCounts(tiles);
  const meldsNeeded = 4 - exposedMeldCount;

  // 尝试每种可能的将（雀头）
  // 情况1：将由两张普通牌组成
  const uniqueTiles = Object.keys(counts).map(Number);
  for (const pairTile of uniqueTiles) {
    if (counts[pairTile] >= 2) {
      const newCounts = { ...counts };
      newCounts[pairTile] -= 2;
      if (newCounts[pairTile] === 0) delete newCounts[pairTile];
      if (canFormMelds(newCounts, meldsNeeded, hzCount)) return true;
    }
  }

  // 情况2：将由1张普通牌+1张红中组成
  if (hzCount >= 1) {
    for (const pairTile of uniqueTiles) {
      const newCounts = { ...counts };
      newCounts[pairTile] -= 1;
      if (newCounts[pairTile] === 0) delete newCounts[pairTile];
      if (canFormMelds(newCounts, meldsNeeded, hzCount - 1)) return true;
    }
  }

  // 情况3：将由2张红中组成（红中作为任意将对）
  if (hzCount >= 2) {
    // 红中本身作为将对
    if (canFormMelds({ ...counts }, meldsNeeded, hzCount - 2)) return true;
  }

  return false;
}

/**
 * 检测给定 counts 和红中数量能否组成指定数量的面子
 */
function canFormMelds(counts, meldsNeeded, wilds) {
  if (meldsNeeded === 0 && wilds === 0) return true;
  if (meldsNeeded === 0) {
    // 多余的红中可以3张一组作为刻子
    return wilds % 3 === 0;
  }

  const totalTiles = Object.values(counts).reduce((a, b) => a + b, 0);
  if (totalTiles + wilds < meldsNeeded * 3) return false;

  // 获取最小的牌作为起点
  const tileKeys = Object.keys(counts).map(Number).sort((a, b) => a - b);

  if (tileKeys.length === 0) {
    // 只剩红中，每3张一个刻子
    return wilds >= meldsNeeded * 3;
  }

  const firstTile = tileKeys[0];

  // 策略1：尝试用 firstTile 组刻子
  const cnt = counts[firstTile];
  if (cnt >= 3) {
    const newCounts = { ...counts };
    newCounts[firstTile] -= 3;
    if (newCounts[firstTile] === 0) delete newCounts[firstTile];
    if (canFormMelds(newCounts, meldsNeeded - 1, wilds)) return true;
  }
  // 2张+1红中
  if (cnt >= 2 && wilds >= 1) {
    const newCounts = { ...counts };
    newCounts[firstTile] -= 2;
    if (newCounts[firstTile] === 0) delete newCounts[firstTile];
    if (canFormMelds(newCounts, meldsNeeded - 1, wilds - 1)) return true;
  }
  // 1张+2红中
  if (cnt >= 1 && wilds >= 2) {
    const newCounts = { ...counts };
    newCounts[firstTile] -= 1;
    if (newCounts[firstTile] === 0) delete newCounts[firstTile];
    if (canFormMelds(newCounts, meldsNeeded - 1, wilds - 2)) return true;
  }

  // 策略2：尝试用 firstTile 组顺子（仅数牌）
  if (isNumberTile(firstTile)) {
    const s = suitOf(firstTile);
    const r = rankOf(firstTile);
    if (r <= 7) {
      const t2 = s + (r + 1);
      const t3 = s + (r + 2);

      // 三张都在
      if (counts[t2] > 0 && counts[t3] > 0) {
        const nc = { ...counts };
        nc[firstTile]--; if (nc[firstTile] === 0) delete nc[firstTile];
        nc[t2]--; if (nc[t2] === 0) delete nc[t2];
        nc[t3]--; if (nc[t3] === 0) delete nc[t3];
        if (canFormMelds(nc, meldsNeeded - 1, wilds)) return true;
      }
      // 缺1张
      const missing1Cases = [];
      if (counts[t2] > 0 && !counts[t3] && wilds >= 1) missing1Cases.push([t2, 1]);
      if (!counts[t2] && counts[t3] > 0 && wilds >= 1) missing1Cases.push([t3, 1]);
      if (counts[t2] > 0 && counts[t3] > 0) {} // 已处理
      else if (counts[t2] > 0 && wilds >= 1) {
        const nc = { ...counts };
        nc[firstTile]--; if (nc[firstTile] === 0) delete nc[firstTile];
        nc[t2]--; if (nc[t2] === 0) delete nc[t2];
        if (canFormMelds(nc, meldsNeeded - 1, wilds - 1)) return true;
      } else if (counts[t3] > 0 && wilds >= 1) {
        const nc = { ...counts };
        nc[firstTile]--; if (nc[firstTile] === 0) delete nc[firstTile];
        nc[t3]--; if (nc[t3] === 0) delete nc[t3];
        if (canFormMelds(nc, meldsNeeded - 1, wilds - 1)) return true;
      } else if (wilds >= 2) {
        // 缺2张，全用红中
        const nc = { ...counts };
        nc[firstTile]--; if (nc[firstTile] === 0) delete nc[firstTile];
        if (canFormMelds(nc, meldsNeeded - 1, wilds - 2)) return true;
      }
    }
  }

  // 策略3：3张红中组成刻子
  if (wilds >= 3) {
    if (canFormMelds({ ...counts }, meldsNeeded - 1, wilds - 3)) return true;
  }

  return false;
}

// ============================================================
//  向听数计算
// ============================================================

/**
 * 计算向听数
 * -1 = 已胡牌, 0 = 听牌, 1 = 差一步, ...
 * @param {number[]} hand - 手牌（通常13张）
 * @returns {number}
 */
const _shantenCache = new Map();
function calcShanten(hand) {
  if (hand.length === 0) return -1;

  // 缓存相同手牌的计算结果
  const key = sortHand(hand).join(',');
  if (_shantenCache.has(key)) return _shantenCache.get(key);
  if (_shantenCache.size > 200) _shantenCache.clear();

  const hzCount = countHongZhong(hand);
  const tiles = nonHongZhong(hand);
  const counts = handToCounts(tiles);

  // 如果手牌数 + 明面子*3 = 14 且 canWin → -1
  if (hand.length === 14 && canWin(hand)) return -1;

  // 向听数 = 8 - 2*面子数 - 搭子数修正
  // 用递归枚举所有可能的面子+搭子组合，取最优
  let bestShanten = 8; // 最大向听
  let callCount = 0;   // 防止手机端递归过深卡死

  function search(cnts, melds, pairs, partials, wildsLeft) {
    callCount++;
    if (callCount > 800) return; // 手机端安全限制，避免卡死
    const total = Object.values(cnts).reduce((a, b) => a + b, 0);
    if (total + wildsLeft === 0) {
      // 计算向听: 8 - 2*melds - pairs - partials
      // 但需要确保 melds <= 4, pairs + partials 有限制
      const shanten = 8 - 2 * melds - Math.min(pairs, 1) - partials;
      bestShanten = Math.min(bestShanten, shanten);
      return;
    }

    const keys = Object.keys(cnts).map(Number).sort((a, b) => a - b);
    if (keys.length === 0) {
      // 全是红中
      const sh = Math.max(-1, 8 - 2 * melds - Math.min(pairs, 1) - partials);
      // 红中每3张=1面子，剩余可能配对/搭子
      const totalWilds = wildsLeft;
      const extraMelds = Math.floor(totalWilds / 3);
      const remain = totalWilds % 3;
      const extraPairs = remain >= 2 ? 1 : 0;
      const extraPartials = remain === 1 ? 1 : 0;
      const finalSh = 8 - 2 * (melds + extraMelds) - Math.min(pairs + extraPairs, 1) - (partials + extraPartials);
      bestShanten = Math.min(bestShanten, Math.max(-1, finalSh));
      return;
    }

    const first = keys[0];
    const cnt = cnts[first];

    // 选项1：跳过这张牌（不组成任何东西，算作废牌 → 需要计算在向听中）
    {
      const nc = { ...cnts };
      delete nc[first];
      search(nc, melds, pairs, partials, wildsLeft);
    }

    // 选项2：组成刻子
    if (cnt >= 3) {
      const nc = { ...cnts };
      nc[first] -= 3;
      if (nc[first] === 0) delete nc[first];
      search(nc, melds + 1, pairs, partials, wildsLeft);
    }
    if (cnt >= 2 && wildsLeft >= 1) {
      const nc = { ...cnts };
      nc[first] -= 2;
      if (nc[first] === 0) delete nc[first];
      search(nc, melds + 1, pairs, partials, wildsLeft - 1);
    }
    if (cnt >= 1 && wildsLeft >= 2) {
      const nc = { ...cnts };
      nc[first] -= 1;
      if (nc[first] === 0) delete nc[first];
      search(nc, melds + 1, pairs, partials, wildsLeft - 2);
    }

    // 选项3：组成将（雀头）
    if (cnt >= 2 && pairs === 0) {
      const nc = { ...cnts };
      nc[first] -= 2;
      if (nc[first] === 0) delete nc[first];
      search(nc, melds, 1, partials, wildsLeft);
    }
    if (cnt >= 1 && wildsLeft >= 1 && pairs === 0) {
      const nc = { ...cnts };
      nc[first] -= 1;
      if (nc[first] === 0) delete nc[first];
      search(nc, melds, 1, partials, wildsLeft - 1);
    }

    // 选项4：组成顺子（仅数牌）
    if (isNumberTile(first)) {
      const s = suitOf(first);
      const r = rankOf(first);
      if (r <= 7) {
        const t2 = s + (r + 1);
        const t3 = s + (r + 2);
        const has2 = cnts[t2] > 0;
        const has3 = cnts[t3] > 0;

        // 三张都有
        if (has2 && has3) {
          const nc = { ...cnts };
          nc[first]--; if (nc[first] === 0) delete nc[first];
          nc[t2]--; if (nc[t2] === 0) delete nc[t2];
          nc[t3]--; if (nc[t3] === 0) delete nc[t3];
          search(nc, melds + 1, pairs, partials, wildsLeft);
        }
        // 缺1张
        if (has2 && !has3 && wildsLeft >= 1) {
          const nc = { ...cnts };
          nc[first]--; if (nc[first] === 0) delete nc[first];
          nc[t2]--; if (nc[t2] === 0) delete nc[t2];
          search(nc, melds + 1, pairs, partials, wildsLeft - 1);
        }
        if (!has2 && has3 && wildsLeft >= 1) {
          const nc = { ...cnts };
          nc[first]--; if (nc[first] === 0) delete nc[first];
          nc[t3]--; if (nc[t3] === 0) delete nc[t3];
          search(nc, melds + 1, pairs, partials, wildsLeft - 1);
        }
        if (!has2 && !has3 && wildsLeft >= 2) {
          const nc = { ...cnts };
          nc[first]--; if (nc[first] === 0) delete nc[first];
          search(nc, melds + 1, pairs, partials, wildsLeft - 2);
        }
      }
    }

    // 选项5：组成搭子（两张相邻/隔一的牌，面子的半成品）
    if (isNumberTile(first)) {
      const s = suitOf(first);
      const r = rankOf(first);

      // 搭子：相邻两张 (r, r+1)
      if (r <= 8 && cnts[s + (r + 1)] > 0 && partials < 4 - melds) {
        const nc = { ...cnts };
        nc[first]--; if (nc[first] === 0) delete nc[first];
        nc[s + (r + 1)]--; if (nc[s + (r + 1)] === 0) delete nc[s + (r + 1)];
        search(nc, melds, pairs, partials + 1, wildsLeft);
      }
      // 搭子：隔一 (r, r+2)
      if (r <= 7 && cnts[s + (r + 2)] > 0 && partials < 4 - melds) {
        const nc = { ...cnts };
        nc[first]--; if (nc[first] === 0) delete nc[first];
        nc[s + (r + 2)]--; if (nc[s + (r + 2)] === 0) delete nc[s + (r + 2)];
        search(nc, melds, pairs, partials + 1, wildsLeft);
      }
    }

    // 选项6：红中作为对子
    if (wildsLeft >= 2 && pairs === 0) {
      search({ ...cnts }, melds, 1, partials, wildsLeft - 2);
    }
  }

  search(counts, 0, 0, 0, hzCount);
  const result = Math.max(-1, bestShanten);
  _shantenCache.set(key, result);
  return result;
}

// ============================================================
//  进张数计算（听牌时，有多少张牌可以胡）
// ============================================================

/**
 * 计算手牌（13张）的进张列表和数量
 * @param {number[]} hand - 13张手牌
 * @returns {{ waits: number[], count: number }}
 */
function countWaits(hand) {
  const waitSet = new Set();
  const allTiles = generateDeck();
  const handCounts = handToCounts(hand);

  for (const tile of allTiles) {
    const inHand = handCounts[tile] || 0;
    if (inHand >= 4) continue; // 已有4张，不可能再摸到
    const testHand = [...hand, tile];
    try {
      if (canWin(testHand)) {
        waitSet.add(tile);
      }
    } catch(e) {
      // 递归过深时跳过，不影响大局
    }
    // 手机端限制：找到几个进张就足够评估了
    if (waitSet.size >= 8) break;
  }

  const waits = [...waitSet].sort((a, b) => a - b);
  return { waits, count: waits.length };
}

// ============================================================
//  手牌评估
// ============================================================

/**
 * 评估手牌质量，返回分数（越高越好）
 * @param {number[]} hand - 手牌
 * @returns {{ score: number, shanten: number, waits: number, melds: number }}
 */
function evaluateHand(hand) {
  const shanten = calcShanten(hand);

  if (hand.length === 14 && shanten === -1) {
    return { score: 10000, shanten: -1, waits: 0, melds: 4 };
  }

  // 统计面子和搭子数量（简化评估）
  const hzCount = countHongZhong(hand);
  const tiles = nonHongZhong(hand);
  const counts = handToCounts(tiles);

  let meldEstimate = 0;
  let pairEstimate = 0;
  const used = {};

  // 估算刻子
  for (const [tile, cnt] of Object.entries(counts)) {
    if (cnt >= 3) { meldEstimate++; used[tile] = 3; }
  }
  // 估算顺子
  for (const suit of ALL_SUITS) {
    for (let r = 1; r <= 7; r++) {
      const t1 = suit + r, t2 = suit + r + 1, t3 = suit + r + 2;
      const c1 = (counts[t1] || 0) - (used[t1] || 0);
      const c2 = (counts[t2] || 0) - (used[t2] || 0);
      const c3 = (counts[t3] || 0) - (used[t3] || 0);
      if (c1 > 0 && c2 > 0 && c3 > 0) {
        meldEstimate++;
        used[t1] = (used[t1] || 0) + 1;
        used[t2] = (used[t2] || 0) + 1;
        used[t3] = (used[t3] || 0) + 1;
      }
    }
  }

  // 估算对子
  for (const [tile, cnt] of Object.entries(counts)) {
    const remain = cnt - (used[tile] || 0);
    if (remain >= 2) pairEstimate++;
  }

  // 进张数（仅13张时计算）
  let waits = 0;
  if (hand.length === 13) {
    waits = countWaits(hand).count;
  }

  // 综合评分
  const score = meldEstimate * 50 + pairEstimate * 10 + waits * 10 - shanten * 100 + hzCount * 30;

  return { score, shanten, waits, melds: meldEstimate };
}

// ============================================================
//  孤张检测
// ============================================================

/**
 * 找出手牌中的孤张（与其他牌无关联的牌）
 */
function findIsolatedTiles(hand) {
  const isolated = [];
  const hzCount = countHongZhong(hand);
  const tiles = nonHongZhong(hand);
  const counts = handToCounts(tiles);

  for (const tile of hand) {
    if (tile === HONG_ZHONG) continue; // 红中不是孤张

    const s = suitOf(tile);
    const r = rankOf(tile);
    let related = false;

    // 检查是否有相同牌
    if (counts[tile] >= 2) related = true;

    // 检查是否有相邻牌
    if (isNumberTile(tile)) {
      for (const dr of [-2, -1, 1, 2]) {
        const nr = r + dr;
        if (nr >= 1 && nr <= 9) {
          const neighbor = s + nr;
          if (counts[neighbor] > 0) { related = true; break; }
        }
      }
    }

    if (!related) isolated.push(tile);
  }

  return isolated;
}

/**
 * 找出手牌中的边张（只有一侧相邻的牌）
 */
function findEdgeTiles(hand) {
  const edge = [];
  const counts = handToCounts(nonHongZhong(hand));

  for (const tile of hand) {
    if (tile === HONG_ZHONG) continue;
    if (!isNumberTile(tile)) continue;

    const s = suitOf(tile);
    const r = rankOf(tile);
    const hasPrev = r > 1 && counts[s + (r - 1)] > 0;
    const hasNext = r < 9 && counts[s + (r + 1)] > 0;

    // 只有一侧有相邻牌 → 边张
    if ((hasPrev && !hasNext) || (!hasPrev && hasNext)) {
      edge.push(tile);
    }
  }

  return edge;
}

// ============================================================
//  出牌候选评分
// ============================================================

/**
 * 评估打出某张牌后的手牌质量
 * @param {number[]} hand - 当前手牌（14张）
 * @param {number} candidate - 候选打出的牌
 * @param {object} [context] - 额外上下文（弃牌池等）
 * @returns {number} 评分（越高越好）
 */
function evaluateDiscard(hand, candidate, context) {
  const remaining = removeTile(hand, candidate);

  // 向听数越低越好
  const shanten = calcShanten(remaining);

  // 进张数
  const waits = countWaits(remaining).count;

  // 基础分 = 进张数 * 10 - 向听数 * 50
  let score = waits * 10 - shanten * 50;

  // 红中惩罚：尽量不打红中
  if (candidate === HONG_ZHONG) score -= 80;

  // 孤张奖励：打孤张不损失搭子
  const isolated = findIsolatedTiles(remaining);
  if (isolated.length > 0 && isolated.includes(candidate)) {
    score += 5;
  }

  // 安全度（hard 难度用）
  if (context && context.discardPool) {
    const safety = calcTileSafety(candidate, context.discardPool);
    score += safety * (context.defenseWeight || 0);
  }

  return score;
}

/**
 * 计算一张牌的安全度（0~1，越大越安全）
 * @param {number} tile - 牌编码
 * @param {object} discardPool - {tile: count} 已打出的牌
 * @returns {number}
 */
function calcTileSafety(tile, discardPool) {
  const totalInGame = 4;
  const discarded = (discardPool && discardPool[tile]) || 0;
  return discarded / totalInGame;
}

// ============================================================
//  AI 出牌决策
// ============================================================

/**
 * AI 出牌决策
 * @param {number[]} hand - 当前手牌（14张）
 * @param {'easy'|'medium'|'hard'} difficulty - 难度
 * @param {object} [context] - 额外上下文
 * @param {object} [context.discardPool] - 弃牌池 {tile: count}
 * @param {number} [context.defenseWeight] - 防守权重
 * @returns {number} 选择打出的牌
 */
function getAIDecision(hand, difficulty, context = {}) {
  if (hand.length === 0) return null;

  const sorted = sortHand(hand);

  // ----------------------------------------------------------
  //  简单 AI：60% 打孤张，40% 随机
  // ----------------------------------------------------------
  if (difficulty === 'easy') {
    // 简单AI不理解红中价值，倾向早期打出
    if (Math.random() < 0.3 && sorted.includes(HONG_ZHONG)) {
      return HONG_ZHONG;
    }

    if (Math.random() < 0.6) {
      const isolated = findIsolatedTiles(sorted);
      if (isolated.length > 0) {
        return isolated[Math.floor(Math.random() * isolated.length)];
      }
    }
    // 随机出牌
    return sorted[Math.floor(Math.random() * sorted.length)];
  }

  // ----------------------------------------------------------
  //  中等 AI：贪心，选择进张数最多/向听数最小的出法
  // ----------------------------------------------------------
  if (difficulty === 'medium') {
    let bestTile = sorted[0];
    let bestScore = -Infinity;

    // 去重，只评估不同牌
    const uniqueTiles = [...new Set(sorted)];

    for (const tile of uniqueTiles) {
      const score = evaluateDiscard(sorted, tile, context);
      // 加少量随机偏差（±5）
      const noise = (Math.random() - 0.5) * 10;
      const finalScore = score + noise;

      if (finalScore > bestScore) {
        bestScore = finalScore;
        bestTile = tile;
      }
    }
    return bestTile;
  }

  // ----------------------------------------------------------
  //  困难 AI：全局最优 + 读牌 + 防守
  // ----------------------------------------------------------
  if (difficulty === 'hard') {
    // 增加防守权重
    const hardContext = {
      ...context,
      defenseWeight: context.defenseWeight || 15,
    };

    let bestTile = sorted[0];
    let bestScore = -Infinity;

    const uniqueTiles = [...new Set(sorted)];

    for (const tile of uniqueTiles) {
      let score = evaluateDiscard(sorted, tile, hardContext);

      // 困难AI额外考虑：
      // 1. 避免打出别人可能需要的牌（如果已经接近听牌，偏防守）
      const remaining = removeTile(sorted, tile);
      const shanten = calcShanten(remaining);
      if (shanten <= 1) {
        // 接近听牌时增加防守权重
        const safety = calcTileSafety(tile, context.discardPool);
        score += safety * 20;
      }

      // 2. 红中保留到关键时刻
      if (tile === HONG_ZHONG) {
        score -= 120;
      }

      // 少量随机偏差（±2）
      const noise = (Math.random() - 0.5) * 4;
      const finalScore = score + noise;

      if (finalScore > bestScore) {
        bestScore = finalScore;
        bestTile = tile;
      }
    }
    return bestTile;
  }

  // 默认：出最后一张
  return sorted[sorted.length - 1];
}

// ============================================================
//  AI 碰牌决策
// ============================================================

/**
 * AI 判断是否碰牌
 * @param {number[]} hand - 当前手牌（不包含别人打出的牌）
 * @param {number} tile - 别人打出的牌
 * @param {'easy'|'medium'|'hard'} difficulty - 难度
 * @param {object} [context] - 额外上下文
 * @returns {boolean} 是否碰
 */
function shouldPeng(hand, tile, difficulty, context = {}) {
  // 检测是否能碰（手牌中至少有2张相同牌）
  const count = hand.filter(t => t === tile).length;
  if (count < 2) return false;

  // 红中碰/杠的特殊处理
  const isHongZhong = tile === HONG_ZHONG;

  // ----------------------------------------------------------
  //  简单 AI：50% 概率碰
  // ----------------------------------------------------------
  if (difficulty === 'easy') {
    // 简单AI不理解红中价值，50%碰
    return Math.random() < 0.5;
  }

  // ----------------------------------------------------------
  //  中等 AI：评估碰后向听数变化，有利则碰(80%)，否则过
  // ----------------------------------------------------------
  if (difficulty === 'medium') {
    // 碰后手牌 = 手牌 - 2张相同 + 碰出的3张（暴露） → 手牌少2张
    const afterPeng = removeTiles(hand, [tile, tile]);

    // 计算碰前后的向听数
    const shantenBefore = calcShanten(hand);
    const shantenAfter = calcShanten(afterPeng);

    // 如果碰后向听数减少，有利
    if (shantenAfter < shantenBefore) {
      return Math.random() < 0.8;
    }
    // 红中特殊：如果手牌有多张红中，碰了损失万能牌灵活性
    if (isHongZhong) {
      const hzCount = countHongZhong(hand);
      if (hzCount >= 3) {
        // 有3张以上红中，碰了保留1张万能牌，可以考虑
        return Math.random() < 0.5;
      }
      return Math.random() < 0.2; // 通常不碰红中
    }
    return Math.random() < 0.15;
  }

  // ----------------------------------------------------------
  //  困难 AI：精确计算碰后收益
  // ----------------------------------------------------------
  if (difficulty === 'hard') {
    const afterPeng = removeTiles(hand, [tile, tile]);

    const shantenBefore = calcShanten(hand);
    const shantenAfter = calcShanten(afterPeng);

    // 向听数减少 → 净收益为正
    if (shantenAfter < shantenBefore) {
      // 红中：只有在收益明显时才碰
      if (isHongZhong) {
        const hzCount = countHongZhong(hand);
        return hzCount >= 3 && shantenAfter <= 0; // 只有确定胡牌才碰红中
      }
      return true;
    }

    // 向听数不变但进张数增加 → 也可以考虑
    if (shantenAfter === shantenBefore) {
      const waitsBefore = countWaits(hand).count;
      const waitsAfter = countWaits(afterPeng).count;
      if (waitsAfter > waitsBefore * 0.8) {
        if (isHongZhong) return false; // 红中不碰
        return Math.random() < 0.3;
      }
    }

    return false;
  }

  return false;
}

// ============================================================
//  AI 胡牌决策
// ============================================================

/**
 * AI 判断是否胡牌
 * @param {number[]} hand - 当前手牌
 * @param {number} tile - 刚摸到的牌（自摸）或别人打出的牌（点炮）
 * @param {'easy'|'medium'|'hard'} difficulty - 难度
 * @param {object} [context]
 * @param {boolean} [context.isSelfDraw] - 是否自摸
 * @returns {boolean} 是否胡
 */
function shouldHu(hand, tile, difficulty, context = {}) {
  const testHand = [...hand, tile];

  // 先确认是否满足胡牌条件
  const isWin = canWin(testHand);
  if (!isWin) return false;

  // ----------------------------------------------------------
  //  简单 AI：95% 概率胡（有时会"错过"）
  // ----------------------------------------------------------
  if (difficulty === 'easy') {
    return Math.random() < 0.95;
  }

  // ----------------------------------------------------------
  //  中等 AI：100% 胡
  // ----------------------------------------------------------
  if (difficulty === 'medium') {
    return true;
  }

  // ----------------------------------------------------------
  //  困难 AI：100% 胡（除非有更好的选择）
  // ----------------------------------------------------------
  if (difficulty === 'hard') {
    // 确认能胡就胡，没有理由放弃
    return true;
  }

  return true;
}

// ============================================================
//  AI 杠牌决策
// ============================================================

/**
 * AI 判断是否杠牌
 * @param {number[]} hand - 当前手牌
 * @param {number} tile - 杠的牌
 * @param {'ming_gang'|'an_gang'|'bu_gang'} gangType - 杠的类型
 * @param {'easy'|'medium'|'hard'} difficulty - 难度
 * @returns {boolean}
 */
function shouldGang(hand, tile, gangType, difficulty) {
  // ----------------------------------------------------------
  //  简单 AI：30% 概率杠
  // ----------------------------------------------------------
  if (difficulty === 'easy') {
    return Math.random() < 0.3;
  }

  // ----------------------------------------------------------
  //  中等 AI：评估杠后影响
  // ----------------------------------------------------------
  if (difficulty === 'medium') {
    if (gangType === 'an_gang' || gangType === 'bu_gang') {
      // 暗杠/补杠：摸一张新牌再出一张，变化不大
      return Math.random() < 0.7;
    }
    // 明杠：用别人打出的牌
    const count = hand.filter(t => t === tile).length;
    if (count >= 3) {
      return Math.random() < 0.6;
    }
    return false;
  }

  // ----------------------------------------------------------
  //  困难 AI：精确计算
  // ----------------------------------------------------------
  if (difficulty === 'hard') {
    // 红中杠：失去万能牌功能，除非已听牌
    if (tile === HONG_ZHONG) {
      const hzCount = countHongZhong(hand);
      // 4张红中暗杠，直接杠
      if (gangType === 'an_gang' && hzCount === 4) return true;
      // 3张红中+别人出红中 → 谨慎
      const afterGang = removeTiles(hand, [tile, tile, tile]);
      const sh = calcShanten(afterGang);
      return sh <= 0; // 只有听牌或已胡才杠
    }

    // 普通牌：暗杠/补杠优先
    if (gangType === 'an_gang' || gangType === 'bu_gang') {
      return true; // 暗杠/补杠通常有利
    }

    // 明杠：评估
    const afterGang = removeTiles(hand, [tile, tile, tile]);
    const shantenBefore = calcShanten(hand);
    const shantenAfter = calcShanten(afterGang);
    return shantenAfter <= shantenBefore;
  }

  return false;
}

// ============================================================
//  响应延迟模拟
// ============================================================

/**
 * 获取 AI 响应延迟（毫秒），模拟"思考"时间
 * @param {'easy'|'medium'|'hard'} difficulty
 * @returns {number}
 */
function getAIDelay(difficulty) {
  switch (difficulty) {
    case 'easy':   return 500 + Math.random() * 1000;   // 0.5-1.5s
    case 'medium': return 1000 + Math.random() * 1000;  // 1-2s
    case 'hard':   return 1500 + Math.random() * 1500;  // 1.5-3s
    default:       return 1000;
  }
}

// ============================================================
//  导出
// ============================================================

if (typeof module !== 'undefined' && module.exports) {
  // Node.js / CommonJS
  module.exports = {
    // 核心 API
    evaluateHand,
    calcShanten,
    getAIDecision,
    shouldPeng,
    shouldHu,
    shouldGang,
    // 工具函数
    canWin,
    countWaits,
    evaluateDiscard,
    findIsolatedTiles,
    findEdgeTiles,
    calcTileSafety,
    getAIDelay,
    // 常量
    HONG_ZHONG,
    SUIT_WAN,
    SUIT_TIAO,
    SUIT_TONG,
    SUIT_ZI,
    TILE_NAMES,
    generateDeck,
    // 内部工具
    handToCounts,
    sortHand,
    removeTile,
    countHongZhong,
    nonHongZhong,
  };
} else {
  // 浏览器全局变量
  window.AIModule = {
    evaluateHand,
    calcShanten,
    getAIDecision,
    shouldPeng,
    shouldHu,
    shouldGang,
    canWin,
    countWaits,
    evaluateDiscard,
    findIsolatedTiles,
    findEdgeTiles,
    calcTileSafety,
    getAIDelay,
    HONG_ZHONG,
    SUIT_WAN,
    SUIT_TIAO,
    SUIT_TONG,
    SUIT_ZI,
    TILE_NAMES,
    generateDeck,
    handToCounts,
    sortHand,
    removeTile,
    countHongZhong,
    nonHongZhong,
  };
}
