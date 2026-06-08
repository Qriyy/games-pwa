/**
 * 红中麻将 — 渲染模块（移动端成熟方案）
 * - DPI 自适应 canvas
 * - 百分比布局，适配所有手机尺寸
 * - 所有绘制函数带边界保护
 */
window.Renderer = (function() {
  var C = window.Constants.C;
  var LAYOUT = window.Constants.LAYOUT;
  var SUIT_COLORS = window.Constants.SUIT_COLORS;
  var CN_NUMS = window.Constants.CN_NUMS;
  var TONG_DOTS = window.Constants.TONG_DOTS;
  var Tiles = window.Tiles;

  var canvas = document.getElementById('gameCanvas');
  var ctx = canvas.getContext('2d');
  var W, H, dpr, sc;

  // ======================================================================
  //  DPI 自适应 resize
  // ======================================================================
  function resize() {
    dpr = window.devicePixelRatio || 1;
    W = window.innerWidth;
    H = window.innerHeight;
    // canvas 内部像素 = CSS 尺寸 × DPI
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    // 所有绘制用 DPI 缩放
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    sc = Math.min(W / 375, 1.3);
    render();
  }
  window.addEventListener('resize', resize);

  // ======================================================================
  //  安全绘图工具
  // ======================================================================
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

  function circle(x, y, r, fill, stroke) {
    if (r <= 0) return;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.stroke(); }
  }

  // ======================================================================
  //  牌面绘制（纯 Canvas，零外部依赖）
  // ======================================================================
  function tile(x, y, w, h, id, up, sel, isNew) {
    if (w <= 0 || h <= 0) return;
    var r = Math.max(0, Math.min(w, h) * 0.08);
    var dy = y;
    if (sel) dy -= Math.max(8, 12 * sc);
    if (isNew && !sel) dy -= Math.max(4, 6 * sc);

    ctx.save();
    if (sel) { ctx.shadowColor = 'rgba(212,165,69,0.6)'; ctx.shadowBlur = 12 * sc; }
    else if (isNew) { ctx.shadowColor = 'rgba(255,255,200,0.3)'; ctx.shadowBlur = 6 * sc; }

    if (!up) {
      // 牌背
      rr(x, dy, w, h, r);
      var g = ctx.createLinearGradient(x, dy, x, dy + h);
      g.addColorStop(0, '#2A5A7C'); g.addColorStop(0.5, '#1A3A5C'); g.addColorStop(1, '#0F1F30');
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = '#0D1A2A'; ctx.lineWidth = 0.8; ctx.stroke();
      ctx.restore(); return;
    }

    // 牌面底色
    rr(x, dy, w, h, r);
    var fg = ctx.createLinearGradient(x, dy, x, dy + h);
    fg.addColorStop(0, '#FFFDF5'); fg.addColorStop(0.7, '#F5EDD8'); fg.addColorStop(1, '#E8DDC0');
    ctx.fillStyle = fg; ctx.fill();
    ctx.strokeStyle = '#C8B890'; ctx.lineWidth = 0.6; ctx.stroke();
    ctx.restore();

    // 牌面文字
    if (!id) return;
    var cx = x + w / 2, cy = dy + h / 2;

    if (Tiles.isHongzhong(id)) {
      ctx.fillStyle = '#C43B2A';
      ctx.font = 'bold ' + Math.max(8, Math.floor(h * 0.45)) + 'px "KaiTi","Microsoft YaHei",serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('中', cx, cy);
    } else {
      var suit = Tiles.tileSuit(id), num = Tiles.tileNumber(id), color = SUIT_COLORS[suit] || '#333';
      // 角标数字
      var fs = Math.max(6, Math.floor(h * 0.17));
      ctx.fillStyle = color;
      ctx.font = 'bold ' + fs + 'px "Microsoft YaHei",sans-serif';
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText('' + num, x + 2, dy + 1);
      ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
      ctx.fillText('' + num, x + w - 2, dy + h - 1);
      // 中心图案
      var fs2 = Math.max(8, Math.floor(h * 0.3));
      if (suit === 'wan') {
        ctx.fillStyle = color;
        ctx.font = 'bold ' + fs2 + 'px "KaiTi","Microsoft YaHei",serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(CN_NUMS[num - 1] || '' + num, cx, cy);
      } else if (suit === 'tiao') {
        var dr = Math.max(1, Math.min(w, h) * 0.04);
        var cols = num <= 3 ? 1 : (num <= 6 ? 2 : 3), rows = Math.ceil(num / cols);
        var cw = w * 0.5 / cols, ch = h * 0.5 / rows;
        var sx = cx - cw * (cols - 1) / 2, sy = cy - ch * (rows - 1) / 2;
        ctx.strokeStyle = '#1A6A2A'; ctx.fillStyle = '#1A6A2A';
        for (var i = 0; i < num; i++) {
          var px = sx + (i % cols) * cw, py = sy + Math.floor(i / cols) * ch;
          ctx.lineWidth = dr; ctx.beginPath(); ctx.moveTo(px, py - ch * 0.3); ctx.lineTo(px, py + ch * 0.3); ctx.stroke();
          ctx.lineWidth = dr * 1.5; ctx.beginPath(); ctx.moveTo(px - dr, py); ctx.lineTo(px + dr, py); ctx.stroke();
          ctx.beginPath(); ctx.arc(px, py - ch * 0.3, dr, 0, Math.PI * 2); ctx.fill();
        }
      } else if (suit === 'tong') {
        var dots = TONG_DOTS[num]; var dotR = Math.max(1.5, Math.min(w, h) * 0.06); var unit = Math.min(w, h) * 0.11;
        if (dots) {
          ctx.strokeStyle = '#8A2A1A'; ctx.fillStyle = '#8A2A1A';
          for (var d = 0; d < dots.length; d++) {
            var dx = cx + dots[d][1] * unit, dy2 = cy + dots[d][0] * unit;
            ctx.lineWidth = Math.max(0.5, dotR * 0.3);
            ctx.beginPath(); ctx.arc(dx, dy2, dotR, 0, Math.PI * 2); ctx.stroke();
            ctx.beginPath(); ctx.arc(dx, dy2, dotR * 0.4, 0, Math.PI * 2); ctx.fill();
          }
        }
      }
    }
  }

  // ======================================================================
  //  主渲染
  // ======================================================================
  function render() {
    var st = window.state;
    if (!st || !st.hands) return;
    try { _render(st); } catch(e) { console.error('render:', e.message); }
  }

  function _render(st) {
    ctx.fillStyle = C.BG;
    ctx.fillRect(0, 0, W, H);

    // 布局区域（百分比）
    var topH = H * 0.09;          // 顶部AI区
    var sideW = W * 0.14;         // 左右侧AI区
    var bottomH = H * 0.27;       // 底部玩家区（加大，给按钮留空间）
    var tableTop = topH;
    var tableBot = H - bottomH;
    var tableH = tableBot - tableTop;
    var cx = W / 2;

    // 1. 桌面
    _table(tableTop, tableH, sideW, cx);

    // 2. 弃牌区
    _discards(st, tableTop, tableH, sideW, cx);

    // 3. 牌墙
    _wall(st, cx, tableBot - 12 * sc);

    // 4. 四家
    _topAI(st, topH, cx);
    _sideAI(st, 2, 0, topH, sideW, tableH, false);       // 西（左）
    _sideAI(st, 3, W - sideW, topH, sideW, tableH, true); // 东（右）
    _bottom(st, bottomH, cx);

    // 5. 回合指示
    _indicator(st, topH, sideW, tableH, bottomH, cx);
  }

  // ===== 桌面 =====
  function _table(top, th, sw, cx) {
    var cy = top + th / 2, tw = W - sw * 2 - 2 * sc, tth = th * 0.96;
    if (tw <= 0 || tth <= 0) return;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 6 * sc;
    rr(cx - tw / 2, cy - tth / 2, tw, tth, 6);
    var g = ctx.createRadialGradient(cx, cy, 4, cx, cy, tw * 0.45);
    g.addColorStop(0, C.TABLE_LIGHT); g.addColorStop(0.5, C.TABLE_PRIMARY); g.addColorStop(1, C.TABLE_EDGE);
    ctx.fillStyle = g; ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 1;
    rr(cx - tw / 2, cy - tth / 2, tw, tth, 6); ctx.stroke();
    // 中心标记
    circle(cx, cy, 12 * sc, C.TABLE_FRAME, 'rgba(212,165,69,0.3)');
    ctx.fillStyle = C.GOLD; ctx.font = 'bold ' + Math.max(8, 10 * sc) + 'px "Microsoft YaHei"';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('南', cx, cy);
  }

  // ===== 弃牌区：每人面前一小块 =====
  function _discards(st, top, th, sw, cx) {
    var dw = Math.max(10, 14 * sc), dh = Math.max(14, 20 * sc), gap = Math.max(1, 1.5 * sc);
    var cw = dw + gap, ch = dh + gap, maxPerRow = 7;
    for (var p = 0; p < 4; p++) {
      var disc = st.discards[p];
      if (!disc || disc.length === 0) continue;
      var show = Math.min(disc.length, maxPerRow * 3);
      var rows = Math.ceil(show / maxPerRow);
      var horiz = (p === 0 || p === 1);

      // 每家弃牌区中心点：在桌面内、靠近自家一侧
      var areaCx, areaCy;
      if (p === 0) { areaCx = cx; areaCy = top + th - dh * rows - 12 * sc; }      // 底部玩家：桌面下方
      else if (p === 1) { areaCx = cx; areaCy = top + 10 * sc; }                   // 顶部AI：桌面上方
      else if (p === 2) { areaCx = sw + 10 * sc; areaCy = top + th * 0.55; }       // 左侧AI：桌面左侧
      else { areaCx = W - sw - dw - 10 * sc; areaCy = top + th * 0.55; }           // 右侧AI：桌面右侧

      for (var i = 0; i < show; i++) {
        var row = Math.floor(i / maxPerRow), col = i % maxPerRow;
        var rowCount = (row < rows - 1) ? maxPerRow : (show - row * maxPerRow);
        var rowW = rowCount * cw;
        var tx, ty;
        if (horiz) {
          tx = areaCx - rowW / 2 + col * cw;
          ty = areaCy + row * ch;
        } else {
          tx = areaCx + row * ch;
          ty = areaCy - rowW / 2 + col * cw;
        }
        tile(tx, ty, dw, dh, disc[i], true, false, false);
      }
    }
  }

  // ===== 牌墙 =====
  function _wall(st, cx, y) {
    var rem = st.deck ? st.deck.length : 0;
    var bw = Math.max(30, 60 * sc), bh = Math.max(3, 5 * sc);
    var bx = cx - bw / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; rr(bx, y, bw, bh, bh / 2); ctx.fill();
    var ratio = rem / 112;
    ctx.fillStyle = ratio > 0.3 ? '#2E7D32' : '#C43B2A';
    rr(bx, y, bw * ratio, bh, bh / 2); ctx.fill();
    ctx.fillStyle = C.TEXT_DIM; ctx.font = Math.max(6, 7 * sc) + 'px "Microsoft YaHei"';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText('余' + rem, cx, y + bh + 1 * sc);
  }

  // ===== 顶部AI（北） =====
  function _topAI(st, topH, cx) {
    var p = 1, count = st.hands[p] ? st.hands[p].length : 0;
    var r = Math.max(6, 10 * sc);
    var avX = cx, avY = topH / 2;
    circle(avX, avY, r, C.WIND_COLORS[p], st.currentPlayer === p ? C.GOLD : null);
    ctx.fillStyle = '#fff'; ctx.font = 'bold ' + Math.max(6, r * 0.7) + 'px "Microsoft YaHei"';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('北', avX, avY + 1);
    // 分数
    ctx.fillStyle = st.currentPlayer === p ? C.GOLD : C.TEXT_DIM;
    ctx.font = Math.max(6, 7 * sc) + 'px "Microsoft YaHei"';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('AI ' + (st.scores[p] || 0), avX + r + 3 * sc, avY);
    // 牌背
    var tw = Math.max(6, 12 * sc), th = Math.max(8, 16 * sc);
    var step = Math.min(tw + 1, W * 0.4 / Math.max(count, 1));
    for (var i = 0; i < count; i++) tile(avX + r + 16 * sc + i * step, avY - th / 2, tw, th, 0, false, false, false);
    // 副露
    _melds(st, p, 4 * sc, topH - 26 * sc);
  }

  // ===== 左右AI =====
  function _sideAI(st, pid, x, topY, sw, th, isR) {
    var count = st.hands[pid] ? st.hands[pid].length : 0;
    var r = Math.max(5, 8 * sc);
    var avX = x + sw / 2, avY = topY + r + 3 * sc;
    circle(avX, avY, r, C.WIND_COLORS[pid], st.currentPlayer === pid ? C.GOLD : null);
    ctx.fillStyle = '#fff'; ctx.font = 'bold ' + Math.max(5, r * 0.65) + 'px "Microsoft YaHei"';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(['西', '东'][pid - 2], avX, avY + 1);
    ctx.fillStyle = st.currentPlayer === pid ? C.GOLD : C.TEXT_DIM;
    ctx.font = Math.max(5, 6 * sc) + 'px "Microsoft YaHei"';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(['AI', 'AI'][pid - 2] + ' ' + (st.scores[pid] || 0), avX, avY + r + 1 * sc);
    // 牌背紧贴头像下方
    var tw = Math.max(5, 10 * sc), tth = Math.max(7, 14 * sc);
    var tileX = avX - tw / 2, startY = avY + r + 8 * sc;
    var step = Math.min(tth + 1, 2.5 * sc);
    for (var i = 0; i < count; i++) tile(tileX, startY + i * step, tw, tth, 0, false, false, false);
    // 副露
    _melds(st, pid, isR ? x + 2 * sc : x + sw - 3 * tw - 4 * sc, startY + count * step + 2 * sc);
  }

  // ===== 底部玩家（南） =====
  function _bottom(st, bottomH, cx) {
    var hand = st.hands[0] || [];
    st.hands[0] = Tiles.sortHand(hand);
    if (st.selectedIdx >= st.hands[0].length) st.selectedIdx = -1;
    hand = st.hands[0];

    var top = H - bottomH;
    var barH = Math.max(20, 26 * sc), r = Math.max(6, 9 * sc);
    var avX = 10 * sc, avY = top + barH / 2;
    circle(avX, avY, r, C.WIND_COLORS[0], st.currentPlayer === 0 ? C.GOLD : null);
    ctx.fillStyle = '#fff'; ctx.font = 'bold ' + Math.max(6, r * 0.7) + 'px "Microsoft YaHei"';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('你', avX, avY + 1);
    ctx.fillStyle = C.TEXT; ctx.font = 'bold ' + Math.max(7, 9 * sc) + 'px "Microsoft YaHei"';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('南 ' + (st.scores[0] || 0) + '分', avX + r + 3 * sc, avY);

    // 副露
    _melds(st, 0, avX + r + 3 * sc, avY + 9 * sc);

    // 手牌
    var n = hand.length;
    if (n === 0) return;
    var mTw = Math.max(20, 36 * sc), mTh = Math.max(28, 48 * sc);
    var padX = 2 * sc, availW = W - padX * 2;
    var pitch, tileW, tileH;
    var total = mTw * n + (n - 1) * 2;
    if (total <= availW) { tileW = mTw; tileH = mTh; pitch = (availW - tileW) / Math.max(n - 1, 1); }
    else { pitch = Math.max(16 * sc, (availW - mTw) / Math.max(n - 1, 1)); tileW = Math.min(mTw, pitch + mTw * 0.08); tileH = tileW * (mTh / mTw); }
    var totalW = (n - 1) * pitch + tileW;
    var hsx = padX + (availW - totalW) / 2;
    var handY = top + barH + 2 * sc;

    st._playerTilePositions = [];
    var ni = n - 1;
    for (var i = 0; i < n; i++) {
      var xx = hsx + i * pitch;
      var isNew = (st.turnPhase === 'draw' || st.turnPhase === 'discard') && i === ni;
      var sel = st.selectedIdx === i;
      var yOff = sel ? Math.max(6, 10 * sc) : (isNew ? Math.max(3, 5 * sc) : 0);
      tile(xx, handY - yOff, tileW, tileH, hand[i], true, sel, isNew && !sel);
      st._playerTilePositions.push({ x: xx, y: handY - yOff, w: tileW, h: tileH, idx: i });
    }

    if (st.turnPhase === 'discard' && st.phase === 'playerTurn') {
      ctx.fillStyle = 'rgba(255,215,0,0.35)'; ctx.font = Math.max(6, 7 * sc) + 'px "Microsoft YaHei"';
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText('点牌→选中→再点打出', cx, handY + tileH + 1 * sc);
    }
  }

  // ===== 副露 =====
  function _melds(st, pid, sx, sy) {
    var melds = st.melds[pid];
    if (!melds || melds.length === 0) return;
    var mw = Math.max(12, 18 * sc), mh = Math.max(16, 24 * sc);
    var ox = 0;
    for (var m = 0; m < melds.length; m++) {
      var meld = melds[m];
      var tc = meld.type === 'gang' ? 4 : 3;
      for (var i = 0; i < tc; i++) {
        var faceUp = !(meld.type === 'angang' || meld.type === 'mangang') || pid === 0;
        tile(sx + ox + i * (mw + 1), sy, mw, mh, meld.tiles[i], faceUp, false, false);
      }
      ox += tc * (mw + 1) + 3 * sc;
    }
  }

  // ===== 回合指示 =====
  function _indicator(st, topH, sw, th, bh, cx) {
    if (st.phase !== 'playerTurn' && st.phase !== 'aiTurn') return;
    var pos = { 0: [cx, H - bh - 4 * sc], 1: [cx, topH + 8 * sc], 2: [sw + 8 * sc, topH + th / 2], 3: [W - sw - 8 * sc, topH + th / 2] };
    var p = pos[st.currentPlayer] || pos[0];
    ctx.save();
    ctx.fillStyle = 'rgba(255,215,0,0.2)'; ctx.beginPath(); ctx.arc(p[0], p[1], 10 * sc, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#FFD700'; ctx.beginPath(); ctx.arc(p[0], p[1], 6 * sc, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  return { canvas: canvas, ctx: ctx, resize: resize, render: render };
})();
