/* ═══════════════════════════════════════════════════════
   NEXUS MAILER — JAVASCRIPT ENGINE
   Full email bot orchestration + UI control
═══════════════════════════════════════════════════════ */

'use strict';

// ─── STATE ─────────────────────────────────────────────
const STATE = {
  running:      false,
  paused:       false,
  recipients:   [],
  sent:         0,
  failed:       0,
  total:        0,
  startTime:    null,
  abortFlag:    false,
  sessionId:    generateId(),
  uptimeTimer:  null,
  statInterv:   null,
  dotCells:     [],
  logBuffer:    [],
  emailLog:     [],          // full send log for export
};

// ─── INIT ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initBinaryStream();
  initClock();
  initBars();
  initDotMatrix();
  initFooterDots();
  startUptimeTimer();
  document.getElementById('sessionId').textContent = 'SESSION: ' + STATE.sessionId;
  log('info', 'NEXUS_MAILER system initialised — ready for transmission');
  log('info', 'Configure SMTP credentials and load recipients to begin');
  animateStats();
});

// ─── BINARY STREAM ─────────────────────────────────────
function initBinaryStream() {
  const el = document.getElementById('binaryStream');
  function gen() {
    let s = '';
    for (let i = 0; i < 120; i++) s += Math.round(Math.random());
    el.textContent = s;
  }
  gen();
  setInterval(gen, 400);
}

// ─── CLOCK ─────────────────────────────────────────────
function initClock() {
  function tick() {
    const now = new Date();
    document.getElementById('systemTime').textContent =
      now.toTimeString().slice(0,8);
  }
  tick();
  setInterval(tick, 1000);
}

// ─── UPTIME ─────────────────────────────────────────────
function startUptimeTimer() {
  const start = Date.now();
  STATE.uptimeTimer = setInterval(() => {
    const d = Date.now() - start;
    const h = String(Math.floor(d / 3600000)).padStart(2,'0');
    const m = String(Math.floor((d % 3600000) / 60000)).padStart(2,'0');
    const s = String(Math.floor((d % 60000) / 1000)).padStart(2,'0');
    document.getElementById('uptime').textContent = `UPTIME: ${h}:${m}:${s}`;
  }, 1000);
}

// ─── BAR CHART ──────────────────────────────────────────
function initBars() {
  const container = document.getElementById('barsContainer');
  container.innerHTML = '';
  for (let i = 0; i < 14; i++) {
    const b = document.createElement('div');
    b.className = 'bar-item';
    b.style.height = Math.floor(Math.random() * 70 + 10) + '%';
    container.appendChild(b);
  }
}

function updateBars() {
  const bars = document.querySelectorAll('.bar-item');
  bars.forEach(b => {
    const pct = Math.floor(Math.random() * 70 + 10);
    b.style.height = pct + '%';
  });
}

// ─── DOT MATRIX ─────────────────────────────────────────
function initDotMatrix() {
  const matrix = document.getElementById('dotMatrix');
  matrix.innerHTML = '';
  STATE.dotCells = [];
  for (let i = 0; i < 126; i++) {
    const d = document.createElement('div');
    d.className = 'dot-cell';
    matrix.appendChild(d);
    STATE.dotCells.push(d);
  }
}

function updateDotMatrix() {
  const total = STATE.total || 1;
  const sent   = STATE.sent;
  const failed = STATE.failed;
  const dots   = STATE.dotCells.length;

  const sentDots   = Math.floor((sent   / total) * dots);
  const failDots   = Math.floor((failed / total) * dots);
  const queueDots  = Math.max(0, dots - sentDots - failDots);

  STATE.dotCells.forEach((cell, i) => {
    cell.className = 'dot-cell';
    if (i < sentDots)                     cell.classList.add('sent');
    else if (i < sentDots + failDots)     cell.classList.add('fail');
    else if (i < sentDots + failDots + Math.min(queueDots, dots - sentDots - failDots))
                                          cell.classList.add('queue');
  });
}

// ─── FOOTER DOTS ────────────────────────────────────────
function initFooterDots() {
  const container = document.getElementById('footerDots');
  for (let i = 0; i < 20; i++) {
    const d = document.createElement('div');
    d.className = 'footer-dot' + (Math.random() > 0.5 ? ' active' : '');
    container.appendChild(d);
  }
  setInterval(() => {
    document.querySelectorAll('.footer-dot').forEach(d => {
      d.classList.toggle('active', Math.random() > 0.5);
    });
  }, 800);
}

