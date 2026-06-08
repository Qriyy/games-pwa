/**
 * 红中麻将 — 渲染模块（四人对战布局版）
 * Canvas 2D 渲染：桌面、AI牌背、玩家手牌、弃牌、副露、牌墙
 */
window.Renderer = (function() {
  const { TILE_W, TILE_H, SUIT_NAMES, SUIT_COLORS, HONGZHONG_ID, C, LAYOUT } = window.Constants;
  const { isHongzhong, tileSuit, tileNumber, tileName, tileBaseId, sortHand } = window.Tiles;
  const { CN_NUMS, SUIT_CN, TONG_DOTS } = window.Constants;

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  let W, H, isPortrait, sc;
  let th2;

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

  // ======================================================================
  //  牌面绘制（真实素材优先，Canvas后备）
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

    // ——— 牌背 ———
    if (!faceUp) {
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
      ctx.restore();
      return;
    }

    // ——— 牌面：真实素材 ———
    const tileImg = window.TileAssets ? window.TileAssets.getTile(tileId) : null;
    if (tileImg) {
      drawRoundedRect(x, drawY, w, h, r);
      ctx.fillStyle = '#FFFDF5';
      ctx.fill();
      ctx.save();
      ctx.beginPath();
      drawRoundedRect(x, drawY, w, h, r);
      ctx.clip();
      ctx.drawImage(tileImg, x, drawY, w, h);
      ctx.restore();
      ctx.strokeStyle = 'rgba(0,0,0,0.12)';
      ctx.lineWidth = 1;
      drawRoundedRect(x, drawY, w, h, r);
      ctx.stroke();
      ctx.restore();
      return;
    }

    // ——— 后备：Canvas手绘 ———
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
      ctx.strokeStyle = 'rgba(200,50,30,0.5)';
      ctx.lineWidth = w * 0.04;
      drawRoundedRect(x + inset + 2, drawY + inset + 2, w - inset*2 - 4, h - inset*2 - 4, r*0.5);
      ctx.stroke();
      ctx.fillStyle = '#C43B2A';
      ctx.font = `bold ${Math.floor(h*0.5)}px "KaiTi","Microsoft YaHei",serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('中', cx, drawY + h*0.46);
    } else {
      const suit = tileSuit(tileId); const num = tileNumber(tileId); const color = SUIT_COLORS[suit];
      const cs = Math.floor(h*0.18);
      ctx.fillStyle = color; ctx.font = `bold ${cs}px "Microsoft YaHei",sans-serif`;
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(`${num}`, x+inset+4, drawY+inset+2);
      ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
      ctx.fillText(`${num}`, x+w-inset-4, drawY+h-inset-2);
      const c2 = Math.floor(h*0.32);
      if (suit === 'wan') {
        ctx.fillStyle = color; ctx.font = `bold ${c2}px "KaiTi","Microsoft YaHei",serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(CN_NUMS[num-1], cx, cy);
      } else if (suit === 'tiao') {
        const dR = Math.min(w,h)*0.04; const cc = num<=3?1:(num<=6?2:3); const rr = Math.ceil(num/cc);
        const cw2 = w*0.55/cc; const ch2 = h*0.55/rr;
        const gsx = cx-(cw2*(cc-1))/2; const gsy = cy-(ch2*(rr-1))/2;
        for (let i=0;i<num;i++) {
          const dx=gsx+(i%cc)*cw2+cw2/2, dy=gsy+Math.floor(i/cc)*ch2+ch2/2;
          ctx.strokeStyle='#1A6A2A'; ctx.lineWidth=Math.max(dR,1.2);
          ctx.beginPath(); ctx.moveTo(dx,dy-ch2*0.35); ctx.lineTo(dx,dy+ch2*0.35); ctx.stroke();
          ctx.lineWidth=Math.max(dR*1.5,1.8); ctx.beginPath(); ctx.moveTo(dx-dR*1.2,dy); ctx.lineTo(dx+dR*1.2,dy); ctx.stroke();
          ctx.fillStyle='#1A6A2A'; ctx.beginPath(); ctx.arc(dx,dy-ch2*0.35,dR*1.2,0,Math.PI*2); ctx.fill();
        }
      } else if (suit === 'tong') {
        const dots = TONG_DOTS[num]; const dR=Math.min(w,h)*0.07; const unit=Math.min(w,h)*0.12;
        for (const [dr,dc] of dots) {
          const dx2=cx+dc*unit, dy2=cy+dr*unit;
          ctx.strokeStyle='#8A2A1A'; ctx.lineWidth=Math.max(dR*0.3,1);
          ctx.beginPath(); ctx.arc(dx2,dy2,dR,0,Math.PI*2); ctx.stroke();
          ctx.fillStyle='#8A2A1A'; ctx.beginPath(); ctx.arc(dx2,dy2,dR*0.45,0,Math.PI*2); ctx.fill();
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

    const r = LAYOUT.AVATAR_R * sc;
    const avatarX = x + r + 8 * sc;
    const avatarY = y + h / 2;
    drawCircle(avatarX, avatarY, r, windColor, isActive ? C.GOLD : null);

    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.floor(r * 0.9)}px "Microsoft YaHei", sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const initial = playerIdx === 0 ? '你' : ['北', '西', '东'][playerIdx - 1];
    ctx.fillText(initial, avatarX, avatarY + 1);

    ctx.fillStyle = isActive ? C.GOLD : C.TEXT;
    ctx.font = `bold ${Math.floor(13 * sc)}px "Microsoft YaHei", sans-serif`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(pName, avatarX + r + 8 * sc, avatarY - 10 * sc);

    ctx.fillStyle = C.TEXT_DIM;
    ctx.font = `${Math.floor(11 * sc)}px "Microsoft YaHei", sans-serif`;
    ctx.fillText(`分: ${score}`, avatarX + r + 8 * sc, avatarY + 10 * sc);
  }

  // ======================================================================
  //  横屏渲染
  // ======================================================================

  function render() {
    ctx.fillStyle = C.BG;
    ctx.fillRect(0, 0, W, H);
    if (isPortrait) { renderPortrait(); }
    else { renderLandscape(); }

    // 调试信息显示
    try {
      const msg = window.UI && window.UI.debugMsg;
      if (msg) {
        ctx.fillStyle = 'rgba(255,0,0,0.9)';
        ctx.font = 'bold 13px monospace';
        ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText(msg, 4, 4);
      }
    } catch(e) {}
  }

  function renderLandscape() {
    const st = window.state;
    const topH = H * LAYOUT.TOP_RATIO;
    const bottomH = H * LAYOUT.BOTTOM_RATIO;
    const sideW = W * LAYOUT.SIDE_RATIO;
    const centerH = H - topH - bottomH;
    const centerW = W - sideW * 2;
    const cx = W / 2, cy = topH + centerH / 2;

    drawTopAI(topH, cx);
    drawSideAI(2, 0, topH, sideW, centerH, false);
    drawSideAI(3, W - sideW, topH, sideW, centerH, true);
    drawTable(cx, cy, centerW, centerH, sideW, topH, bottomH);
    drawPlayerBottom(bottomH, sideW);
    drawTurnIndicator(st, topH, bottomH, sideW, centerH);
  }

  // ==================== 竖屏（移动端） 四人对战布局 ====================

  function renderPortrait() {
    const st = window.state;
    const lp = LAYOUT.PORTRAIT;
    const cx = W / 2;

    const topH    = H * lp.TOP_H;
    const sideW   = W * lp.SIDE_W;
    // 底部固定只占 22%（信息栏+手牌），其余都给桌面
    const bottomH = H * 0.22;
    const tableH  = H - topH - bottomH - 6 * sc;

    // 4个方向
    drawPortraitTopAI(0, topH, cx);                        // P1 北（对面）
    drawPortraitSideAI(2, 0, topH, sideW, tableH, false);  // P2 西（左）
    drawPortraitSideAI(3, W - sideW, topH, sideW, tableH, true); // P3 东（右）
    drawPortraitTable(topH, tableH, sideW);                 // 桌面
    drawPortraitBottom(bottomH, H - bottomH);               // 玩家
    drawPortraitTurnIndicator(st, topH, sideW, tableH, bottomH, cx);
  }

  // ===== 横屏各区域 =====

  function drawTopAI(topH, cx) {
    const st = window.state; const p = 1; const count = st.hands[p].length;
    const tw = LAYOUT.AI_TILE_W * sc; const th = LAYOUT.AI_TILE_H * sc;
    const totalW = Math.min(count * (tw+1), W*0.6);
    const startX = cx - totalW/2; const tileY = topH/2 - th/2 + 2*sc;
    drawPlayerPanel(10*sc, 4*sc, 140*sc, topH-8*sc, 1, st.currentPlayer===1);
    for (let i=0;i<count;i++) drawTile(startX+i*(tw+1), tileY, tw, th, 0, false, false, false);
    ctx.fillStyle = C.TEXT_DIM; ctx.font = `${Math.floor(11*sc)}px "Microsoft YaHei",sans-serif`;
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillText(`×${count}`, startX+totalW+6*sc, tileY+th/2);
  }

  function drawSideAI(playerIdx, x, topY, sideW, centerH, isRight) {
    const st = window.state; const count = st.hands[playerIdx].length;
    const tw = LAYOUT.AI_TILE_W * sc; const th = LAYOUT.AI_TILE_H * sc;
    const totalH = Math.min(count*(th+1), centerH*0.65);
    const startY = topY + centerH/2 - totalH/2; const tileX = x+sideW/2 - tw/2;
    const panelW=120*sc; const panelH=44*sc;
    const panelX=isRight ? x+4*sc : x+sideW-panelW-4*sc;
    const panelY=topY+6*sc;
    drawPlayerPanel(panelX, panelY, panelW, panelH, playerIdx, st.currentPlayer===playerIdx);
    for (let i=0;i<count;i++) drawTile(tileX, startY+i*(th+1), tw, th, 0, false, false, false);
    ctx.fillStyle = C.TEXT_DIM; ctx.font = `${Math.floor(10*sc)}px "Microsoft YaHei",sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(`×${count}`, tileX+tw/2, startY+totalH+4*sc);
  }

  function drawTable(cx, cy, tw, th, sideW, topH, bottomH) {
    const st = window.state;
    const bw = 4;
    ctx.save();
    ctx.shadowColor='rgba(0,0,0,0.5)'; ctx.shadowBlur=20; ctx.shadowOffsetY=4;
    drawRoundedRect(cx-tw/2, cy-th/2, tw, th, 16);
    const fg = ctx.createLinearGradient(cx-tw/2,cy-th/2,cx+tw/2,cy+th/2);
    fg.addColorStop(0,C.TABLE_BORDER); fg.addColorStop(0.5,'#5D4037'); fg.addColorStop(1,C.TABLE_BORDER);
    ctx.fillStyle=fg; ctx.fill(); ctx.restore();
    const ix=cx-tw/2+bw+4, iy=cy-th/2+bw+4, iw=tw-(bw+4)*2, ih=th-(bw+4)*2;
    ctx.save(); ctx.shadowColor='rgba(0,0,0,0.3)'; ctx.shadowBlur=10;
    drawRoundedRect(ix,iy,iw,ih,12);
    const tg=ctx.createRadialGradient(cx,cy,10,cx,cy,iw/2);
    tg.addColorStop(0,C.TABLE_LIGHT); tg.addColorStop(0.5,C.TABLE_PRIMARY); tg.addColorStop(1,C.TABLE_EDGE);
    ctx.fillStyle=tg; ctx.fill(); ctx.restore();
    drawDiscardCenter(cx, cy, iw, ih, sc);
    drawWallInfo(cx, cy, iw);
  }

  function drawDiscardCenter(cx, cy, tableW, tableH, sc2) {
    const st = window.state; const ds = LAYOUT.DISCARD_COLS;
    const gap = Math.min(4*sc2,6); const tw = Math.min(30*sc2,36); const th = tw*4/3;
    const cellW = tw+gap; const cellH = th+gap; const cols = ds;
    for (let p=0;p<4;p++) {
      const disc = st.discards[p];
      if (disc.length===0) continue;
      const zoneW = cols*cellW; const zoneH = 3*cellH;
      let zoneX, zoneY;
      if (p<=1) { zoneX=cx-zoneW/2; zoneY=p===0 ? cy+tableH*0.15 : cy-tableH*0.15-zoneH; }
      else { zoneX=p===2 ? cx-tableW*0.25-zoneW/2 : cx+tableW*0.25-zoneW/2; zoneY=cy-zoneH/2; }
      for (let i=0;i<Math.min(disc.length,cols*3);i++) {
        const row=Math.floor(i/cols), col=i%cols;
        drawTile(zoneX+col*cellW, zoneY+row*cellH, tw, th, disc[i], true, false, false);
      }
    }
    ctx.fillStyle=C.TEXT_DIM; ctx.font=`${Math.floor(9*sc2)}px "Microsoft YaHei",sans-serif`;
    ctx.textAlign='center'; ctx.textBaseline='middle';
    const lp = [[cx,cy+tableH*0.15-6*sc2+3*cellH],[cx,cy-tableH*0.15+6*sc2],[cx-tableW*0.25,cy],[cx+tableW*0.25,cy]];
    const lb=['你(南)','北','西','东'];
    for (let p=0;p<4;p++) if (st.discards[p].length>0) ctx.fillText(lb[p], lp[p][0], lp[p][1]);
  }

  function drawWallInfo(cx, cy, tableW) {
    const st = window.state; const remaining = st.deck.length;
    const barW = Math.min(120*sc, tableW*0.2); const barH = 8*sc;
    const barX = cx-barW/2; const barY = cy+6*sc;
    ctx.fillStyle='rgba(0,0,0,0.3)'; drawRoundedRect(barX,barY,barW,barH,barH/2); ctx.fill();
    const ratio=remaining/112; ctx.fillStyle=ratio>0.3?C.GREEN_BRIGHT:C.RED;
    drawRoundedRect(barX,barY,barW*ratio,barH,barH/2); ctx.fill();
    ctx.fillStyle=C.TEXT; ctx.font=`bold ${Math.floor(12*sc)}px "Microsoft YaHei",sans-serif`;
    ctx.textAlign='center'; ctx.textBaseline='top';
    ctx.fillText(`余牌 ${remaining}`, cx, barY+barH+4*sc);
  }

  function drawPlayerBottom(bottomH, sideW) {
    const st = window.state; const hand = st.hands[0];
    const panelH = Math.min(LAYOUT.PANEL_H*sc, bottomH*0.38);
    drawPlayerPanel(8*sc, H-bottomH+6*sc, 140*sc, panelH, 0, st.currentPlayer===0);
    let msx = 140*sc+16*sc; drawMeldsForPlayer(0, msx, H-bottomH+6*sc, bottomH);
    const tw=TILE_W*sc; const th=TILE_H*sc; th2=th;
    st.hands[0]=sortHand(st.hands[0]); if (st.selectedIdx>=hand.length) st.selectedIdx=-1;
    const aw=W-140*sc-24*sc; const gap=Math.min(tw+2,(aw-tw)/Math.max(hand.length-1,1));
    const totalHandW=(hand.length-1)*gap+tw;
    const hsx=140*sc+16*sc+Math.max(0,(aw-16*sc-totalHandW)/2);
    const handY=H-bottomH+panelH+8*sc;
    st._playerTilePositions=[]; const newTileIdx=hand.length-1;
    for (let i=0;i<hand.length;i++) {
      const x=hsx+i*gap;
      const isNew=(st.turnPhase==='draw'||st.turnPhase==='discard')&&i===newTileIdx;
      const selected=st.selectedIdx===i; const yOff=selected?12:(isNew?8:0);
      drawTile(x, handY-yOff, tw, th, hand[i], true, selected, isNew&&!selected);
      st._playerTilePositions.push({x,y:handY-yOff,w:tw,h:th,idx:i});
    }
  }

  function drawMeldsForPlayer(playerIdx, startX, startY, zoneH) {
    const st = window.state; const melds = st.melds[playerIdx];
    if (melds.length===0) return;
    const mw=Math.min(28*sc,34); const mh=mw*4/3; let ox=0;
    for (const meld of melds) {
      const tc=meld.type==='gang'?4:3;
      for (let i=0;i<tc;i++) {
        const fu=(meld.type!=='angang'&&meld.type!=='mangang')||playerIdx===0;
        drawTile(startX+ox+i*(mw+2), startY, mw, mh, meld.tiles[i], fu, false, false);
      }
      ox+=tc*(mw+2)+6*sc;
    }
  }

  function drawTurnIndicator(st, topH, bottomH, sideW, centerH) {
    if (st.phase!=='playerTurn'&&st.phase!=='aiTurn') return;
    const pos={0:[W/2,H-bottomH-6*sc],1:[W/2,topH+10*sc],2:[sideW+10*sc,topH+centerH/2],3:[W-sideW-10*sc,topH+centerH/2]};
    const [ix,iy]=pos[st.currentPlayer]||pos[0];
    ctx.save(); ctx.fillStyle='rgba(255,215,0,0.2)';
    ctx.beginPath(); ctx.arc(ix,iy,14*sc,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#FFD700'; ctx.beginPath(); ctx.arc(ix,iy,8*sc,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='rgba(255,215,0,0.35)'; ctx.beginPath(); ctx.arc(ix,iy,12*sc,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }

  function drawPortraitTurnIndicator(st, topH, sideW, tableH, bottomH, cx) {
    if (st.phase!=='playerTurn'&&st.phase!=='aiTurn') return;
    const pos={
      0:[cx, H-bottomH-6*sc],
      1:[cx, topH+10*sc],
      2:[sideW+10*sc, topH+tableH/2],
      3:[W-sideW-10*sc, topH+tableH/2]
    };
    const [ix,iy]=pos[st.currentPlayer]||pos[0];
    ctx.save(); ctx.fillStyle='rgba(255,215,0,0.2)';
    ctx.beginPath(); ctx.arc(ix,iy,14*sc,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#FFD700'; ctx.beginPath(); ctx.arc(ix,iy,8*sc,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='rgba(255,215,0,0.35)'; ctx.beginPath(); ctx.arc(ix,iy,12*sc,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }

  // ======================================================================
  //  竖屏 四人对战（参考标准麻将APP）
  // ======================================================================

  // ===== 顶部AI（P1 北家） =====
  function drawPortraitTopAI(topY, zoneH, cx) {
    const st = window.state, p = 1, lp = LAYOUT.PORTRAIT;
    const isActive = st.currentPlayer === p;
    const count = st.hands[p].length;

    const r = lp.AVATAR_R * sc;
    const avX = 12 * sc, avY = topY + zoneH / 2;
    drawCircle(avX, avY, r, C.WIND_COLORS[p], isActive ? C.GOLD : null);
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.floor(r*0.7)}px "Microsoft YaHei",sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('北', avX, avY+1);

    ctx.fillStyle = isActive ? C.GOLD : C.TEXT_DIM;
    ctx.font = `${Math.floor(8*sc)}px "Microsoft YaHei",sans-serif`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(`北AI ${st.scores[p]}`, avX+r+4*sc, avY);

    const tw = lp.AI_TILE_W * sc, th = lp.AI_TILE_H * sc;
    const tileY = avY - th/2;
    const availW = W - avX - 80*sc;
    // 重叠步进，确保所有牌都能显示
    const step = Math.min(tw + 1, availW / count);
    for (let i = 0; i < count; i++) {
      drawTile(W - (count-i)*step, tileY, tw, th, 0, false, false, false);
    }
  }

  // ===== 左右AI（P2西 P3东） =====
  function drawPortraitSideAI(playerIdx, x, topY, sideW, tableH, isRight) {
    const st = window.state, lp = LAYOUT.PORTRAIT;
    const isActive = st.currentPlayer === playerIdx;
    const count = st.hands[playerIdx].length;

    // 头像在上端
    const r = lp.AVATAR_R * sc;
    const avX = x + sideW/2;
    const avY = topY + r + 4*sc;
    drawCircle(avX, avY, r, C.WIND_COLORS[playerIdx], isActive ? C.GOLD : null);
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.floor(r*0.65)}px "Microsoft YaHei",sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(['西','东'][playerIdx-2], avX, avY+1);

    // 名字+分数
    ctx.fillStyle = isActive ? C.GOLD : C.TEXT_DIM;
    ctx.font = `${Math.floor(8*sc)}px "Microsoft YaHei",sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(`${['西AI','东AI'][playerIdx-2]}  ${st.scores[playerIdx]}`, avX, avY + r + 2*sc);

    // 牌背纵向（重叠显示，确保数量对应）
    const tw = lp.AI_TILE_W * sc, th = lp.AI_TILE_H * sc;
    const tileX = avX - tw/2;
    const availV = (topY + tableH) - (avY + r + 18*sc);
    // 重叠步进：让所有牌都能显示出来
    const step = Math.min(th + 1, availV / count);
    const startY = (topY + tableH) - step * count - 4*sc;
    for (let i = 0; i < count; i++) {
      drawTile(tileX, startY + i*step, tw, th, 0, false, false, false);
    }
  }

  // ===== 中央桌面（仿APP布局：转盘+四角弃牌+牌墙） =====
  function drawPortraitTable(topY, tableH, sideW) {
    const st = window.state, lp = LAYOUT.PORTRAIT;
    const cx = W/2, cy = topY + tableH/2;
    const tw = W - sideW*2 - 2*sc, th = tableH*0.92;
    const bw = 3*sc;

    // 桌面
    ctx.save();
    ctx.shadowColor='rgba(0,0,0,0.35)'; ctx.shadowBlur=8; ctx.shadowOffsetY=2;
    drawRoundedRect(cx-tw/2, cy-th/2, tw, th, 8);
    const g=ctx.createRadialGradient(cx,cy,5,cx,cy,tw*0.45);
    g.addColorStop(0,C.TABLE_LIGHT); g.addColorStop(0.5,C.TABLE_PRIMARY); g.addColorStop(1,C.TABLE_EDGE);
    ctx.fillStyle=g; ctx.fill();
    ctx.restore();
    ctx.strokeStyle='rgba(0,0,0,0.15)'; ctx.lineWidth=1.5; drawRoundedRect(cx-tw/2,cy-th/2,tw,th,8); ctx.stroke();

    // ===== 中央转盘指示 =====
    const compassR = 16*sc;
    drawCircle(cx, cy, compassR, C.TABLE_FRAME, 'rgba(212,165,69,0.4)');
    // 风位
    ctx.fillStyle = C.GOLD; ctx.font = `bold ${Math.floor(14*sc)}px "Microsoft YaHei",sans-serif`;
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('南', cx, cy-2*sc);
    ctx.fillStyle='rgba(255,255,255,0.2)'; ctx.font=`${Math.floor(8*sc)}px "Microsoft YaHei",sans-serif`;
    ctx.fillText(st.dealerIdx===0?'庄':'', cx, cy+10*sc);

    // 四角方向标签
    const dirs=[{l:'北',x:cx,y:cy-th/2+12*sc},{l:'南',x:cx,y:cy+th/2-12*sc},{l:'西',x:cx-tw/2+10*sc,y:cy},{l:'东',x:cx+tw/2-10*sc,y:cy}];
    ctx.fillStyle='rgba(255,255,255,0.1)'; ctx.font=`${Math.floor(9*sc)}px "Microsoft YaHei",sans-serif`;
    for(const d of dirs){ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(d.l,d.x,d.y);}

    // ===== 四角弃牌区 =====
    const dtw=lp.DISCARD_W*sc, dth=lp.DISCARD_H*sc;
    const colMap=[3,3,3,3]; // 每个方向最多3列
    const discPos=[
      {cx:cx+tw*0.15, cy:cy-th*0.18}, // 南（底部玩家的弃牌，在桌面下方）
      {cx:cx-tw*0.15, cy:cy-th*0.18}, // 北（对家弃牌，在桌面下方偏左）
      {cx:cx-tw*0.15, cy:cy+th*0.18}, // 西
      {cx:cx+tw*0.15, cy:cy+th*0.18}, // 东
    ];

    for(let p=0;p<4;p++){
      const disc=st.discards[p];
      if(disc.length===0) continue;
      const {cx:dcx,cy:dcy}=discPos[p];
      const cc=colMap[p];
      const rows=Math.ceil(disc.length/cc);
      const zw=cc*(dtw+2), zh=rows*(dth+2);
      const sx=dcx-zw/2, sy=dcy-zh/2;
      for(let i=0;i<disc.length&&i<9;i++){
        const row=Math.floor(i/cc), col=i%cc;
        drawTile(sx+col*(dtw+2), sy+row*(dth+2), dtw, dth, disc[i], true, false, false);
      }
    }

    // ===== 牌墙 =====
    const rem=st.deck.length;
    const barW=Math.min(70*sc,tw*0.3);
    const barH2=7*sc;
    const barX=cx-barW/2;
    const barY=cy+th/2-16*sc;
    ctx.fillStyle='rgba(0,0,0,0.3)'; drawRoundedRect(barX,barY,barW,barH2,barH2/2); ctx.fill();
    const ratio=rem/112;
    ctx.fillStyle=ratio>0.3?'#2E7D32':'#C43B2A';
    drawRoundedRect(barX,barY,barW*ratio,barH2,barH2/2); ctx.fill();
    ctx.fillStyle=C.TEXT_DIM; ctx.font=`${Math.floor(8*sc)}px "Microsoft YaHei",sans-serif`;
    ctx.textAlign='center'; ctx.textBaseline='top'; ctx.fillText(`余${rem}`,cx,barY+barH2+2*sc);
    if(rem<=10){
      ctx.fillStyle=C.RED_BRIGHT; ctx.font=`bold ${Math.floor(9*sc)}px "Microsoft YaHei",sans-serif`;
      ctx.fillText('⚠',cx-barW/2-8*sc,barY);
    }
  }

  // ===== 底部玩家（P0 南家） =====
  function drawPortraitBottom(bottomH, tableBottomY) {
    const st = window.state, hand = st.hands[0], cx = W/2, lp = LAYOUT.PORTRAIT;
    st.hands[0]=sortHand(st.hands[0]); if(st.selectedIdx>=hand.length)st.selectedIdx=-1;

    const areaTop=H-bottomH;
    const padX=2*sc;

    // 手牌计算
    const mTw=lp.TILE_W*sc, mTh=lp.TILE_H*sc;
    const availW=W-padX*2;
    const minVW=24*sc;
    const noOver=mTw*hand.length+(hand.length-1)*2;
    let tileW,tileH,pitch;
    if(noOver<=availW){tileW=mTw;tileH=mTh;pitch=(availW-tileW)/Math.max(hand.length-1,1);}
    else{const tp=(availW-mTw)/Math.max(hand.length-1,1);pitch=Math.max(tp,minVW);tileW=Math.min(mTw,pitch+mTw*lp.OVERLAP);tileH=tileW*(mTh/mTw);}
    th2=tileH;
    const totalW=(hand.length-1)*pitch+tileW, hsx=padX+(availW-totalW)/2;
    const handY = areaTop + 4*sc + mTh*0.5;

    // 玩家信息行（底部分数栏风格）
    const barH=36*sc;
    const r=10*sc;
    const avX=12*sc, avY=areaTop+barH/2;
    drawCircle(avX,avY,r,C.WIND_COLORS[0],st.currentPlayer===0?C.GOLD:null);
    ctx.fillStyle='#fff'; ctx.font=`bold ${Math.floor(r*0.7)}px "Microsoft YaHei",sans-serif`;
    ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('你',avX,avY+1);

    // 名字+分数（参照APP风格：名字大字+分数小字）
    ctx.fillStyle=C.TEXT; ctx.font=`bold ${Math.floor(11*sc)}px "Microsoft YaHei",sans-serif`;
    ctx.textAlign='left'; ctx.textBaseline='middle';
    ctx.fillText('你(南)', avX+r+5*sc, avY-6*sc);

    ctx.fillStyle=C.TEXT_DIM; ctx.font=`${Math.floor(9*sc)}px "Microsoft YaHei",sans-serif`;
    ctx.textAlign='left'; ctx.textBaseline='middle';
    ctx.fillText(`${st.scores[0]}分`, avX+r+5*sc, avY+7*sc);

    // 副露（在玩家信息和手牌之间，右上区域）
    const melds=st.melds[0];
    let meldX=W-10*sc;
    const mw=lp.MELD_W*sc, mh=lp.MELD_H*sc;
    for(const meld of melds){
      const tc=meld.type==='gang'?4:3;
      meldX-=tc*(mw+1)+3*sc;
      for(let i=0;i<tc;i++){
        drawTile(meldX+i*(mw+1), areaTop+4*sc, mw, mh, meld.tiles[i], true, false, false);
      }
    }

    // 手牌（单循环绘制+记录位置）
    st._playerTilePositions=[]; const newTileIdx=hand.length-1;
    for(let i=0;i<hand.length;i++){
      const x=hsx+i*pitch;
      const isNew=(st.turnPhase==='draw'||st.turnPhase==='discard')&&i===newTileIdx;
      const sel=st.selectedIdx===i;
      const yOff=sel?14*sc:(isNew?8*sc:0);
      drawTile(x, handY-yOff, tileW, tileH, hand[i], true, sel, isNew&&!sel);
      st._playerTilePositions.push({x,y:handY-yOff,w:tileW,h:tileH,idx:i});
    }

    // 提示
    if(st.turnPhase==='discard'&&st.phase==='playerTurn'){
      ctx.fillStyle='rgba(255,215,0,0.4)'; ctx.font=`${Math.floor(9*sc)}px "Microsoft YaHei",sans-serif`;
      ctx.textAlign='center'; ctx.textBaseline='top'; ctx.fillText('点牌→选中→再点打出',cx,handY+tileH+2*sc);
    }
  }

  // ======================================================================
  //  公共 API
  // ======================================================================

  return { canvas, ctx, resize, render, getCanvas, getCtx };
})();
