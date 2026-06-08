/**
 * 红中麻将 — 游戏流程模块（简洁版）
 *
 * 核心原则：
 *   1. 只有一个"当前动作"在执行，不存在并行
 *   2. 每个动作开始时检查状态是否仍然有效
 *   3. clearAllPending() 在每次状态切换时调用
 */
window.GameFlow = (function () {
  const { HONGZHONG_ID } = window.Constants;
  const { isHongzhong, tileBaseId, tileName, sortHand, buildDeck, shuffle } = window.Tiles;
  const { canHu, canPeng, canGang, canSelfGang } = window.HuDetection;
  const { calcScore } = window.Scoring;
  const { performHu, performPeng, performGang, performQiangGangHu, checkQiangGangHu } = window.Actions;
  const { getAIDecision, shouldPeng, shouldHu } = window.AIBridge;
  const { render } = window.Renderer;

  function s() { return window.state; }

  // ====== 唯一的异步控制系统 ======
  let _pendingTimers = [];
  let _actionId = 0; // 单调递增，每次新动作+1

  /** 清除所有待执行的异步动作 */
  function cancelAll() {
    _actionId++;
    _pendingTimers.forEach(t => clearTimeout(t));
    _pendingTimers = [];
  }

  /** 安排一个延迟动作，自动绑定当前 actionId */
  function schedule(fn, delay) {
    const id = _actionId;
    const t = setTimeout(() => {
      // 如果 actionId 变了，说明中间有新动作，跳过
      if (id !== _actionId) return;
      fn();
    }, delay);
    _pendingTimers.push(t);
  }

  // ====== 出牌顺序：逆时针 南→东→北→西 ======
  const NEXT = [3, 1, 2, 0];

  // ================================================================
  //  startNewGame
  // ================================================================
  function startNewGame() {
    cancelAll();
    const st = s();
    st.deck = shuffle(buildDeck());
    st.hands = [[], [], [], []];
    st.discards = [[], [], [], []];
    st.melds = [[], [], [], []];
    st.selectedIdx = -1;
    st.lastDiscard = -1;
    st.lastDiscardPlayer = -1;
    st.pendingActions = [];
    st.canHu = false;
    st.canGang = false;
    st.canPeng = false;
    st.winner = -1;
    st.winType = '';
    st.huTile = -1;
    st.gangLog = [];
    st.isAfterGang = false;
    st.isLastTile = false;
    st.qiangGangTile = -1;
    st.qiangGangPlayer = -1;

    for (let r = 0; r < 13; r++) {
      for (let p = 0; p < 4; p++) {
        st.hands[p].push(st.deck.pop());
      }
    }

    st.currentPlayer = st.dealerIdx;
    st.hands[st.dealerIdx].push(st.deck.pop());
    st.hands[st.dealerIdx] = sortHand(st.hands[st.dealerIdx]);

    if (st.dealerIdx === 0 && canHu(st.hands[0], st.melds[0]).canHu) {
      st.canHu = true;
    }

    if (st.dealerIdx === 0) {
      st.phase = 'playerTurn';
      st.turnPhase = 'discard';
    } else {
      st.phase = 'aiTurn';
    }

    window.UI.updateButtons();
    try { render(); } catch (e) { console.error('render:', e); }

    if (st.dealerIdx !== 0) {
      schedule(() => aiTurn(st.dealerIdx), 800);
    }
  }

  // ================================================================
  //  drawTileFromDeck — 玩家摸牌（同步）
  // ================================================================
  function drawTileFromDeck(playerIdx) {
    const st = s();
    if (st.deck.length === 0) { endGame(-1, 'draw'); return null; }
    const tile = st.deck.pop();
    if (st.deck.length === 0) st.isLastTile = true;
    st.hands[playerIdx].push(tile);

    if (playerIdx === 0) {
      st.hands[0] = sortHand(st.hands[0]);
      if (canHu(st.hands[0], st.melds[0]).canHu) st.canHu = true;
      st.canGang = canSelfGang(st.hands[0], st.melds[0]).length > 0;
      st.canPeng = false;
      st.selectedIdx = -1;
      st.phase = 'playerTurn';
      st.turnPhase = 'discard';
      window.UI.updateButtons();
      window.UI.playSound('draw');
    } else {
      window.UI.playSound('draw');
    }
    try { render(); } catch (e) { console.error('render:', e); }
    return tile;
  }

  // ================================================================
  //  playerDiscard — 玩家出牌
  // ================================================================
  function playerDiscard(idx) {
    const st = s();
    if (st.phase !== 'playerTurn' || st.turnPhase !== 'discard') return;
    if (idx < 0 || idx >= st.hands[0].length) return;
    const tile = st.hands[0][idx];
    if (isHongzhong(tile)) { window.UI.setStatus('红中不能打出！'); return; }

    st.hands[0].splice(idx, 1);
    st.hands[0] = sortHand(st.hands[0]);
    st.discards[0].push(tile);
    st.lastDiscard = tile;
    st.lastDiscardPlayer = 0;
    st.selectedIdx = -1;
    st.canHu = false; st.canGang = false; st.canPeng = false;
    window.UI.playSound('discard');
    try { render(); } catch (e) { console.error('render:', e); }

    try { checkResponses(0, tile); } catch (e) {
      console.error('checkResponses:', e);
      nextTurn(0);
    }
  }

  // ================================================================
  //  aiTurn — AI 回合（摸牌 + 出牌）
  // ================================================================
  function aiTurn(playerIdx) {
    const st = s();
    st.phase = 'aiTurn';
    st.currentPlayer = playerIdx;
    try { render(); } catch (e) {}

    schedule(() => {
      const cur = s();
      // 守卫：必须仍是该 AI 的回合
      if (cur.phase !== 'aiTurn' || cur.currentPlayer !== playerIdx) return;
      if (cur.phase === 'gameOver') return;

      try {
        // 摸牌
        if (cur.deck.length === 0) { endGame(-1, 'draw'); return; }
        const tile = cur.deck.pop();
        if (cur.deck.length === 0) cur.isLastTile = true;
        cur.hands[playerIdx].push(tile);
        window.UI.playSound('draw');

        // 自摸检查
        if (canHu(cur.hands[playerIdx], cur.melds[playerIdx]).canHu) {
          if (shouldHu(cur.hands[playerIdx], -1, cur.difficulty)) {
            aiWin(playerIdx, tile, 'zimo');
            return;
          }
        }

        // 自杠检查
        const selfGangs = canSelfGang(cur.hands[playerIdx], cur.melds[playerIdx]);
        if (selfGangs.length > 0) {
          performGang(playerIdx, -1, selfGangs[0]);
          cur.isAfterGang = true;
          schedule(() => aiTurn(playerIdx), 600);
          return;
        }
        cur.isAfterGang = false;
        cur.isLastTile = false;

        // 出牌
        let discardIdx;
        try { discardIdx = getAIDecision(cur.hands[playerIdx], cur.difficulty); }
        catch (e) { discardIdx = -1; }

        if (discardIdx < 0 || discardIdx >= cur.hands[playerIdx].length) {
          for (let i = 0; i < cur.hands[playerIdx].length; i++) {
            if (!isHongzhong(cur.hands[playerIdx][i])) {
              const d = cur.hands[playerIdx].splice(i, 1)[0];
              cur.discards[playerIdx].push(d);
              cur.lastDiscard = d; cur.lastDiscardPlayer = playerIdx;
              break;
            }
          }
        } else {
          const d = cur.hands[playerIdx].splice(discardIdx, 1)[0];
          cur.discards[playerIdx].push(d);
          cur.lastDiscard = d; cur.lastDiscardPlayer = playerIdx;
        }

        window.UI.playSound('discard');
        try { render(); } catch (e) {}
        checkResponses(playerIdx, cur.lastDiscard);
      } catch (err) {
        console.error('AI回合异常:', err);
        nextTurn(playerIdx);
      }
    }, 500 + Math.random() * 400);
  }

  function aiWin(playerIdx, tile, type) {
    const st = s();
    st.winner = playerIdx; st.winType = type; st.huTile = tile;
    st.phase = 'gameOver';
    cancelAll();
    window.UI.playSound('hu');
    endGame(playerIdx, type);
  }

  // ================================================================
  //  checkResponses — 检查所有人对弃牌的响应
  // ================================================================
  function checkResponses(discardPlayer, tile) {
    const st = s();
    cancelAll(); // 清除旧动作

    const huPlayers = [], gangPlayers = [], pengPlayers = [];
    for (let p = 0; p < 4; p++) {
      if (p === discardPlayer) continue;
      const testHand = [...st.hands[p], tile];
      if (canHu(testHand, st.melds[p]).canHu) huPlayers.push(p);
      else if (canGang(st.hands[p], tile, st.melds[p])) gangPlayers.push(p);
      else if (canPeng(st.hands[p], tile)) pengPlayers.push(p);
    }

    // ---- 胡 ----
    if (huPlayers.length > 0) {
      if (huPlayers.includes(0)) {
        st.canHu = true; st.canPeng = false; st.canGang = false;
        st.pendingActions = ['hu', 'pass'];
        st.phase = 'playerTurn'; st.turnPhase = 'response';
        window.UI.updateButtons(); render();
        return;
      }
      const aiHu = huPlayers.find(p => p !== 0);
      if (aiHu !== undefined) {
        schedule(() => { performHu(aiHu, tile, discardPlayer); endGame(aiHu, 'dianpao', discardPlayer); }, 500);
        return;
      }
    }

    // ---- 杠 ----
    if (gangPlayers.length > 0) {
      if (gangPlayers.includes(0)) {
        st.canGang = true; st.canPeng = false; st.canHu = false;
        st.pendingActions = ['gang', 'pass'];
        st.phase = 'playerTurn'; st.turnPhase = 'response';
        window.UI.updateButtons(); render();
        return;
      }
      const aiGang = gangPlayers.find(p => p !== 0);
      if (aiGang !== undefined) {
        schedule(() => {
          performGang(aiGang, tile, tileBaseId(tile));
          const qg = checkQiangGangHu(aiGang, tile, 'ming_gang');
          if (qg && typeof qg === 'object') {
            if (qg.player !== 0) {
              schedule(() => { performQiangGangHu(qg.player, qg.tile, qg.gangPlayer); endGame(qg.player, 'qiangganghu', qg.gangPlayer); }, 300);
            }
            return;
          }
          schedule(() => aiTurn(aiGang), 600);
        }, 500);
        return;
      }
    }

    // ---- 碰 ----
    if (pengPlayers.length > 0) {
      if (pengPlayers.includes(0)) {
        st.canPeng = true; st.canGang = false; st.canHu = false;
        st.pendingActions = ['peng', 'pass'];
        st.phase = 'playerTurn'; st.turnPhase = 'response';
        window.UI.updateButtons(); render();
        return;
      }
      const aiPeng = pengPlayers.find(p => p !== 0);
      if (aiPeng !== undefined) {
        schedule(() => {
          performPeng(aiPeng, tile, discardPlayer);
          schedule(() => {
            const cur = s();
            let discardIdx;
            try { discardIdx = getAIDecision(cur.hands[aiPeng], cur.difficulty); }
            catch (e) { discardIdx = -1; }
            let discarded;
            if (discardIdx < 0 || discardIdx >= cur.hands[aiPeng].length) {
              for (let i = 0; i < cur.hands[aiPeng].length; i++) {
                if (!isHongzhong(cur.hands[aiPeng][i])) { discarded = cur.hands[aiPeng].splice(i, 1)[0]; break; }
              }
            } else { discarded = cur.hands[aiPeng].splice(discardIdx, 1)[0]; }
            if (discarded) {
              cur.discards[aiPeng].push(discarded);
              cur.lastDiscard = discarded; cur.lastDiscardPlayer = aiPeng;
              window.UI.playSound('discard');
              try { render(); } catch (e) {}
              checkResponses(aiPeng, discarded);
            }
          }, 500);
        }, 500);
        return;
      }
    }

    // ---- 无人响应 → 下一回合 ----
    nextTurn(discardPlayer);
  }

  // ================================================================
  //  nextTurn — 切到下一个玩家
  // ================================================================
  function nextTurn(fromPlayer) {
    const st = s();
    const next = NEXT[fromPlayer];
    st.currentPlayer = next;
    st.lastDiscard = -1;
    cancelAll();

    try {
      if (next === 0) {
        st.phase = 'playerTurn';
        st.turnPhase = 'draw';
        drawTileFromDeck(0);
      } else {
        aiTurn(next);
      }
    } catch (err) {
      console.error('nextTurn异常:', err);
      st.phase = 'playerTurn'; st.turnPhase = 'discard';
      st.selectedIdx = -1;
      window.UI.updateButtons(); render();
    }
  }

  // ================================================================
  //  playerPass — 玩家"过"
  // ================================================================
  function playerPass() {
    const st = s();
    cancelAll();
    st.canHu = false; st.canGang = false; st.canPeng = false;
    st.selectedIdx = -1; st.pendingActions = [];
    window.UI.updateButtons();

    // 检查其他 AI 能否响应
    const tile = st.lastDiscard;
    const dp = st.lastDiscardPlayer;
    if (tile > 0 && dp >= 0) {
      for (let p = 1; p < 4; p++) {
        if (p === dp) continue;
        if (canHu([...st.hands[p], tile], st.melds[p]).canHu && shouldHu(st.hands[p], tile, st.difficulty)) {
          schedule(() => { performHu(p, tile, dp); endGame(p, 'dianpao', dp); }, 400);
          return;
        }
      }
      for (let p = 1; p < 4; p++) {
        if (p === dp) continue;
        if (canPeng(st.hands[p], tile) && shouldPeng(st.hands[p], tile, st.difficulty)) {
          st.phase = 'aiTurn'; st.currentPlayer = p;
          schedule(() => {
            performPeng(p, tile, dp);
            schedule(() => {
              const cur = s();
              let discardIdx;
              try { discardIdx = getAIDecision(cur.hands[p], cur.difficulty); }
              catch (e) { discardIdx = -1; }
              let discarded;
              if (discardIdx < 0 || discardIdx >= cur.hands[p].length) {
                for (let i = 0; i < cur.hands[p].length; i++) {
                  if (!isHongzhong(cur.hands[p][i])) { discarded = cur.hands[p].splice(i, 1)[0]; break; }
                }
              } else { discarded = cur.hands[p].splice(discardIdx, 1)[0]; }
              if (discarded) {
                cur.discards[p].push(discarded);
                cur.lastDiscard = discarded; cur.lastDiscardPlayer = p;
                window.UI.playSound('discard');
                try { render(); } catch (e) {}
                checkResponses(p, discarded);
              }
            }, 500);
          }, 400);
          return;
        }
      }
    }
    nextTurn(dp);
  }

  // ================================================================
  //  endGame
  // ================================================================
  function endGame(winner, type, dianpaoPlayer) {
    const st = s();
    st.phase = 'gameOver';
    cancelAll();

    const modal = document.getElementById('result-modal');
    const title = document.getElementById('result-title');
    const detail = document.getElementById('result-detail');
    const score = document.getElementById('result-score');

    if (type === 'draw') {
      title.textContent = '流局';
      detail.textContent = '牌墙已摸完，无人胡牌';
      score.textContent = '本局不计分';
    } else {
      const isPlayerWin = (winner === 0);
      const { fan, typeName, points } = calcScore(st.hands[winner], st.melds[winner], type);
      title.textContent = isPlayerWin ? '🎉 你赢了！' : (window.UI.aiDirectionName(winner) + ' 胡了');
      let detailText = typeName + '（' + fan + '番）\n胡牌: ' + tileName(st.huTile);
      detailText += '\n牌面: ' + sortHand(st.hands[winner]).map(t => tileName(t)).join(' ');
      detail.textContent = detailText;

      if (isPlayerWin) {
        if (type === 'zimo') {
          const total = points * 3;
          st.scores[0] += total;
          for (let p = 1; p < 4; p++) st.scores[p] -= points;
          score.textContent = '底分10 × ' + fan + '番 = ' + points + '分/家\n自摸三家付: +' + total + '分';
        } else {
          st.scores[0] += points;
          st.scores[dianpaoPlayer] -= points;
          score.textContent = '底分10 × ' + fan + '番 = ' + points + '分\n点炮者付: +' + points + '分';
        }
      } else {
        if (type === 'zimo') {
          for (let p = 0; p < 4; p++) {
            if (p === winner) st.scores[p] += points * 3;
            else st.scores[p] -= points;
          }
          score.textContent = typeName + '（' + fan + '番）\n你付 ' + points + '分 (三家各付)';
        } else {
          if (dianpaoPlayer === 0) {
            st.scores[0] -= points; st.scores[winner] += points;
            score.textContent = typeName + '（' + fan + '番）\n你点炮: -' + points + '分';
          } else {
            st.scores[dianpaoPlayer] -= points; st.scores[winner] += points;
            score.textContent = typeName + '（' + fan + '番）\n' + window.UI.aiDirectionName(dianpaoPlayer) + '点炮';
          }
        }
      }
    }

    modal.classList.add('show');
    window.UI.updateScoreBar();
  }

  // ================================================================
  //  导出
  // ================================================================
  return {
    startNewGame, drawTileFromDeck, playerDiscard,
    aiTurn, checkResponses, nextTurn, playerPass, endGame,
  };
})();
