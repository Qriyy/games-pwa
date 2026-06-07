/**
 * 红中麻将 — 常量模块
 * 牌尺寸、花色映射、专业配色方案、布局参数
 */
window.Constants = (function() {
  // ====== 牌尺寸 ======
  const TILE_W = 48, TILE_H = 64;
  const TILE_W_SM = 36, TILE_H_SM = 48;

  // ====== 花色 ======
  const SUITS = ['wan','tiao','tong'];
  const SUIT_NAMES = { wan: '万', tiao: '条', tong: '筒' };
  const SUIT_COLORS = { wan: '#1A3A8A', tiao: '#1A6A2A', tong: '#8A2A1A' };

  // ====== 红中 ======
  const HONGZHONG_ID = 30;

  // ====== 专业配色方案（雀魂风格） ======
  const C = {
    BG:             '#0D1117',       // 深色背景
    TABLE_PRIMARY:  '#1B5E20',       // 桌面主色（深绿）
    TABLE_LIGHT:    '#2E7D32',       // 桌面亮区
    TABLE_EDGE:     '#143A17',       // 桌面边缘
    TABLE_BORDER:   '#4E342E',       // 桌边木框
    TABLE_SHINE:    'rgba(255,255,255,0.03)', // 桌面纹理
    PANEL_BG:       '#131B26',       // 玩家面板背景
    PANEL_BORDER:   '#2A3A4A',       // 面板边框
    PANEL_ACTIVE:   '#D4A545',       // 活跃玩家面板高亮
    GOLD:           '#D4A545',       // 金色
    GOLD_BRIGHT:    '#FFD700',       // 亮金
    RED:            '#C43B2A',       // 红中红色
    RED_BRIGHT:     '#E8533F',       // 亮红（按钮悬停）
    TILE_FACE:      '#FFF8E1',       // 牌面象牙白
    TILE_DARK:      '#E8DCC8',       // 牌底暗色
    TILE_BACK:      '#1A3A5C',       // 牌背深蓝
    TILE_BACK_LIGHT:'#2A5A7C',       // 牌背亮蓝
    TEXT:           '#F5E6C8',       // 主文字奶油色
    TEXT_DIM:       '#8A8A7A',       // 次要文字
    TEXT_BRIGHT:    '#FFFFFF',       // 亮白文字
    GREEN_BRIGHT:   '#2E7D32',       // 亮绿（状态指示）
    WIND_COLORS:    { 0: '#F5E6C8',  // 南（玩家）奶油
                      1: '#7B9F7B',  // 北 灰绿
                      2: '#8A9FB0',  // 西 灰蓝
                      3: '#B08A7A' },// 东 棕灰
  };

  // ====== 布局参数 ======
  const LAYOUT = {
    TOP_RATIO:      0.14,     // 上方AI区域高度比例
    BOTTOM_RATIO:   0.34,     // 玩家区域高度比例
    SIDE_RATIO:     0.13,     // 左右AI区域宽度比例
    PANEL_H:        48,       // 玩家面板高度
    PANEL_W:        140,      // 玩家面板宽度
    AVATAR_R:       16,       // 头像半径
    AI_TILE_W:      30,       // AI牌背宽度
    AI_TILE_H:      40,       // AI牌背高度
    DISCARD_COLS:   7,        // 弃牌列数
    // 移动端竖屏参数
    PORTRAIT: {
      TOP_BAR_H:    0.10,     // 顶部AI信息栏高度比例
      TABLE_H:      0.38,     // 桌面区域高度比例
      BOTTOM_H:     0.52,     // 玩家手牌区域高度比例（加大给手牌和按钮）
      AVATAR_R:     14,       // 顶部AI头像半径
      TILE_W:       42,       // 玩家手牌宽度
      TILE_H:       56,       // 玩家手牌高度
      DISCARD_W:    22,       // 弃牌宽度
      DISCARD_H:    30,       // 弃牌高度
      AI_TILE_W:    22,       // AI牌背宽度
      AI_TILE_H:    30,       // AI牌背高度
      MELD_W:       20,       // 副露牌宽度
      MELD_H:       27,       // 副露牌高度
      BTN_GAP:      8,        // 按钮间距
    },
  };

  return {
    TILE_W, TILE_H, TILE_W_SM, TILE_H_SM,
    SUITS, SUIT_NAMES, SUIT_COLORS,
    HONGZHONG_ID, C, LAYOUT,
  };
})();
