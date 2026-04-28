/* =============================================
   ESP32 Motor Dashboard — app.js
   ============================================= */

let mqttClient  = null;
let isConnected = false;
let currentCmd  = 'stop';

const speedA = () => parseInt(document.getElementById('spd-a').value, 10);
const speedB = () => parseInt(document.getElementById('spd-b').value, 10);
const pct    = v  => Math.round(v / 255 * 100);

// ── MQTT ──────────────────────────────────────
function toggleConnect() {
  if (isConnected) {
    mqttClient && mqttClient.end(true);
    setConnUI(false);
  } else {
    startMQTT();
  }
}

function startMQTT() {
  const host     = document.getElementById('broker-host').value.trim();
  const port     = parseInt(document.getElementById('broker-port').value, 10);
  const url      = `ws://${host}:${port}/mqtt`;
  const clientId = 'esp32dash_' + Math.random().toString(36).slice(2, 8);

  log('SYS', `Mencoba: ${url}`, '');

  mqttClient = mqtt.connect(url, {
    clientId,
    keepalive:       30,
    connectTimeout:  8000,
    reconnectPeriod: 3000,
    clean: true,
  });

  mqttClient.on('connect', () => {
    setConnUI(true);
    const topicStatus = document.getElementById('topic-status').value.trim();
    mqttClient.subscribe(topicStatus, { qos: 0 }, (err) => {
      if (!err) log('SUB', topicStatus, 'subscribed');
    });
  });

  mqttClient.on('error', (err) => {
    log('ERR', err.message || 'Connection error', '');
    setConnUI(false, true);
  });

  mqttClient.on('close', () => {
    if (isConnected) {
      setConnUI(false);
      log('SYS', 'Koneksi terputus', 'reconnecting…');
    }
  });

  mqttClient.on('message', (topic, payload) => {
    try {
      const d = JSON.parse(payload.toString());
      log('RCV', (d.state||'?').toUpperCase(), `A:${pct(d.speedA||0)}% B:${pct(d.speedB||0)}%`);
    } catch {
      log('RCV', topic, payload.toString().slice(0, 60));
    }
  });
}

// ── PUBLISH ───────────────────────────────────
function publish(msg) {
  if (!isConnected) { log('ERR', 'Belum terhubung', ''); return; }
  const topic = document.getElementById('topic-cmd').value.trim();
  mqttClient.publish(topic, msg, { qos: 0 });
}

// ── D-PAD ─────────────────────────────────────
function pressCmd(cmd) {
  if (cmd === currentCmd) return;
  currentCmd = cmd;

  document.querySelectorAll('.dpad-btn').forEach(b => b.classList.remove('pressed'));
  const btn = document.getElementById('btn-' + cmd);
  if (btn) {
    btn.classList.add('pressed');
    if (cmd !== 'stop') setTimeout(() => btn.classList.remove('pressed'), 180);
  }

  publish(cmd);
  log('CMD', cmd.toUpperCase(), `A:${cmd==='stop'?0:pct(speedA())}% B:${cmd==='stop'?0:pct(speedB())}%`);
}

// ── KECEPATAN ─────────────────────────────────
function onSpeedChange(motor, val) {
  document.getElementById('pct-' + motor.toLowerCase()).textContent = pct(val) + '%';
  publish(`speed${motor}:${val}`);
}

// ── CONN UI ───────────────────────────────────
function setConnUI(connected, error = false) {
  isConnected = connected;
  const pill  = document.getElementById('conn-pill');
  const label = document.getElementById('conn-label');
  const btn   = document.getElementById('btn-connect');
  pill.className    = 'conn-pill' + (connected ? ' connected' : error ? ' error' : '');
  label.textContent = connected
    ? document.getElementById('broker-host').value
    : error ? 'Gagal terhubung' : 'Terputus';
  btn.textContent = connected ? 'Putuskan' : 'Hubungkan';
  btn.className   = 'btn-connect' + (connected ? ' active' : '');
}

// ── LOG ───────────────────────────────────────
function log(type, dir, extra) {
  const box = document.getElementById('log');
  const now = new Date();
  const ts  = [now.getHours(), now.getMinutes(), now.getSeconds()]
                .map(x => x.toString().padStart(2,'0')).join(':');
  const line = document.createElement('div');
  line.className = 'log-line';
  line.innerHTML = `<span class="log-ts">${ts}</span>`
                 + `<span class="log-dir">[${type}]</span>`
                 + `<span class="log-extra">${dir} ${extra}</span>`;
  box.appendChild(line);
  box.scrollTop = box.scrollHeight;
  if (box.children.length > 60) box.removeChild(box.firstChild);
}

function clearLog() { document.getElementById('log').innerHTML = ''; }

// ── KEYBOARD ──────────────────────────────────
document.addEventListener('keydown', e => {
  const map = { ArrowUp:'maju', ArrowDown:'mundur', ArrowLeft:'kiri', ArrowRight:'kanan', ' ':'stop' };
  if (map[e.key]) { e.preventDefault(); pressCmd(map[e.key]); }
});
document.addEventListener('keyup', e => {
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) pressCmd('stop');
});

// ── INIT ──────────────────────────────────────
(function init() {
  document.getElementById('pct-a').textContent = pct(speedA()) + '%';
  document.getElementById('pct-b').textContent = pct(speedB()) + '%';
  log('SYS', 'Dashboard siap', 'Klik Hubungkan untuk mulai');
})();
