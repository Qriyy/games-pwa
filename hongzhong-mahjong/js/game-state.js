/**
 * 红中麻将 — 游戏状态模块
 * 管理全局 state 对象的初始化与重置
 */
window.GameState = (function() {
  /**
   * 创建默认 state 对象
   */
  function createDefaultState() {
    return {
      phase: 'idle',
      deck: [],
      hands: [[], [], [], []],
      discards: [[], [], [], []],
      melds: [[], [], [], []],
      scores: [0, 0, 0, 0],
      currentPlayer: 0,
      selectedIdx: -1,
      lastDiscard: -1,
      lastDiscardPlayer: -1,
      pendingActions: [],
      canHu: false, canGang: false, canPeng: false,
      turnPhase: 'draw',
      winner: -1,
      winType: '',
      huTile: -1,
      animState: null,
      difficulty: 2,
      playerWind: 0,
      gangLog: [],
      isAfterGang: false,
      isLastTile: false,
      dealerIdx: 0,
      qiangGangTile: -1,
      qiangGangPlayer: -1,
    };
  }

  /**
   * 重置状态为新局（保留 scores, difficulty, dealerIdx）
   */
  function resetForNewRound(stateObj) {
    const keepScores = stateObj.scores;
    const keepDifficulty = stateObj.difficulty;
    const keepDealer = stateObj.dealerIdx;

    const def = createDefaultState();
    Object.assign(stateObj, def);

    stateObj.scores = keepScores;
    stateObj.difficulty = keepDifficulty;
    stateObj.dealerIdx = keepDealer;
    stateObj.currentPlayer = keepDealer;
  }

  return {
    createDefaultState,
    resetForNewRound,
  };
})();
