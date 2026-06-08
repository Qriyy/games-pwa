/**
 * 红中麻将 — Canvas 渲染器（完全重写）
 * 核心原则：像真的坐在麻将桌前
 *   - 两边AI(西/东)：俯视横向牌堆，牌背朝上
 *   - 对家(北)：横向小牌背，风圈头像
 *   - 弃牌区：南/北横排，西/东竖排
 *   - 碰/杠在手牌左侧
 *   - 牌面：万蓝 / 条绿 / 筒红 / 红中大红
 *   - 牌背：深绿+暗纹，牌面：象牙白渐变
 *   - DPI自适应，竖屏优先
 */
window.Renderer = (function () {
  'use strict';

  var C           = window.Constants.C;
  var LAYOUT      = window.Constants.LAYOUT;
  var SUIT_COLORS = window.Constants.SUIT_COLORS;
  var CN_NUMS     = window.Constants.CN_NUMS;
  var TONG_DOTS   = window.Constants.TONG_DOTS;
  var Tiles       = window.Tiles;

  /* ================================================================
   *  Canvas & DPI
   * ================================================================ */
  var canvas = document.getElementById('gameCanvas');
  var ctx    = canvas.getContext('2d');
  var W, H, dpr;
  var _layoutDirty = true;

  function resize() {
    dpr = window.devicePixelRatio || 1;
    W   = window.innerWidth;
    H   = window.innerHeight;
    canvas.width        = W * dpr;
    canvas.height       = H * dpr;
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
  function rr(x, y, w, h, r) {
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

  function fillRR(x, y, w, h, r, fill, stroke, lw) {
    rr(x, y, w, h, r);
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lw || 1;
      ctx.stroke();
    }
  }

  function circle(cx, cy, r, fill, stroke) {
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

  function text(str, x, y, align, baseline, font, color) {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    ctx.fillText(str, x, y);
  }

  /* ================================================================
   *  绘制单张牌  drawTile(x, y, w, h, id, faceUp, selected, isNew)
   * ================================================================ */
  function drawTile(x, y, w, h, id, faceUp, selected, isNew) {
    if (w <= 0 || h <= 0) return;
    var r = Math.max(0, Math.min(w, h) * 0.08);
    var dy = y;
    if (selected) dy -= Math.max(4, h * 0.14);
    else if (isNew) dy -= Math.max(2, h * 0.07);

    ctx.save();
    if (selected) {
      ctx.shadowColor = 'rgba(255,215,0,0.6)';
      ctx.shadowBlur = 14;
    } else if (isNew) {
      ctx.shadowColor = 'rgba(255,255,200,0.25)';
      ctx.shadowBlur = 6;
    }

    /* ---- 牌背：深绿 + 暗纹 ---- */
    if (!faceUp) {
      rr(x, dy, w, h, r);
      var bg = ctx.createLinearGradient(x, dy, x + w, dy + h);
      bg.addColorStop(0, '#2D5A3A');
      bg.addColorStop(0.5, '#1A4A2A');
      bg.addColorStop(1, '#0E2E1A');
      ctx.fillStyle = bg;
      ctx.fill();
      ctx.strokeStyle = '#0A2210';
      ctx.lineWidth = 0.8;
      ctx.stroke();
      // 暗纹：菱格
      ctx.globalAlpha = 0.07;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 0.4;
      var step = Math.max(3, Math.min(w, h) * 0.18);
      for (var lx = x + step; lx < x + w; lx += step) {
        ctx.beginPath(); ctx.moveTo(lx, dy); ctx.lineTo(lx, dy + h); ctx.stroke();
      }
      for (var ly = dy + step; ly < dy + h; ly += step) {
        ctx.beginPath(); ctx.moveTo(x, ly); ctx.lineTo(x + w, ly); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.restore();
      return;
    }

    /* ---- 牌面：象牙白渐变 ---- */
    rr(x, dy, w, h, r);
    var fg = ctx.createLinearGradient(x, dy, x, dy + h);
    fg.addColorStop(0, '#FFFDF5');
    fg.addColorStop(0.6, '#F8F0DC');
    fg.addColorStop(1, '#EAE0C8');
    ctx.fillStyle = fg;
    ctx.fill();
    ctx.strokeStyle = '#C8B890';
    ctx.lineWidth = 0.6;
    ctx.stroke();
    ctx.restore();

    if (!id) return;

    var cx = x + w / 2;
    var cy = dy + h / 2;

    /* ---- 红中：大红「中」 ---- */
    if (Tiles.isHongzhong(id)) {
      var zhFS = Math.max(10, Math.floor(h * 0.5));
      ctx.save();
      ctx.shadowColor = 'rgba(196,59,42,0.3)';
      ctx.shadowBlur = 3;
      text('中', cx, cy + 1, 'center', 'middle',
           'bold ' + zhFS + 'px "KaiTi","STKaiti","SimSun",serif', '#C43B2A');
      ctx.restore();
      return;
    }

    var suit  = Tiles.tileSuit(id);
    var num   = Tiles.tileNumber(id);
    var color = SUIT_COLORS[suit] || '#333';

    /* ---- 角标数字 ---- */
    var fs1 = Math.max(6, Math.floor(h * 0.16));
    text('' + num, x + w * 0.14, dy + h * 0.06, 'left', 'top',
         'bold ' + fs1 + 'px "Microsoft YaHei",sans-serif', color);
    text('' + num, x + w * 0.86, dy + h * 0.94, 'right', 'bottom',
         'bold ' + fs1 + 'px "Microsoft YaHei",sans-serif', color);

    /* ---- 花色字 ---- */
    var fsHanzi = Math.max(5, Math.floor(h * 0.10));
    var suitChar = suit === 'wan' ? '万' : suit === 'tiao' ? '条' : '筒';
    text(suitChar, x + w * 0.86, dy + h * 0.06, 'right', 'top',
         'bold ' + fsHanzi + 'px "Microsoft YaHei",sans-serif', color);

    /* ---- 中心图案 ---- */
    var fs2 = Math.max(10, Math.floor(h * 0.32));

    if (suit === 'wan') {
      text(CN_NUMS[num - 1] || '' + num, cx, cy, 'center', 'middle',
           'bold ' + fs2 + 'px "KaiTi","STKaiti","Microsoft YaHei",serif', color);
    } else if (suit === 'tiao') {
      var dr = Math.max(1.2, Math.min(w, h) * 0.04);
      var cols = num <= 3 ? 1 : (num <= 6 ? 2 : 3);
      var rows = Math.ceil(num / cols);
      var cw = w * 0.48 / cols;
      var ch = h * 0.48 / rows;
      var sx2 = cx - cw * (cols - 1) / 2;
      var sy2 = cy - ch * (rows - 1) / 2;
      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      for (var i = 0; i < num; i++) {
        var px = sx2 + (i % cols) * cw;
        var py = sy2 + Math.floor(i / cols) * ch;
        ctx.lineWidth = dr * 1.3;
        ctx.beginPath();
        ctx.moveTo(px, py - ch * 0.32);
        ctx.lineTo(px, py + ch * 0.32);
        ctx.stroke();
        ctx.lineWidth = dr * 2;
        ctx.beginPath();
        ctx.moveTo(px - dr * 1.2, py);
        ctx.lineTo(px + dr * 1.2, py);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(px, py - ch * 0.32, dr, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (suit === 'tong') {
      var dots = TONG_DOTS[num];
      var dotR = Math.max(1.8, Math.min(w, h) * 0.06);
      var unit = Math.min(w, h) * 0.11;
      if (dots) {
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        for (var d = 0; d < dots.length; d++) {
          var ddx = cx + dots[d][1] * unit;
          var ddy = cy + dots[d][0] * unit;
          ctx.lineWidth = Math.max(0.6, dotR * 0.3);
          ctx.beginPath();
          ctx.arc(ddx, ddy, dotR, 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(ddx, ddy, dotR * 0.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  /* ================================================================
   *  布局缓存
   * ================================================================ */
  var L = {};

  function _calcLayout() {
    var btnEl = document.getElementById('ui-overlay');
    var btnH  = btnEl ? Math.max(60, btnEl.offsetHeight || 60) : 70;
    var isPortrait = H >= W;

    if (isPortrait) {
      _calcLayoutPortrait(btnH);
    } else {
      _calcLayoutLandscape(btnH);
    }
    L.isPortrait = isPortrait;
  }

  /* ==== 公共弃牌布局计算 ==== */
  function _calcDiscardAreas(tableL, tableTop, tableW, tableH, dPitchX, dPitchY, dw, dh, gap) {
    // 弃牌区占桌面中央 85%
    var daL = tableL + tableW * 0.075;
    var daT = tableTop + tableH * 0.075;
    var daW = tableW * 0.85;
    var daH = tableH * 0.85;
    var daR = daL + daW;
    var daB = daT + daH;

    // 竖排弃牌(西/东)各占2列宽
    var vertCols = 2;
    var vertW = dPitchX * vertCols + gap * 2;
    // 中间横排可用宽度
    var midW = daW - vertW * 2 - gap * 4;
    var horzCols = Math.max(3, Math.floor(midW / dPitchX));
    // 中间横排可用高度（各占一半减去间距）
    var midH = daH;
    var horzRows = Math.max(2, Math.floor((midH * 0.42) / dPitchY));

    return {
      // 南(0)：横排，弃牌区下半部分
      0: {
        x: daL + vertW + gap * 3,
        y: daB - horzRows * dPitchY - gap,
        cols: horzCols,
        tw: dw, th: dh,
        mode: 'h'
      },
      // 北(1)：横排，弃牌区上半部分
      1: {
        x: daL + vertW + gap * 3,
        y: daT + gap,
        cols: horzCols,
        tw: dw, th: dh,
        mode: 'h'
      },
      // 西(2)：竖排（从上到下），弃牌区左侧
      2: {
        x: daL + gap,
        y: daT + gap,
        rows: Math.max(3, Math.floor(daH / dPitchY)),
        cols: vertCols,
        tw: dw, th: dh,
        mode: 'v'
      },
      // 东(3)：竖排（从上到下），弃牌区右侧
      3: {
        x: daR - dPitchX * vertCols - gap,
        y: daT + gap,
        rows: Math.max(3, Math.floor(daH / dPitchY)),
        cols: vertCols,
        tw: dw, th: dh,
        mode: 'v'
      }
    };
  }

  /* ==== 竖屏布局 ==== */
  function _calcLayoutPortrait(btnH) {
    var scale = Math.min(W / 375, H / 750);

    // 玩家手牌
    var tw = Math.round(44 * scale);
    var th = Math.round(59 * scale);
    // 弃牌（手牌的60%）
    var dw = Math.round(26 * scale);
    var dh = Math.round(35 * scale);
    // 副露牌
    var mw = Math.round(28 * scale);
    var mh = Math.round(37 * scale);
    // AI牌背：俯视横向（宽 > 高），像一摞躺着的牌
    var aiTW = Math.round(28 * scale);  // 横向宽
    var aiTH = Math.round(18 * scale);  // 横向高
    var aiGap = Math.round(3 * scale);  // 堆叠偏移

    // 区域分配
    var topH    = Math.round(H * 0.11);           // 北家
    var sideW   = Math.round(W * 0.13);           // 东西
    var playerH = Math.round(H * 0.28);           // 玩家
    var tableTop = topH;
    var tableBot = H - btnH - playerH;
    var tableH   = Math.max(100, tableBot - tableTop);
    var tableL   = sideW;
    var tableR   = W - sideW;
    var tableW   = tableR - tableL;
    var cx       = W / 2;

    var dGap    = Math.round(1.5 * scale);
    var dPitchX = dw + dGap;
    var dPitchY = dh + dGap;

    L.scale   = scale;
    L.btnH    = btnH;
    L.tw      = tw;
    L.th      = th;
    L.dw      = dw;
    L.dh      = dh;
    L.mw      = mw;
    L.mh      = mh;
    L.aiTW    = aiTW;
    L.aiTH    = aiTH;
    L.aiGap   = aiGap;
    L.dGap    = dGap;
    L.table   = { l: tableL, t: tableTop, r: tableR, b: tableTop + tableH, cx: cx, cy: tableTop + tableH / 2, w: tableW, h: tableH };
    L.sideW   = sideW;
    L.playerH = playerH;
    L.playerY = H - btnH - playerH;

    // 北家
    L.top   = { cx: cx, cy: topH * 0.5 };
    // 西家
    L.left  = { cx: sideW * 0.5, cy: tableTop + tableH * 0.5 };
    // 东家
    L.right = { cx: W - sideW * 0.5, cy: tableTop + tableH * 0.5 };

    L.discard = _calcDiscardAreas(tableL, tableTop, tableW, tableH, dPitchX, dPitchY, dw, dh, dGap);
  }

  /* ==== 横屏布局 ==== */
  function _calcLayoutLandscape(btnH) {
    var scale = Math.min(W / 750, H / 375);

    var tw = Math.round(40 * scale);
    var th = Math.round(54 * scale);
    var dw = Math.round(24 * scale);
    var dh = Math.round(32 * scale);
    var mw = Math.round(26 * scale);
    var mh = Math.round(35 * scale);
    var aiTW = Math.round(28 * scale);
    var aiTH = Math.round(18 * scale);
    var aiGap = Math.round(3 * scale);

    var topH    = Math.round(H * 0.13);
    var sideW   = Math.round(W * 0.13);
    var playerH = Math.round(H * 0.30);
    var tableTop = topH;
    var tableBot = H - btnH - playerH;
    var tableH   = Math.max(80, tableBot - tableTop);
    var tableL   = sideW;
    var tableR   = W - sideW;
    var tableW   = tableR - tableL;
    var cx       = W / 2;

    var dGap    = Math.round(1.5 * scale);
    var dPitchX = dw + dGap;
    var dPitchY = dh + dGap;

    L.scale   = scale;
    L.btnH    = btnH;
    L.tw      = tw;
    L.th      = th;
    L.dw      = dw;
    L.dh      = dh;
    L.mw      = mw;
    L.mh      = mh;
    L.aiTW    = aiTW;
    L.aiTH    = aiTH;
    L.aiGap   = aiGap;
    L.dGap    = dGap;
    L.table   = { l: tableL, t: tableTop, r: tableR, b: tableTop + tableH, cx: cx, cy: tableTop + tableH / 2, w: tableW, h: tableH };
    L.sideW   = sideW;
    L.playerH = playerH;
    L.playerY = H - btnH - playerH;

    L.top   = { cx: cx, cy: topH * 0.5 };
    L.left  = { cx: sideW * 0.5, cy: tableTop + tableH * 0.5 };
    L.right = { cx: W - sideW * 0.5, cy: tableTop + tableH * 0.5 };

    L.discard = _calcDiscardAreas(tableL, tableTop, tableW, tableH, dPitchX, dPitchY, dw, dh, dGap);
  }

  /* ================================================================
   *  风圈 & 分数
   * ================================================================ */
  function drawWindCircle(cx, cy, r, label, pid, st) {
    var active = st.currentPlayer === pid;
    circle(cx, cy, r, C.WIND_COLORS[pid], active ? C.GOLD_BRIGHT : null);
    text(label, cx, cy + 1, 'center', 'middle',
         'bold ' + Math.max(7, Math.round(r * 0.72)) + 'px "Microsoft YaHei"', '#fff');
  }

  function drawScore(x, y, pid, st, align, fontSz) {
    var active = st.currentPlayer === pid;
    text((st.scores[pid] || 0) + '', x, y, align, 'middle',
         (fontSz || 10) + 'px "Microsoft YaHei"', active ? C.GOLD : C.TEXT_DIM);
  }

  /* ================================================================
   *  副露（碰/杠）
   * ================================================================ */
  function drawMelds(melds, x, y, isHorizontal, faceUpOverride) {
    if (!melds || melds.length === 0) return;
    var mw = L.mw, mh = L.mh, gap = 2;
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
   *  北家（对家）— 上方，横向牌背，风圈头像
   * ================================================================ */
  function _drawNorth(st) {
    var pid = 1;
    var hand = st.hands[pid] || [];
    var L2 = L.top;
    var tw = L.aiTW, th = L.aiTH;
    var gap = Math.max(1, Math.round(L.scale * 1.5));
    var count = hand.length;

    // 风圈头像（圆圈+文字）在牌堆左侧
    var avatarR = Math.max(9, Math.round(12 * (L.scale || 1)));
    drawWindCircle(L2.cx - (count * (tw + gap)) / 2 - avatarR - 6, L2.cy, avatarR, '北', pid, st);
    drawScore(L2.cx - (count * (tw + gap)) / 2 - avatarR * 2 - 10, L2.cy, pid, st, 'right', 9);

    // 牌背横排居中
    var totalW = count * tw + (count - 1) * gap;
    var sx = L2.cx - totalW / 2;
    for (var i = 0; i < count; i++) {
      drawTile(sx + i * (tw + gap), L2.cy - th / 2, tw, th, 0, false, false, false);
    }

    // 副露在牌背右侧
    drawMelds(st.melds[pid], sx + totalW + 8, L2.cy - th / 2, true);
  }

  /* ================================================================
   *  西家（左侧）— 俯视横向牌堆，每张微微向右偏移
   * ================================================================ */
  function _drawWest(st) {
    var pid = 2;
    var hand = st.hands[pid] || [];
    var L2 = L.left;
    var tw = L.aiTW, th = L.aiTH;  // 宽 > 高，横向
    var gap = L.aiGap;
    var count = hand.length;

    // 风圈和分数在牌堆上方
    var avatarR = Math.max(8, Math.round(10 * (L.scale || 1)));
    drawWindCircle(L2.cx, L2.cy - th / 2 - avatarR - 4, avatarR, '西', pid, st);
    drawScore(L2.cx, L2.cy - th / 2 - avatarR * 2 - 6, pid, st, 'center', 8);

    // 俯视堆叠：每张微微向右偏移（从上往下看一摞横放的牌）
    var startX = L2.cx - tw / 2;
    var startY = L2.cy - th / 2;
    for (var i = 0; i < count; i++) {
      drawTile(startX + i * gap, startY, tw, th, 0, false, false, false);
    }

    // 副露在牌堆下方
    drawMelds(st.melds[pid], L2.cx - L.mw / 2, startY + th + 6, true);
  }

  /* ================================================================
   *  东家（右侧）— 俯视横向牌堆，每张微微向左偏移
   * ================================================================ */
  function _drawEast(st) {
    var pid = 3;
    var hand = st.hands[pid] || [];
    var L2 = L.right;
    var tw = L.aiTW, th = L.aiTH;
    var gap = L.aiGap;
    var count = hand.length;

    var avatarR = Math.max(8, Math.round(10 * (L.scale || 1)));
    drawWindCircle(L2.cx, L2.cy - th / 2 - avatarR - 4, avatarR, '东', pid, st);
    drawScore(L2.cx, L2.cy - th / 2 - avatarR * 2 - 6, pid, st, 'center', 8);

    // 俯视堆叠：每张微微向左偏移
    var startX = L2.cx - tw / 2;
    var startY = L2.cy - th / 2;
    for (var i = 0; i < count; i++) {
      drawTile(startX - i * gap, startY, tw, th, 0, false, false, false);
    }

    // 副露在牌堆下方
    drawMelds(st.melds[pid], L2.cx - L.mw / 2, startY + th + 6, true);
  }

  /* ================================================================
   *  南家（玩家）— 底部手牌
   * ================================================================ */
  function _drawSouth(st) {
    var pid = 0;
    var playerY = L.playerY;
    var tw0 = L.tw, th0 = L.th;

    // 信息条
    var barY = playerY;
    drawWindCircle(14, barY + 10, 10, '你', pid, st);
    drawScore(30, barY + 10, pid, st, 'left', 11);

    // 手牌
    var hand = Tiles.sortHand(st.hands[pid] || []);
    st.hands[pid] = hand;
    if (st.selectedIdx >= hand.length) st.selectedIdx = -1;

    var n = hand.length;
    if (n === 0) { st._playerTilePositions = []; return; }

    // 碰杠在左侧
    var melds = st.melds[pid] || [];
    var meldW = 0;
    if (melds.length > 0) {
      var meldGap = 4;
      var singleMeldW = 0;
      for (var m = 0; m < melds.length; m++) {
        var tc = melds[m].type === 'gang' ? 4 : 3;
        singleMeldW += tc * (L.mw + 2) + meldGap;
      }
      meldW = singleMeldW + 4;
      drawMelds(melds, 4, barY + 26, true);
    }

    // 手牌起始X（碰杠右侧开始）
    var padX = 2;
    var availW = W - padX * 2 - meldW;

    // 自动缩小
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
    var sx = meldW + padX + (availW - totalW) / 2;
    var handY = barY + 24;

    st._playerTilePositions = [];
    var ni = n - 1;

    for (var i = 0; i < n; i++) {
      var xx = sx + i * pitch;
      var isNew = (st.turnPhase === 'draw' || st.turnPhase === 'discard') && i === ni;
      var sel = st.selectedIdx === i;
      var yOff = sel ? Math.max(5, th * 0.14) : (isNew ? Math.max(2, th * 0.06) : 0);

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
  function _drawDiscard(st, pid) {
    var disc = st.discards[pid];
    if (!disc || disc.length === 0) return;

    var area = L.discard[pid];
    var dw = area.tw, dh = area.th;
    var gap = L.dGap || 2;
    var dPitchX = dw + gap;
    var dPitchY = dh + gap;

    if (area.mode === 'v') {
      // 竖排：从上到下，每列到rows后换列
      var rows = area.rows || 6;
      for (var i = 0; i < disc.length; i++) {
        var col = Math.floor(i / rows);
        var row = i % rows;
        var tx = area.x + col * dPitchX;
        var ty = area.y + row * dPitchY;
        drawTile(tx, ty, dw, dh, disc[i], true, false, false);
      }
    } else {
      // 横排：从左到右，超过cols换行
      var cols = area.cols || 7;
      for (var i = 0; i < disc.length; i++) {
        var row = Math.floor(i / cols);
        var col = i % cols;
        var tx = area.x + col * dPitchX;
        var ty = area.y + row * dPitchY;
        drawTile(tx, ty, dw, dh, disc[i], true, false, false);
      }
    }
  }

  /* ================================================================
   *  主渲染入口
   * ================================================================ */
  function render() {
    var st = window.state;
    if (!st || !st.hands) return;
    try { _renderCore(st); } catch (e) { console.error('render:', e); }
  }

  function _renderCore(st) {
    if (_layoutDirty) { _calcLayout(); _layoutDirty = false; }

    var T = L.table;

    /* ---- 背景 ---- */
    ctx.fillStyle = C.BG;
    ctx.fillRect(0, 0, W, H);

    /* ---- 桌面 ---- */
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 8;
    rr(T.l, T.t, T.w, T.h, 6);
    var g = ctx.createRadialGradient(T.cx, T.cy, 4, T.cx, T.cy, T.w * 0.52);
    g.addColorStop(0, C.TABLE_LIGHT);
    g.addColorStop(0.5, C.TABLE_PRIMARY);
    g.addColorStop(1, C.TABLE_EDGE);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 1;
    rr(T.l, T.t, T.w, T.h, 6);
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
    _drawNorth(st);
    _drawWest(st);
    _drawEast(st);
    _drawSouth(st);

    /* ---- 弃牌 ---- */
    for (var p = 0; p < 4; p++) _drawDiscard(st, p);

    /* ---- 回合指示 ---- */
    if (st.phase === 'playerTurn' || st.phase === 'aiTurn') {
      var indicPos = {
        0: [W / 2, L.playerY - 6],
        1: [L.top.cx, L.top.cy + L.aiTH + 12],
        2: [L.left.cx + L.aiTW + 10, L.left.cy],
        3: [L.right.cx - L.aiTW - 10, L.right.cy]
      };
      var ip = indicPos[st.currentPlayer] || indicPos[0];
      ctx.save();
      ctx.fillStyle = 'rgba(255,215,0,0.22)';
      ctx.beginPath();
      ctx.arc(ip[0], ip[1], 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = C.GOLD_BRIGHT;
      ctx.beginPath();
      ctx.arc(ip[0], ip[1], 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  /* ================================================================
   *  初始化
   * ================================================================ */
  resize();

  return {
    canvas: canvas,
    ctx:    ctx,
    resize: resize,
    render: render
  };
})();
