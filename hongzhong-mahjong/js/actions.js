/**
 * 红中麻将 — 动作执行模块
 * performHu / performPeng / performGang / performQiangGangHu / checkQiangGangHu
 */
window.Actions = (function() {
  const { HONGZHONG_ID } = window.Constants;
  const { isHongzhong, tileBaseId, tileName, sortHand } = window.Tiles;
  const { canHu } = window.HuDetection;

  function s() { return window.state; }

  function performHu(playerIdx, tile, fromPlayer) {
    const st = s();
    const discPile = st.discards[fromPlayer];
    const dIdx = discPile.lastIndexOf(tile);
    if (dIdx >= 0) discPile.splice(dIdx, 1);

    st.hands[playerIdx].push(tile);
    st.winner = playerIdx;
    st.winType = 'dianpao';
    st.huTile = tile;
    st.phase = 'gameOver';

    return { player: playerIdx, type: 'dianpao', fromPlayer };
  }

  function performPeng(playerIdx, tile, fromPlayer) {
    const st = s();
    const discPile = st.discards[fromPlayer];
    const dIdx = discPile.lastIndexOf(tile);
    if (dIdx >= 0) discPile.splice(dIdx, 1);

    const base = tileBaseId(tile);
    let removedTiles = [];
    st.hands[playerIdx] = st.hands[playerIdx].filter(t => {
      if (removedTiles.length < 2 && !isHongzhong(t) && tileBaseId(t) === base) {
        removedTiles.push(t);
        return false;
      }
      return true;
    });

    st.melds[playerIdx].push({
      type: 'peng',
      tiles: [tile, ...removedTiles],
      wildUsed: false,
    });
    st.lastDiscard = -1;

    if (playerIdx === 0) {
      st.hands[0] = sortHand(st.hands[0]);
    }
  }

  function performGang(playerIdx, tile, baseId) {
    const st = s();
    let gangType, tiles;

    if (tile >= 0) {
      // 明杠
      const fromPlayer = st.lastDiscardPlayer;
      const discPile = st.discards[fromPlayer];
      const dIdx = discPile.lastIndexOf(tile);
      if (dIdx >= 0) discPile.splice(dIdx, 1);

      let removed = 0;
      st.hands[playerIdx] = st.hands[playerIdx].filter(t => {
        if (removed < 3 && tileBaseId(t) === baseId && !isHongzhong(t)) {
          removed++;
          return false;
        }
        return true;
      });

      gangType = 'gang';
      tiles = [tile, tile, tile, tile];
      st.melds[playerIdx].push({ type: 'gang', tiles: [tile, tile, tile, tile] });
    } else {
      // 暗杠或补杠
      let buGang = false;
      for (const m of st.melds[playerIdx]) {
        if (m.type === 'peng' && tileBaseId(m.tiles[0]) === baseId) {
          let removed = false;
          st.hands[playerIdx] = st.hands[playerIdx].filter(t => {
            if (!removed && tileBaseId(t) === baseId) {
              removed = true;
              return false;
            }
            return true;
          });
          m.type = 'gang';
          m.tiles.push(m.tiles[0]);
          buGang = true;
          break;
        }
      }
      if (!buGang) {
        let removed = 0;
        const realTile = st.hands[playerIdx].find(t => tileBaseId(t) === baseId);
        st.hands[playerIdx] = st.hands[playerIdx].filter(t => {
          if (removed < 4 && tileBaseId(t) === baseId) {
            removed++;
            return false;
          }
          return true;
        });
        st.melds[playerIdx].push({
          type: 'angang',
          tiles: [realTile || baseId, realTile || baseId, realTile || baseId, realTile || baseId],
        });
      }
      gangType = buGang ? 'bugang' : 'angang';
      tiles = [baseId, baseId, baseId, baseId];
    }

    // 杠分计算
    let gangBase;
    if (gangType === 'angang' && baseId === 27) gangBase = 30;
    else if (gangType === 'angang') gangBase = 20;
    else gangBase = 10;

    for (let p = 0; p < 4; p++) {
      if (p === playerIdx) st.scores[p] += gangBase * 3;
      else st.scores[p] -= gangBase;
    }
    const gangName = (gangType === 'angang' && baseId === 27) ? '红中杠' : gangType;
    st.gangLog.push({ player: playerIdx, type: gangName, score: gangBase * 3 });

    st.lastDiscard = -1;

    if (playerIdx === 0) {
      st.hands[0] = sortHand(st.hands[0]);
      st.canGang = false;
      st.canHu = false;
      st.canPeng = false;
      st.selectedIdx = -1;
    }

    return { gangType, baseId, gangTile: gangType === 'gang' ? tile : baseId };
  }

  function performQiangGangHu(playerIdx, tile, gangPlayer) {
    const st = s();
    st.hands[playerIdx].push(tile);
    st.winner = playerIdx;
    st.winType = 'qiangganghu';
    st.huTile = tile;
    st.phase = 'gameOver';
  }

  function checkQiangGangHu(gangPlayer, gangTile, gangType) {
    const st = s();
    if (gangType === 'angang') return false;

    for (let p = 0; p < 4; p++) {
      if (p === gangPlayer) continue;
      const testHand = [...st.hands[p], gangTile];
      if (canHu(testHand, st.melds[p]).canHu) {
        if (p === 0) {
          st.canHu = true;
          st.pendingActions = ['hu', 'pass'];
          st.qiangGangTile = gangTile;
          st.qiangGangPlayer = gangPlayer;
          return { player: p, tile: gangTile, gangPlayer };
        } else {
          return { player: p, tile: gangTile, gangPlayer };
        }
      }
    }
    return null;
  }

  return {
    performHu, performPeng, performGang,
    performQiangGangHu, checkQiangGangHu,
  };
})();
