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

  // 启动 UI
  window.UI.init();
})();
