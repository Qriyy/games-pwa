/**
 * 红中麻将 — 游戏流程模块
 * startNewGame / drawTileFromDeck / playerDiscard / aiTurn / aiWin
 * checkResponses / nextTurn / playerPass / endGame
 */
window.GameFlow = (function() {
  const { HONGZHONG_ID } = window.Constants;
  const { isHongzhong, tileBaseId, tileName, sortHand, buildDeck, shuffle } = window.Tiles;
  const { canHu, canPeng, canGang, canSelfGang } = window.HuDetection;
  const { calcScore } = window.Scoring;
  const { performHu, performPeng, performGang, performQiangGangHu, checkQiangGangHu } = window.Actions;
  const { getAIDecision, shouldPeng, shouldHu } = window.AIBridge;
  const { render } = window.Renderer;

  function s() { return window.state; }

  function startNewGame() {
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

    for (let round = 0; round < 13; round++) {
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
    try { render(); } catch(e) { console.error('startNewGame渲染异常:', e); }

    if (st.dealerIdx !== 0) {
      setTimeout(() => aiTurn(st.dealerIdx), 800);
    }
  }

  function drawTileFromDeck(playerIdx) {
    const st = s();
    if (st.deck.length === 0) {
      endGame(-1, 'draw');
      return;
    }
    const tile = st.deck.pop();
    if (st.deck.length === 0) st.isLastTile = true;

    st.hands[playerIdx].push(tile);

    if (playerIdx === 0) {
      st.hands[0] = sortHand(st.hands[0]);
    }

    if (playerIdx === 0) {
      const selfGangs = canSelfGang(st.hands[0], st.melds[0]);
      if (canHu(st.hands[0], st.melds[0]).canHu) {
        st.canHu = true;
      }
      st.canGang = selfGangs.length > 0;
      st.canPeng = false;
      st.selectedIdx = -1;
      st.phase = 'playerTurn';
      st.turnPhase = 'discard';
      window.UI.updateButtons();
      window.UI.playSound('draw');
    } else {
      window.UI.playSound('draw');
    }

    try { render(); } catch(e) { console.error('drawTile渲染异常:', e); }
    return tile;
  }

  function playerDiscard(idx) {
    const st = s();
    if (st.phase !== 'playerTurn' || st.turnPhase !== 'discard') return;
    if (idx < 0 || idx >= st.hands[0].length) return;

    const tile = st.hands[0][idx];
    if (isHongzhong(tile)) {
      window.UI.setStatus('红中不能打出！');
      return;
    }
    st.hands[0].splice(idx, 1);
    st.hands[0] = sortHand(st.hands[0]);
    st.discards[0].push(tile);
    st.lastDiscard = tile;
    st.lastDiscardPlayer = 0;
    st.selectedIdx = -1;
    st.canHu = false;
    st.canGang = false;
    st.canPeng = false;
    window.UI.playSound('discard');

    try {
      checkResponses(0, tile);
    } catch(err) {
      console.error('玩家出牌后checkResponses异常:', err);
      nextTurn(0);
    }
  }

  function aiTurn(playerIdx) {
    const st = s();
    st.phase = 'aiTurn';
    st.currentPlayer = playerIdx;
    st._aiStartTime = Date.now(); // 健康检查用
    try { render(); } catch(e) { console.error('AI渲染异常:', e); }

    // 安全定时器：3秒后如果还卡在aiTurn就强制推进
    if (_aiSafetyTimer) clearTimeout(_aiSafetyTimer);
    _aiSafetyTimer = setTimeout(() => {
      if (s().phase === 'aiTurn') {
        console.warn('AI超时，强制推进');
        nextTurn(playerIdx);
      }
    }, 3000);

    setTimeout(() => {
      try {
        if (st.deck.length === 0) {
          endGame(-1, 'draw');
          return;
        }
        const tile = st.deck.pop();
        if (st.deck.length === 0) st.isLastTile = true;

        st.hands[playerIdx].push(tile);
        window.UI.playSound('draw');

        // 检查自摸
        if (canHu(st.hands[playerIdx], st.melds[playerIdx]).canHu) {
          if (shouldHu(st.hands[playerIdx], -1, st.difficulty)) {
            aiWin(playerIdx, tile, 'zimo');
            return;
          }
        }

        // 检查自杠
        const selfGangs = canSelfGang(st.hands[playerIdx], st.melds[playerIdx]);
        if (selfGangs.length > 0) {
          const gangBase = selfGangs[0];
          performGang(playerIdx, -1, gangBase);
          st.isAfterGang = true;
          setTimeout(() => aiTurn(playerIdx), 600);
          return;
        }

        st.isAfterGang = false;
        st.isLastTile = false;

        let discardIdx;
        try {
          discardIdx = getAIDecision(st.hands[playerIdx], st.difficulty);
        } catch(e) {
          discardIdx = -1;
        }
        if (discardIdx < 0 || discardIdx >= st.hands[playerIdx].length) {
          // fallback: 打第一张非红中
          for (let i = 0; i < st.hands[playerIdx].length; i++) {
            if (!isHongzhong(st.hands[playerIdx][i])) {
              const discarded = st.hands[playerIdx].splice(i, 1)[0];
              st.discards[playerIdx].push(discarded);
              st.lastDiscard = discarded;
              st.lastDiscardPlayer = playerIdx;
              break;
            }
          }
        } else {
          const discarded = st.hands[playerIdx].splice(discardIdx, 1)[0];
          st.discards[playerIdx].push(discarded);
          st.lastDiscard = discarded;
          st.lastDiscardPlayer = playerIdx;
        }
        window.UI.playSound('discard');
        render();

        checkResponses(playerIdx, st.lastDiscard);
      } catch(err) {
        // 任何异常都强制推进到下一回合，防止游戏卡死
        console.error('AI回合异常:', err.message, err.stack);
        nextTurn(playerIdx);
      }
    }, 500 + Math.random() * 400);
  }

  function aiWin(playerIdx, tile, type) {
    const st = s();
    st.winner = playerIdx;
    st.winType = type;
    st.huTile = tile;
    st.phase = 'gameOver';
    window.UI.playSound('hu');
    endGame(playerIdx, type);
  }

  function checkResponses(discardPlayer, tile) {
    const st = s();

    let huPlayers = [];
    let gangPlayers = [];
    let pengPlayers = [];

    for (let p = 0; p < 4; p++) {
      if (p === discardPlayer) continue;
      const testHand = [...st.hands[p], tile];

      if (canHu(testHand, st.melds[p]).canHu) {
        huPlayers.push(p);
      } else if (canGang(st.hands[p], tile, st.melds[p])) {
        gangPlayers.push(p);
      } else if (canPeng(st.hands[p], tile)) {
        pengPlayers.push(p);
      }
    }

    // 胡优先
    if (huPlayers.length > 0) {
      if (huPlayers.includes(0)) {
        st.canHu = true;
        st.canPeng = false;
        st.canGang = false;
        st.pendingActions = ['hu', 'pass'];
        st.phase = 'playerTurn';
        st.turnPhase = 'response';
        window.UI.updateButtons();
        render();
        // AI胡
        for (const p of huPlayers) {
          if (p !== 0) {
            setTimeout(() => {
              performHu(p, tile, discardPlayer);
              endGame(p, 'dianpao', discardPlayer);
            }, 300);
            return;
          }
        }
        return;
      }
      const aiHu = huPlayers.find(p => p !== 0);
      if (aiHu !== undefined) {
        setTimeout(() => {
          performHu(aiHu, tile, discardPlayer);
          endGame(aiHu, 'dianpao', discardPlayer);
        }, 500);
        return;
      }
    }

    // 杠
    if (gangPlayers.length > 0) {
      if (gangPlayers.includes(0)) {
        st.canGang = true;
        st.canPeng = false;
        st.canHu = false;
        st.pendingActions = ['gang', 'pass'];
        st.phase = 'playerTurn';
        st.turnPhase = 'response';
        window.UI.updateButtons();
        render();
        return;
      }
      const aiGang = gangPlayers.find(p => p !== 0);
      if (aiGang !== undefined) {
        setTimeout(() => {
          const result = performGang(aiGang, tile, tileBaseId(tile));
          // 抢杠胡检查
          const qg = result ? checkQiangGangHu(aiGang, result.gangTile, result.gangType) : null;
          if (qg && typeof qg === 'object') {
            if (qg.player !== 0) {
              setTimeout(() => {
                performQiangGangHu(qg.player, qg.tile, qg.gangPlayer);
                endGame(qg.player, 'qiangganghu', qg.gangPlayer);
              }, 300);
            }
            // player 0: UI 已由 checkQiangGangHu 设置
            return;
          }
          setTimeout(() => aiTurn(aiGang), 600);
        }, 500);
        return;
      }
    }

    // 碰
    if (pengPlayers.length > 0) {
      if (pengPlayers.includes(0)) {
        st.canPeng = true;
        st.canGang = false;
        st.canHu = false;
        st.pendingActions = ['peng', 'pass'];
        st.phase = 'playerTurn';
        st.turnPhase = 'response';
        window.UI.updateButtons();
        render();
        return;
      }
      const aiPeng = pengPlayers.find(p => p !== 0);
      if (aiPeng !== undefined) {
        setTimeout(() => {
          performPeng(aiPeng, tile, discardPlayer);
          setTimeout(() => {
            const discardIdx = getAIDecision(st.hands[aiPeng], st.difficulty);
            let discarded;
            if (discardIdx < 0 || discardIdx >= st.hands[aiPeng].length) {
              for (let i = 0; i < st.hands[aiPeng].length; i++) {
                if (!isHongzhong(st.hands[aiPeng][i])) {
                  discarded = st.hands[aiPeng].splice(i, 1)[0];
                  break;
                }
              }
            } else {
              discarded = st.hands[aiPeng].splice(discardIdx, 1)[0];
            }
            if (discarded) {
              st.discards[aiPeng].push(discarded);
              st.lastDiscard = discarded;
              st.lastDiscardPlayer = aiPeng;
              window.UI.playSound('discard');
              render();
              checkResponses(aiPeng, discarded);
            }
          }, 500);
        }, 500);
        return;
      }
    }

    nextTurn(discardPlayer);
  }

  let _aiSafetyTimer = null;

  function nextTurn(fromPlayer) {
    const st = s();
    let next = (fromPlayer + 1) % 4;
    st.currentPlayer = next;
    st.lastDiscard = -1;
    st._aiStartTime = null; // 清除健康检查时间戳

    // 清除安全定时器
    if (_aiSafetyTimer) { clearTimeout(_aiSafetyTimer); _aiSafetyTimer = null; }

    try {
      if (next === 0) {
        st.phase = 'playerTurn';
        st.turnPhase = 'draw';
        drawTileFromDeck(0);
      } else {
        aiTurn(next);
      }
    } catch(err) {
      console.error('nextTurn异常:', err);
      // 强制切到玩家回合
      st.phase = 'playerTurn';
      st.turnPhase = 'discard';
      st.selectedIdx = -1;
      window.UI.updateButtons();
      render();
    }
  }

  function playerPass() {
    const st = s();
    st.canHu = false;
    st.canGang = false;
    st.canPeng = false;
    st.selectedIdx = -1;
    st.pendingActions = [];
    window.UI.updateButtons();

    nextTurn(st.lastDiscardPlayer);
  }

  function endGame(winner, type, dianpaoPlayer) {
    const st = s();
    st.phase = 'gameOver';

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

      title.textContent = isPlayerWin ? '🎉 你赢了！' : `${window.UI.aiDirectionName(winner)} 胡了`;

      let detailText = `${typeName}（${fan}番）`;
      detailText += `\n胡牌: ${tileName(st.huTile)}`;

      const winHand = sortHand(st.hands[winner]);
      detailText += '\n牌面: ' + winHand.map(t => tileName(t)).join(' ');
      detail.textContent = detailText;

      if (isPlayerWin) {
        if (type === 'zimo') {
          const total = points * 3;
          st.scores[0] += total;
          for (let p = 1; p < 4; p++) st.scores[p] -= points;
          let scoreText = `底分10 × ${fan}番 = ${points}分/家\n自摸三家付: +${total}分`;
          if (st.gangLog.length > 0) scoreText += `\n杠分已计入总分`;
          score.textContent = scoreText;
        } else {
          st.scores[0] += points;
          st.scores[dianpaoPlayer] -= points;
          let scoreText = `底分10 × ${fan}番 = ${points}分\n点炮者付: +${points}分`;
          if (st.gangLog.length > 0) scoreText += `\n杠分已计入总分`;
          score.textContent = scoreText;
        }
      } else {
        if (type === 'zimo') {
          for (let p = 0; p < 4; p++) {
            if (p === winner) st.scores[p] += points * 3;
            else st.scores[p] -= points;
          }
          let scoreText = `${typeName}（${fan}番）\n你付 ${points}分 (三家各付)`;
          if (st.gangLog.length > 0) scoreText += `\n杠分已计入总分`;
          score.textContent = scoreText;
        } else {
          if (dianpaoPlayer === 0) {
            st.scores[0] -= points;
            st.scores[winner] += points;
            let scoreText = `${typeName}（${fan}番）\n你点炮: -${points}分`;
            if (st.gangLog.length > 0) scoreText += `\n杠分已计入总分`;
            score.textContent = scoreText;
          } else {
            st.scores[dianpaoPlayer] -= points;
            st.scores[winner] += points;
            let scoreText = `${typeName}（${fan}番）\n${window.UI.aiDirectionName(dianpaoPlayer)} 点炮`;
            if (st.gangLog.length > 0) scoreText += `\n杠分已计入总分`;
            score.textContent = scoreText;
          }
        }
      }

      window.UI.updateScoreBar();
    }

    modal.classList.add('show');
    render();
  }

  return {
    startNewGame, drawTileFromDeck, playerDiscard,
    aiTurn, aiWin, checkResponses, nextTurn, playerPass, endGame,
  };
})();
