/**
 * 红中麻将 — UI 交互模块
 * 状态栏、按钮控制、音效、输入处理、初始化
 */
window.UI = (function() {
  const { isHongzhong, tileBaseId } = window.Tiles;
  const { canSelfGang } = window.HuDetection;
  const { performHu, performPeng, performGang } = window.Actions;
  const { drawTileFromDeck, playerDiscard, playerPass, startNewGame, endGame, aiTurn } = window.GameFlow;
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
    const overlay = document.getElementById('ui-overlay');
    const btnHu = document.getElementById('btnHu');
    const btnGang = document.getElementById('btnGang');
    const btnPeng = document.getElementById('btnPeng');
    const btnPass = document.getElementById('btnPass');

    btnHu.disabled = !st.canHu;
    btnGang.disabled = !st.canGang;
    btnPeng.disabled = !st.canPeng;
    // 过按钮只在 response 阶段启用
    btnPass.disabled = !(st.turnPhase === 'response' && (st.canHu || st.canGang || st.canPeng));

    // 有任何可用按钮就显示，否则隐藏
    const anyEnabled = !btnHu.disabled || !btnGang.disabled || !btnPeng.disabled || !btnPass.disabled;
    if (anyEnabled) {
      overlay.classList.add('visible');
    } else {
      overlay.classList.remove('visible');
    }
  }

  function updateScoreBar() {
    const st = s();
    const names = ['你(南)', '北AI', '西AI', '东AI'];
    let text = '红中麻将 | ';
    for (let i = 0; i < 4; i++) {
      text += `${names[i]}: ${st.scores[i]}  `;
    }
    document.getElementById('status-bar').textContent = text;
  }

  function playSound(name) {
    try {
      if (window.HongZhongAudio) {
        const fn = 'play' + name.charAt(0).toUpperCase() + name.slice(1);
        if (typeof HongZhongAudio[fn] === 'function') {
          HongZhongAudio[fn]();
        }
      }
    } catch(e) {}
  }

  // ============== 输入处理 ==============

  function getPointerPos(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  function handleClick(e) {
    const st = s();
    if (st.phase !== 'playerTurn') return;

    const pos = getPointerPos(e);

    if (st.turnPhase === 'discard' && st._playerTilePositions) {
      for (let i = st._playerTilePositions.length - 1; i >= 0; i--) {
        const tp = st._playerTilePositions[i];
        if (pos.x >= tp.x && pos.x <= tp.x + tp.w && pos.y >= tp.y && pos.y <= tp.y + tp.h) {
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
  }

  function setupInputHandlers() {
    // 用 pointerdown 统一处理鼠标+触摸
    canvas.addEventListener('pointerdown', handleClick);

    // 胡牌按钮
    document.getElementById('btnHu').addEventListener('click', () => {
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
    document.getElementById('btnGang').addEventListener('click', () => {
      const st = s();
      if (!st.canGang) return;
      playSound('click');

      if (st.turnPhase === 'response') {
        performGang(0, st.lastDiscard, tileBaseId(st.lastDiscard));
        st.isAfterGang = true;
        setTimeout(() => drawTileFromDeck(0), 300);
      } else {
        const gangs = canSelfGang(st.hands[0], st.melds[0]);
        if (gangs.length > 0) {
          performGang(0, -1, gangs[0]);
          st.isAfterGang = true;
          setTimeout(() => drawTileFromDeck(0), 300);
        }
      }
    });

    // 碰牌按钮
    document.getElementById('btnPeng').addEventListener('click', () => {
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
    document.getElementById('btnPass').addEventListener('click', () => {
      playSound('click');
      playerPass();
    });

    // 弹窗内新局按钮
    document.getElementById('btnNewRound').addEventListener('click', () => {
      document.getElementById('result-modal').classList.remove('show');
      updateScoreBar();
      startNewGame();
    });

    // 右上角新局按钮
    document.getElementById('btnNewGame').addEventListener('click', () => {
      document.getElementById('result-modal').classList.remove('show');
      updateScoreBar();
      startNewGame();
    });
  }

  // ============== 初始化 ==============

  function init() {
    setupInputHandlers();
    window.Renderer.resize();
    setStatus('红中麻将');

    // 预加载真实牌图素材
    window.TileAssets.preload(() => {
      console.log('牌图素材加载完成');
      window.Renderer.render();
      // 素材就绪后短暂延迟启动游戏
      setTimeout(() => {
        document.getElementById('status-bar').classList.add('hide');
        window.state.dealerIdx = Math.floor(Math.random() * 4);
        startNewGame();
      }, 200);
    });
  }

  return {
    aiDirectionName, setStatus, updateButtons, updateScoreBar, playSound,
    init,
  };
})();
