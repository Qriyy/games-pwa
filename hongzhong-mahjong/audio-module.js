/**
 * 红中麻将 — 音效模块 (v2 - 修复无声音问题)
 * 纯 Web Audio API 合成，无外部音频文件依赖
 *
 * 修复内容：
 *   1. AudioContext 懒初始化 — 首次 playSound 时才创建
 *   2. 创建后立即 resume() 并用 await 等待就绪
 *   3. 所有内部函数正确连接到 destination
 *   4. 音量提升到可听范围 (0.3–0.7)
 *   5. 导出到 window.HongZhongAudio
 *
 * 音效清单：
 *   playDraw()        摸牌音   清脆木质敲击   80ms   vol 0.5
 *   playDiscard()     出牌音   牌落桌面声    120ms   vol 0.5
 *   playPeng()        碰牌音   双击 间隔60ms         vol 0.6
 *   playGang()        杠牌音   三击 间隔50ms         vol 0.6
 *   playHu()          胡牌音   锣鼓点+上升音阶       vol 0.7
 *   playClick()       按钮点击  轻微嗒声      50ms   vol 0.4
 *   playError()       错误操作  短促双音降调  150ms   vol 0.5
 *   playCountdown()   倒计时提示 低频提示      80ms   vol 0.4
 *   playDrawGame()    流局音   低沉嗡声      500ms   vol 0.5
 */

