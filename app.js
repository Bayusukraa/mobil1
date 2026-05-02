/* =============================================
   ESP32 Motor Dashboard — app.js (FINAL)
   Fix: wss:// otomatis saat halaman HTTPS
============================================= */

let mqttClient  = null;
let isConnected = false;
let currentCmd  = 'stop';

const speedA = () => parseInt(document.getElementById('spd-a').value, 10);
const speedB = () => parseInt(document.getElementById('spd-b').value, 10);
const pct    = v  => Math.round(v / 255 * 100);

// ── DETEKSI HTTPS ──────────────────────────────
const isPageSecure = () => location.protocol === 'https:';

function initSSLBadge() {
  const badge     = document.getElementById('ssl-badge');
  const portInput = document.getElementById('broker-port');

  if (isPageSecure()) {
    badge.textContent = 'WSS (SSL)';
    badge.className   = 'ssl-badge secure';
    // Otomatis ganti ke port 8084 (WSS) jika masih default 8083
    if (portInput.value === '8083') portInput.value = '8084';
  } else {
    badge.textContent = 'WS (Plain)';
    badge.className   = 'ssl-badge insecure';
  }
}

// ── MQTT ───────────────────────────────────────
function toggleConnect() {
  if (isConnected) {
    mqttClient && mqttClient.end(true);
    setConnUI(false);
  } else {
    startMQTT();
  }
}

function startMQTT() {
  const host = document.getElementById('broker-host').value.trim();
  const port = parseInt(document.getElementById('broker-port').value, 10);

  // ✅ FIX UTAMA: wss:// jika HTTPS, ws:// jika HTTP
  const protocol = isPageSecure() ? 'wss' : 'ws';
  const url      = `${protocol}://${host}:${port}/mqtt`;
  const clientId = 'esp32dash_' + Math.random().toString(36).slice(2, 8);

  log('SYS', `Mencoba: ${url}`, isPageSecure() ? '[SSL]' : '[Plain]');

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
      else      log('ERR', 'Subscribe gagal', err.message);
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
      log('RCV', (d.state || '?').toUpperCase(), `A:${pct(d.speedA || 0)}% B:${pct(d.speedB || 0)}%`);
    } catch {
      log('RCV', topic, payload.toString().slice(0, 60));
    }
  });
}

// ── PUBLISH ────────────────────────────────────
function publish(msg) {
  if (!isConnected) { log('ERR', 'Belum terhubung', ''); return; }
  const topic = document.getElementById('topic-cmd').value.trim();
  mqttClient.publish(topic, msg, { qos: 0 });
}

// ── D-PAD ──────────────────────────────────────
function pressCmd(cmd) {
  if (cmd === currentCmd) return;
  currentCmd = cmd;

  document.querySelectorAll('.dpad-btn').forEach(b => b.classList.remove('pressed'));
  const btn = document.getElementById('btn-' + cmd);
  if (btn) {
    btn.classList.add('pressed');
    if (cmd !== 'stop') setTimeout(() => btn.classList.remove('pressed'), 180);
  }

  const payload = JSON.stringify({
    cmd,
    speedA: cmd === 'stop' ? 0 : speedA(),
    speedB: cmd === 'stop' ? 0 : speedB(),
  });

  publish(payload);
  log('CMD', cmd.toUpperCase(), `A:${cmd === 'stop' ? 0 : pct(speedA())}% B:${cmd === 'stop' ? 0 : pct(speedB())}%`);
}

function handleMouseLeave(cmd) {
  // Hanya kirim stop jika tombol ini yang sedang aktif
  if (currentCmd === cmd) pressCmd('stop');
}

// ── KECEPATAN ──────────────────────────────────
function onSpeedChange(motor, val) {
  document.getElementById('pct-' + motor.toLowerCase()).textContent = pct(val) + '%';
  const payload = JSON.stringify({ speedUpdate: motor, value: parseInt(val) });
  publish(payload);
}

// ── CONN UI ────────────────────────────────────
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

// ── LOG ────────────────────────────────────────
function log(type, dir, extra) {
  const box = document.getElementById('log');
  const now = new Date();
  const ts  = [now.getHours(), now.getMinutes(), now.getSeconds()]
                .map(x => x.toString().padStart(2, '0')).join(':');

  const line = document.createElement('div');
  line.className = 'log-line';
  line.innerHTML =
    `<span class="log-ts">${ts}</span>` +
    `<span class="log-dir log-dir-${type}">[${type}]</span>` +
    `<span class="log-extra">${dir}${extra ? ' — ' + extra : ''}</span>`;

  box.appendChild(line);
  box.scrollTop = box.scrollHeight;
  if (box.children.length > 80) box.removeChild(box.firstChild);
}

function clearLog() {
  document.getElementById('log').innerHTML = '';
}

// ── KEYBOARD ───────────────────────────────────
document.addEventListener('keydown', e => {
  const map = {
    ArrowUp:    'maju',
    ArrowDown:  'mundur',
    ArrowLeft:  'kiri',
    ArrowRight: 'kanan',
    ' ':        'stop',
  };
  if (map[e.key]) { e.preventDefault(); pressCmd(map[e.key]); }
});

document.addEventListener('keyup', e => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
    pressCmd('stop');
  }
});

// ── INIT ───────────────────────────────────────
(function init() {
  document.getElementById('pct-a').textContent = pct(speedA()) + '%';
  document.getElementById('pct-b').textContent = pct(speedB()) + '%';
  initSSLBadge();
  log('SYS', 'Dashboard siap', isPageSecure() ? 'Mode: WSS (HTTPS detected)' : 'Mode: WS (HTTP)');
})();
