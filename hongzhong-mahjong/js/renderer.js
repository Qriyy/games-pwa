/**
 * 红中麻将 — 渲染模块（专业布局版）
 * Canvas 2D 渲染：四人对战界面，仿雀魂/欢乐麻将风格
 * 桌面、玩家面板、手牌、弃牌、副露、牌墙
 */
window.Renderer = (function() {
  const { TILE_W, TILE_H, SUIT_NAMES, SUIT_COLORS, HONGZHONG_ID, C, LAYOUT } = window.Constants;
  const { isHongzhong, tileSuit, tileNumber, tileName, tileBaseId, sortHand } = window.Tiles;

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  let W, H, isPortrait, sc;
  let th2; // player hand tile height (cached)

  function getCanvas() { return canvas; }
  function getCtx() { return ctx; }

  // ======================================================================
  //  尺寸调整
  // ======================================================================

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W;
    canvas.height = H;
    isPortrait = H > W;
    // 竖屏：参考 375px（iPhone SE）宽度
    // 横屏：参考 1200px 桌面宽度
    if (isPortrait) {
      sc = Math.min(W / 375, 1.3);
    } else {
      sc = Math.min(W / 1200, H / 800, 1.2);
    }
    render();
  }

  window.addEventListener('resize', resize);

  // ======================================================================
  //  几何工具
  // ======================================================================

  function drawRoundedRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  function drawShadowedRect(x, y, w, h, r, fill, stroke) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 3;
    drawRoundedRect(x, y, w, h, r);
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.shadowBlur = 0;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawCircle(x, y, r, fill, stroke) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  const { CN_NUMS, SUIT_CN, TONG_DOTS } = window.Constants;

  // ======================================================================
  //  牌面绘制（优先使用真实牌图素材）
  // ======================================================================

  function drawTile(x, y, w, h, tileId, faceUp, selected, isNew) {
    const r = Math.min(w, h) * 0.08;
    let drawY = y;
    if (selected) drawY -= 12 * sc;
    if (isNew) drawY -= 8 * sc;

    ctx.save();
    if (selected || isNew) {
      ctx.shadowColor = selected ? 'rgba(212,165,69,0.6)' : 'rgba(255,255,200,0.3)';
      ctx.shadowBlur = selected ? 16 : 8;
      ctx.shadowOffsetY = 0;
    }

    // ====== 牌背 ======
    if (!faceUp) {
      const backImg = window.TileAssets ? window.TileAssets.getBack() : null;
      if (backImg) {
        // 使用真实牌背图
        drawRoundedRect(x, drawY, w, h, r);
        ctx.fillStyle = '#0D1A2A';
        ctx.fill();
        ctx.save();
        ctx.beginPath();
        drawRoundedRect(x, drawY, w, h, r);
        ctx.clip();
        ctx.drawImage(backImg, x, drawY, w, h);
        ctx.restore();
      } else {
        // Canvas 绘制牌背
        drawRoundedRect(x, drawY, w, h, r);
        const grad = ctx.createLinearGradient(x, drawY, x, drawY + h);
        grad.addColorStop(0, C.TILE_BACK_LIGHT);
        grad.addColorStop(0.3, C.TILE_BACK);
        grad.addColorStop(0.7, C.TILE_BACK);
        grad.addColorStop(1, '#0F1F30');
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.strokeStyle = '#0D1A2A';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        drawRoundedRect(x + 5, drawY + 5, w - 10, h - 10, r - 1);
        ctx.fill();
      }
      ctx.restore();
      return;
    }

    // ====== 牌面：尝试使用真实素材 ======
    const tileImg = window.TileAssets ? window.TileAssets.getTile(tileId) : null;

    if (tileImg) {
      // 使用真实牌面图
      drawRoundedRect(x, drawY, w, h, r);
      ctx.fillStyle = '#FFFDF5';
      ctx.fill();
      ctx.save();
      ctx.beginPath();
      drawRoundedRect(x, drawY, w, h, r);
      ctx.clip();
      ctx.drawImage(tileImg, x, drawY, w, h);
      ctx.restore();
      // 轻微边框
      ctx.strokeStyle = 'rgba(0,0,0,0.12)';
      ctx.lineWidth = 1;
      drawRoundedRect(x, drawY, w, h, r);
      ctx.stroke();
      ctx.restore();
      return;
    }

    // ====== 后备：Canvas 手绘牌面 ======
    drawRoundedRect(x, drawY, w, h, r);
    ctx.fillStyle = '#D4C4A0';
    ctx.fill();
    ctx.strokeStyle = '#A89070';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const inset = 3;
    drawRoundedRect(x + inset, drawY + inset, w - inset * 2, h - inset * 2, r * 0.6);
    const faceGrad = ctx.createLinearGradient(x, drawY, x, drawY + h);
    faceGrad.addColorStop(0, '#FFFDF5');
    faceGrad.addColorStop(0.7, '#F5EDD8');
    faceGrad.addColorStop(1, '#E8DDC0');
    ctx.fillStyle = faceGrad;
    ctx.fill();
    ctx.strokeStyle = '#C8B890';
    ctx.lineWidth = 0.7;
    ctx.stroke();

    ctx.restore();

    const cx = x + w / 2;
    const cy = drawY + h / 2;

    if (isHongzhong(tileId)) {
      ctx.strokeStyle = 'rgba(200, 50, 30, 0.5)';
      ctx.lineWidth = w * 0.04;
      drawRoundedRect(x + inset + 2, drawY + inset + 2, w - inset * 2 - 4, h - inset * 2 - 4, r * 0.5);
      ctx.stroke();
      ctx.fillStyle = '#C43B2A';
      ctx.font = `bold ${Math.floor(h * 0.5)}px "KaiTi", "Microsoft YaHei", serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('中', cx, drawY + h * 0.46);
    } else {
      const suit = tileSuit(tileId);
      const num = tileNumber(tileId);
      const color = SUIT_COLORS[suit];

      const cornerSize = Math.floor(h * 0.18);
      ctx.fillStyle = color;
      ctx.font = `bold ${cornerSize}px "Microsoft YaHei", sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(`${num}`, x + inset + 4, drawY + inset + 2);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`${num}`, x + w - inset - 4, drawY + h - inset - 2);

      const centerSize = Math.floor(h * 0.32);
      if (suit === 'wan') {
        ctx.fillStyle = color;
        ctx.font = `bold ${centerSize}px "KaiTi", "Microsoft YaHei", serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(CN_NUMS[num - 1], cx, cy);
      } else if (suit === 'tiao') {
        const dotR = Math.min(w, h) * 0.04;
        const cols = num <= 3 ? 1 : (num <= 6 ? 2 : 3);
        const rows = Math.ceil(num / cols);
        const cellW = (w * 0.55) / cols;
        const cellH = (h * 0.55) / rows;
        const gsx = cx - (cellW * (cols - 1)) / 2;
        const gsy = cy - (cellH * (rows - 1)) / 2;
        for (let i = 0; i < num; i++) {
          const dx = gsx + (i % cols) * cellW + cellW / 2;
          const dy = gsy + Math.floor(i / cols) * cellH + cellH / 2;
          ctx.strokeStyle = '#1A6A2A';
          ctx.lineWidth = Math.max(dotR, 1.2);
          ctx.beginPath();
          ctx.moveTo(dx, dy - cellH * 0.35);
          ctx.lineTo(dx, dy + cellH * 0.35);
          ctx.stroke();
          ctx.lineWidth = Math.max(dotR * 1.5, 1.8);
          ctx.beginPath();
          ctx.moveTo(dx - dotR * 1.2, dy);
          ctx.lineTo(dx + dotR * 1.2, dy);
          ctx.stroke();
          ctx.fillStyle = '#1A6A2A';
          ctx.beginPath();
          ctx.arc(dx, dy - cellH * 0.35, dotR * 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (suit === 'tong') {
        const dots = TONG_DOTS[num];
        const dotR = Math.min(w, h) * 0.07;
        const unit = Math.min(w, h) * 0.12;
        for (const [dr, dc] of dots) {
          const dx2 = cx + dc * unit;
          const dy2 = cy + dr * unit;
          ctx.strokeStyle = '#8A2A1A';
          ctx.lineWidth = Math.max(dotR * 0.3, 1);
          ctx.beginPath();
          ctx.arc(dx2, dy2, dotR, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = '#8A2A1A';
          ctx.beginPath();
          ctx.arc(dx2, dy2, dotR * 0.45, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }



  // ======================================================================
  //  玩家面板
  // ======================================================================

  function drawPlayerPanel(x, y, w, h, playerIdx, isActive) {
    const st = window.state;
    const pName = playerIdx === 0 ? '你(南)' : ['北AI', '西AI', '东AI'][playerIdx - 1];
    const score = st.scores[playerIdx];
    const windColor = C.WIND_COLORS[playerIdx];

    // 面板背景
    ctx.save();
    if (isActive) {
      ctx.shadowColor = 'rgba(212,165,69,0.4)';
      ctx.shadowBlur = 20;
    }
    drawRoundedRect(x, y, w, h, 8);
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, isActive ? '#1A2840' : C.PANEL_BG);
    grad.addColorStop(1, isActive ? '#0F1A30' : '#0E151E');
    ctx.fillStyle = grad;
    ctx.fill();

    const borderColor = isActive ? C.PANEL_ACTIVE : C.PANEL_BORDER;
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = isActive ? 2 : 1;
    ctx.stroke();
    ctx.restore();

    // 头像圆圈
    const r = LAYOUT.AVATAR_R * sc;
    const avatarX = x + r + 8 * sc;
    const avatarY = y + h / 2;
    drawCircle(avatarX, avatarY, r, windColor, isActive ? C.GOLD : null);

    // 名字缩写（取首字）
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.floor(r * 0.9)}px "Microsoft YaHei", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const initial = playerIdx === 0 ? '你' : ['北', '西', '东'][playerIdx - 1];
    ctx.fillText(initial, avatarX, avatarY + 1);

    // 名字
    ctx.fillStyle = isActive ? C.GOLD : C.TEXT;
    ctx.font = `bold ${Math.floor(13 * sc)}px "Microsoft YaHei", sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(pName, avatarX + r + 8 * sc, avatarY - 10 * sc);

    // 分数
    ctx.fillStyle = C.TEXT_DIM;
    ctx.font = `${Math.floor(11 * sc)}px "Microsoft YaHei", sans-serif`;
    ctx.fillText(`分: ${score}`, avatarX + r + 8 * sc, avatarY + 10 * sc);

    // 风位标记（小方牌）
    const winds = ['', '北', '西', '东'];
    const windX = x + w - 28 * sc;
    const windY = y + 6 * sc;
    ctx.fillStyle = isActive ? C.GOLD : 'rgba(255,255,255,0.2)';
    ctx.font = `${Math.floor(11 * sc)}px "Microsoft YaHei", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(winds[playerIdx], windX, windY);
  }

  // ======================================================================
  //  AI 手牌（牌背一行/一列）
  // ======================================================================

  function drawAIHandTiles(playerIdx, startX, startY, count, vertical) {
    const tw = LAYOUT.AI_TILE_W * sc;
    const th = LAYOUT.AI_TILE_H * sc;

    for (let i = 0; i < count; i++) {
      const x = vertical ? startX : startX + i * (tw + 1);
      const y = vertical ? startY + i * (th + 1) : startY;
      drawTile(x, y, tw, th, 0, false, false, false);
    }
  }

  // ======================================================================
  //  主渲染
  // ======================================================================

  function render() {
    ctx.fillStyle = C.BG;
    ctx.fillRect(0, 0, W, H);

    if (isPortrait) {
      renderPortrait();
    } else {
      renderLandscape();
    }
  }

  // ==================== 横屏（桌面端） ====================

  function renderLandscape() {
    const st = window.state;
    const topH = H * LAYOUT.TOP_RATIO;
    const bottomH = H * LAYOUT.BOTTOM_RATIO;
    const sideW = W * LAYOUT.SIDE_RATIO;
    const centerH = H - topH - bottomH;
    const centerW = W - sideW * 2;
    const cx = W / 2, cy = topH + centerH / 2;

    // ——— 1. 上方 AI（P1 North） ———
    drawTopAI(topH, cx);

    // ——— 2. 中部：左右 AI + 桌面 ———
    // 左 AI（P2 West）
    drawSideAI(2, 0, topH, sideW, centerH, false);
    // 右 AI（P3 East）
    drawSideAI(3, W - sideW, topH, sideW, centerH, true);

    // ——— 3. 中央桌面 ———
    drawTable(cx, cy, centerW, centerH, sideW, topH, bottomH);

    // ——— 4. 下方玩家区域 ———
    drawPlayerBottom(bottomH, sideW);

    // ——— 5. 回合指示 ———
    drawTurnIndicator(st, topH, bottomH, sideW, centerH);
  }

  // ==================== 竖屏（移动端） ====================

  function renderPortrait() {
    const st = window.state;
    const lp = LAYOUT.PORTRAIT;
    const topBarH = H * lp.TOP_BAR_H;
    const tableH  = H * lp.TABLE_H;
    const bottomH = H * lp.BOTTOM_H;

    // 顶部 AI 信息栏
    drawPortraitTopBar(topBarH);

    // 中央桌面（弃牌堆 + 牌墙）
    drawPortraitTable(topBarH, tableH);

    // 底部玩家手牌
    drawPortraitBottom(bottomH, topBarH + tableH);
  }

  // ======================================================================
  //  横屏各区域
  // ======================================================================

  function drawTopAI(topH, cx) {
    const st = window.state;
    const count = st.hands[1].length;
    const tw = LAYOUT.AI_TILE_W * sc;
    const th = LAYOUT.AI_TILE_H * sc;
    const totalW = Math.min(count * (tw + 1), W * 0.6);
    const startX = cx - totalW / 2;
    const tileY = topH / 2 - th / 2 + 2 * sc;

    // 面板
    drawPlayerPanel(10 * sc, 4 * sc, 140 * sc, topH - 8 * sc, 1, st.currentPlayer === 1);

    // 牌背
    for (let i = 0; i < count; i++) {
      drawTile(startX + i * (tw + 1), tileY, tw, th, 0, false, false, false);
    }

    // 牌数标记
    ctx.fillStyle = C.TEXT_DIM;
    ctx.font = `${Math.floor(11 * sc)}px "Microsoft YaHei", sans-serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(`×${count}`, startX + totalW + 6 * sc, tileY + th / 2);
  }

  function drawSideAI(playerIdx, x, topY, sideW, centerH, isRight) {
    const st = window.state;
    const count = st.hands[playerIdx].length;
    const tw = LAYOUT.AI_TILE_W * sc;
    const th = LAYOUT.AI_TILE_H * sc;
    const totalH = Math.min(count * (th + 1), centerH * 0.65);
    const startY = topY + centerH / 2 - totalH / 2;
    const tileX = x + sideW / 2 - tw / 2;

    // 面板 (顶部或底部)
    const panelW = isRight ? 120 * sc : 120 * sc;
    const panelH = 44 * sc;
    const panelX = isRight ? x + 4 * sc : x + sideW - panelW - 4 * sc;
    const panelY = topY + 6 * sc;

    ctx.save();
    // 玩家的纵向面板，使用旋转文字
    // 简化：显示名字+分数在顶部
    drawPlayerPanel(panelX, panelY, panelW, panelH, playerIdx, st.currentPlayer === playerIdx);

    // 牌背纵向排列
    for (let i = 0; i < count; i++) {
      drawTile(tileX, startY + i * (th + 1), tw, th, 0, false, false, false);
    }

    // 牌数标记
    ctx.fillStyle = C.TEXT_DIM;
    ctx.font = `${Math.floor(10 * sc)}px "Microsoft YaHei", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`×${count}`, tileX + tw / 2, startY + totalH + 4 * sc);
    ctx.restore();
  }

  function drawTable(cx, cy, tw, th, sideW, topH, bottomH) {
    const st = window.state;

    // ——— 桌面背景（带木框效果） ———
    const borderW = 4;
    ctx.save();

    // 外框阴影
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 4;

    // 木框
    drawRoundedRect(cx - tw / 2, cy - th / 2, tw, th, 16);
    const frameGrad = ctx.createLinearGradient(cx - tw / 2, cy - th / 2, cx + tw / 2, cy + th / 2);
    frameGrad.addColorStop(0, C.TABLE_BORDER);
    frameGrad.addColorStop(0.5, '#5D4037');
    frameGrad.addColorStop(1, C.TABLE_BORDER);
    ctx.fillStyle = frameGrad;
    ctx.fill();
    ctx.restore();

    // 绿毡内框
    const innerX = cx - tw / 2 + borderW + 4;
    const innerY = cy - th / 2 + borderW + 4;
    const innerW = tw - (borderW + 4) * 2;
    const innerH = th - (borderW + 4) * 2;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 10;
    drawRoundedRect(innerX, innerY, innerW, innerH, 12);
    const tableGrad = ctx.createRadialGradient(cx, cy, 10, cx, cy, innerW / 2);
    tableGrad.addColorStop(0, C.TABLE_LIGHT);
    tableGrad.addColorStop(0.5, C.TABLE_PRIMARY);
    tableGrad.addColorStop(1, C.TABLE_EDGE);
    ctx.fillStyle = tableGrad;
    ctx.fill();
    ctx.restore();

    // 木纹装饰线
    ctx.strokeStyle = 'rgba(78,52,46,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(innerX + 20, cy);
    ctx.lineTo(innerX + innerW - 20, cy);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, innerY + 20);
    ctx.lineTo(cx, innerY + innerH - 20);
    ctx.stroke();

    // ——— 弃牌区 ———
    drawDiscardCenter(cx, cy, innerW, innerH, sc);

    // ——— 牌墙信息 ———
    drawWallInfo(cx, cy, innerW);
  }

  function drawDiscardCenter(cx, cy, tableW, tableH, sc2) {
    const st = window.state;
    const ds = LAYOUT.DISCARD_COLS;
    const gap = Math.min(4 * sc2, 6);
    const tw = Math.min(30 * sc2, 36);
    const th = tw * 4 / 3;

    // 四个方向的弃牌区
    const labels = ['你(南)', '北', '西', '东'];

    // 计算一张小牌的尺寸
    const cellW = tw + gap;
    const cellH = th + gap;
    const cols = ds;

    for (let p = 0; p < 4; p++) {
      const disc = st.discards[p];
      if (disc.length === 0) continue;

      const zoneW = cols * cellW;
      const zoneH = 3 * cellH;

      let zoneX, zoneY;

      if (p <= 1) {
        // 南北：横向排列
        zoneX = cx - zoneW / 2;
        zoneY = p === 0 ? cy + tableH * 0.15 : cy - tableH * 0.15 - zoneH;
      } else {
        // 西：左列，东：右列
        zoneX = p === 2 ? cx - tableW * 0.25 - zoneW / 2 : cx + tableW * 0.25 - zoneW / 2;
        zoneY = cy - zoneH / 2;
      }

      // 绘制区域的弃牌
      for (let i = 0; i < Math.min(disc.length, cols * 3); i++) {
        const row = Math.floor(i / cols);
        const col = i % cols;
        const dx = zoneX + col * cellW;
        const dy = zoneY + row * cellH;
        drawTile(dx, dy, tw, th, disc[i], true, false, false);
      }
    }

    // 弃牌区标签（小字标识）
    ctx.fillStyle = C.TEXT_DIM;
    ctx.font = `${Math.floor(9 * sc2)}px "Microsoft YaHei", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const labelPositions = [
      [cx, cy + tableH * 0.15 - 6 * sc2 + 3 * cellH],
      [cx, cy - tableH * 0.15 + 6 * sc2],
      [cx - tableW * 0.25, cy],
      [cx + tableW * 0.25, cy],
    ];

    for (let p = 0; p < 4; p++) {
      if (st.discards[p].length > 0) {
        ctx.fillText(labels[p], labelPositions[p][0], labelPositions[p][1]);
      }
    }
  }

  function drawWallInfo(cx, cy, tableW) {
    const st = window.state;
    const remaining = st.deck.length;

    // 牌墙图标 + 数字
    const barW = Math.min(120 * sc, tableW * 0.2);
    const barH = 8 * sc;
    const barX = cx - barW / 2;
    const barY = cy + 6 * sc;

    // 背景条
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    drawRoundedRect(barX, barY, barW, barH, barH / 2);
    ctx.fill();

    // 填充
    const fillRatio = remaining / 112;
    ctx.fillStyle = fillRatio > 0.3 ? C.GREEN_BRIGHT : C.RED;
    drawRoundedRect(barX, barY, barW * fillRatio, barH, barH / 2);
    ctx.fill();

    // 文字
    ctx.fillStyle = C.TEXT;
    ctx.font = `bold ${Math.floor(12 * sc)}px "Microsoft YaHei", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`余牌 ${remaining}`, cx, barY + barH + 4 * sc);

    // 红中图标（装饰）
    ctx.fillStyle = 'rgba(196,59,42,0.15)';
    ctx.font = `${Math.floor(20 * sc)}px "Microsoft YaHei", serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🀄', cx - barW / 2 - 20 * sc, cy);
  }

  function drawPlayerBottom(bottomH, sideW) {
    const st = window.state;
    const hand = st.hands[0];
    const panelH = Math.min(LAYOUT.PANEL_H * sc, bottomH * 0.38);

    // ——— 玩家面板 ———
    const panelW = 140 * sc;
    drawPlayerPanel(8 * sc, H - bottomH + 6 * sc, panelW, panelH, 0, st.currentPlayer === 0);

    // ——— 副露区 ———
    let meldStartX = panelW + 16 * sc;
    const meldY = H - bottomH + 6 * sc;
    drawMeldsForPlayer(0, meldStartX, meldY, bottomH);

    // ——— 手牌 ———
    const tw = TILE_W * sc;
    const th = TILE_H * sc;
    th2 = th;
    st.hands[0] = sortHand(st.hands[0]);
    if (st.selectedIdx >= hand.length) st.selectedIdx = -1;

    // 计算可用宽度（从面板右侧到屏幕右边缘）
    const availW = W - panelW - 24 * sc;
    const gap = Math.min(tw + 2, (availW - tw) / Math.max(hand.length - 1, 1));
    const totalHandW = (hand.length - 1) * gap + tw;
    const handStartX = panelW + 16 * sc + Math.max(0, (availW - 16 * sc - totalHandW) / 2);

    // 手牌 Y（位于面板下方）
    const handY = H - bottomH + panelH + 8 * sc;

    st._playerTilePositions = [];
    const newTileIdx = hand.length - 1; // 最后一张是新摸的

    for (let i = 0; i < hand.length; i++) {
      const x = handStartX + i * gap;
      const isNew = (st.turnPhase === 'draw' || st.turnPhase === 'discard') && i === newTileIdx;
      const selected = st.selectedIdx === i;
      const yOff = (selected ? 12 : (isNew ? 8 : 0));
      drawTile(x, handY - yOff, tw, th, hand[i], true, selected, isNew && !selected);
      st._playerTilePositions.push({ x, y: handY - yOff, w: tw, h: th, idx: i });
    }
  }

  function drawMeldsForPlayer(playerIdx, startX, startY, zoneH) {
    const st = window.state;
    const melds = st.melds[playerIdx];
    if (melds.length === 0) return;

    const mw = Math.min(28 * sc, 34);
    const mh = mw * 4 / 3;
    let offsetX = 0;

    for (const meld of melds) {
      const tileCount = meld.type === 'gang' ? 4 : 3;
      for (let i = 0; i < tileCount; i++) {
        const x = startX + offsetX + i * (mw + 2);
        const faceUp = (meld.type !== 'angang' && meld.type !== 'mangang') || playerIdx === 0;
        drawTile(x, startY, mw, mh, meld.tiles[i], faceUp, false, false);
      }
      offsetX += tileCount * (mw + 2) + 6 * sc;
    }
  }

  function drawTurnIndicator(st, topH, bottomH, sideW, centerH) {
    if (st.phase !== 'playerTurn' && st.phase !== 'aiTurn') return;

    const positions = {
      0: [W / 2, H - bottomH - 6 * sc],
      1: [W / 2, topH + 10 * sc],
      2: [sideW + 10 * sc, topH + centerH / 2],
      3: [W - sideW - 10 * sc, topH + centerH / 2],
    };

    const [ix, iy] = positions[st.currentPlayer] || positions[0];

    // 脉冲光环
    ctx.save();
    ctx.fillStyle = 'rgba(255,215,0,0.2)';
    ctx.beginPath();
    ctx.arc(ix, iy, 14 * sc, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.arc(ix, iy, 8 * sc, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,215,0,0.35)';
    ctx.beginPath();
    ctx.arc(ix, iy, 12 * sc, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ======================================================================
  //  竖屏渲染
  // ======================================================================

  function drawPortraitTopBar(topBarH) {
    const st = window.state;
    const lp = LAYOUT.PORTRAIT;
    const y = 2 * sc;
    const barH = topBarH - 2 * sc;
    const third = W / 3;

    for (let p = 1; p <= 3; p++) {
      const x = third * (p - 1);
      const isActive = st.currentPlayer === p;

      // 头像圆圈
      const r = lp.AVATAR_R * sc;
      const avX = x + 12 * sc;
      const avY = y + barH / 2;
      drawCircle(avX, avY, r, C.WIND_COLORS[p], isActive ? C.GOLD : null);

      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.floor(r * 0.7)}px "Microsoft YaHei", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(['北','西','东'][p - 1], avX, avY + 1);

      // 分数（精简，不加"分:"）
      ctx.fillStyle = isActive ? C.GOLD : C.TEXT_DIM;
      ctx.font = `${Math.floor(10 * sc)}px "Microsoft YaHei", sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const label = ['北AI','西AI','东AI'][p - 1];
      ctx.fillText(`${label} ${st.scores[p]}`, avX + r + 4 * sc, avY);

      // 牌数（右侧）
      ctx.fillStyle = isActive ? C.GOLD : 'rgba(255,255,255,0.3)';
      ctx.font = `${Math.floor(8 * sc)}px "Microsoft YaHei", sans-serif`;
      ctx.textAlign = 'right';
      ctx.fillText(`×${st.hands[p].length}`, x + third - 8 * sc, avY);
    }
  }

  function drawPortraitTable(topY, tableH) {
    const st = window.state;
    const cx = W / 2;
    const cy = topY + tableH / 2;
    const tw = W * 0.94;
    const th = tableH * 0.92;
    const lp = LAYOUT.PORTRAIT;

    // ====== 桌框（胡桃木） ======
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 4;
    drawRoundedRect(cx - tw / 2, cy - th / 2, tw, th, 12);
    ctx.fillStyle = C.TABLE_FRAME;
    ctx.fill();
    ctx.restore();

    // 框内收边
    const borderW = 5 * sc;
    const innerX = cx - tw / 2 + borderW;
    const innerY = cy - th / 2 + borderW;
    const innerW = tw - borderW * 2;
    const innerH = th - borderW * 2;

    // ====== 绒面桌布 ======
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 8;
    drawRoundedRect(innerX, innerY, innerW, innerH, 8);
    const tableGrad = ctx.createRadialGradient(cx, cy, innerW * 0.05, cx, cy, innerW * 0.55);
    tableGrad.addColorStop(0, C.TABLE_LIGHT);
    tableGrad.addColorStop(0.35, C.TABLE_PRIMARY);
    tableGrad.addColorStop(0.75, '#0A3511');
    tableGrad.addColorStop(1, C.TABLE_EDGE);
    ctx.fillStyle = tableGrad;
    ctx.fill();
    ctx.restore();

    // 绒面纹理斜线
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.02)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = innerX - innerH; i < innerX + innerW; i += 18 * sc) {
      ctx.moveTo(i, innerY);
      ctx.lineTo(i + innerH, innerY + innerH);
    }
    ctx.stroke();
    ctx.restore();

    // 内边框
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1;
    drawRoundedRect(innerX, innerY, innerW, innerH, 8);
    ctx.stroke();

    // ====== 弃牌堆 ======
    const allDiscards = [];
    for (let p = 0; p < 4; p++) {
      for (const d of st.discards[p]) {
        allDiscards.push({ tile: d, player: p });
      }
    }

    const dtw = lp.DISCARD_W * sc;
    const dth = lp.DISCARD_H * sc;
    const cols = 6;
    const gap = 2;
    const maxRows = 4;
    const rows = Math.min(Math.ceil(allDiscards.length / cols), maxRows);
    const zoneW = cols * (dtw + gap);
    const zoneH = rows * (dth + gap);

    if (allDiscards.length > 0) {
      const startX = cx - zoneW / 2;
      // 弃牌区放在桌面上半部分
      const startY = cy - zoneH / 2 - tableH * 0.12;
      for (let i = 0; i < allDiscards.length && i < cols * maxRows; i++) {
        const row = Math.floor(i / cols);
        const col = i % cols;
        drawTile(startX + col * (dtw + gap), startY + row * (dth + gap), dtw, dth, allDiscards[i].tile, true, false, false);
      }
    } else {
      // 空桌提示
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.font = `${Math.floor(16 * sc)}px "Microsoft YaHei", serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('红中', cx, cy - 4 * sc);
    }

    // ====== 牌墙（醒目大条） ======
    const remaining = st.deck.length;
    const barW = Math.min(120 * sc, tw * 0.4);
    const barH = 9 * sc;
    const barX = cx - barW / 2;
    const barY = cy + innerH / 2 - 20 * sc;

    // 底色
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    drawRoundedRect(barX, barY, barW, barH, barH / 2);
    ctx.fill();

    // 填充
    const ratio = remaining / 112;
    const barGrad = ctx.createLinearGradient(barX, 0, barX + barW * ratio, 0);
    barGrad.addColorStop(0, ratio > 0.3 ? '#2E7D32' : '#C43B2A');
    barGrad.addColorStop(1, ratio > 0.3 ? '#4CAF50' : '#EF5350');
    ctx.fillStyle = barGrad;
    drawRoundedRect(barX, barY, barW * ratio, barH, barH / 2);
    ctx.fill();

    // 数字
    ctx.fillStyle = C.TEXT;
    ctx.font = `bold ${Math.floor(12 * sc)}px "Microsoft YaHei", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`🀄 余牌 ${remaining}`, cx, barY - 4 * sc);
  }

  function drawPortraitBottom(bottomH, tableBottomY) {
    const st = window.state;
    const hand = st.hands[0];
    const cx = W / 2;
    const lp = LAYOUT.PORTRAIT;

    st.hands[0] = sortHand(st.hands[0]);
    if (st.selectedIdx >= hand.length) st.selectedIdx = -1;

    const padX = 2 * sc;

    // ====== 计算手牌布局（从下往上排） ======
    // 按钮区域大约底部 70px，提示文字 20px，留空隙
    const btnReserve = 82 * sc;
    const maxTileW = lp.TILE_W * sc;
    const maxTileH = lp.TILE_H * sc;
    const availW = W - padX * 2;

    // 每张牌最小可见宽度
    const minVisibleW = 26 * sc;
    const needNoOverlap = maxTileW * hand.length + (hand.length - 1) * 2;

    let tileW, tileH, pitch;
    if (needNoOverlap <= availW) {
      // 不重叠
      tileW = maxTileW;
      tileH = maxTileH;
      pitch = (availW - tileW) / Math.max(hand.length - 1, 1);
    } else {
      // 重叠模式
      const targetPitch = (availW - maxTileW) / Math.max(hand.length - 1, 1);
      const visiblePerTile = Math.max(targetPitch, minVisibleW);
      pitch = visiblePerTile;
      tileW = Math.min(maxTileW, pitch + maxTileW * lp.OVERLAP);
      tileH = tileW * (maxTileH / maxTileW);
    }

    th2 = tileH;
    const totalW = (hand.length - 1) * pitch + tileW;
    const handStartX = padX + (availW - totalW) / 2;
    // 手牌贴底部，留 btnReserve 给按钮+提示
    const handBottom = H - btnReserve;
    const handY = handBottom - tileH;

    // ====== 玩家信息行（在手牌上方） ======
    const r = 11 * sc;
    const infoY = handY - r * 2 - 10 * sc;
    const avX = 14 * sc;
    const avY = infoY + r + 4 * sc;

    drawCircle(avX, avY, r, C.WIND_COLORS[0], st.currentPlayer === 0 ? C.GOLD : null);
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.floor(r * 0.75)}px "Microsoft YaHei", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('你', avX, avY + 1);

    ctx.fillStyle = C.TEXT;
    ctx.font = `bold ${Math.floor(10 * sc)}px "Microsoft YaHei", sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`你(南)  ${st.scores[0]}分`, avX + r + 5 * sc, avY);

    // 副露（紧接头像右侧）
    const melds = st.melds[0];
    let meldX = avX + 78 * sc;
    const mw = lp.MELD_W * sc;
    const mh = lp.MELD_H * sc;
    for (const meld of melds) {
      const tc = meld.type === 'gang' ? 4 : 3;
      for (let i = 0; i < tc; i++) {
        drawTile(meldX + i * (mw + 1), avY - mh / 2, mw, mh, meld.tiles[i], true, false, false);
      }
      meldX += tc * (mw + 1) + 3 * sc;
    }

    // ====== 手牌（从右往左画，前面的牌在上面） ======
    st._playerTilePositions = [];
    const newTileIdx = hand.length - 1;

    for (let i = hand.length - 1; i >= 0; i--) {
      const x = handStartX + i * pitch;
      const isNew = (st.turnPhase === 'draw' || st.turnPhase === 'discard') && i === newTileIdx;
      const selected = st.selectedIdx === i;
      const yOff = selected ? 16 * sc : (isNew ? 10 * sc : 0);
      drawTile(x, handY - yOff, tileW, tileH, hand[i], true, selected, isNew && !selected);
    }
    // 重新正向填充位置数组（供点击检测用）
    st._playerTilePositions = [];
    for (let i = 0; i < hand.length; i++) {
      const x = handStartX + i * pitch;
      const isNew = (st.turnPhase === 'draw' || st.turnPhase === 'discard') && i === newTileIdx;
      const selected = st.selectedIdx === i;
      const yOff = selected ? 16 * sc : (isNew ? 10 * sc : 0);
      st._playerTilePositions.push({ x, y: handY - yOff, w: tileW, h: tileH, idx: i });
    }

    // ====== 出牌提示 ======
    if (st.turnPhase === 'discard' && st.phase === 'playerTurn') {
      ctx.fillStyle = 'rgba(255,215,0,0.5)';
      ctx.font = `${Math.floor(10 * sc)}px "Microsoft YaHei", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText('点击牌 → 选中 → 再点打出', cx, handBottom + 4 * sc);
    }

    // ====== 回合指示 ======
    if (st.currentPlayer === 0 && st.phase === 'playerTurn') {
      ctx.save();
      ctx.fillStyle = 'rgba(255,215,0,0.15)';
      ctx.beginPath();
      ctx.arc(cx, infoY, 6 * sc, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFD700';
      ctx.beginPath();
      ctx.arc(cx, infoY, 3 * sc, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // ======================================================================
  //  公共 API
  // ======================================================================

  return {
    canvas, ctx, resize, render,
    getCanvas, getCtx,
  };
})();
