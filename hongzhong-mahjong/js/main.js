/**
 * 红中麻将 — 主入口模块
 * 初始化游戏状态并启动 UI
 */
(function() {
  'use strict';

  // 创建全局 state 对象
  const defaultState = window.GameState.createDefaultState();
  window.state = defaultState;

  // AI 模块难度映射 (0=easy, 1=medium, 2=hard)
  window.state.difficulty = 2;
  window.state.dealerIdx = Math.floor(Math.random() * 4);

  // 全局错误恢复：任何未捕获的错误都尝试恢复游戏
  window.onerror = function(msg) {
    console.error('全局错误:', msg);
    try {
      var st = window.state;
      if (st && st.phase === 'aiTurn') {
        console.warn('检测到AI卡死，强制恢复');
        st.phase = 'playerTurn';
        st.turnPhase = 'discard';
        st.selectedIdx = -1;
        if (window.UI) window.UI.updateButtons();
        if (window.Renderer) window.Renderer.render();
      }
    } catch(e) {}
    return true; // 阻止默认错误处理
  };

  // 健康检查：每2秒检测游戏是否卡死
  setInterval(function() {
    try {
      var st = window.state;
      if (!st) return;
      // 如果在AI回合超过5秒没动静，强制恢复
      if (st.phase === 'aiTurn' && st._aiStartTime) {
        if (Date.now() - st._aiStartTime > 5000) {
          console.warn('AI超时，强制恢复到玩家回合');
          st.phase = 'playerTurn';
          st.turnPhase = 'discard';
          st.selectedIdx = -1;
          st._aiStartTime = null;
          if (window.UI) window.UI.updateButtons();
          if (window.Renderer) window.Renderer.render();
        }
      }
    } catch(e) {}
  }, 2000);

  // 启动 UI
  window.UI.init();
})();
