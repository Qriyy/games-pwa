/**
 * 红中麻将 — UI 交互模块（移动端版）
 */
window.UI = (function() {
  const { isHongzhong, tileBaseId } = window.Tiles;
  const { canSelfGang } = window.HuDetection;
  const { performHu, performPeng, performGang } = window.Actions;
  const { drawTileFromDeck, playerDiscard, playerPass, startNewGame, endGame } = window.GameFlow;
  const { canvas, render } = window.Renderer;

  function s() { return window.state; }

  // ============== 工具函数 ==============

  function aiDirectionName(idx) {
    return ['', '北AI', '西AI', '东AI'][idx] || 'AI';
  }

  function setStatus(text) {
    document.getElementById('status-bar').textContent = text;
  }

  function updateButtons() {
    const st = s();
    document.getElementById('btnHu').disabled = !st.canHu;
    document.getElementById('btnGang').disabled = !st.canGang;
    document.getElementById('btnPeng').disabled = !st.canPeng;
    document.getElementById('btnPass').disabled = !(st.turnPhase === 'response' && (st.canHu || st.canGang || st.canPeng));
  }

  function updateScoreBar() {
    const st = s();
    const names = ['你(南)', '北AI', '西AI', '东AI'];
    let text = '红中麻将 | ';
    for (let i = 0; i < 4; i++) text += names[i] + ': ' + st.scores[i] + '  ';
    document.getElementById('status-bar').textContent = text;
  }

  function playSound(name) {
    try {
      if (window.HongZhongAudio) {
        const fn = 'play' + name.charAt(0).toUpperCase() + name.slice(1);
        if (typeof HongZhongAudio[fn] === 'function') HongZhongAudio[fn]();
      }
    } catch(e) {}
  }

  // ============== 点击处理 ==============

  function handleClick(e) {
    const st = s();
    if (st.phase !== 'playerTurn') return;
    if (st.turnPhase !== 'discard') return;
    if (!st._playerTilePositions || st._playerTilePositions.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    for (let i = st._playerTilePositions.length - 1; i >= 0; i--) {
      const tp = st._playerTilePositions[i];
      if (x >= tp.x && x <= tp.x + tp.w && y >= tp.y && y <= tp.y + tp.h) {
        if (st.selectedIdx === i) {
          playerDiscard(i);
        } else {
          st.selectedIdx = i;
          playSound('click');
          render();
        }
        return;
      }
    }
    if (st.selectedIdx >= 0) {
      st.selectedIdx = -1;
      render();
    }
  }

  // ============== 初始化 ==============

  function init() {
    // click 在桌面和手机上都能用，touch-action:none 让手机不卡300ms延迟
    canvas.addEventListener('click', handleClick);

    // 胡牌按钮
    document.getElementById('btnHu').addEventListener('click', function() {
      const st = s();
      if (!st.canHu) return;
      playSound('click');
      if (st.turnPhase === 'response') {
        performHu(0, st.lastDiscard, st.lastDiscardPlayer);
        endGame(0, 'dianpao', st.lastDiscardPlayer);
      } else {
        st.winner = 0;
        st.winType = 'zimo';
        st.huTile = st.hands[0][st.hands[0].length - 1];
        st.phase = 'gameOver';
        playSound('hu');
        endGame(0, 'zimo');
      }
    });

    // 杠牌按钮
    document.getElementById('btnGang').addEventListener('click', function() {
      const st = s();
      if (!st.canGang) return;
      playSound('click');
      if (st.turnPhase === 'response') {
        performGang(0, st.lastDiscard, tileBaseId(st.lastDiscard));
        st.isAfterGang = true;
        setTimeout(function() { drawTileFromDeck(0); }, 300);
      } else {
        const gangs = canSelfGang(st.hands[0], st.melds[0]);
        if (gangs.length > 0) {
          performGang(0, -1, gangs[0]);
          st.isAfterGang = true;
          setTimeout(function() { drawTileFromDeck(0); }, 300);
        }
      }
    });

    // 碰牌按钮
    document.getElementById('btnPeng').addEventListener('click', function() {
      const st = s();
      if (!st.canPeng) return;
      playSound('click');
      performPeng(0, st.lastDiscard, st.lastDiscardPlayer);
      setStatus('你碰了！请出牌');
      st.phase = 'playerTurn';
      st.turnPhase = 'discard';
      st.canPeng = false;
      st.canGang = false;
      st.canHu = false;
      updateButtons();
      render();
    });

    // 过按钮
    document.getElementById('btnPass').addEventListener('click', function() {
      playSound('click');
      playerPass();
    });

    // 弹窗内新局按钮
    document.getElementById('btnNewRound').addEventListener('click', function() {
      document.getElementById('result-modal').classList.remove('show');
      updateScoreBar();
      startNewGame();
    });

    // 新局按钮
    document.getElementById('btnNewGame').addEventListener('click', function() {
      document.getElementById('result-modal').classList.remove('show');
      updateScoreBar();
      startNewGame();
    });

    // 启动游戏
    try {
      resize();
      setStatus('红中麻将');
      document.getElementById('status-bar').classList.add('hide');
      window.state.dealerIdx = Math.floor(Math.random() * 4);
      startNewGame();
    } catch(e) {
      console.error('初始化异常:', e);
    }
  }

  return {
    aiDirectionName, setStatus, updateButtons, updateScoreBar, playSound,
    init,
  };
})();
