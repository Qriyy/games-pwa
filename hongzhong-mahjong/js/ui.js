/**
 * 红中麻将 — UI 交互模块（移动端版）
 */
window.UI = (function() {
  var Tiles = window.Tiles;
  var HuDetection = window.HuDetection;
  var Actions = window.Actions;
  var GameFlow = window.GameFlow;
  var render = window.Renderer.render;

  function s() { return window.state; }

  function aiDirectionName(idx) { return ['', '北AI', '西AI', '东AI'][idx] || 'AI'; }

  function setStatus(t) { document.getElementById('status-bar').textContent = t; }

  function updateButtons() {
    var st = s();
    document.getElementById('btnHu').disabled = !st.canHu;
    document.getElementById('btnGang').disabled = !st.canGang;
    document.getElementById('btnPeng').disabled = !st.canPeng;
    document.getElementById('btnPass').disabled = !(st.turnPhase === 'response' && (st.canHu || st.canGang || st.canPeng));
  }

  function updateScoreBar() {
    var st = s(); var names = ['你', '北AI', '西AI', '东AI'];
    var t = '红中麻将 | ';
    for (var i = 0; i < 4; i++) t += names[i] + ':' + st.scores[i] + '  ';
    document.getElementById('status-bar').textContent = t;
  }

  function playSound(n) {
    try {
      if (window.HongZhongAudio) {
        var fn = 'play' + n.charAt(0).toUpperCase() + n.slice(1);
        if (typeof HongZhongAudio[fn] === 'function') HongZhongAudio[fn]();
      }
    } catch(e) {}
  }

  // ===== 点击处理 =====
  function handleClick(e) {
    var st = s();
    if (st.phase !== 'playerTurn' || st.turnPhase !== 'discard') return;
    if (!st._playerTilePositions || !st._playerTilePositions.length) return;

    var cv = document.getElementById('gameCanvas');
    if (!cv) return;
    var rect = cv.getBoundingClientRect();
    var x = e.clientX - rect.left, y = e.clientY - rect.top;

    for (var i = st._playerTilePositions.length - 1; i >= 0; i--) {
      var tp = st._playerTilePositions[i];
      if (x >= tp.x && x <= tp.x + tp.w && y >= tp.y && y <= tp.y + tp.h) {
        if (st.selectedIdx === i) { GameFlow.playerDiscard(i); }
        else { st.selectedIdx = i; playSound('click'); render(); }
        return;
      }
    }
    if (st.selectedIdx >= 0) { st.selectedIdx = -1; render(); }
  }

  // ===== 初始化 =====
  function init() {
    var cv = document.getElementById('gameCanvas');
    if (cv) {
      cv.addEventListener('click', handleClick);
    }

    document.getElementById('btnHu').addEventListener('click', function() {
      var st = s(); if (!st.canHu) return;
      playSound('click');
      if (st.turnPhase === 'response') {
        Actions.performHu(0, st.lastDiscard, st.lastDiscardPlayer);
        GameFlow.endGame(0, 'dianpao', st.lastDiscardPlayer);
      } else {
        st.winner = 0; st.winType = 'zimo';
        st.huTile = st.hands[0][st.hands[0].length - 1];
        st.phase = 'gameOver'; playSound('hu');
        GameFlow.endGame(0, 'zimo');
      }
    });

    document.getElementById('btnGang').addEventListener('click', function() {
      var st = s(); if (!st.canGang) return;
      playSound('click');
      if (st.turnPhase === 'response') {
        Actions.performGang(0, st.lastDiscard, Tiles.tileBaseId(st.lastDiscard));
        st.isAfterGang = true;
        GameFlow.drawTileFromDeck(0);
      } else {
        var gangs = HuDetection.canSelfGang(st.hands[0], st.melds[0]);
        if (gangs.length > 0) {
          Actions.performGang(0, -1, gangs[0]);
          st.isAfterGang = true;
          GameFlow.drawTileFromDeck(0);
        }
      }
    });

    document.getElementById('btnPeng').addEventListener('click', function() {
      var st = s(); if (!st.canPeng) return;
      playSound('click');
      Actions.performPeng(0, st.lastDiscard, st.lastDiscardPlayer);
      setStatus('你碰了！请出牌');
      st.phase = 'playerTurn'; st.turnPhase = 'discard';
      st.canPeng = false; st.canGang = false; st.canHu = false;
      updateButtons(); render();
    });

    document.getElementById('btnPass').addEventListener('click', function() {
      playSound('click'); GameFlow.playerPass();
    });

    document.getElementById('btnNewRound').addEventListener('click', function() {
      document.getElementById('result-modal').classList.remove('show');
      updateScoreBar(); GameFlow.startNewGame();
    });

    document.getElementById('btnNewGame').addEventListener('click', function() {
      document.getElementById('result-modal').classList.remove('show');
      updateScoreBar(); GameFlow.startNewGame();
    });

    // 启动
    window.Renderer.resize();
    setStatus('红中麻将');
    document.getElementById('status-bar').classList.add('hide');
    window.state.dealerIdx = Math.floor(Math.random() * 4);
    GameFlow.startNewGame();
  }

  return { aiDirectionName: aiDirectionName, setStatus: setStatus, updateButtons: updateButtons, updateScoreBar: updateScoreBar, playSound: playSound, init: init };
})();
