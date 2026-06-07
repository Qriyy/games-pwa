/**
 * 红中麻将 — AI 桥接层
 * 在主游戏编码（1-27/30）与 AI 模块编码（0x10-0x41）之间转换
 * 所有对 window.AIModule 的调用都通过此桥接层
 */
window.AIBridge = (function() {
  const { toAIHand, toAITile, fromAITile } = window.Tiles;

  /**
   * 调用 AI 出牌决策
   * @param {number[]} hand - 主游戏编码的手牌
   * @param {number} difficulty - 0=easy, 1=medium, 2=hard
   * @returns {number} 要打出牌的索引
   */
  function getAIDecision(hand, difficulty) {
    if (!window.AIModule || !window.AIModule.getAIDecision) return -1;
    const diffMap = ['easy', 'medium', 'hard'];
    const difficultyName = diffMap[difficulty] || 'medium';
    try {
      const aiHand = toAIHand(hand);
      const result = window.AIModule.getAIDecision(aiHand, difficultyName);
      if (result === null || result === undefined) return -1;
      // result 是 AI 编码的牌值，需要在 aiHand 里找对应位置
      const idx = aiHand.indexOf(result);
      return idx;
    } catch(e) {
      return -1;
    }
  }

  /**
   * 调用 AI 碰牌决策
   */
  function shouldPeng(hand, tile, difficulty) {
    if (!window.AIModule || !window.AIModule.shouldPeng) return true;
    const diffMap = ['easy', 'medium', 'hard'];
    const difficultyName = diffMap[difficulty] || 'medium';
    try {
      return window.AIModule.shouldPeng(toAIHand(hand), toAITile(tile), difficultyName);
    } catch(e) {
      return true;
    }
  }

  /**
   * 调用 AI 胡牌决策
   */
  function shouldHu(hand, tile, difficulty) {
    if (!window.AIModule || !window.AIModule.shouldHu) return true;
    const diffMap = ['easy', 'medium', 'hard'];
    const difficultyName = diffMap[difficulty] || 'medium';
    try {
      return window.AIModule.shouldHu(toAIHand(hand), toAITile(tile), difficultyName);
    } catch(e) {
      return true;
    }
  }

  /**
   * 调用 AI 杠牌决策
   */
  function shouldGang(hand, tile, gangType, difficulty) {
    if (!window.AIModule || !window.AIModule.shouldGang) return true;
    const diffMap = ['easy', 'medium', 'hard'];
    const difficultyName = diffMap[difficulty] || 'medium';
    try {
      return window.AIModule.shouldGang(toAIHand(hand), toAITile(tile), gangType, difficultyName);
    } catch(e) {
      return true;
    }
  }

  return {
    getAIDecision,
    shouldPeng,
    shouldHu,
    shouldGang,
  };
})();
