// TEMPORARY — delete this file and its require() in server.js when done
const eventEmitter = require('./eventEmitter');

const SUNNY_START    = 10;
const SUNNY_END      = 17;
const WINDOW_MS      = 5 * 60 * 1000; // 5-minute windows
const ANALYZE_EVERY  = 5;             // run analysis every N new windows

let windowStart   = null;
let windowSamples = [];
let windows       = [];

function isSunny() {
  const h = new Date().getHours();
  return h >= SUNNY_START && h < SUNNY_END;
}

function pearson(xs, ys) {
  const n = xs.length;
  if (n < 2) return 0;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  const num  = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0);
  const denX = Math.sqrt(xs.reduce((s, x) => s + (x - mx) ** 2, 0));
  const denY = Math.sqrt(ys.reduce((s, y) => s + (y - my) ** 2, 0));
  return denX && denY ? num / (denX * denY) : 0;
}

function analyze() {
  const deltaVs    = windows.map(w => w.deltaV);
  const panelIs  = windows.map(w => w.panelI_avg);
  const nets     = windows.map(w => w.net_avg);

  const corrP = pearson(deltaVs, panelIs);
  const corrN = pearson(deltaVs, nets);

  const winner = Math.abs(corrP) >= Math.abs(corrN) ? 'panel.i' : 'net (panel.i - load.i)';

  console.log('\n+----------------------------------------------+');
  console.log(  '|       SensorAnalyst -- interim report        |');
  console.log(  '+----------------------------------------------+');
  console.log( `|  Windows collected : ${String(windows.length).padEnd(23)}|`);
  console.log( `|  Corr panel.i      : ${corrP.toFixed(3).padEnd(23)}|`);
  console.log( `|  Corr net          : ${corrN.toFixed(3).padEnd(23)}|`);
  console.log( `|  -> Better predictor: ${winner.padEnd(22)}|`);
  console.log(  '+----------------------------------------------+\n');
}

eventEmitter.on('notifyClient', (raw) => {
  let msg;
  try { msg = JSON.parse(raw); } catch { return; }
  if (msg.type !== 'sensorData') return;
  if (!isSunny()) return;

  const batteryV = msg.battery?.v;
  const panelI   = msg.panel?.i;
  const loadI    = msg.load?.i;
  if (batteryV == null || panelI == null || loadI == null) return;

  const net = panelI - loadI;
  const now = Date.now();

  if (!windowStart) windowStart = now;
  windowSamples.push({ batteryV, panelI, net });

  if (now - windowStart >= WINDOW_MS && windowSamples.length >= 2) {
    const deltaV     = windowSamples.at(-1).batteryV - windowSamples[0].batteryV;
    const panelI_avg = windowSamples.reduce((s, r) => s + r.panelI, 0) / windowSamples.length;
    const net_avg    = windowSamples.reduce((s, r) => s + r.net,    0) / windowSamples.length;

    windows.push({ deltaV, panelI_avg, net_avg });
    console.log(`[SensorAnalyst] window #${windows.length}: dV=${deltaV.toFixed(3)}V  avg panel.i=${panelI_avg.toFixed(1)}mA  avg net=${net_avg.toFixed(1)}mA`);

    if (windows.length % ANALYZE_EVERY === 0) analyze();

    windowStart   = null;
    windowSamples = [];
  }
});

console.log(`[SensorAnalyst] started -- tracking sunny hours ${SUNNY_START}:00-${SUNNY_END}:00`);
