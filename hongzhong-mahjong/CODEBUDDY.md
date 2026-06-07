# CODEBUDDY.md

This file provides guidance to CodeBuddy when working with code in this repository.

## 项目概述

"红中麻将"是一个纯浏览器端的 HTML5 麻将游戏，使用 Canvas 2D 渲染，单人 vs 3个 AI 对战。规则基于红中作为万能牌（癞子）的简易麻将变种。

## 常用命令

```bash
# 开发：直接用浏览器打开 index.html 即可运行，无构建步骤
start index.html

# 如需本地 HTTP 服务器（必须，因为 AIModule 通过 script src 加载）
npx serve .
# 或用 Python
python -m http.server 8000
# 然后访问 http://localhost:8000
```

项目为纯前端项目，无构建工具、无包管理器、无测试框架。所有功能通过浏览器直接运行。

## 代码架构

### 文件结构

| 文件/目录 | 职责 |
|---|---|
| `index.html` | 仅 CSS 样式 + HTML 骨架（112行），通过 `<script>` 加载 JS 模块 |
| `js/constants.js` | 常量定义：牌尺寸、花色映射、颜色、红中 ID |
| `js/tiles.js` | 牌工具：花色/点数/名称/编码转换，AI 编码（0x）↔ 游戏编码（1-30）互转 |
| `js/game-state.js` | 游戏状态初始化与重置 |
| `js/hu-detection.js` | 胡/碰/杠检测核心算法（含红中万能牌），已清理死代码 |
| `js/scoring.js` | 计分模块：`detectHuType` + `calcScore`（合并重复逻辑） |
| `js/actions.js` | 动作执行：`performHu`/`performPeng`/`performGang`/抢杠胡 |
| `js/ai-bridge.js` | AI 编码桥接层：所有 `AIModule.*` 调用经过此层自动编码转换 |
| `js/game-flow.js` | 游戏流程：发牌/摸牌/出牌/AI回合/点炮检查/结算 |
| `js/renderer.js` | Canvas 2D 渲染：桌面/手牌/弃牌/副露/玩家标签 |
| `js/ui.js` | UI 交互：按钮控制/状态栏/音效/点击输入处理 |
| `js/main.js` | 入口：创建 state 对象、启动 UI |
| `ai-module.js` | AI 模块。独立加载，提供 3 级难度的出牌/碰/杠/胡决策 |
| `audio-module.js` | 音效模块。纯 Web Audio API 合成，无外部音频文件 |
| `docs/` | 设计文档和规则说明 |

### 模块加载顺序（`index.html`）

```
ai-module.js → audio-module.js → constants.js → tiles.js → game-state.js →
hu-detection.js → scoring.js → actions.js → ai-bridge.js →
renderer.js → game-flow.js → ui.js → main.js
```

所有模块使用 `window.X = (function() { ... return { ... }; })();` IIFE 模式暴露。

### 游戏状态管理

全局 `window.state` 对象管理所有游戏数据：

- `phase`：游戏阶段 (`idle`, `playerTurn`, `aiTurn`, `gameOver`)
- `hands`/`discards`/`melds`：四名玩家的手牌、弃牌、副露（碰/杠）
- `scores`：四名玩家分数
- `currentPlayer`：当前玩家索引 (0=玩家, 1-3=AI)
- `turnPhase`：`draw` 或 `discard` 或 `response`
- `canHu`/`canGang`/`canPeng`：控制 UI 按钮可用状态

### 胡牌检测 (`js/hu-detection.js`)

- `canHu()`：入口，要求至少 1 张红中，检测七小对/龙七对/标准胡
- `tryHu()`/`tryMelds()`：递归回溯算法，用红中作为万能牌补全面子和将
- `canPeng()`/`canGang()`：碰/杠检测，红中可以替代普通牌
- `checkQidui()`/`checkLongQidui()`：七小对/龙七对检测
- `checkPengpenghu()`/`checkQingyise()`：碰碰胡/清一色检测

### 游戏流程 (`js/game-flow.js`)

- `startNewGame()`：初始化牌墙（112张），发牌
- `drawTileFromDeck()`：摸牌，检查自摸/自杠
- `checkResponses()`：点炮检查（胡 > 杠 > 碰优先级），支持抢杠胡
- `nextTurn()`：下家回合切换
- `endGame()`：结算显示

### AI 编码桥接 (`js/ai-bridge.js`)

解决两套编码体系互调的无转换 Bug：
- 主游戏编码：万 1-9 = id 1-9，条 = 10-18，筒 = 19-27，红中 = 30
- AI 模块编码：万 = 0x10+点数，条 = 0x20+点数，筒 = 0x30+点数，红中 = 0x41
- 桥接层自动转换，AI 模块内部代码不变

### ai-module.js：三层难度 AI

- **Easy**：30%概率随机出红中，60% 打孤张，否则纯随机
- **Medium**：贪心策略，枚举每种出牌后评估向听数和进张数，取最优（含随机噪声 ±5）
- **Hard**：全局最优 + 防守，出牌评估加入安全度因子，红中惩罚更高（-120），接近听牌时增加防守权重

核心函数：
- `calcShanten(hand)` — 递归枚举最优面子+搭子组合计算向听数
- `countWaits(hand)` — 枚举牌墙中所有牌，统计可胡的张数
- `evaluateDiscard(hand, tile)` — 模拟打出某张牌后的向听数+进张评分
- `getAIDecision(hand, difficulty)` — 主入口，返回要打出的牌
- `shouldPeng()`/`shouldHu()`/`shouldGang()` — 碰/胡/杠决策

### audio-module.js：Web Audio API 音效

通过 `HongZhongAudio` 全局对象暴露 `playDraw()` / `playDiscard()` / `playPeng()` / `playGang()` / `playHu()` 等函数，全部使用噪声缓冲和振荡器合成。

### 牌编码体系

项目中存在两套编码，注意区分：
- `index.html`：万 1-9 = id 1-9，条 1-9 = id 10-18，筒 1-9 = id 19-27，红中 = id 30
- `ai-module.js`：万 = 0x10+点数，条 = 0x20+点数，筒 = 0x30+点数，红中 = 0x41
