/**
 * 红中麻将 — 计分模块
 * 合并了原代码中重复的 detectHuType 和 calcScore 逻辑
 * 单一数据源：detectHuType 做牌型检测+番数计算，calcScore 为薄包装
 */
window.Scoring = (function() {
  const { HONGZHONG_ID } = window.Constants;
  const { isHongzhong } = window.Tiles;
  const { checkQidui, checkLongQidui, checkPengpenghu, checkQingyise, checkHunyise } = window.HuDetection;

  function s() { return window.state; }

  /**
   * 牌型检测 + 番数计算
   * 从 window.state 读取 isAfterGang / isLastTile
   */
  function detectHuType(hand, melds, winType) {
    const st = s();
    const isQidui = (hand.length === 14) && checkQidui(hand);
    const isLongQidui = isQidui && checkLongQidui(hand);
    const isPengpenghu = !isQidui && checkPengpenghu(hand, melds);
    const isQingyise = checkQingyise(hand, melds);
    const isHunyise = !isQingyise && checkHunyise(hand, melds);

    let baseFan = 1;
    let names = ['平胡'];
    if (isLongQidui) { baseFan = 12; names = ['龙七对']; }
    else if (isQidui) { baseFan = 8; names = ['七小对']; }
    else { if (isPengpenghu) { baseFan = 2; names = ['碰碰胡']; } }
    if (isQingyise) { baseFan += 6; names.push('清一色'); }
    else if (isHunyise) { baseFan += 2; names.push('混一色'); }

    let bonusFan = 0;
    const bonusNames = [];
    if (winType === 'zimo' || winType === 'zimo_raw') { bonusFan += 1; bonusNames.push('自摸'); }
    if (winType === 'qiangganghu') { bonusFan += 2; bonusNames.push('抢杠胡'); }
    if (st.isAfterGang) { bonusFan += 2; bonusNames.push('杠上开花'); }
    if (st.isLastTile) { bonusFan += 2; bonusNames.push('海底捞月'); }

    // 天胡：庄家起手14张直接胡（turnCount===1表示庄家首回合，无人摸过牌）
    if (st.turnCount === 1) {
      bonusFan += 8;
      bonusNames.push('天胡');
    }
    // 地胡：闲家第一次摸牌即胡（turnCount===2，且胡牌者非庄家）
    else if (st.turnCount === 2 && st.winner !== st.dealerIdx) {
      bonusFan += 8;
      bonusNames.push('地胡');
    }

    // 全求人：所有面子均为明面子，且为点炮胡（非自摸）
    if (winType === 'dianpao' && melds.length > 0) {
      const allExposed = melds.every(m => m.type !== 'angang');
      if (allExposed && melds.length === 4) {
        bonusFan += 2;
        bonusNames.push('全求人');
      }
    }

    // 红中杠 +2番
    for (const m of melds) {
      if ((m.type === 'gang' || m.type === 'angang') && m.tiles && m.tiles.length > 0 && isHongzhong(m.tiles[0])) {
        bonusFan += 2;
        bonusNames.push('红中杠');
        break;
      }
    }

    const totalFan = baseFan + bonusFan;
    return { baseFan, bonusFan, totalFan, names: [...names, ...bonusNames] };
  }

  /**
   * 计算分数（薄包装，调用 detectHuType）
   */
  function calcScore(hand, melds, winType) {
    const info = detectHuType(hand, melds, winType);
    const points = 10 * info.totalFan;
    const typeName = info.names.join('·');
    return { fan: info.totalFan, typeName, points, detail: info };
  }

  return {
    detectHuType,
    calcScore,
  };
})();
