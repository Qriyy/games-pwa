/**
 * 红中麻将 — 自动打牌机器人（页面内嵌）
 * 添加方式：在 index.html 的 </body> 前添加：
 *   <script src="js/bot.js"></script>
 * 或者直接复制此文件内容到浏览器控制台执行。
 */
(function() {
  'use strict';

  var BOT_ACTIVE = true;       // 是否启用自动打牌
  const AI_WAIT   = 1200;      // AI 回合等待基础时间 (ms)
  const HUMAN_WAIT = 600;      // 玩家操作延迟 (ms)
  const MAX_ROUNDS = 10;       // 最大对局数

  if (!BOT_ACTIVE) return;
  console.log('%c🀄 红中麻将自动打牌已启动', 'color:#D4A545;font-size:16px;font-weight:bold');

  var roundCount = 0;
  var isPlaying  = false;
  var timer      = null;

  function log(msg) {
    console.log('[Bot]', msg);
  }

  function clearBotTimer() {
    if (timer) { clearTimeout(timer); timer = null; }
  }

  // 等待状态就绪
  function waitFor(fn, callback, interval) {
    clearBotTimer();
    if (!BOT_ACTIVE) return;
    timer = setInterval(function() {
      try {
        if (fn()) {
          clearBotTimer();
          callback();
        }
      } catch(e) { /* ignore */ }
    }, interval || 200);
  }

  // 获取游戏状态摘要
  function getState() {
    var st = window.state;
    if (!st || !st.hands) return null;
    return {
      phase: st.phase,
      turnPhase: st.turnPhase,
      cp: st.currentPlayer,
      handLen: (st.hands[0] || []).length,
      deckLen: (st.deck || []).length,
      canHu: st.canHu,
      canGang: st.canGang,
      canPeng: st.canPeng,
      scores: (st.scores || []).slice(),
      lastDiscard: st.lastDiscard,
      lastDiscardPlayer: st.lastDiscardPlayer
    };
  }

  // ===== 玩家回合决策（使用 AI 模块） =====
  function playerTurn() {
    if (isPlaying) return;
    isPlaying = true;

    try {
      var st = window.state;
      if (st.phase !== 'playerTurn') { isPlaying = false; return; }

      // 如果是 response 阶段（碰/杠/胡选择）
      if (st.turnPhase === 'response') {
        handleResponsePhase();
        isPlaying = false;
        return;
      }

      // 如果是 draw 阶段（刚摸牌），检查自摸/自杠
      if (st.turnPhase === 'draw') {
        if (st.canHu) {
          log('自摸！点胡按钮...');
          document.getElementById('btnHu').click();
          isPlaying = false;
          return;
        }
        if (st.canGang) {
          log('自杠！点杠按钮...');
          document.getElementById('btnGang').click();
          isPlaying = false;
          return;
        }
        // 没动作则等过渡到 discard
        isPlaying = false;
        return;
      }

      // discard 阶段：出牌
      if (st.turnPhase === 'discard') {
        setTimeout(function() {
          try {
            if (window.state.phase !== 'playerTurn' || window.state.turnPhase !== 'discard') {
              isPlaying = false;
              return;
            }

            var hand = window.Tiles.sortHand(window.state.hands[0]);
            var aiResult;

            // 用 AI 桥接层获取要打出的牌（返回牌值，非索引）
            try {
              aiResult = window.AIBridge.getAIDecision(window.state.hands[0], window.state.difficulty);
            } catch(e) {
              aiResult = -1;
            }

            var discardIdx = -1;
            if (aiResult >= 0) {
              // getAIDecision 返回的是 aiHand 中的索引，需要从原始手牌中找到对应的牌值
              var rawHand = window.state.hands[0];
              var aiHand = window.Tiles.toAIHand(rawHand);
              // 如果 aiResult 是索引（数字小于手牌长度），则取 aiHand[aiResult] 再转回游戏编码
              var aiTile;
              if (aiResult < rawHand.length) {
                aiTile = aiHand[aiResult];
              } else {
                aiTile = aiResult; // fallback: 当作牌值处理
              }
              var gameTile = window.Tiles.fromAITile(aiTile);
              for (var i = 0; i < hand.length; i++) {
                if (hand[i] === gameTile) { discardIdx = i; break; }
              }
            }

            if (discardIdx < 0) discardIdx = 0;

            log('出牌: ' + window.Tiles.tileName(hand[discardIdx]) + ' (位置 ' + discardIdx + ')');
            window.state.selectedIdx = discardIdx;
            window.Renderer.render();

            setTimeout(function() {
              try {
                if (window.state.phase === 'playerTurn' && window.state.turnPhase === 'discard') {
                  window.GameFlow.playerDiscard(discardIdx);
                }
              } catch(e) { log('出牌异常: ' + e.message); }
              isPlaying = false;
            }, HUMAN_WAIT);
          } catch(e) {
            log('出牌决策异常: ' + e.message);
            isPlaying = false;
          }
        }, 300);
        return;
      }
    } catch(e) {
      log('playerTurn异常: ' + e.message);
    }
    isPlaying = false;
  }

  // ===== 响应阶段处理 =====
  function handleResponsePhase() {
    setTimeout(function() {
      try {
        var st = window.state;
        if (st.turnPhase !== 'response') return;

        var canHu = !document.getElementById('btnHu').disabled;
        var canGang = !document.getElementById('btnGang').disabled;
        var canPeng = !document.getElementById('btnPeng').disabled;
        var canPass = !document.getElementById('btnPass').disabled;

        // 策略：胡 > 杠 > 碰 > 过
        if (canHu) {
          log('胡！点炮');
          document.getElementById('btnHu').click();
        } else if (canGang) {
          log('杠！');
          document.getElementById('btnGang').click();
        } else if (canPeng) {
          log('碰！');
          document.getElementById('btnPeng').click();
        } else if (canPass) {
          log('过');
          document.getElementById('btnPass').click();
        }
      } catch(e) { log('响应处理异常: ' + e.message); }
    }, 400);
  }

  // ===== 检测游戏结束并开始下一局 =====
  function checkGameOver() {
    try {
      var st = window.state;
      if (st.phase === 'gameOver') {
        roundCount++;
        log('=== 第' + roundCount + '局结束 === 分数: ' + JSON.stringify(st.scores));

        if (roundCount >= MAX_ROUNDS) {
          log('=== 自动打牌完成！共 ' + MAX_ROUNDS + ' 局 ===');
          log('最终分数: ' + JSON.stringify(st.scores));
          log('总得分: ' + st.scores[0]);
          return;
        }

        // 等待结算弹窗出现，然后点击再来一局
        setTimeout(function() {
          try {
            var modal = document.getElementById('result-modal');
            if (modal && modal.classList.contains('show')) {
              log('开始下一局...');
              document.getElementById('btnNewRound').click();
            } else {
              // 如果弹窗没显示，手动检查
              checkGameOver();
            }
          } catch(e) {}
        }, 1500);
      }
    } catch(e) {}
  }

  // ===== 监控循环 =====
  function monitor() {
    if (!BOT_ACTIVE) return;

    var st = getState();
    if (!st) { setTimeout(monitor, 500); return; }

    // 检测游戏结束
    checkGameOver();

    // 当是玩家的回合且 bot 空闲时
    if (st.phase === 'playerTurn' && !isPlaying) {
      playerTurn();
    }

    // AI 回合：等它自动执行
    setTimeout(monitor, AI_WAIT / 4);
  }

  // ===== 劫持 GameFlow 方法，在新局开始时自动接管 =====
  var origStartNewGame = window.GameFlow && window.GameFlow.startNewGame;
  if (origStartNewGame) {
    window.GameFlow.startNewGame = function() {
      origStartNewGame.apply(window.GameFlow, arguments);
      log('新局开始');
      roundCount++;
      isPlaying = false;
      clearBotTimer();
    };
  }

  // ===== 启动 =====
  log('等待游戏初始化...');
  var initCheck = setInterval(function() {
    try {
      if (window.state && window.state.phase && window.GameFlow && window.Renderer) {
        clearInterval(initCheck);
        log('游戏已加载，开始监控...');
        setTimeout(monitor, 1500);
      }
    } catch(e) {}
  }, 300);

  // 暴露停止函数
  window.stopBot = function() {
    BOT_ACTIVE = false;
    clearBotTimer();
    log('自动打牌已停止');
  };
})();
