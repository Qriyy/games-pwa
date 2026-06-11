/**
 * 红中麻将 — 自动化打牌脚本
 * 使用 Playwright 自动控制浏览器，代替玩家操作
 * 运行: npx playwright _auto_play.js  或  node _auto_play.js（需要先安装 playwright）
 */

(async () => {
  // 动态 require playwright
  let playwright;
  try {
    playwright = require('playwright');
  } catch (e) {
    console.error('请先安装 playwright: npm install playwright');
    process.exit(1);
  }

  const URL = 'http://localhost:3000';
  const AI_INTERVAL = 1500; // AI 回合等待时间
  const PLAYER_DELAY = 800; // 玩家操作延迟

  const browser = await playwright.chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 420, height: 820 } });
  const page = await context.newPage();

  // 收集控制台输出
  page.on('console', msg => {
    if (msg.type() === 'error') console.log('[游戏错误]', msg.text());
  });

  await page.goto(URL, { waitUntil: 'networkidle' });
  console.log('=== 红中麻将 自动打牌开始 ===');

  // 辅助：等待并执行 JS
  async function evalJS(code) {
    return await page.evaluate(code);
  }

  // 辅助：等待指定状态
  async function waitState(predicate, timeout = 30000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const result = await evalJS(predicate);
      if (result) return result;
      await new Promise(r => setTimeout(r, 100));
    }
    throw new Error('超时等待状态');
  }

  // 智能出牌：优先打出最差的牌
  async function autoDiscard() {
    const state = await evalJS(() => {
      const st = window.state;
      if (!st || st.phase !== 'playerTurn' || st.turnPhase !== 'discard') return null;
      return {
        hand: st.hands[0].slice(),
        canHu: st.canHu,
        canGang: st.canGang,
        canPeng: st.canPeng,
        selectedIdx: st.selectedIdx
      };
    });
    if (!state) return false;

    // 使用 AI 模块决策
    const aiDecision = await evalJS(() => {
      try {
        const result = window.AIBridge.getAIDecision(window.state.hands[0], window.state.difficulty);
        const hand = window.Tiles.sortHand(window.state.hands[0]);
        const idx = hand.indexOf(result);
        return idx >= 0 ? idx : 0;
      } catch(e) {
        return -1;
      }
    });

    if (aiDecision >= 0) {
      await evalJS((idx) => {
        window.state.selectedIdx = idx;
        window.Renderer.render();
      }, aiDecision);
      await new Promise(r => setTimeout(r, PLAYER_DELAY));
      // 再次点击同一张牌打出
      await evalJS((idx) => {
        window.GameFlow.playerDiscard(idx);
      }, aiDecision);
      console.log(`  出牌: 位置 ${aiDecision}`);
      return true;
    }

    // 兜底：出第一张
    await evalJS(() => {
      window.GameFlow.playerDiscard(0);
    });
    console.log('  出牌: 位置 0 (兜底)');
    return true;
  }

  // 处理响应（胡/杠/碰/过）
  async function handleResponse() {
    const state = await evalJS(() => {
      const st = window.state;
      return {
        phase: st.phase,
        turnPhase: st.turnPhase,
        canHu: st.canHu,
        canGang: st.canGang,
        canPeng: st.canPeng
      };
    });

    if (state.turnPhase !== 'response') return false;
    if (!state.canHu && !state.canGang && !state.canPeng) return false;

    // 优先级: 胡 > 杠 > 碰
    if (state.canHu) {
      console.log('  响应: 胡！');
      document.getElementById('btnHu').click();
      return true;
    }
    if (state.canGang) {
      console.log('  响应: 杠');
      document.getElementById('btnGang').click();
      return true;
    }
    if (state.canPeng) {
      console.log('  响应: 碰');
      document.getElementById('btnPeng').click();
      return true;
    }
    return false;
  }

  // 处理自摸/自杠
  async function handleSelfAction() {
    const state = await evalJS(() => {
      const st = window.state;
      return {
        phase: st.phase,
        turnPhase: st.turnPhase,
        canHu: st.canHu,
        canGang: st.canGang
      };
    });

    if (state.turnPhase !== 'draw') return false;

    if (state.canHu) {
      console.log('  自摸！');
      document.getElementById('btnHu').click();
      return true;
    }
    if (state.canGang) {
      console.log('  自杠');
      document.getElementById('btnGang').click();
      return true;
    }
    return false;
  }

  // 主循环
  async function playGame() {
    let roundCount = 0;
    const maxRounds = 3; // 打3局

    while (roundCount < maxRounds) {
      const state = await evalJS(() => ({
        phase: window.state.phase,
        turnPhase: window.state.turnPhase,
        currentPlayer: window.state.currentPlayer,
        deckLen: window.state.deck ? window.state.deck.length : 0,
        myHand: window.state.hands[0].length,
        score: window.state.scores[0]
      }));

      console.log(`\n[回合] phase=${state.phase} turnPhase=${state.turnPhase} 当前玩家=${state.currentPlayer} 手牌=${state.myHand} 余牌=${state.deckLen} 分数=${state.score}`);

      if (state.phase === 'gameOver') {
        const result = await evalJS(() => {
          const st = window.state;
          return {
            winner: st.winner,
            winType: st.winType,
            huTile: st.huTile,
            fan: st.fan,
            scores: st.scores.slice()
          };
        });
        console.log(`  结算: 胡牌者=${result.winner} 方式=${result.winType} 番=${result.fan} 分数=${JSON.stringify(result.scores)}`);
        roundCount++;

        // 点击再来一局
        if (roundCount < maxRounds) {
          console.log(`\n=== 第 ${roundCount + 1} 局开始 ===`);
          document.getElementById('btnNewRound').click();
          await new Promise(r => setTimeout(r, 2000));
        }
        continue;
      }

      // 处理响应
      if (state.turnPhase === 'response') {
        // 通过点击按钮处理
        const btnState = await evalJS(() => ({
          canHu: !document.getElementById('btnHu').disabled,
          canGang: !document.getElementById('btnGang').disabled,
          canPeng: !document.getElementById('btnPeng').disabled,
          canPass: !document.getElementById('btnPass').disabled
        }));

        if (btnState.canHu) {
          console.log('  响应: 胡！');
          document.getElementById('btnHu').click();
        } else if (btnState.canGang) {
          console.log('  响应: 杠');
          document.getElementById('btnGang').click();
        } else if (btnState.canPeng) {
          console.log('  响应: 碰');
          document.getElementById('btnPeng').click();
        } else if (btnState.canPass) {
          console.log('  响应: 过');
          document.getElementById('btnPass').click();
        }
        await new Promise(r => setTimeout(r, AI_INTERVAL));
        continue;
      }

      // 玩家回合 - 出牌
      if (state.phase === 'playerTurn' && state.turnPhase === 'discard') {
        await autoDiscard();
        await new Promise(r => setTimeout(r, AI_INTERVAL / 2));
        continue;
      }

      // 如果是新摸牌阶段（draw），等它过渡到 discard
      if (state.phase === 'playerTurn' && state.turnPhase === 'draw') {
        // 先检查自摸/自杠
        const handled = await handleSelfAction();
        if (handled) {
          await new Promise(r => setTimeout(r, AI_INTERVAL));
          continue;
        }
        // 否则等它自动过渡到 discard
        await new Promise(r => setTimeout(r, 500));
        continue;
      }

      // AI 回合，等待它完成
      await new Promise(r => setTimeout(r, AI_INTERVAL / 2));
    }

    console.log('\n=== 自动打牌结束 ===');
    const final = await evalJS(() => window.state.scores.slice());
    console.log('最终分数:', JSON.stringify(final));
  }

  // 点击新局开始
  await new Promise(r => setTimeout(r, 1000));
  document.getElementById('btnNewGame').click();
  await new Promise(r => setTimeout(r, 2000));

  try {
    await playGame();
  } catch (e) {
    console.error('自动打牌出错:', e.message);
  }

  // 保持浏览器打开让用户查看
  console.log('\n浏览器保持打开，按 Ctrl+C 退出');
  await new Promise(() => {});
})();
