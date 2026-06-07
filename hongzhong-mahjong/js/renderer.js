/**
 * 红中麻将 — 渲染模块（纯竖屏移动端版）
 * 只保留竖屏布局，去掉所有横屏代码，确保手机端稳定
 */
window.Renderer = (function() {
  const { SUIT_COLORS, HONGZHONG_ID, C, LAYOUT } = window.Constants;
  const { isHongzhong, tileSuit, tileNumber, tileName, sortHand } = window.Tiles;
  const { CN_NUMS } = window.Constants;

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  let W, H, sc;

  // ======================================================================
  //  尺寸调整
  // ======================================================================

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W;
    canvas.height = H;
    sc = Math.min(W / 375, 1.3);
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
  //  牌面绘制（纯Canvas手绘）
  // ======================================================================

  function drawTile(x, y, w, h, tileId, faceUp, selected, isNew) {
    var r = Math.min(w, h) * 0.08;
    var drawY = y;
    if (selected) drawY -= 12 * sc;
    if (isNew) drawY -= 8 * sc;

    ctx.save();
    if (selected) {
      ctx.shadowColor = 'rgba(212,165,69,0.6)';
      ctx.shadowBlur = 16;
    } else if (isNew) {
      ctx.shadowColor = 'rgba(255,255,200,0.3)';
      ctx.shadowBlur = 8;
    }

    // ——— 牌背 ———
    if (!faceUp) {
      drawRoundedRect(x, drawY, w, h, r);
      var grad = ctx.createLinearGradient(x, drawY, x, drawY + h);
      grad.addColorStop(0, C.TILE_BACK_LIGHT);
      grad.addColorStop(0.3, C.TILE_BACK);
      grad.addColorStop(1, '#0F1F30');
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = '#0D1A2A';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
      return;
    }

    // ——— 牌面 ———
    drawRoundedRect(x, drawY, w, h, r);
    var inset = 3;
    var faceGrad = ctx.createLinearGradient(x, drawY, x, drawY + h);
    faceGrad.addColorStop(0, '#FFFDF5');
    faceGrad.addColorStop(0.7, '#F5EDD8');
    faceGrad.addColorStop(1, '#E8DDC0');
    ctx.fillStyle = faceGrad;
    ctx.fill();
    ctx.strokeStyle = '#C8B890';
    ctx.lineWidth = 0.7;
    ctx.stroke();
    ctx.restore();

    var cx = x + w / 2;
    var cy = drawY + h / 2;

    if (isHongzhong(tileId)) {
      ctx.strokeStyle = 'rgba(200,50,30,0.5)';
      ctx.lineWidth = w * 0.04;
      drawRoundedRect(x + inset + 2, drawY + inset + 2, w - inset*2 - 4, h - inset*2 - 4, r*0.5);
      ctx.stroke();
      ctx.fillStyle = '#C43B2A';
      ctx.font = 'bold ' + Math.floor(h*0.5) + 'px "KaiTi","Microsoft YaHei",serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('中', cx, drawY + h*0.46);
    } else {
      var suit = tileSuit(tileId), num = tileNumber(tileId), color = SUIT_COLORS[suit];
      var cs = Math.floor(h*0.18);
      ctx.fillStyle = color; ctx.font = 'bold ' + cs + 'px "Microsoft YaHei",sans-serif';
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText('' + num, x+inset+4, drawY+inset+2);
      ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
      ctx.fillText('' + num, x+w-inset-4, drawY+h-inset-2);
      var c2 = Math.floor(h*0.32);
      if (suit === 'wan') {
        ctx.fillStyle = color; ctx.font = 'bold ' + c2 + 'px "KaiTi","Microsoft YaHei",serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(CN_NUMS[num-1], cx, cy);
      } else if (suit === 'tiao') {
        var dR = Math.min(w,h)*0.04;
        var cc = num<=3?1:(num<=6?2:3), rr = Math.ceil(num/cc);
        var cw2 = w*0.55/cc, ch2 = h*0.55/rr;
        var gsx = cx-(cw2*(cc-1))/2, gsy = cy-(ch2*(rr-1))/2;
        for (var ti=0; ti<num; ti++) {
          var dx=gsx+(ti%cc)*cw2+cw2/2, dy=gsy+Math.floor(ti/cc)*ch2+ch2/2;
          ctx.strokeStyle='#1A6A2A'; ctx.lineWidth=Math.max(dR,1.2);
          ctx.beginPath(); ctx.moveTo(dx,dy-ch2*0.35); ctx.lineTo(dx,dy+ch2*0.35); ctx.stroke();
          ctx.lineWidth=Math.max(dR*1.5,1.8); ctx.beginPath(); ctx.moveTo(dx-dR*1.2,dy); ctx.lineTo(dx+dR*1.2,dy); ctx.stroke();
          ctx.fillStyle='#1A6A2A'; ctx.beginPath(); ctx.arc(dx,dy-ch2*0.35,dR*1.2,0,Math.PI*2); ctx.fill();
        }
      } else if (suit === 'tong') {
        var dots = window.Constants.TONG_DOTS[num];
        var dotR = Math.min(w,h)*0.07, unit = Math.min(w,h)*0.12;
        for (var di=0; di<dots.length; di++) {
          var dr = dots[di][0], dc = dots[di][1];
          var dotX = cx + dc*unit, dotY = cy + dr*unit;
          ctx.strokeStyle='#8A2A1A'; ctx.lineWidth=Math.max(dotR*0.3,1);
          ctx.beginPath(); ctx.arc(dotX, dotY, dotR, 0, Math.PI*2); ctx.stroke();
          ctx.fillStyle='#8A2A1A'; ctx.beginPath(); ctx.arc(dotX, dotY, dotR*0.45, 0, Math.PI*2); ctx.fill();
        }
      }
    }
  }

  // ======================================================================
  //  主渲染
  // ======================================================================

  function render() {
    var st = window.state;
    ctx.fillStyle = C.BG;
    ctx.fillRect(0, 0, W, H);

    var lp = LAYOUT.PORTRAIT;
    var cx = W / 2;
    var topH = H * lp.TOP_H;
    var sideW = W * lp.SIDE_W;
    var bottomH = H * 0.22;
    var tableH = H - topH - bottomH - 6 * sc;

    drawTopAI(st, topH, cx);
    drawSideAI(st, 2, 0, topH, sideW, tableH, false);
    drawSideAI(st, 3, W - sideW, topH, sideW, tableH, true);
    drawTable(st, topH, tableH, sideW);
    drawBottom(st, bottomH);
    drawTurnIndicator(st, topH, sideW, tableH, bottomH, cx);
  }

  // ===== 顶部AI =====
  function drawTopAI(st, zoneH, cx) {
    var p = 1, lp = LAYOUT.PORTRAIT;
    var isActive = st.currentPlayer === p;
    var count = st.hands[p].length;

    var r = lp.AVATAR_R * sc;
    var avX = 12 * sc, avY = zoneH / 2;
    drawCircle(avX, avY, r, C.WIND_COLORS[p], isActive ? C.GOLD : null);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold ' + Math.floor(r*0.7) + 'px "Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('北', avX, avY+1);
    ctx.fillStyle = isActive ? C.GOLD : C.TEXT_DIM;
    ctx.font = Math.floor(8*sc) + 'px "Microsoft YaHei",sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('北AI ' + st.scores[p], avX+r+4*sc, avY);

    var tw = lp.AI_TILE_W * sc, th = lp.AI_TILE_H * sc;
    var tileY = avY - th/2;
    var availW = W - avX - 80*sc;
    var step = Math.min(tw + 1, availW / Math.max(count, 1));
    for (var i = 0; i < count; i++) {
      drawTile(W - (count-i)*step, tileY, tw, th, 0, false, false, false);
    }
  }

  // ===== 左右AI =====
  function drawSideAI(st, playerIdx, x, topY, sideW, tableH, isRight) {
    var lp = LAYOUT.PORTRAIT;
    var isActive = st.currentPlayer === playerIdx;
    var count = st.hands[playerIdx].length;

    var r = lp.AVATAR_R * sc;
    var avX = x + sideW/2;
    var avY = topY + r + 4*sc;
    drawCircle(avX, avY, r, C.WIND_COLORS[playerIdx], isActive ? C.GOLD : null);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold ' + Math.floor(r*0.65) + 'px "Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(['西','东'][playerIdx-2], avX, avY+1);
    ctx.fillStyle = isActive ? C.GOLD : C.TEXT_DIM;
    ctx.font = Math.floor(8*sc) + 'px "Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(['西AI','东AI'][playerIdx-2] + ' ' + st.scores[playerIdx], avX, avY + r + 2*sc);

    var tw = lp.AI_TILE_W * sc, th = lp.AI_TILE_H * sc;
    var tileX = avX - tw/2;
    var availV = (topY + tableH) - (avY + r + 18*sc);
    var step = Math.min(th + 1, availV / Math.max(count, 1));
    var startY = (topY + tableH) - step * count - 4*sc;
    for (var i = 0; i < count; i++) {
      drawTile(tileX, startY + i*step, tw, th, 0, false, false, false);
    }
  }

  // ===== 中央桌面 =====
  function drawTable(st, topY, tableH, sideW) {
    var lp = LAYOUT.PORTRAIT;
    var cx = W/2, cy = topY + tableH/2;
    var tw = W - sideW*2 - 2*sc, th = tableH*0.92;

    ctx.save();
    ctx.shadowColor='rgba(0,0,0,0.35)'; ctx.shadowBlur=8; ctx.shadowOffsetY=2;
    drawRoundedRect(cx-tw/2, cy-th/2, tw, th, 8);
    var g=ctx.createRadialGradient(cx,cy,5,cx,cy,tw*0.45);
    g.addColorStop(0,C.TABLE_LIGHT); g.addColorStop(0.5,C.TABLE_PRIMARY); g.addColorStop(1,C.TABLE_EDGE);
    ctx.fillStyle=g; ctx.fill();
    ctx.restore();
    ctx.strokeStyle='rgba(0,0,0,0.15)'; ctx.lineWidth=1.5; drawRoundedRect(cx-tw/2,cy-th/2,tw,th,8); ctx.stroke();

    // 转盘
    var compassR = 16*sc;
    drawCircle(cx, cy, compassR, C.TABLE_FRAME, 'rgba(212,165,69,0.4)');
    ctx.fillStyle = C.GOLD; ctx.font = 'bold ' + Math.floor(14*sc) + 'px "Microsoft YaHei",sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('南', cx, cy-2*sc);
    ctx.fillStyle='rgba(255,255,255,0.2)'; ctx.font=Math.floor(8*sc)+'px "Microsoft YaHei",sans-serif';
    ctx.fillText(st.dealerIdx===0?'庄':'', cx, cy+10*sc);

    // 方向标签
    var dirs=[{l:'北',x:cx,y:cy-th/2+12*sc},{l:'南',x:cx,y:cy+th/2-12*sc},{l:'西',x:cx-tw/2+10*sc,y:cy},{l:'东',x:cx+tw/2-10*sc,y:cy}];
    ctx.fillStyle='rgba(255,255,255,0.1)'; ctx.font=Math.floor(9*sc)+'px "Microsoft YaHei",sans-serif';
    for(var di=0;di<dirs.length;di++){ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(dirs[di].l,dirs[di].x,dirs[di].y);}

    // 弃牌区
    var dtw=lp.DISCARD_W*sc, dth=lp.DISCARD_H*sc;
    var discPos=[
      {x:cx+tw*0.15, y:cy-th*0.18},
      {x:cx-tw*0.15, y:cy-th*0.18},
      {x:cx-tw*0.15, y:cy+th*0.18},
      {x:cx+tw*0.15, y:cy+th*0.18},
    ];
    for(var p=0;p<4;p++){
      var disc=st.discards[p];
      if(disc.length===0) continue;
      var dcx=discPos[p].x, dcy=discPos[p].y;
      var cc=3, rows=Math.ceil(disc.length/cc);
      var zw=cc*(dtw+2), zh=rows*(dth+2);
      var sx=dcx-zw/2, sy=dcy-zh/2;
      for(var i=0;i<disc.length&&i<9;i++){
        var row=Math.floor(i/cc), col=i%cc;
        drawTile(sx+col*(dtw+2), sy+row*(dth+2), dtw, dth, disc[i], true, false, false);
      }
    }

    // 牌墙
    var rem=st.deck.length;
    var barW=Math.min(70*sc,tw*0.3);
    var barH2=7*sc;
    var barX=cx-barW/2;
    var barY=cy+th/2-16*sc;
    ctx.fillStyle='rgba(0,0,0,0.3)'; drawRoundedRect(barX,barY,barW,barH2,barH2/2); ctx.fill();
    var ratio=rem/112;
    ctx.fillStyle=ratio>0.3?'#2E7D32':'#C43B2A';
    drawRoundedRect(barX,barY,barW*ratio,barH2,barH2/2); ctx.fill();
    ctx.fillStyle=C.TEXT_DIM; ctx.font=Math.floor(8*sc)+'px "Microsoft YaHei",sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='top'; ctx.fillText('余'+rem,cx,barY+barH2+2*sc);
  }

  // ===== 底部玩家 =====
  function drawBottom(st, bottomH) {
    var hand = st.hands[0], cx = W/2, lp = LAYOUT.PORTRAIT;
    st.hands[0] = sortHand(st.hands[0]);
    if (st.selectedIdx >= hand.length) st.selectedIdx = -1;

    var areaTop = H - bottomH;
    var padX = 2*sc;
    var mTw = lp.TILE_W*sc, mTh = lp.TILE_H*sc;
    var availW = W - padX*2;
    var minVW = 24*sc;
    var noOver = mTw*hand.length + (hand.length-1)*2;
    var tileW, tileH, pitch;
    if (noOver <= availW) {
      tileW = mTw; tileH = mTh;
      pitch = (availW - tileW) / Math.max(hand.length-1, 1);
    } else {
      var tp = (availW - mTw) / Math.max(hand.length-1, 1);
      pitch = Math.max(tp, minVW);
      tileW = Math.min(mTw, pitch + mTw*lp.OVERLAP);
      tileH = tileW * (mTh/mTw);
    }
    var totalW = (hand.length-1)*pitch + tileW;
    var hsx = padX + (availW - totalW)/2;
    var handY = areaTop + 4*sc + mTh*0.5;

    // 玩家信息
    var barH = 36*sc, r = 10*sc;
    var avX = 12*sc, avY = areaTop + barH/2;
    drawCircle(avX, avY, r, C.WIND_COLORS[0], st.currentPlayer===0 ? C.GOLD : null);
    ctx.fillStyle='#fff'; ctx.font='bold '+Math.floor(r*0.7)+'px "Microsoft YaHei",sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('你',avX,avY+1);
    ctx.fillStyle=C.TEXT; ctx.font='bold '+Math.floor(11*sc)+'px "Microsoft YaHei",sans-serif';
    ctx.textAlign='left'; ctx.textBaseline='middle';
    ctx.fillText('你(南)', avX+r+5*sc, avY-6*sc);
    ctx.fillStyle=C.TEXT_DIM; ctx.font=Math.floor(9*sc)+'px "Microsoft YaHei",sans-serif';
    ctx.fillText(st.scores[0]+'分', avX+r+5*sc, avY+7*sc);

    // 副露
    var melds = st.melds[0];
    var meldX = W - 10*sc;
    var mw = lp.MELD_W*sc, mh = lp.MELD_H*sc;
    for (var mi = 0; mi < melds.length; mi++) {
      var meld = melds[mi];
      var tc = meld.type==='gang' ? 4 : 3;
      meldX -= tc*(mw+1) + 3*sc;
      for (var ti = 0; ti < tc; ti++) {
        drawTile(meldX + ti*(mw+1), areaTop+4*sc, mw, mh, meld.tiles[ti], true, false, false);
      }
    }

    // 手牌
    st._playerTilePositions = [];
    var newTileIdx = hand.length - 1;
    for (var i = 0; i < hand.length; i++) {
      var x = hsx + i*pitch;
      var isNew = (st.turnPhase==='draw' || st.turnPhase==='discard') && i===newTileIdx;
      var sel = st.selectedIdx === i;
      var yOff = sel ? 14*sc : (isNew ? 8*sc : 0);
      drawTile(x, handY - yOff, tileW, tileH, hand[i], true, sel, isNew && !sel);
      st._playerTilePositions.push({x: x, y: handY - yOff, w: tileW, h: tileH, idx: i});
    }

    // 提示
    if (st.turnPhase === 'discard' && st.phase === 'playerTurn') {
      ctx.fillStyle='rgba(255,215,0,0.4)'; ctx.font=Math.floor(9*sc)+'px "Microsoft YaHei",sans-serif';
      ctx.textAlign='center'; ctx.textBaseline='top';
      ctx.fillText('点牌→选中→再点打出', cx, handY + tileH + 2*sc);
    }
  }

  // ===== 回合指示 =====
  function drawTurnIndicator(st, topH, sideW, tableH, bottomH, cx) {
    if (st.phase !== 'playerTurn' && st.phase !== 'aiTurn') return;
    var pos = {
      0: [cx, H - bottomH - 6*sc],
      1: [cx, topH + 10*sc],
      2: [sideW + 10*sc, topH + tableH/2],
      3: [W - sideW - 10*sc, topH + tableH/2]
    };
    var p = pos[st.currentPlayer] || pos[0];
    ctx.save();
    ctx.fillStyle='rgba(255,215,0,0.2)';
    ctx.beginPath(); ctx.arc(p[0], p[1], 14*sc, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle='#FFD700';
    ctx.beginPath(); ctx.arc(p[0], p[1], 8*sc, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle='rgba(255,215,0,0.35)';
    ctx.beginPath(); ctx.arc(p[0], p[1], 12*sc, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }

  // ======================================================================
  //  公共 API
  // ======================================================================

  return { canvas: canvas, ctx: ctx, resize: resize, render: render };
})();