// ─── LOG ────────────────────────────────────────────────
function log(type, msg) {
  const now = new Date().toISOString().slice(11,23);
  const win = document.getElementById('logWindow');
  const line = document.createElement('div');
  line.className = `log-line ${type}`;
  line.innerHTML = `<span class="log-ts">${now}</span><span class="log-msg">${escHtml(msg)}</span>`;
  win.appendChild(line);
  win.scrollTop = win.scrollHeight;

  // Keep max 200 lines
  while (win.children.length > 200) win.removeChild(win.firstChild);
  STATE.logBuffer.push({ ts: now, type, msg });
}

function escHtml(s) {
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;');
}

// ─── STAT ANIMATION ─────────────────────────────────────
function animateStats() {
  const targets = { delivered: 0, open: 0, success: 0 };
  function tick() {
    if (!STATE.running) {
      targets.delivered = STATE.sent;
      targets.open      = Math.floor(STATE.sent * 0.55);
      targets.success   = STATE.sent - STATE.failed;
    }
    const d = document.getElementById('statDelivered');
    const o = document.getElementById('statOpen');
    const s = document.getElementById('statSuccess');
    if (d) d.textContent = targets.delivered.toLocaleString();
    if (o) o.textContent = targets.open.toLocaleString();
    if (s) s.textContent = targets.success.toLocaleString();
    document.getElementById('totalSent').textContent = `TOTAL SENT: ${STATE.sent.toLocaleString()}`;
  }
  STATE.statInterv = setInterval(tick, 500);
}

// ─── PARSE RECIPIENTS ───────────────────────────────────
function parseRecipients() {
  const raw = document.getElementById('recipients').value.trim();
  if (!raw) { log('warn', 'No recipients entered'); return; }

  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
  STATE.recipients = [];

  lines.forEach(line => {
    if (line.includes(',')) {
      const parts = line.split(',').map(p => p.trim());
      const name  = parts[0];
      const email = parts[1];
      if (isValidEmail(email)) STATE.recipients.push({ name, email });
    } else {
      if (isValidEmail(line)) STATE.recipients.push({ name: line.split('@')[0], email: line });
    }
  });

  STATE.total = STATE.recipients.length;
  document.getElementById('recipientCount').textContent = STATE.total;
  log('info', `Parsed ${STATE.total} valid recipients`);
  updateDotMatrix();
}

function clearRecipients() {
  STATE.recipients = [];
  STATE.total = 0;
  document.getElementById('recipients').value = '';
  document.getElementById('recipientCount').textContent = '0';
  initDotMatrix();
  log('info', 'Recipient list cleared');
}

function isValidEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

// ─── LOAD CSV ───────────────────────────────────────────
function loadCSV(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('recipients').value = e.target.result;
    parseRecipients();
    log('info', `CSV loaded: ${file.name}`);
  };
  reader.readAsText(file);
}

