/**
 * 红中麻将 — 音效模块
 * 纯 Web Audio API 合成，无外部音频文件依赖
 *
 * 音效清单（参照 art.md 第7章）:
 *   playDraw()        摸牌音   清脆木质敲击   80ms   vol 0.3
 *   playDiscard()     出牌音   牌落桌面声    120ms   vol 0.4
 *   playPeng()        碰牌音   双击 间隔60ms         vol 0.5
 *   playGang()        杠牌音   三击 间隔50ms         vol 0.5
 *   playHu()          胡牌音   锣鼓点+上升音阶       vol 0.7
 *   playClick()       按钮点击  轻微嗒声      50ms   vol 0.2
 *   playError()       错误操作  短促双音降调  150ms   vol 0.3
 *   playCountdown()   倒计时提示 低频提示      80ms   vol 0.3
 *   playDrawGame()    流局音   低沉嗡声      500ms   vol 0.4
 */

const HongZhongAudio = (() => {
  let _ctx = null;

  /** 获取或创建 AudioContext（需在用户手势后首次调用） */
  function ctx() {
    if (!_ctx) {
      _ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (_ctx.state === 'suspended') {
      _ctx.resume();
    }
    return _ctx;
  }

  // ── 工具函数 ────────────────────────────────────────────

  /**
   * 创建噪声缓冲
   * @param {number} duration 秒
   * @returns {AudioBuffer}
   */
  function noiseBuffer(duration) {
    const c = ctx();
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
   * @param {object} opts
   * @param {number} opts.duration   持续时间(秒)
   * @param {number} opts.vol        峰值音量 0-1
   * @param {number} opts.hpFreq     高通滤波频率(Hz)
   * @param {number} opts.lpFreq     低通滤波频率(Hz)
   * @param {number} opts.attack     起音时间(秒)
   * @param {number} opts.decay      衰减时间(秒)
   * @returns {GainNode} 输出增益节点
   */
  function noiseHit({ duration = 0.08, vol = 0.3, hpFreq = 300, lpFreq = 4000, attack = 0.003, decay = 0.06 }) {
    const c = ctx();
    const now = c.currentTime;

    const src = c.createBufferSource();
    src.buffer = noiseBuffer(duration + 0.05);

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

    src.connect(hp).connect(lp).connect(gain);
    src.start(now);
    src.stop(now + duration + 0.05);

    return gain;
  }

  /**
   * 创建带谐振的噪声源（高频谐振模拟木质清脆声）
   * @param {object} opts
   */
  function resonantNoiseHit({ duration = 0.08, vol = 0.3, resFreq = 1000, resQ = 8, hpFreq = 400, lpFreq = 6000 }) {
    const c = ctx();
    const now = c.currentTime;

    // 噪声层
    const nsSrc = c.createBufferSource();
    nsSrc.buffer = noiseBuffer(duration + 0.05);

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

    // 合并输出
    const out = c.createGain();
    out.gain.value = 1;
    nsGain.connect(out);
    oscGain.connect(out);

    nsSrc.start(now);
    nsSrc.stop(now + duration + 0.05);
    osc.start(now);
    osc.stop(now + duration);

    return out;
  }

  // ── 音效实现 ────────────────────────────────────────────

  /**
   * 1. 摸牌音 — 清脆木质敲击
   * 短促噪声脉冲(80ms) + 高频谐振(800-1200Hz)
   * 音量: 0.3
   */
  function playDraw() {
    const freq = 800 + Math.random() * 400; // 800-1200Hz 随机
    resonantNoiseHit({
      duration: 0.08,
      vol: 0.3,
      resFreq: freq,
      resQ: 10,
      hpFreq: 400,
      lpFreq: 6000,
    });
  }

  /**
   * 2. 出牌音 — 牌落桌面声
   * 中频噪声脉冲(120ms) + 低频共振(200-400Hz)
   * 音量: 0.4
   */
  function playDiscard() {
    const c = ctx();
    const now = c.currentTime;

    // 噪声层 — 中频
    const hit = noiseHit({
      duration: 0.12,
      vol: 0.4,
      hpFreq: 150,
      lpFreq: 3000,
      attack: 0.003,
      decay: 0.1,
    });

    // 低频共振层 — 模拟桌面震动
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 200 + Math.random() * 200; // 200-400Hz

    const oscGain = c.createGain();
    oscGain.gain.setValueAtTime(0, now);
    oscGain.gain.linearRampToValueAtTime(0.25, now + 0.005);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(oscGain);
    oscGain.connect(c.destination);

    osc.start(now);
    osc.stop(now + 0.15);

    hit.connect(c.destination);
  }

  /**
   * 3. 碰牌音 — 双击，间隔60ms
   * 音量: 0.5
   */
  function playPeng() {
    const c = ctx();
    const now = c.currentTime;

    for (let i = 0; i < 2; i++) {
      const t = now + i * 0.06;
      _playSingleHit(t, 0.5, i === 1 ? 1.1 : 1.0); // 第二声略重
    }
  }

  /**
   * 4. 杠牌音 — 三击，间隔50ms，最后一声略重
   * 音量: 0.5
   */
  function playGang() {
    const c = ctx();
    const now = c.currentTime;

    for (let i = 0; i < 3; i++) {
      const t = now + i * 0.05;
      const volMul = i === 2 ? 1.3 : 1.0; // 最后一声更重
      _playSingleHit(t, 0.5 * volMul, 0.8 + i * 0.15);
    }
  }

  /**
   * 单次敲击声（碰/杠共用）
   * @param {number} startTime 开始时间
   * @param {number} vol       音量
   * @param {number} pitchMul  音高倍率
   */
  function _playSingleHit(startTime, vol, pitchMul = 1) {
    const c = ctx();

    // 噪声脉冲
    const nsBuf = noiseBuffer(0.08);
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

  /**
   * 5. 胡牌音 — 锣鼓点 + 上升音阶
   *   开头: 低频大鼓声 100Hz 200ms vol 0.6
   *   中段: 快速上升音阶 C4→E4→G4→C5 每音100ms
   *   结尾: 高频余韵 2000Hz 渐弱500ms
   * 音量: 0.7
   */
  function playHu() {
    const c = ctx();
    const now = c.currentTime;

    // ── 开头：大鼓声 ──
    const drumOsc = c.createOscillator();
    drumOsc.type = 'sine';
    drumOsc.frequency.setValueAtTime(150, now);
    drumOsc.frequency.exponentialRampToValueAtTime(60, now + 0.2);

    // 鼓噪声层（用噪声模拟鼓皮震动）
    const drumNoiseBuf = noiseBuffer(0.25);
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
    drumNoiseGain.gain.linearRampToValueAtTime(0.2, now + 0.005);
    drumNoiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    drumOsc.connect(drumGain).connect(c.destination);
    drumNoise.connect(drumNoiseLP).connect(drumNoiseGain).connect(c.destination);
    drumOsc.start(now);
    drumOsc.stop(now + 0.3);
    drumNoise.start(now);
    drumNoise.stop(now + 0.3);

    // ── 中段：上升音阶 C4(262)→E4(330)→G4(392)→C5(523) ──
    const notes = [262, 330, 392, 523]; // C4 E4 G4 C5
    const noteStart = now + 0.15; // 与鼓声稍重叠

    notes.forEach((freq, i) => {
      const t = noteStart + i * 0.1;

      const osc = c.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;

      // 轻微颤音增加表现力
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
   * 50ms，音量 0.2
   */
  function playClick() {
    resonantNoiseHit({
      duration: 0.05,
      vol: 0.2,
      resFreq: 3000,
      resQ: 5,
      hpFreq: 800,
      lpFreq: 8000,
      attack: 0.002,
      decay: 0.04,
    });
  }

  /**
   * 7. 错误操作音 — 短促双音（降调）
   * 150ms，音量 0.3
   */
  function playError() {
    const c = ctx();
    const now = c.currentTime;

    // 两个下降音
    const freqs = [600, 400]; // 降调
    freqs.forEach((freq, i) => {
      const t = now + i * 0.08;

      const osc = c.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.7, t + 0.06);

      const gain = c.createGain();
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.3, t + 0.003);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

      // 低通滤波让声音柔和一些
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
   * 80ms，音量 0.3
   */
  function playCountdown() {
    const c = ctx();
    const now = c.currentTime;

    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 440;

    const gain = c.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.3, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain).connect(c.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  /**
   * 9. 流局音 — 低沉「嗡」声
   * 500ms，音量 0.4
   */
  function playDrawGame() {
    const c = ctx();
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
    gain.gain.linearRampToValueAtTime(0.4, now + 0.05);
    gain.gain.setValueAtTime(0.4, now + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    const gain2 = c.createGain();
    gain2.gain.setValueAtTime(0, now);
    gain2.gain.linearRampToValueAtTime(0.2, now + 0.05);
    gain2.gain.setValueAtTime(0.2, now + 0.3);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc.connect(gain).connect(c.destination);
    osc2.connect(gain2).connect(c.destination);

    osc.start(now);
    osc.stop(now + 0.55);
    osc2.start(now);
    osc2.stop(now + 0.55);
  }

  /**
   * 初始化音频上下文（需在用户手势事件中调用）
   * 某些浏览器要求在用户交互后才能创建/恢复 AudioContext
   */
  function init() {
    ctx(); // 触发创建
  }

  // ── 公开 API ────────────────────────────────────────────
  return {
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
})();

// 支持 ES Module 和全局引用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = HongZhongAudio;
}
