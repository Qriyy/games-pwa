/**
 * 红中麻将 — Canvas 渲染器（重写版）
 * - 竖屏优先布局（手机竖屏最优）
 * - DPI 自适应（devicePixelRatio）
 * - 暗色主题，雀魂风格配色
 * - 牌面：万蓝 / 条绿 / 筒红 / 红中大红字
 * - 四家：北(上) 西(左) 东(右) 南(下=玩家)
 * - 操作按钮由 HTML 渲染，canvas 不画按钮
 */
window.Renderer = (function () {
  'use strict';

  var C       = window.Constants.C;
  var LAYOUT  = window.Constants.LAYOUT;
  var SUIT_COLORS = window.Constants.SUIT_COLORS;
  var CN_NUMS = window.Constants.CN_NUMS;
  var TONG_DOTS   = window.Constants.TONG_DOTS;
  var Tiles   = window.Tiles;

  /* ================================================================
   *  Canvas & DPI
   * ================================================================ */
  var canvas = document.getElementById('gameCanvas');
  var ctx    = canvas.getContext('2d');
  var W, H, dpr;

  function resize () {
    dpr = window.devicePixelRatio || 1;
    W   = window.innerWidth;
    H   = window.innerHeight;
    canvas.width       = W * dpr;
    canvas.height      = H * dpr;
    canvas.style.width  = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    _layoutDirty = true;
    render();
  }
  window.addEventListener('resize', resize);

  /* ================================================================
   *  绘图工具
   * ================================================================ */
  function rr (x, y, w, h, r) {
    if (w <= 0 || h <= 0) return;
    r = Math.max(0, Math.min(r || 0, w / 2, h / 2));
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

  function fillRR (x, y, w, h, r, fill, stroke, lw) {
    rr(x, y, w, h, r);
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lw || 1;
      ctx.stroke();
    }
  }

  function circle (cx, cy, r, fill, stroke) {
    if (r <= 0) return;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  function text (str, x, y, align, baseline, font, color) {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    ctx.fillText(str, x, y);
  }

  /* ================================================================
   *  牌面绘制
   * ================================================================ */
  function drawTile (x, y, w, h, id, faceUp, selected, isNew) {
    if (w <= 0 || h <= 0) return;
    var r = Math.max(0, Math.min(w, h) * 0.08);
    var dy = y;
    if (selected) dy -= Math.max(4, h * 0.14);
    else if (isNew) dy -= Math.max(2, h * 0.07);

    ctx.save();
    if (selected) { ctx.shadowColor = 'rgba(255,215,0,0.6)'; ctx.shadowBlur = 14; }
    else if (isNew) { ctx.shadowColor = 'rgba(255,255,200,0.25)'; ctx.shadowBlur = 6; }

    /* ---- 牌背 ---- */
    if (!faceUp) {
      rr(x, dy, w, h, r);
      var bg = ctx.createLinearGradient(x, dy, x, dy + h);
      bg.addColorStop(0, '#2A5A7C'); bg.addColorStop(0.5, '#1A3A5C'); bg.addColorStop(1, '#0F1F30');
      ctx.fillStyle = bg; ctx.fill();
      ctx.strokeStyle = '#0D1A2A'; ctx.lineWidth = 0.8; ctx.stroke();
      ctx.restore(); return;
    }

    /* ---- 牌面底色 ---- */
    rr(x, dy, w, h, r);
    var fg = ctx.createLinearGradient(x, dy, x, dy + h);
    fg.addColorStop(0, '#FFFDF5'); fg.addColorStop(0.7, '#F5EDD8'); fg.addColorStop(1, '#E8DDC0');
    ctx.fillStyle = fg; ctx.fill();
    ctx.strokeStyle = '#C8B890'; ctx.lineWidth = 0.6; ctx.stroke();
    ctx.restore();

    if (!id) return;

    var cx = x + w / 2;
    var cy = dy + h / 2;

    /* ---- 红中：大红字 ---- */
    if (Tiles.isHongzhong(id)) {
      var zhFontSize = Math.max(10, Math.floor(h * 0.5));
      text('中', cx, cy + 1, 'center', 'middle',
           'bold ' + zhFontSize + 'px "KaiTi","STKaiti","SimSun",serif', '#C43B2A');
      return;
    }

    var suit = Tiles.tileSuit(id);
    var num  = Tiles.tileNumber(id);
    var color = SUIT_COLORS[suit] || '#333';

    /* ---- 角标数字 ---- */
    var fs1 = Math.max(6, Math.floor(h * 0.16));
    text('' + num, x + w * 0.12, dy + h * 0.06, 'left', 'top',
         'bold ' + fs1 + 'px "Microsoft YaHei",sans-serif', color);
    text('' + num, x + w * 0.88, dy + h * 0.94, 'right', 'bottom',
         'bold ' + fs1 + 'px "Microsoft YaHei",sans-serif', color);

    /* ---- 中心图案 ---- */
    var fs2 = Math.max(10, Math.floor(h * 0.32));

    if (suit === 'wan') {
      text(CN_NUMS[num - 1] || '' + num, cx, cy, 'center', 'middle',
           'bold ' + fs2 + 'px "KaiTi","STKaiti","Microsoft YaHei",serif', color);

    } else if (suit === 'tiao') {
      /* 条子 — 用小圆和短线组合 */
      var dr = Math.max(1.2, Math.min(w, h) * 0.04);
      var cols = num <= 3 ? 1 : (num <= 6 ? 2 : 3);
      var rows = Math.ceil(num / cols);
      var cw = w * 0.48 / cols;
      var ch = h * 0.48 / rows;
      var sx = cx - cw * (cols - 1) / 2;
      var sy = cy - ch * (rows - 1) / 2;
      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      for (var i = 0; i < num; i++) {
        var px = sx + (i % cols) * cw;
        var py = sy + Math.floor(i / cols) * ch;
        ctx.lineWidth = dr * 1.3;
        ctx.beginPath(); ctx.moveTo(px, py - ch * 0.32); ctx.lineTo(px, py + ch * 0.32); ctx.stroke();
        ctx.lineWidth = dr * 2;
        ctx.beginPath(); ctx.moveTo(px - dr * 1.2, py); ctx.lineTo(px + dr * 1.2, py); ctx.stroke();
        ctx.beginPath(); ctx.arc(px, py - ch * 0.32, dr, 0, Math.PI * 2); ctx.fill();
      }

    } else if (suit === 'tong') {
      /* 筒子 — 圆环+实心点 */
      var dots  = TONG_DOTS[num];
      var dotR  = Math.max(1.8, Math.min(w, h) * 0.06);
      var unit  = Math.min(w, h) * 0.11;
      if (dots) {
        ctx.strokeStyle = color;
        ctx.fillStyle   = color;
        for (var d = 0; d < dots.length; d++) {
          var dx = cx + dots[d][1] * unit;
          var ddy = cy + dots[d][0] * unit;
          ctx.lineWidth = Math.max(0.6, dotR * 0.3);
          ctx.beginPath(); ctx.arc(dx, ddy, dotR, 0, Math.PI * 2); ctx.stroke();
          ctx.beginPath(); ctx.arc(dx, ddy, dotR * 0.4, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
  }

  /* ================================================================
   *  牌面尺寸（静态参照，按手机竖屏 375×750 标定）
   * ================================================================ */
  var TW_PLAYER = 43;   // 玩家手牌宽
  var TH_PLAYER = 57;   // 玩家手牌高
  var TW_AI_TOP = 18;   // 北家牌背宽
  var TH_AI_TOP = 25;   // 北家牌背高
  var TW_AI_SIDE = 14;  // 左右家牌背宽
  var TH_AI_SIDE = 20;  // 左右家牌背高
  var TW_DISC   = 20;   // 弃牌宽
  var TH_DISC   = 27;   // 弃牌高
  var TW_MELD   = 28;   // 副露牌宽
  var TH_MELD   = 37;   // 副露牌高

  /* ================================================================
   *  布局缓存
   * ================================================================ */
  var L = {};            // 布局坐标缓存
  var _layoutDirty = true;

  function _calcLayout () {
    var isPortrait = H > W;

    /* 按钮区域：取 #ui-overlay 元素的实际高度，默认 62px */
    var btnEl = document.getElementById('ui-overlay');
    var btnH = btnEl ? (btnEl.offsetHeight || 62) : 62;

    if (isPortrait) {
      /* ---- 竖屏布局 ---- */
      var topH  = Math.round(H * 0.085);
      var sideW = Math.round(W * 0.12);
      var playerH = Math.round(H * 0.32);
      var tableTop = topH;
      var tableBot = H - btnH - playerH;
      var tableH = Math.max(60, tableBot - tableTop);
      var tableL = sideW;
      var tableR = W - sideW;
      var tableW = tableR - tableL;
      var cx = W / 2;

      L.isPortrait = true;

      /* 桌面 */
      L.table = { l: tableL, t: tableTop, r: tableR, b: tableTop + tableH, cx: cx, cy: tableTop + tableH / 2 };

      /* 北家（上） */
      L.top = { cx: cx, cy: topH / 2 + 4, tw: TW_AI_TOP, th: TH_AI_TOP };

      /* 西家（左） */
      L.left = { cx: sideW / 2, cy: tableTop + tableH * 0.35, tw: TW_AI_SIDE, th: TH_AI_SIDE };

      /* 东家（右） */
      L.right = { cx: W - sideW / 2, cy: tableTop + tableH * 0.35, tw: TW_AI_SIDE, th: TH_AI_SIDE };

      /* 弃牌区 */
      var dW = TW_DISC, dH = TH_DISC, dGap = 1.5;
      var dPitchX = dW + dGap, dPitchY = dH + dGap;
      var dCols = Math.max(4, Math.floor(tableW * 0.85 / dPitchX));

      var bDiscH = 2 * dPitchY;
      L.discard = {
        0: { x: tableL + tableW * 0.08, y: tableTop + tableH - dPitchY - 4, cols: dCols, tw: dW, th: dH },
        1: { x: tableL + tableW * 0.08, y: tableTop + 4,                    cols: dCols, tw: dW, th: dH },
        2: { x: sideW + 2, y: tableTop + tableH * 0.38,  cols: dCols, tw: dW, th: dH },
        3: { x: W - sideW - dW - 2, y: tableTop + tableH * 0.38, cols: dCols, tw: dW, th: dH }
      };

      /* 玩家区 */
      L.playerBar = { y: H - btnH - playerH, h: 20 };
      L.playerHand = { y: H - btnH - playerH + 22, baseW: TW_PLAYER, baseH: TH_PLAYER };

    } else {
      /* ---- 横屏布局 ---- */
      var topH2  = Math.round(H * 0.10);
      var sideW2 = Math.round(W * 0.12);
      var bottomH2 = Math.round(H * 0.30);
      var tableTop2 = topH2;
      var tableBot2 = H - bottomH2;
      var tableH2 = Math.max(60, tableBot2 - tableTop2);
      var tableL2 = sideW2;
      var tableR2 = W - sideW2;
      var tableW2 = tableR2 - tableL2;
      var cx2 = W / 2;

      L.isPortrait = false;

      L.table = { l: tableL2, t: tableTop2, r: tableR2, b: tableTop2 + tableH2, cx: cx2, cy: tableTop2 + tableH2 / 2 };

      L.top = { cx: cx2, cy: topH2 / 2 + 4, tw: TW_AI_TOP, th: TH_AI_TOP };
      L.left = { cx: sideW2 / 2, cy: tableTop2 + tableH2 * 0.35, tw: TW_AI_SIDE, th: TH_AI_SIDE };
      L.right = { cx: W - sideW2 / 2, cy: tableTop2 + tableH2 * 0.35, tw: TW_AI_SIDE, th: TH_AI_SIDE };

      var dW2 = TW_DISC, dH2 = TH_DISC, dG2 = 1.5;
      var dPX2 = dW2 + dG2, dPY2 = dH2 + dG2;
      var dCols2 = Math.max(4, Math.floor(tableW2 * 0.85 / dPX2));

      L.discard = {
        0: { x: tableL2 + tableW2 * 0.08, y: tableTop2 + tableH2 - dPY2 - 4, cols: dCols2, tw: dW2, th: dH2 },
        1: { x: tableL2 + tableW2 * 0.08, y: tableTop2 + 4,                     cols: dCols2, tw: dW2, th: dH2 },
        2: { x: sideW2 + 2, y: tableTop2 + tableH2 * 0.38,   cols: dCols2, tw: dW2, th: dH2 },
        3: { x: W - sideW2 - dW2 - 2, y: tableTop2 + tableH2 * 0.38, cols: dCols2, tw: dW2, th: dH2 }
      };

      L.playerBar = { y: H - bottomH2, h: 20 };
      L.playerHand = { y: H - bottomH2 + 22, baseW: TW_PLAYER, baseH: TH_PLAYER };
    }
  }

  /* ================================================================
   *  绘制辅助：风圈头像
   * ================================================================ */
  function drawWindCircle (cx, cy, r, label, pid, st) {
    var active = st.currentPlayer === pid;
    circle(cx, cy, r, C.WIND_COLORS[pid], active ? C.GOLD_BRIGHT : null);
    text(label, cx, cy + 1, 'center', 'middle',
         'bold ' + Math.max(7, Math.round(r * 0.72)) + 'px "Microsoft YaHei"', '#fff');
  }

  function drawScore (x, y, pid, st, align, fontSz) {
    var active = st.currentPlayer === pid;
    text((st.scores[pid] || 0) + '', x, y, align, 'middle',
         (fontSz || 10) + 'px "Microsoft YaHei"', active ? C.GOLD : C.TEXT_DIM);
  }

  /* ================================================================
   *  绘制辅助：副露
   * ================================================================ */
  function drawMelds (melds, x, y, isHorizontal, faceUpOverride) {
    if (!melds || melds.length === 0) return;
    var mw = TW_MELD, mh = TH_MELD, gap = 2;
    var offset = 0;
    for (var m = 0; m < melds.length; m++) {
      var meld = melds[m];
      var tc = meld.type === 'gang' ? 4 : 3;
      for (var i = 0; i < tc; i++) {
        var tx, ty;
        var faceUp = (typeof faceUpOverride === 'boolean')
          ? faceUpOverride
          : !(meld.type === 'angang');
        if (isHorizontal) {
          tx = x + offset + i * (mw + gap);
          ty = y;
        } else {
          tx = x;
          ty = y + offset + i * (mh + gap);
        }
        drawTile(tx, ty, mw, mh, meld.tiles[i], faceUp, false, false);
      }
      offset += tc * ((isHorizontal ? mw : mh) + gap) + 4;
    }
  }

  /* ================================================================
   *  主渲染入口
   * ================================================================ */
  function render () {
    var st = window.state;
    if (!st || !st.hands) return;
    try { _renderCore(st); } catch (e) { console.error('render:', e); }
  }

  function _renderCore (st) {
    /* 重算布局 */
    if (_layoutDirty) { _calcLayout(); _layoutDirty = false; }

    var T = L.table;

    /* ---- 背景 ---- */
    ctx.fillStyle = C.BG;
    ctx.fillRect(0, 0, W, H);

    /* ---- 桌面 ---- */
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 8;
    rr(T.l, T.t, T.r - T.l, T.b - T.t, 6);
    var g = ctx.createRadialGradient(T.cx, T.cy, 4, T.cx, T.cy, (T.r - T.l) * 0.52);
    g.addColorStop(0, C.TABLE_LIGHT);
    g.addColorStop(0.5, C.TABLE_PRIMARY);
    g.addColorStop(1, C.TABLE_EDGE);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 1;
    rr(T.l, T.t, T.r - T.l, T.b - T.t, 6);
    ctx.stroke();

    /* ---- 桌面中心标记 ---- */
    circle(T.cx, T.cy, 10, C.TABLE_FRAME, 'rgba(212,165,69,0.3)');
    text('南', T.cx, T.cy + 1, 'center', 'middle', 'bold 9px "Microsoft YaHei"', C.GOLD);

    /* ---- 牌墙余数 ---- */
    var rem = st.deck ? st.deck.length : 0;
    var bw = 56, bh = 5;
    var bx = T.cx - bw / 2;
    var by = T.cy + 18;
    fillRR(bx, by, bw, bh, bh / 2, 'rgba(0,0,0,0.3)');
    var ratio = rem / 112;
    fillRR(bx, by, bw * ratio, bh, bh / 2, ratio > 0.3 ? C.GREEN_BRIGHT : C.RED);
    text('余' + rem, T.cx, by + bh + 2, 'center', 'top', '9px "Microsoft YaHei"', C.TEXT_DIM);

    /* ---- 四家 ---- */
    _drawTop(st);
    _drawLeft(st);
    _drawRight(st);
    _drawBottom(st);

    /* ---- 弃牌 ---- */
    for (var p = 0; p < 4; p++) _drawDiscard(st, p);

    /* ---- 回合指示 ---- */
    if (st.phase === 'playerTurn' || st.phase === 'aiTurn') {
      var indicPos = {
        0: [T.cx, L.playerBar.y - 6],
        1: [L.top.cx, L.top.cy + 26],
        2: [L.left.cx + 16, L.left.cy],
        3: [L.right.cx - 16, L.right.cy]
      };
      var ip = indicPos[st.currentPlayer] || indicPos[0];
      ctx.save();
      ctx.fillStyle = 'rgba(255,215,0,0.22)';
      ctx.beginPath(); ctx.arc(ip[0], ip[1], 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = C.GOLD_BRIGHT;
      ctx.beginPath(); ctx.arc(ip[0], ip[1], 5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  /* ================================================================
   *  北家（上）
   * ================================================================ */
  function _drawTop (st) {
    var pid = 1;
    var hand = st.hands[pid] || [];
    var L2 = L.top;
    drawWindCircle(L2.cx - 30, L2.cy, 11, '北', pid, st);
    drawScore(L2.cx - 14, L2.cy, pid, st, 'left', 10);
    /* 牌背 */
    var count = hand.length;
    var stepX = Math.min(L2.tw + 1.5, W * 0.36 / Math.max(count, 1));
    var startX = L2.cx;
    for (var i = 0; i < count; i++) {
      drawTile(startX + i * stepX, L2.cy - L2.th / 2, L2.tw, L2.th, 0, false, false, false);
    }
    /* 副露 */
    drawMelds(st.melds[pid], 4, L2.cy + 16, true);
  }

  /* ================================================================
   *  西家（左）
   * ================================================================ */
  function _drawLeft (st) {
    var pid = 2;
    var hand = st.hands[pid] || [];
    var L2 = L.left;
    drawWindCircle(L2.cx, L2.cy - 18, 9, '西', pid, st);
    drawScore(L2.cx, L2.cy - 5, pid, st, 'center', 9);
    /* 牌背垂直 */
    var count = hand.length;
    var stepY = Math.min(L2.th + 1.5, 3);
    var startY = L2.cy + 4;
    for (var i = 0; i < count; i++) {
      drawTile(L2.cx - L2.tw / 2, startY + i * stepY, L2.tw, L2.th, 0, false, false, false);
    }
    /* 副露 */
    drawMelds(st.melds[pid], L2.cx - TW_MELD / 2, startY + count * stepY + 4, true);
  }

  /* ================================================================
   *  东家（右）
   * ================================================================ */
  function _drawRight (st) {
    var pid = 3;
    var hand = st.hands[pid] || [];
    var L2 = L.right;
    drawWindCircle(L2.cx, L2.cy - 18, 9, '东', pid, st);
    drawScore(L2.cx, L2.cy - 5, pid, st, 'center', 9);
    var count = hand.length;
    var stepY = Math.min(L2.th + 1.5, 3);
    var startY = L2.cy + 4;
    for (var i = 0; i < count; i++) {
      drawTile(L2.cx - L2.tw / 2, startY + i * stepY, L2.tw, L2.th, 0, false, false, false);
    }
    drawMelds(st.melds[pid], L2.cx - TW_MELD / 2, startY + count * stepY + 4, true);
  }

  /* ================================================================
   *  南家（玩家）— 底部
   * ================================================================ */
  function _drawBottom (st) {
    var pid = 0;
    var bar = L.playerBar;
    var hnd = L.playerHand;

    /* 信息条 */
    drawWindCircle(14, bar.y + bar.h / 2, 10, '你', pid, st);
    drawScore(30, bar.y + bar.h / 2, pid, st, 'left', 11);
    /* 副露在信息条右侧 */
    drawMelds(st.melds[pid], 52, bar.y + 1, true);

    /* ---- 手牌 ---- */
    var hand = Tiles.sortHand(st.hands[pid] || []);
    st.hands[pid] = hand;
    if (st.selectedIdx >= hand.length) st.selectedIdx = -1;

    var n = hand.length;
    if (n === 0) { st._playerTilePositions = []; return; }

    var tw0 = hnd.baseW, th0 = hnd.baseH;
    var padX = 2;
    var availW = W - padX * 2;

    /* 自动缩小：若放不下则按比例缩 */
    var pitch, tw, th;
    var idealW = tw0 * n + (n - 1) * 2;
    if (idealW <= availW) {
      tw = tw0; th = th0;
      pitch = n > 1 ? (availW - tw) / (n - 1) : 0;
    } else {
      pitch = Math.max(tw0 * 0.45, (availW - tw0) / (n - 1));
      tw = Math.min(tw0, pitch + tw0 * 0.08);
      th = tw * (th0 / tw0);
    }

    var totalW = (n - 1) * pitch + tw;
    var sx = padX + (availW - totalW) / 2;
    var handY = hnd.y;

    st._playerTilePositions = [];
    var ni = n - 1;

    for (var i = 0; i < n; i++) {
      var xx = sx + i * pitch;
      var isNew = (st.turnPhase === 'draw' || st.turnPhase === 'discard') && i === ni;
      var sel   = st.selectedIdx === i;
      var yOff  = sel ? Math.max(5, th * 0.14) : (isNew ? Math.max(2, th * 0.06) : 0);

      drawTile(xx, handY - yOff, tw, th, hand[i], true, sel, isNew && !sel);

      st._playerTilePositions.push({
        x: xx,
        y: handY - yOff,
        w: tw,
        h: th + yOff,
        idx: i
      });
    }
  }

  /* ================================================================
   *  弃牌区
   * ================================================================ */
  function _drawDiscard (st, pid) {
    var disc = st.discards[pid];
    if (!disc || disc.length === 0) return;

    var area = L.discard[pid];
    var dw = area.tw, dh = area.th;
    var gap = 1.5;
    var pitchX = dw + gap;
    var pitchY = dh + gap;
    var cols = area.cols;
    var show = disc.length;

    for (var i = 0; i < show; i++) {
      var row = Math.floor(i / cols);
      var col = i % cols;
      var tx = area.x + col * pitchX;
      var ty = area.y + row * pitchY;
      drawTile(tx, ty, dw, dh, disc[i], true, false, false);
    }
  }

  /* ================================================================
   *  导出
   * ================================================================ */
  resize();

  return {
    canvas: canvas,
    ctx:    ctx,
    resize: resize,
    render: render
  };
})();
