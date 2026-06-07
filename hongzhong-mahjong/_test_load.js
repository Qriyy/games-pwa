// 模拟基本 DOM
const fs = require('fs');

global.document = {
  getElementById: () => ({
    getContext: () => ({
      fillStyle: null, fillRect: () => {},
      beginPath: () => {}, moveTo: () => {}, lineTo: () => {},
      arcTo: () => {}, closePath: () => {}, clip: () => {},
      fill: () => {}, stroke: () => {},
      createLinearGradient: () => ({ addColorStop: () => {} }),
      createRadialGradient: () => ({ addColorStop: () => {} }),
      save: () => {}, restore: () => {}, translate: () => {},
      rotate: () => {}, fillText: () => {}, arc: () => {},
      drawImage: () => {},
      font: '', textAlign: '', textBaseline: '',
      shadowColor: '', shadowBlur: 0, shadowOffsetY: 0,
      lineWidth: 0,
      strokeStyle: '',
    }),
    addEventListener: () => {},
    classList: { add: () => {}, remove: () => {} },
    textContent: '',
    style: { textContent: '' },
    width: 400,
    height: 800,
    getBoundingClientRect: () => ({ left: 0, top: 0 }),
  }),
  querySelector: () => null,
};
global.window = global;
window.addEventListener = () => {};
global.navigator = { userAgent: 'node' };
global.AudioContext = function() { this.state = 'running'; };
global.Image = function() { this.onload = null; this.onerror = null; this.src = ''; };

function loadMod(name) {
  const code = fs.readFileSync(name, 'utf8');
  const fn = new Function(code);
  fn();
  console.log('OK: ' + name);
}

const order = [
  'js/constants.js', 'js/tiles.js', 'js/game-state.js',
  'js/hu-detection.js', 'js/scoring.js', 'js/actions.js',
  'js/ai-bridge.js', 'js/tile-assets.js', 'js/renderer.js',
  'js/game-flow.js', 'js/ui.js', 'js/main.js'
];

try {
  order.forEach(f => loadMod(f));
  console.log('=== 所有模块加载成功 ===');
  console.log('state keys:', Object.keys(window.state));
} catch(e) {
  console.log('ERROR:', e.message);
  console.log('Stack:', e.stack.split('\n').slice(0, 5).join('\n'));
}
