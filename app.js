/* =============================================
   ESP32 Motor Dashboard — app.js
   Auto WSS (Vercel/HTTPS) | WS (localhost)
   ============================================= */

let client = null;
let conn   = false;
let cur    = 'stop';

const pct = v => Math.round(v / 255 * 100);
const sA  = () => +document.getElementById('spd-a').value;
const sB  = () => +document.getElementById('spd-b').value;

// ── CONNECT / DISCONNECT ──────────────────────
function toggleConn() {
  conn ? disconnect() : connect();
}

function connect() {
  const host = document.getElementById('host').value.trim();

  // AUTO: wss:// di Vercel/HTTPS, ws:// di localhost
  const isSecure = location.protocol === 'https:';
  const port     = isSecure ? 8084 : 8083;
  const url      = `${isSecure ? 'wss' : 'ws'}://${host}:${port}/mqtt`;

  const id = 'dash_' + Math.random().toString(36).slice(2, 8);

  addLog('SYS', 'sys', `Menghubungkan → ${url}`);

  client = mqtt.connect(url, {
    clientId:        id,
    keepalive:       30,
    connectTimeout:  8000,
    reconnectPeriod: 0,   // matikan auto-reconnect, biar user kontrol
    clean:           true,
  });

  client.on('connect', () => {
    conn = true;
    setUI();
    const t = document.getElementById('tstat').value.trim();
    client.subscribe(t, { qos: 0 });
    addLog('SUB', 'sub', `Subscribe: ${t}`);
  });

  client.on('error', e => {
    addLog('ERR', 'err', e.message || 'Connection error');
    setUI(true);
  });

  client.on('close', () => {
    if (conn) {
      conn = false;
      setUI();
      addLog('SYS', 'sys', 'Koneksi terputus');
    }
  });

  client.on('message', (topic, payload) => {
    try {
      const d = JSON.parse(payload.toString());
      addLog('RCV', 'rcv',
        `${(d.state || '?').toUpperCase()} — A:${pct(d.speedA || 0)}% B:${pct(d.speedB || 0)}%`
      );
    } catch {
      addLog('RCV', 'rcv', payload.toString().slice(0, 60));
    }
  });
}

function disconnect() {
  client && client.end(true);
  conn = false;
  setUI();
  addLog('SYS', 'sys', 'Terputus manual');
}

// ── PUBLISH ───────────────────────────────────
function pub(msg) {
  if (!conn) { addLog('ERR', 'err', 'Belum terhubung!'); return; }
  const topic = document.getElementById('tcmd').value.trim();
  client.publish(topic, msg, { qos: 0 });
}

// ── D-PAD ─────────────────────────────────────
function press(cmd) {
  if (cmd === cur) return;
  cur = cmd;

  document.querySelectorAll('.dpad-btn').forEach(b => b.classList.remove('pressed'));
  const b = document.getElementById('btn-' + cmd);
  if (b) {
    b.classList.add('pressed');
    if (cmd !== 'stop') setTimeout(() => b.classList.remove('pressed'), 180);
  }

  pub(cmd);
  addLog('CMD', 'cmd',
    `${cmd.toUpperCase()} — A:${cmd === 'stop' ? 0 : pct(sA())}% B:${cmd === 'stop' ? 0 : pct(sB())}%`
  );
}

function ev(e, cmd) {
  e.preventDefault();
  press(cmd);
}

// ── SPEED ─────────────────────────────────────
function onSpeed(motor, val) {
  const pctVal  = pct(val);
  const color   = motor === 'A' ? '#00ff88' : '#00ccff';
  const sliderId = 'spd-' + motor.toLowerCase();

  document.getElementById('pct-' + motor.toLowerCase()).textContent = pctVal + '%';
  document.getElementById(sliderId).style.background =
    `linear-gradient(90deg, ${color} ${pctVal}%, #1e2530 ${pctVal}%)`;

  pub(`speed${motor}:${val}`);
}

// ── UI STATE ──────────────────────────────────
function setUI(err = false) {
  const pill = document.getElementById('pill');
  const lbl  = document.getElementById('pill-label');
  const btn  = document.getElementById('btn-conn');

  pill.className    = 'pill' + (conn ? ' on' : err ? ' err' : '');
  lbl.textContent   = conn
    ? document.getElementById('host').value.toUpperCase()
    : err ? 'GAGAL' : 'TERPUTUS';
  btn.textContent   = conn ? 'DISCONNECT' : 'CONNECT';
  btn.className     = 'btn btn-conn' + (conn ? ' active' : '');
}

// ── LOG ───────────────────────────────────────
function addLog(tag, cls, msg) {
  const box = document.getElementById('log');
  const now = new Date();
  const ts  = [now.getHours(), now.getMinutes(), now.getSeconds()]
                .map(x => String(x).padStart(2, '0')).join(':');

  const line = document.createElement('div');
  line.className = 'log-line';
  line.innerHTML =
    `<span class="log-ts">${ts}</span>` +
    `<span class="log-type t-${cls}">[${tag}]</span>` +
    `<span class="log-msg">${msg}</span>`;

  box.appendChild(line);
  box.scrollTop = box.scrollHeight;
  if (box.children.length > 80) box.removeChild(box.firstChild);
}

function clearLog() {
  document.getElementById('log').innerHTML = '';
}

// ── KEYBOARD ──────────────────────────────────
document.addEventListener('keydown', e => {
  const map = {
    ArrowUp:    'maju',
    ArrowDown:  'mundur',
    ArrowLeft:  'kiri',
    ArrowRight: 'kanan',
    ' ':        'stop',
  };
  if (map[e.key]) { e.preventDefault(); press(map[e.key]); }
});

document.addEventListener('keyup', e => {
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) press('stop');
});

// ── INIT ──────────────────────────────────────
(function init() {
  document.getElementById('pct-a').textContent = pct(sA()) + '%';
  document.getElementById('pct-b').textContent = pct(sB()) + '%';
  addLog('SYS', 'sys', 'Dashboard siap — klik CONNECT untuk mulai');
})();
