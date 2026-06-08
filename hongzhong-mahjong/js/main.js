/**
 * 红中麻将 — 主入口模块
 */
(function() {
  'use strict';
  try {
    var defaultState = window.GameState.createDefaultState();
    window.state = defaultState;
    window.state.difficulty = 2;
    window.state.dealerIdx = Math.floor(Math.random() * 4);
    window.UI.init();
  } catch(e) {
    console.error('初始化异常:', e);
    var el = document.getElementById('err');
    if (el) { el.style.display='block'; el.textContent = e.message; }
  }
})();
