/**
 * 红中麻将 — 胡/碰/杠检测模块
 * 包含胡牌检测（含红中万能牌）、碰牌检测、杠牌检测
 */
window.HuDetection = (function() {
  const { HONGZHONG_ID } = window.Constants;
  const { isHongzhong, tileBaseId, countTiles, tileSuit } = window.Tiles;

  // ============== 胡牌检测 ==============

  function canHu(hand, melds) {
    // 七小对 / 龙七对
    if (hand.length === 14) {
      if (checkLongQidui(hand)) return { canHu: true, type: 'longqidui', fan: 12 };
      if (checkQidui(hand)) return { canHu: true, type: 'qidui', fan: 8 };
    }

    // Check standard 4 melds + 1 pair (不需要红中也能胡)
    const counts = {};
    let wildCount = 0;
    for (const t of hand) {
      if (isHongzhong(t)) { wildCount++; continue; }
      const b = tileBaseId(t);
      counts[b] = (counts[b] || 0) + 1;
    }
    const meldsCount = melds ? melds.length : 0;
    const groupsNeeded = (hand.length < 14) ? (5 - meldsCount) : 5;
    const normal = tryHu(counts, wildCount, groupsNeeded);
    if (normal) return { canHu: true, type: 'normal', fan: 1 };
    return { canHu: false, type: null, fan: 0 };
  }

  function tryHu(counts, wild, groupsNeeded) {
    if (groupsNeeded === 0) return wild === 0;

    if (groupsNeeded === 1) {
      let totalNonWild = 0;
      for (const b in counts) totalNonWild += counts[b];
      if (totalNonWild === 0 && wild >= 2) return true;
      if (totalNonWild === 2 && wild >= 0) {
        for (const b in counts) {
          if (counts[b] === 2) return true;
        }
      }
      if (totalNonWild === 1 && wild === 1) return true;
      if (totalNonWild === 0 && wild === 2) return true;
      return false;
    }

    for (const b in counts) {
      if (counts[b] >= 2) {
        counts[b] -= 2;
        const ok = tryMelds(counts, wild, groupsNeeded - 1);
        counts[b] += 2;
        if (ok) return true;
      }
    }
    if (wild >= 1) {
      for (const b in counts) {
        if (counts[b] >= 1) {
          counts[b] -= 1;
          const ok = tryMelds(counts, wild - 1, groupsNeeded - 1);
          counts[b] += 1;
          if (ok) return true;
        }
      }
    }
    if (wild >= 2) {
      const ok = tryMelds(counts, wild - 2, groupsNeeded - 1);
      if (ok) return true;
    }
    return false;
  }

  function tryMelds(counts, wild, meldsNeeded) {
    if (meldsNeeded === 0) {
      let total = 0;
      for (const b in counts) total += counts[b];
      return total === 0 && wild === 0;
    }

    let first = -1;
    for (let b = 0; b < 27; b++) {
      if (counts[b] && counts[b] > 0) { first = b; break; }
    }

    if (first === -1) {
      return wild >= meldsNeeded * 3;
    }

    // Try triplet (kezi)
    if (counts[first] >= 3) {
      counts[first] -= 3;
      if (tryMelds(counts, wild, meldsNeeded - 1)) { counts[first] += 3; return true; }
      counts[first] += 3;
    }
    if (counts[first] >= 2 && wild >= 1) {
      counts[first] -= 2;
      if (tryMelds(counts, wild - 1, meldsNeeded - 1)) { counts[first] += 2; return true; }
      counts[first] += 2;
    }
    if (counts[first] >= 1 && wild >= 2) {
      counts[first] -= 1;
      if (tryMelds(counts, wild - 2, meldsNeeded - 1)) { counts[first] += 1; return true; }
      counts[first] += 1;
    }

    // Try sequence (shunzi)
    if (first < 27) {
      const suitStart = Math.floor(first / 9) * 9;
      const num = first - suitStart;
      if (num <= 6) {
        const b2 = first + 1, b3 = first + 2;
        if (b2 < suitStart + 9 && b3 < suitStart + 9) {
          const have1 = counts[first] || 0;
          const have2 = counts[b2] || 0;
          const have3 = counts[b3] || 0;

          if (have1 >= 1 && have2 >= 1 && have3 >= 1) {
            counts[first]--; counts[b2]--; counts[b3]--;
            if (tryMelds(counts, wild, meldsNeeded - 1)) {
              counts[first]++; counts[b2]++; counts[b3]++; return true;
            }
            counts[first]++; counts[b2]++; counts[b3]++;
          }
          if (wild >= 1) {
            if (have2 >= 1 && have3 >= 1) {
              counts[b2]--; counts[b3]--;
              if (tryMelds(counts, wild - 1, meldsNeeded - 1)) {
                counts[b2]++; counts[b3]++; return true;
              }
              counts[b2]++; counts[b3]++;
            }
            if (have1 >= 1 && have3 >= 1) {
              counts[first]--; counts[b3]--;
              if (tryMelds(counts, wild - 1, meldsNeeded - 1)) {
                counts[first]++; counts[b3]++; return true;
              }
              counts[first]++; counts[b3]++;
            }
            if (have1 >= 1 && have2 >= 1) {
              counts[first]--; counts[b2]--;
              if (tryMelds(counts, wild - 1, meldsNeeded - 1)) {
                counts[first]++; counts[b2]++; return true;
              }
              counts[first]++; counts[b2]++;
            }
          }
          if (wild >= 2) {
            if (have1 >= 1) {
              counts[first]--;
              if (tryMelds(counts, wild - 2, meldsNeeded - 1)) { counts[first]++; return true; }
              counts[first]++;
            }
            if (have2 >= 1) {
              counts[b2]--;
              if (tryMelds(counts, wild - 2, meldsNeeded - 1)) { counts[b2]++; return true; }
              counts[b2]++;
            }
            if (have3 >= 1) {
              counts[b3]--;
              if (tryMelds(counts, wild - 2, meldsNeeded - 1)) { counts[b3]++; return true; }
              counts[b3]++;
            }
            if (tryMelds(counts, wild - 3, meldsNeeded - 1)) return true;
          }
        }
      }
    }
    return false;
  }

  // ============== 碰牌检测 ==============
  // 清理了原始代码中的死代码（第一个 count 循环）
  function canPeng(hand, tile) {
    if (isHongzhong(tile)) return false;
    const base = tileBaseId(tile);
    let natural = 0;
    for (const t of hand) {
      if (!isHongzhong(t) && tileBaseId(t) === base) natural++;
    }
    return natural >= 2;
  }

  // ============== 七小对 & 特殊胡检测 ==============

  function checkQidui(hand) {
    if (hand.length !== 14) return false;
    const counts = {};
    let wildCount = 0;
    for (const t of hand) {
      if (isHongzhong(t)) { wildCount++; continue; }
      const b = tileBaseId(t);
      counts[b] = (counts[b] || 0) + 1;
    }
    let needWild = 0;
    for (const b in counts) {
      if (counts[b] % 2 === 1) needWild++;
    }
    if (needWild > wildCount) return false;
    const remainingWild = wildCount - needWild;
    return remainingWild % 2 === 0;
  }

  function checkLongQidui(hand) {
    if (!checkQidui(hand)) return false;
    const counts = {};
    let wildCount = 0;
    for (const t of hand) {
      if (isHongzhong(t)) { wildCount++; continue; }
      const b = tileBaseId(t);
      counts[b] = (counts[b] || 0) + 1;
    }
    for (const b in counts) {
      if (counts[b] >= 4) return true;
    }
    for (const b in counts) {
      if (counts[b] >= 3 && wildCount >= 1) return true;
    }
    if (wildCount >= 4) return true;
    return false;
  }

  function checkAllTriplets(counts, wild) {
    for (const b in counts) {
      let c = counts[b];
      if (c === 0) continue;
      const remainder = c % 3;
      if (remainder > 0) {
        const needed = 3 - remainder;
        if (wild >= needed) wild -= needed;
        else return false;
      }
    }
    return wild >= 0 && wild % 3 === 0;
  }

  function tryPairThenTriplets(counts, wild) {
    const bases = Object.keys(counts);
    for (const b of bases) {
      if (counts[b] >= 2) {
        counts[b] -= 2;
        if (checkAllTriplets({...counts}, wild)) { counts[b] += 2; return true; }
        counts[b] += 2;
      }
    }
    if (wild >= 1) {
      for (const b of bases) {
        if (counts[b] >= 1) {
          counts[b] -= 1;
          if (checkAllTriplets({...counts}, wild - 1)) { counts[b] += 1; return true; }
          counts[b] += 1;
        }
      }
    }
    if (wild >= 2) {
      if (checkAllTriplets({...counts}, wild - 2)) return true;
    }
    return false;
  }

  function checkPengpenghu(hand, melds) {
    for (const m of melds) {
      if (m.type !== 'peng' && m.type !== 'gang' && m.type !== 'angang') return false;
    }
    const counts = {};
    let wildCount = 0;
    for (const t of hand) {
      if (isHongzhong(t)) { wildCount++; continue; }
      const b = tileBaseId(t);
      counts[b] = (counts[b] || 0) + 1;
    }
    return tryPairThenTriplets(counts, wildCount);
  }

  /**
   * 混一色：所有牌（含副露）为同一花色 + 红中，且必须有红中
   */
  function checkHunyise(hand, melds) {
    let suit = null;
    let hasHz = false;
    for (const t of hand) {
      if (isHongzhong(t)) { hasHz = true; continue; }
      const s = tileSuit(t);
      if (suit === null) suit = s;
      else if (s !== suit) return false;
    }
    for (const m of melds) {
      for (const t of m.tiles) {
        if (isHongzhong(t)) { hasHz = true; continue; }
        const s = tileSuit(t);
        if (suit === null) suit = s;
        else if (s !== suit) return false;
      }
    }
    return suit !== null && hasHz;
  }

  function checkQingyise(hand, melds) {
    let suit = null;
    for (const t of hand) {
      if (isHongzhong(t)) continue;
      const s = tileSuit(t);
      if (suit === null) suit = s;
      else if (s !== suit) return false;
    }
    for (const m of melds) {
      for (const t of m.tiles) {
        if (isHongzhong(t)) continue;
        const s = tileSuit(t);
        if (suit === null) suit = s;
        else if (s !== suit) return false;
      }
    }
    return suit !== null;
  }

  // ============== 杠牌检测 ==============

  function canGang(hand, tile, melds) {
    // 红中不能用来杠
    if (isHongzhong(tile)) return false;
    if (tile >= 0) {
      let natural = 0, wild = 0;
      for (const t of hand) {
        if (isHongzhong(t)) wild++;
        else if (tileBaseId(t) === tileBaseId(tile)) natural++;
      }
      if (natural >= 3) return true;
      return false;
    }
    const counts = countTiles(hand);
    for (const b in counts) {
      if (parseInt(b) === 27) continue; // 红中不能杠
      if (counts[b] >= 4) return true;
    }
    for (const m of melds) {
      if (m.type === 'peng') {
        for (const t of hand) {
          if (tileBaseId(m.tiles[0]) === 27) continue; // 红中不能碰后补杠
          if (tileBaseId(t) === tileBaseId(m.tiles[0])) return true;
        }
      }
    }
    return false;
  }

  function canSelfGang(hand, melds) {
    const results = [];
    const counts = countTiles(hand);
    for (const b in counts) {
      if (parseInt(b) === 27) continue; // 红中不能暗杠
      if (counts[b] >= 4) results.push(parseInt(b));
    }
    for (const m of melds) {
      if (m.type === 'peng') {
        if (tileBaseId(m.tiles[0]) === 27) continue; // 红中不能碰后补杠
        for (const t of hand) {
          if (tileBaseId(t) === tileBaseId(m.tiles[0]) && !results.includes(tileBaseId(t))) {
            results.push(tileBaseId(t));
          }
        }
      }
    }
    return results;
  }

  /** 听牌检测：当前手牌能胡，或只差一张即可胡 */
  function isTing(hand, melds) {
    if (canHu(hand, melds).canHu) return true;
    var allIds = [];
    for (var i = 1; i <= 27; i++) allIds.push(i);
    allIds.push(HONGZHONG_ID);
    for (var j = 0; j < allIds.length; j++) {
      var testHand = hand.concat(allIds[j]);
      if (canHu(testHand, melds).canHu) return true;
    }
    return false;
  }

  return {
    canHu, tryHu, tryMelds,
    canPeng, isTing,
    checkQidui, checkLongQidui, checkPengpenghu, checkQingyise, checkHunyise,
    checkAllTriplets, tryPairThenTriplets,
    canGang, canSelfGang,
  };
})();