const HongZhongAudio = (() => {
  let _ctx = null;
  let _initPromise = null;

  /**
   * 获取或创建 AudioContext（懒初始化）
   * 首次调用时创建，并立即 resume()
   * @returns {AudioContext}
   */
  function ctx() {
    if (!_ctx) {
      try {
        _ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        console.warn('[HongZhongAudio] 无法创建 AudioContext:', e);
        return null;
      }
    }
    // 如果 suspended，尝试恢复（异步但不阻塞调度）
    if (_ctx.state === 'suspended') {
      _ctx.resume().catch(() => {});
    }
    return _ctx;
  }

  /**
   * 确保 AudioContext 就绪（async）
   * 在播放前调用，等待 resume 完成
   */
  async function ensureReady() {
    const c = ctx();
    if (!c) return null;
    if (c.state === 'suspended') {
      try {
        await c.resume();
      } catch (e) {
        console.warn('[HongZhongAudio] resume 失败:', e);
      }
    }
    return c;
  }

  // ── 工具函数 ────────────────────────────────────────────

  /**
   * 创建噪声缓冲
   * @param {AudioContext} c
   * @param {number} duration 秒
   * @returns {AudioBuffer}
   */
  function noiseBuffer(c, duration) {
    const len = Math.ceil(c.sampleRate * duration);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buf;
  }

  /**
   * 创建带包络的噪声源（模拟木质/桌面敲击）
   * 自动连接到 destination
   */
  function noiseHit(c, { duration = 0.08, vol = 0.5, hpFreq = 300, lpFreq = 4000, attack = 0.003, decay = 0.06 }) {
    const now = c.currentTime;

    const src = c.createBufferSource();
    src.buffer = noiseBuffer(c, duration + 0.05);

    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = hpFreq;

    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = lpFreq;

    const gain = c.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(vol, now + attack);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    src.connect(hp).connect(lp).connect(gain).connect(c.destination);
    src.start(now);
    src.stop(now + duration + 0.05);
  }

  /**
   * 创建带谐振的噪声源（高频谐振模拟木质清脆声）
   * 自动连接到 destination
   */
  function resonantNoiseHit(c, { duration = 0.08, vol = 0.5, resFreq = 1000, resQ = 8, hpFreq = 400, lpFreq = 6000 }) {
    const now = c.currentTime;

    // 噪声层
    const nsSrc = c.createBufferSource();
    nsSrc.buffer = noiseBuffer(c, duration + 0.05);

    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = hpFreq;

    const nsGain = c.createGain();
    nsGain.gain.setValueAtTime(0, now);
    nsGain.gain.linearRampToValueAtTime(vol * 0.6, now + 0.003);
    nsGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    nsSrc.connect(hp).connect(nsGain);

    // 谐振层（正弦波模拟共鸣）
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = resFreq;

    const resFilter = c.createBiquadFilter();
    resFilter.type = 'bandpass';
    resFilter.frequency.value = resFreq;
    resFilter.Q.value = resQ;

    const oscGain = c.createGain();
    oscGain.gain.setValueAtTime(0, now);
    oscGain.gain.linearRampToValueAtTime(vol * 0.4, now + 0.002);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + duration * 0.8);

    osc.connect(resFilter).connect(oscGain);

    // 合并输出 → 直连 destination
    const out = c.createGain();
    out.gain.value = 1;
    nsGain.connect(out);
    oscGain.connect(out);
    out.connect(c.destination);

    nsSrc.start(now);
    nsSrc.stop(now + duration + 0.05);
    osc.start(now);
    osc.stop(now + duration);
  }

  /**
   * 单次敲击声（碰/杠共用）
   * 自动连接到 destination
   */
  function playSingleHit(c, startTime, vol, pitchMul = 1) {
    // 噪声脉冲
    const nsBuf = noiseBuffer(c, 0.08);
    const ns = c.createBufferSource();
    ns.buffer = nsBuf;

    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 300 * pitchMul;

    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 4000;

    const nsGain = c.createGain();
    nsGain.gain.setValueAtTime(0, startTime);
    nsGain.gain.linearRampToValueAtTime(vol * 0.6, startTime + 0.003);
    nsGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.06);

    ns.connect(hp).connect(lp).connect(nsGain).connect(c.destination);
    ns.start(startTime);
    ns.stop(startTime + 0.1);

    // 低频脉冲
    const osc = c.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = 300 * pitchMul;

    const oscGain = c.createGain();
    oscGain.gain.setValueAtTime(0, startTime);
    oscGain.gain.linearRampToValueAtTime(vol * 0.5, startTime + 0.004);
    oscGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.05);

    osc.connect(oscGain).connect(c.destination);
    osc.start(startTime);
    osc.stop(startTime + 0.08);
  }

  // ── 音效实现 ────────────────────────────────────────────

  /**
   * 1. 摸牌音 — 清脆木质敲击
   * 短促噪声脉冲(80ms) + 高频谐振(800-1200Hz)
   */
  function playDraw() {
    const c = ctx();
    if (!c) return;
    const freq = 800 + Math.random() * 400;
    resonantNoiseHit(c, {
      duration: 0.08,
      vol: 0.5,
      resFreq: freq,
      resQ: 10,
      hpFreq: 400,
      lpFreq: 6000,
    });
  }

  /**
   * 2. 出牌音 — 牌落桌面声
   * 中频噪声脉冲(120ms) + 低频共振(200-400Hz)
   */
  function playDiscard() {
    const c = ctx();
    if (!c) return;
    const now = c.currentTime;

    // 噪声层 — 中频
    noiseHit(c, {
      duration: 0.12,
      vol: 0.5,
      hpFreq: 150,
      lpFreq: 3000,
      attack: 0.003,
      decay: 0.1,
    });

    // 低频共振层 — 模拟桌面震动
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 200 + Math.random() * 200;

    const oscGain = c.createGain();
    oscGain.gain.setValueAtTime(0, now);
    oscGain.gain.linearRampToValueAtTime(0.35, now + 0.005);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(oscGain).connect(c.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  /**
   * 3. 碰牌音 — 双击，间隔60ms
   */
  function playPeng() {
    const c = ctx();
    if (!c) return;
    const now = c.currentTime;

    for (let i = 0; i < 2; i++) {
      const t = now + i * 0.06;
      playSingleHit(c, t, 0.6, i === 1 ? 1.1 : 1.0);
    }
  }

  /**
   * 4. 杠牌音 — 三击，间隔50ms，最后一声略重
   */
  function playGang() {
    const c = ctx();
    if (!c) return;
    const now = c.currentTime;

    for (let i = 0; i < 3; i++) {
      const t = now + i * 0.05;
      const volMul = i === 2 ? 1.3 : 1.0;
      playSingleHit(c, t, 0.6 * volMul, 0.8 + i * 0.15);
    }
  }

  /**
   * 5. 胡牌音 — 锣鼓点 + 上升音阶
   *   开头: 低频大鼓声 150→60Hz 200ms
   *   中段: 快速上升音阶 C4→E4→G4→C5 每音100ms
   *   结尾: 高频余韵 2000Hz 渐弱500ms
   */
  function playHu() {
    const c = ctx();
    if (!c) return;
    const now = c.currentTime;

    // ── 开头：大鼓声 ──
    const drumOsc = c.createOscillator();
    drumOsc.type = 'sine';
    drumOsc.frequency.setValueAtTime(150, now);
    drumOsc.frequency.exponentialRampToValueAtTime(60, now + 0.2);

    // 鼓噪声层
    const drumNoiseBuf = noiseBuffer(c, 0.25);
    const drumNoise = c.createBufferSource();
    drumNoise.buffer = drumNoiseBuf;
    const drumNoiseLP = c.createBiquadFilter();
    drumNoiseLP.type = 'lowpass';
    drumNoiseLP.frequency.value = 800;

    const drumGain = c.createGain();
    drumGain.gain.setValueAtTime(0, now);
    drumGain.gain.linearRampToValueAtTime(0.6, now + 0.01);
    drumGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    const drumNoiseGain = c.createGain();
    drumNoiseGain.gain.setValueAtTime(0, now);
    drumNoiseGain.gain.linearRampToValueAtTime(0.3, now + 0.005);
    drumNoiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    drumOsc.connect(drumGain).connect(c.destination);
    drumNoise.connect(drumNoiseLP).connect(drumNoiseGain).connect(c.destination);
    drumOsc.start(now);
    drumOsc.stop(now + 0.3);
    drumNoise.start(now);
    drumNoise.stop(now + 0.3);

    // ── 中段：上升音阶 C4(262)→E4(330)→G4(392)→C5(523) ──
    const notes = [262, 330, 392, 523];
    const noteStart = now + 0.15;

    notes.forEach((freq, i) => {
      const t = noteStart + i * 0.1;

      const osc = c.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;

      // 轻微颤音
      const vibrato = c.createOscillator();
      vibrato.frequency.value = 5;
      const vibratoGain = c.createGain();
      vibratoGain.gain.value = freq * 0.005;
      vibrato.connect(vibratoGain).connect(osc.frequency);

      const gain = c.createGain();
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.5, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

      osc.connect(gain).connect(c.destination);
      osc.start(t);
      osc.stop(t + 0.12);
      vibrato.start(t);
      vibrato.stop(t + 0.12);
    });

    // ── 结尾：高频余韵 ──
    const tailStart = noteStart + notes.length * 0.1;
    const tailOsc = c.createOscillator();
    tailOsc.type = 'sine';
    tailOsc.frequency.value = 2000;

    const tailGain = c.createGain();
    tailGain.gain.setValueAtTime(0.3, tailStart);
    tailGain.gain.exponentialRampToValueAtTime(0.001, tailStart + 0.5);

    tailOsc.connect(tailGain).connect(c.destination);
    tailOsc.start(tailStart);
    tailOsc.stop(tailStart + 0.55);
  }

  /**
   * 6. 按钮点击音 — 轻微「嗒」声
   */
  function playClick() {
    const c = ctx();
    if (!c) return;
    resonantNoiseHit(c, {
      duration: 0.05,
      vol: 0.4,
      resFreq: 3000,
      resQ: 5,
      hpFreq: 800,
      lpFreq: 8000,
    });
  }

  /**
   * 7. 错误操作音 — 短促双音（降调）
   */
  function playError() {
    const c = ctx();
    if (!c) return;
    const now = c.currentTime;

    const freqs = [600, 400];
    freqs.forEach((freq, i) => {
      const t = now + i * 0.08;

      const osc = c.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.7, t + 0.06);

      const gain = c.createGain();
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.5, t + 0.003);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 2000;

      osc.connect(lp).connect(gain).connect(c.destination);
      osc.start(t);
      osc.stop(t + 0.08);
    });
  }

  /**
   * 8. 倒计时提示音 — 低频提示
   */
  function playCountdown() {
    const c = ctx();
    if (!c) return;
    const now = c.currentTime;

    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 440;

    const gain = c.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.4, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain).connect(c.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  /**
   * 9. 流局音 — 低沉「嗡」声
   */
  function playDrawGame() {
    const c = ctx();
    if (!c) return;
    const now = c.currentTime;

    // 低频嗡声
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 100;

    // 二倍频增加厚度
    const osc2 = c.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = 150;

    const gain = c.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.5, now + 0.05);
    gain.gain.setValueAtTime(0.5, now + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    const gain2 = c.createGain();
    gain2.gain.setValueAtTime(0, now);
    gain2.gain.linearRampToValueAtTime(0.3, now + 0.05);
    gain2.gain.setValueAtTime(0.3, now + 0.3);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc.connect(gain).connect(c.destination);
    osc2.connect(gain2).connect(c.destination);

    osc.start(now);
    osc.stop(now + 0.55);
    osc2.start(now);
    osc2.stop(now + 0.55);
  }

  /**
   * 初始化音频上下文（可选 — 在用户手势事件中调用可提前初始化）
   */
  function init() {
    ctx();
  }

  // ── 公开 API ────────────────────────────────────────────
  const api = {
    init,
    playDraw,
    playDiscard,
    playPeng,
    playGang,
    playHu,
    playClick,
    playError,
    playCountdown,
    playDrawGame,
  };

  // 导出到 window
  if (typeof window !== 'undefined') {
    window.HongZhongAudio = api;
  }

  return api;
})();

// 支持 CommonJS
if (typeof module !== 'undefined' && module.exports) {
  module.exports = HongZhongAudio;
}
