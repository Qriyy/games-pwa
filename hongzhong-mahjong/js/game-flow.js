/**
 * 红中麻将 — 游戏流程模块（状态机版本）
 *
 * 用 requestAnimationFrame + actionQueue 替代所有 setTimeout 链式调用，
 * 彻底消除竞态条件。所有延迟动作通过 enqueue() 入队，统一由 tick() 驱动。
 *
 * 核心机制：
 *   - _actionQueue: 待执行动作队列，每项带 delay 和 generation 标记
 *   - _generation:  世代计数器，clearQueue() 时递增，旧世代的动作自动跳过
 *   - tick():       requestAnimationFrame 循环，每帧最多执行一个到期动作
 *
 * 导出接口（保持不变）：
 *   startNewGame, drawTileFromDeck, playerDiscard, aiTurn, aiWin,
 *   checkResponses, nextTurn, playerPass, endGame
 */
window.GameFlow = (function () {
  /* ========== 依赖模块 ========== */
  const { HONGZHONG_ID } = window.Constants;
  const { isHongzhong, tileBaseId, tileName, sortHand, buildDeck, shuffle } = window.Tiles;
  const { canHu, canPeng, canGang, canSelfGang } = window.HuDetection;
  const { calcScore } = window.Scoring;
  const { performHu, performPeng, performGang, performQiangGangHu, checkQiangGangHu } = window.Actions;
  const { getAIDecision, shouldPeng, shouldHu } = window.AIBridge;
  const { render } = window.Renderer;

  /** 快捷访问全局状态 */
  function s() { return window.state; }

  /* ================================================================
   *  动作队列 — 彻底替代 setTimeout / clearTimeout
   * ================================================================ */

  /** @type {Array<{gen:number, enqueuedAt:number, delay:number, fn:Function}>} */
  let _actionQueue = [];

  /** 世代计数器；每次 clearQueue() 递增，旧世代的动作在执行前被跳过 */
  let _generation = 0;

  /** requestAnimationFrame 循环是否正在运行 */
  let _tickRunning = false;

  /**
   * 入队一个延迟动作
   * @param {number}   delay  延迟毫秒数（从入队时刻算起）
   * @param {Function} fn     到期后执行的回调
   */
  function enqueue(delay, fn) {
    _actionQueue.push({
      gen: _generation,
      enqueuedAt: Date.now(),
      delay: delay,
      fn: fn,
    });
    ensureTick();
  }

  /** 清空队列并使所有已入队动作失效（递增 generation） */
  function clearQueue() {
    _generation++;
    _actionQueue.length = 0;
  }

  /** 确保 tick 循环正在运行 */
  function ensureTick() {
    if (!_tickRunning) {
      _tickRunning = true;
      requestAnimationFrame(tick);
    }
  }

  /**
   * 主循环 — 每帧从队列头部取一个动作：
   *   1. 未到延迟 → 跳过，等下一帧
   *   2. 世代不匹配 → 已失效，丢弃
   *   3. 游戏已结束 → 清空队列，停止循环
   *   4. 正常 → 执行动作，然后请求下一帧
   */
  function tick() {
    if (_actionQueue.length === 0) {
      _tickRunning = false;
      return;
    }

    const action = _actionQueue[0];
    const elapsed = Date.now() - action.enqueuedAt;

    // 还没到执行时间
    if (elapsed < action.delay) {
      requestAnimationFrame(tick);
      return;
    }

    // 取出队首
    _actionQueue.shift();

    // 世代不匹配 → 已失效（被 clearQueue 清除过）
    if (action.gen !== _generation) {
      requestAnimationFrame(tick);
      return;
    }

    // 游戏已结束
    if (s().phase === 'gameOver') {
      _actionQueue.length = 0;
      _tickRunning = false;
      return;
    }

    // 执行动作
    try {
      action.fn();
    } catch (err) {
      console.error('动作队列执行异常:', err);
      // 不中断循环，继续处理下一个
    }

    requestAnimationFrame(tick);
  }

  /* ================================================================
   *  常量
   * ================================================================ */

  // 逆时针出牌顺序：南(0)→东(3)→北(1)→西(2)→南(0)
  const TURN_ORDER = [3, 1, 2, 0]; // TURN_ORDER[from] = 下一个玩家

  /* ================================================================
   *  startNewGame — 开始新局
   * ================================================================ */
  function startNewGame() {
    clearQueue(); // 清空所有旧动作

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

    // 发牌：每人 13 张
    for (let round = 0; round < 13; round++) {
      for (let p = 0; p < 4; p++) {
        st.hands[p].push(st.deck.pop());
      }
    }

    // 庄家多摸一张
    st.currentPlayer = st.dealerIdx;
    st.hands[st.dealerIdx].push(st.deck.pop());
    st.hands[st.dealerIdx] = sortHand(st.hands[st.dealerIdx]);

    // 庄家是玩家时检查天胡
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
    try { render(); } catch (e) { console.error('startNewGame渲染异常:', e); }

    // 庄家是 AI → 延迟开始 AI 回合
    if (st.dealerIdx !== 0) {
      enqueue(800, () => aiTurn(st.dealerIdx));
    }
  }

  /* ================================================================
   *  drawTileFromDeck — 从牌墙摸牌（同步，不入队）
   * ================================================================ */
  function drawTileFromDeck(playerIdx) {
    const st = s();
    if (st.deck.length === 0) {
      endGame(-1, 'draw');
      return null;
    }
    const tile = st.deck.pop();
    if (st.deck.length === 0) st.isLastTile = true;

    st.hands[playerIdx].push(tile);

    if (playerIdx === 0) {
      st.hands[0] = sortHand(st.hands[0]);
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

    try { render(); } catch (e) { console.error('drawTile渲染异常:', e); }
    return tile;
  }

  /* ================================================================
   *  playerDiscard — 玩家出牌（直接执行，不入队）
   * ================================================================ */
  function playerDiscard(idx) {
    const st = s();
    if (st.phase !== 'playerTurn' || st.turnPhase !== 'discard') return;
    if (idx < 0 || idx >= st.hands[0].length) return;

    const tile = st.hands[0][idx];
    if (isHongzhong(tile)) {
      window.UI.setStatus('红中不能打出！');
      return;
    }

    // 执行出牌
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
    } catch (err) {
      console.error('玩家出牌后checkResponses异常:', err);
      nextTurn(0);
    }
  }

  /* ================================================================
   *  aiTurn — AI 回合（入队执行，500-900ms 模拟思考）
   * ================================================================ */
  function aiTurn(playerIdx) {
    const st = s();
    st.phase = 'aiTurn';
    st.currentPlayer = playerIdx;
    try { render(); } catch (e) { console.error('AI渲染异常:', e); }

    const delay = 500 + Math.random() * 400;

    enqueue(delay, () => {
      const cur = s();
      // 状态校验：必须仍是该 AI 的回合
      if (cur.phase !== 'aiTurn' || cur.currentPlayer !== playerIdx) return;
      if (cur.phase === 'gameOver') return;

      try {
        // ---- 摸牌 ----
        if (cur.deck.length === 0) {
          endGame(-1, 'draw');
          return;
        }
        const tile = cur.deck.pop();
        if (cur.deck.length === 0) cur.isLastTile = true;
        cur.hands[playerIdx].push(tile);
        window.UI.playSound('draw');

        // ---- 检查自摸 ----
        if (canHu(cur.hands[playerIdx], cur.melds[playerIdx]).canHu) {
          if (shouldHu(cur.hands[playerIdx], -1, cur.difficulty)) {
            aiWin(playerIdx, tile, 'zimo');
            return;
          }
        }

        // ---- 检查自杠 ----
        const selfGangs = canSelfGang(cur.hands[playerIdx], cur.melds[playerIdx]);
        if (selfGangs.length > 0) {
          const gangBase = selfGangs[0];
          performGang(playerIdx, -1, gangBase);
          cur.isAfterGang = true;
          // 杠后补牌 → 递归 AI 回合
          enqueue(600, () => aiTurn(playerIdx));
          return;
        }

        cur.isAfterGang = false;
        cur.isLastTile = false;

        // ---- AI 决策：出哪张牌 ----
        let discardIdx;
        try {
          discardIdx = getAIDecision(cur.hands[playerIdx], cur.difficulty);
        } catch (e) {
          discardIdx = -1;
        }

        if (discardIdx < 0 || discardIdx >= cur.hands[playerIdx].length) {
          // fallback：打第一张非红中
          for (let i = 0; i < cur.hands[playerIdx].length; i++) {
            if (!isHongzhong(cur.hands[playerIdx][i])) {
              const discarded = cur.hands[playerIdx].splice(i, 1)[0];
              cur.discards[playerIdx].push(discarded);
              cur.lastDiscard = discarded;
              cur.lastDiscardPlayer = playerIdx;
              break;
            }
          }
        } else {
          const discarded = cur.hands[playerIdx].splice(discardIdx, 1)[0];
          cur.discards[playerIdx].push(discarded);
          cur.lastDiscard = discarded;
          cur.lastDiscardPlayer = playerIdx;
        }

        window.UI.playSound('discard');
        try { render(); } catch (e) { console.error('AI出牌渲染异常:', e); }

        // ---- 检查其他玩家响应 ----
        checkResponses(playerIdx, cur.lastDiscard);
      } catch (err) {
        console.error('AI回合异常:', err.message, err.stack);
        nextTurn(playerIdx);
      }
    });
  }

  /* ================================================================
   *  aiWin — AI 胡牌（直接执行，清空队列）
   * ================================================================ */
  function aiWin(playerIdx, tile, type) {
    const st = s();
    st.winner = playerIdx;
    st.winType = type;
    st.huTile = tile;
    st.phase = 'gameOver';
    clearQueue();
    window.UI.playSound('hu');
    endGame(playerIdx, type);
  }

  /* ================================================================
   *  checkResponses — 检查所有人对弃牌的响应
   *
   *  优先级：胡 > 杠 > 碰 > 过
   *  玩家(0)需要等待操作时直接设置状态，不入队；
   *  AI 响应通过 enqueue 延迟执行。
   * ================================================================ */
  function checkResponses(discardPlayer, tile) {
    const st = s();

    // 扫描所有玩家的响应能力
    const huPlayers = [];
    const gangPlayers = [];
    const pengPlayers = [];

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

    // ---- 胡（最高优先级）----
    if (huPlayers.length > 0) {
      if (huPlayers.includes(0)) {
        // 玩家可以胡 → 显示按钮，等待操作
        st.canHu = true;
        st.canPeng = false;
        st.canGang = false;
        st.pendingActions = ['hu', 'pass'];
        st.phase = 'playerTurn';
        st.turnPhase = 'response';
        window.UI.updateButtons();
        render();
        // 如果同时有 AI 可以胡，入队 AI 胡（300ms 后）
        for (const p of huPlayers) {
          if (p !== 0) {
            enqueue(300, () => {
              performHu(p, tile, discardPlayer);
              endGame(p, 'dianpao', discardPlayer);
            });
            return;
          }
        }
        return;
      }
      // 只有 AI 能胡
      const aiHu = huPlayers.find(p => p !== 0);
      if (aiHu !== undefined) {
        enqueue(500, () => {
          performHu(aiHu, tile, discardPlayer);
          endGame(aiHu, 'dianpao', discardPlayer);
        });
        return;
      }
    }

    // ---- 杠 ----
    if (gangPlayers.length > 0) {
      if (gangPlayers.includes(0)) {
        // 玩家可以杠 → 显示按钮
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
        enqueue(500, () => {
          const result = performGang(aiGang, tile, tileBaseId(tile));
          // 抢杠胡检查
          const qg = result ? checkQiangGangHu(aiGang, result.gangTile, result.gangType) : null;
          if (qg && typeof qg === 'object') {
            if (qg.player !== 0) {
              enqueue(300, () => {
                performQiangGangHu(qg.player, qg.tile, qg.gangPlayer);
                endGame(qg.player, 'qiangganghu', qg.gangPlayer);
              });
            }
            // player 0: UI 已由 checkQiangGangHu 设置
            return;
          }
          // 无抢杠胡 → 杠后继续 AI 回合
          enqueue(600, () => aiTurn(aiGang));
        });
        return;
      }
    }

    // ---- 碰 ----
    if (pengPlayers.length > 0) {
      if (pengPlayers.includes(0)) {
        // 玩家可以碰 → 显示按钮
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
        enqueue(500, () => {
          performPeng(aiPeng, tile, discardPlayer);
          enqueue(500, () => {
            const cur = s();
            // AI 碰后出牌
            let discardIdx;
            try {
              discardIdx = getAIDecision(cur.hands[aiPeng], cur.difficulty);
            } catch (e) {
              discardIdx = -1;
            }
            let discarded;
            if (discardIdx < 0 || discardIdx >= cur.hands[aiPeng].length) {
              for (let i = 0; i < cur.hands[aiPeng].length; i++) {
                if (!isHongzhong(cur.hands[aiPeng][i])) {
                  discarded = cur.hands[aiPeng].splice(i, 1)[0];
                  break;
                }
              }
            } else {
              discarded = cur.hands[aiPeng].splice(discardIdx, 1)[0];
            }
            if (discarded) {
              cur.discards[aiPeng].push(discarded);
              cur.lastDiscard = discarded;
              cur.lastDiscardPlayer = aiPeng;
              window.UI.playSound('discard');
              try { render(); } catch (e) { console.error('碰后出牌渲染异常:', e); }
              checkResponses(aiPeng, discarded);
            }
          });
        });
        return;
      }
    }

    // ---- 无人响应 → 下一回合 ----
    nextTurn(discardPlayer);
  }

  /* ================================================================
   *  nextTurn — 切换到下一个玩家
   * ================================================================ */
  function nextTurn(fromPlayer) {
    const st = s();
    const next = TURN_ORDER[fromPlayer];
    st.currentPlayer = next;
    st.lastDiscard = -1;

    // 清空队列，所有旧动作失效
    clearQueue();

    try {
      if (next === 0) {
        // 玩家回合：直接摸牌
        st.phase = 'playerTurn';
        st.turnPhase = 'draw';
        drawTileFromDeck(0);
      } else {
        // AI 回合：入队执行
        aiTurn(next);
      }
    } catch (err) {
      console.error('nextTurn异常:', err);
      // 强制切到玩家回合
      st.phase = 'playerTurn';
      st.turnPhase = 'discard';
      st.selectedIdx = -1;
      window.UI.updateButtons();
      render();
    }
  }

  /* ================================================================
   *  playerPass — 玩家"过"（不入队，直接执行）
   * ================================================================ */
  function playerPass() {
    const st = s();
    clearQueue(); // 清空所有旧动作

    st.canHu = false;
    st.canGang = false;
    st.canPeng = false;
    st.selectedIdx = -1;
    st.pendingActions = [];
    window.UI.updateButtons();

    // 玩家过了 → 检查其他 AI 是否能响应这张弃牌
    const tile = st.lastDiscard;
    const discardPlayer = st.lastDiscardPlayer;

    if (tile > 0 && discardPlayer >= 0) {
      // 优先检查 AI 胡
      for (let p = 1; p < 4; p++) {
        if (p === discardPlayer) continue;
        if (canHu([...st.hands[p], tile], st.melds[p]).canHu) {
          if (shouldHu(st.hands[p], tile, st.difficulty)) {
            enqueue(400, () => {
              performHu(p, tile, discardPlayer);
              endGame(p, 'dianpao', discardPlayer);
            });
            return;
          }
        }
      }
      // 检查 AI 碰
      for (let p = 1; p < 4; p++) {
        if (p === discardPlayer) continue;
        if (canPeng(st.hands[p], tile) && shouldPeng(st.hands[p], tile, st.difficulty)) {
          st.phase = 'aiTurn';
          st.currentPlayer = p;
          enqueue(400, () => {
            performPeng(p, tile, discardPlayer);
            enqueue(500, () => {
              const cur = s();
              let discardIdx;
              try {
                discardIdx = getAIDecision(cur.hands[p], cur.difficulty);
              } catch (e) {
                discardIdx = -1;
              }
              let discarded;
              if (discardIdx < 0 || discardIdx >= cur.hands[p].length) {
                for (let i = 0; i < cur.hands[p].length; i++) {
                  if (!isHongzhong(cur.hands[p][i])) {
                    discarded = cur.hands[p].splice(i, 1)[0];
                    break;
                  }
                }
              } else {
                discarded = cur.hands[p].splice(discardIdx, 1)[0];
              }
              if (discarded) {
                cur.discards[p].push(discarded);
                cur.lastDiscard = discarded;
                cur.lastDiscardPlayer = p;
                window.UI.playSound('discard');
                try { render(); } catch (e) { console.error('碰后出牌渲染异常:', e); }
                checkResponses(p, discarded);
              }
            });
          });
          return;
        }
      }
    }

    // 没有 AI 要响应 → 正常下一回合
    nextTurn(discardPlayer);
  }

  /* ================================================================
   *  endGame — 结束游戏，显示结果弹窗
   * ================================================================ */
  function endGame(winner, type, dianpaoPlayer) {
    const st = s();
    st.phase = 'gameOver';
    clearQueue(); // 游戏结束，清空所有队列

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

  /* ================================================================
   *  导出接口
   * ================================================================ */
  return {
    startNewGame, drawTileFromDeck, playerDiscard,
    aiTurn, aiWin, checkResponses, nextTurn, playerPass, endGame,
  };
})();