// ─── TEST CONNECTION ─────────────────────────────────────
async function testConnection() {
  const resultEl = document.getElementById('connectionResult');
  resultEl.textContent = '⟳ TESTING...';
  resultEl.className = 'connection-result';

  const cfg = getSmtpConfig();
  const mode = document.getElementById('apiMode').value;

  if (mode === 'backend') {
    try {
      const res = await fetch(document.getElementById('apiHost').value + '/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg)
      });
      const data = await res.json();
      if (data.ok) {
        resultEl.textContent = '✓ CONNECTION SUCCESSFUL';
        resultEl.className = 'connection-result ok';
        log('ok', 'SMTP connection test passed');
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (err) {
      resultEl.textContent = '✗ ' + err.message;
      resultEl.className = 'connection-result err';
      log('err', 'SMTP connection failed: ' + err.message);
    }
  } else {
    // Simulate test in frontend-only mode
    await sleep(600);
    if (cfg.host && cfg.user && cfg.pass) {
      resultEl.textContent = '✓ CONFIG VALID (FRONTEND MODE)';
      resultEl.className = 'connection-result ok';
      log('ok', 'SMTP config validated — running in simulation mode');
    } else {
      resultEl.textContent = '✗ INCOMPLETE CONFIG';
      resultEl.className = 'connection-result err';
      log('err', 'SMTP config incomplete — fill all fields');
    }
  }
}

// ─── GET CONFIG ─────────────────────────────────────────
function getSmtpConfig() {
  return {
    host:      document.getElementById('smtpHost').value.trim(),
    port:      parseInt(document.getElementById('smtpPort').value) || 587,
    user:      document.getElementById('smtpUser').value.trim(),
    pass:      document.getElementById('smtpPass').value,
    fromName:  document.getElementById('fromName').value.trim(),
    fromEmail: document.getElementById('fromEmail').value.trim(),
  };
}

// ─── START CAMPAIGN ─────────────────────────────────────
async function startCampaign() {
  if (STATE.running) return;

  if (STATE.recipients.length === 0) {
    parseRecipients();
    if (STATE.recipients.length === 0) {
      log('err', 'No valid recipients — cannot start campaign');
      return;
    }
  }

  const subject = document.getElementById('subject').value.trim();
  const body    = document.getElementById('emailBody').value.trim();
  if (!subject) { log('err', 'Subject line is required'); return; }
  if (!body)    { log('err', 'Email body is required'); return; }

  const cfg = getSmtpConfig();
  if (!cfg.host || !cfg.user || !cfg.pass) {
    log('err', 'SMTP configuration incomplete'); return;
  }

  STATE.running   = true;
  STATE.abortFlag = false;
  STATE.sent      = 0;
  STATE.failed    = 0;
  STATE.total     = STATE.recipients.length;
  STATE.startTime = Date.now();
  STATE.emailLog  = [];

  document.getElementById('startBtn').disabled = true;
  document.getElementById('stopBtn').disabled  = false;

  const batchSize  = parseInt(document.getElementById('batchSize').value) || 50;
  const delay      = parseInt(document.getElementById('delay').value)     || 200;
  const maxRetries = parseInt(document.getElementById('maxRetries').value) || 3;
  const mode       = document.getElementById('apiMode').value;

  log('ok', `▶ CAMPAIGN STARTED — ${STATE.total} recipients | batch:${batchSize} | delay:${delay}ms`);

  // Animate bars on start
  const barInterval = setInterval(updateBars, 800);

  // Process in batches
  for (let i = 0; i < STATE.recipients.length && !STATE.abortFlag; i += batchSize) {
    const batch = STATE.recipients.slice(i, i + batchSize);
    log('info', `Processing batch ${Math.floor(i/batchSize)+1} — ${batch.length} emails`);

    for (const recipient of batch) {
      if (STATE.abortFlag) break;

      const personalizedSubject = personalise(subject, recipient);
      const personalizedBody    = personalise(body, recipient);

      let success = false;
      for (let attempt = 0; attempt <= maxRetries && !success; attempt++) {
        try {
          if (mode === 'backend') {
            success = await sendViaBackend(cfg, recipient, personalizedSubject, personalizedBody);
          } else {
            success = await simulateSend(recipient, delay);
          }
        } catch (err) {
          if (attempt === maxRetries) {
            log('err', `✗ ${recipient.email} — ${err.message}`);
          }
        }
      }

      if (success) {
        STATE.sent++;
        log('ok', `✓ ${recipient.email}`);
        STATE.emailLog.push({ ts: new Date().toISOString(), email: recipient.email, name: recipient.name, status: 'sent' });
      } else {
        STATE.failed++;
        STATE.emailLog.push({ ts: new Date().toISOString(), email: recipient.email, name: recipient.name, status: 'failed' });
      }

      updateProgress();
      updateDotMatrix();
      await sleep(delay);
    }

    // Inter-batch pause
    if (!STATE.abortFlag && i + batchSize < STATE.recipients.length) {
      log('info', `Batch complete — pausing 1s before next batch`);
      await sleep(1000);
    }
  }

  clearInterval(barInterval);
  STATE.running = false;
  document.getElementById('startBtn').disabled = false;
  document.getElementById('stopBtn').disabled  = true;

  if (STATE.abortFlag) {
    log('warn', `⛔ CAMPAIGN ABORTED — sent:${STATE.sent} failed:${STATE.failed}`);
  } else {
    log('ok', `✔ CAMPAIGN COMPLETE — sent:${STATE.sent} failed:${STATE.failed} rate:${pct(STATE.sent, STATE.total)}%`);
  }

  updateCircleGauges();
}

// ─── STOP CAMPAIGN ──────────────────────────────────────
function stopCampaign() {
  STATE.abortFlag = true;
  document.getElementById('stopBtn').disabled = true;
  log('warn', 'ABORT signal sent — stopping after current email...');
}

// ─── SEND VIA BACKEND ───────────────────────────────────
async function sendViaBackend(cfg, recipient, subject, body) {
  const apiHost = document.getElementById('apiHost').value;
  const res = await fetch(apiHost + '/api/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cfg, recipient, subject, body })
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'Send failed');
  return true;
}

// ─── SIMULATE SEND (FRONTEND MODE) ──────────────────────
async function simulateSend(recipient, delay) {
  await sleep(Math.max(delay, 80));
  // 93% success rate simulation
  if (Math.random() < 0.07) throw new Error('Simulated SMTP timeout');
  return true;
}

// ─── PERSONALISE ────────────────────────────────────────
function personalise(template, recipient) {
  return template
    .replace(/\{name\}/gi,  recipient.name  || '')
    .replace(/\{email\}/gi, recipient.email || '');
}

// ─── UPDATE PROGRESS ────────────────────────────────────
function updateProgress() {
  const total    = STATE.total || 1;
  const done     = STATE.sent + STATE.failed;
  const progress = pct(done, total);

  document.getElementById('progressBar').style.width = progress + '%';
  document.getElementById('progressText').textContent = `${done} / ${STATE.total} sent`;
  document.getElementById('progressPct').textContent  = progress + '%';
  document.getElementById('queueCount').textContent   = STATE.total - done;
  document.getElementById('sendingCount').textContent = STATE.running ? 1 : 0;
  document.getElementById('doneCount').textContent    = STATE.sent;
  document.getElementById('failedCount').textContent  = STATE.failed;

  // Speed & ETA
  const elapsed  = (Date.now() - STATE.startTime) / 1000 || 1;
  const speed    = (done / elapsed).toFixed(2);
  const remaining= STATE.total - done;
  const eta      = speed > 0 ? remaining / speed : 0;
  const etaStr   = eta > 0 ? formatSecs(eta) : '--:--';

  document.getElementById('speedMeter').textContent = `${speed} emails/sec`;
  document.getElementById('etaMeter').textContent   = etaStr;

  // Block fill widths
  const queuePct   = pct(Math.max(0, STATE.total - done), STATE.total);
  const sendPct    = STATE.running ? 100 : 0;
  const donePct    = pct(STATE.sent, STATE.total);
  const failPct    = pct(STATE.failed, STATE.total);
  const fills = document.querySelectorAll('.block-fill');
  if (fills[0]) fills[0].style.width = queuePct  + '%';
  if (fills[1]) fills[1].style.width = sendPct   + '%';
  if (fills[2]) fills[2].style.width = donePct   + '%';
  if (fills[3]) fills[3].style.width = failPct   + '%';
}

function updateCircleGauges() {
  const total = STATE.total || 1;
  const deliveredPct = pct(STATE.sent, total);
  const openPct      = pct(Math.floor(STATE.sent * 0.55), total);
  const successPct   = pct(STATE.sent - STATE.failed, total);

  const circles = document.querySelectorAll('.circle-gauge .fill');
  const labels  = document.querySelectorAll('.pct-label');
  if (circles[0]) { circles[0].style.setProperty('--pct', deliveredPct); labels[0].textContent = deliveredPct + '%'; }
  if (circles[1]) { circles[1].style.setProperty('--pct', openPct);      labels[1].textContent = openPct + '%'; }
  if (circles[2]) { circles[2].style.setProperty('--pct', successPct);   labels[2].textContent = successPct + '%'; }
}

// ─── EXPORT LOG ─────────────────────────────────────────
function exportLog() {
  if (STATE.emailLog.length === 0) {
    log('warn', 'No data to export yet'); return;
  }
  const header = 'timestamp,email,name,status\n';
  const rows   = STATE.emailLog.map(r =>
    `${r.ts},"${r.email}","${r.name}","${r.status}"`
  ).join('\n');
  const blob = new Blob([header + rows], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `nexus_campaign_${STATE.sessionId}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  log('info', `Exported ${STATE.emailLog.length} records to CSV`);
}

// ─── HELPERS ────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function pct(a, b) { return Math.round((a / (b || 1)) * 100); }
function formatSecs(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}
function generateId() {
  return Math.random().toString(36).slice(2,8).toUpperCase();
}
