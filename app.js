/* ============================================================
   VAULTX — Cyberpunk Password Manager
   app.js
   ============================================================ */

'use strict';

/* ── Storage keys ─────────────────────────────────────────── */
const PATTERN_KEY = 'vaultx_pattern';
const DATA_KEY    = 'vaultx_data';

/* ── State ────────────────────────────────────────────────── */
let patternDots = [];
let drawing     = false;
let lockMode    = 'unlock';
let sortAZ      = true;
let activeCat   = 'all';
let showFPw     = false;
let editId      = null;
const DOT_POS   = [];

const genOpts = { upper: true, lower: true, nums: true, syms: false };

/* ── DOM refs ─────────────────────────────────────────────── */
const grid      = document.getElementById('pattern-grid');
const canvas    = document.getElementById('pat-canvas');
const ctx       = canvas.getContext('2d');

/* ============================================================
   LOCAL STORAGE HELPERS
   ============================================================ */
function loadData() {
  try { return JSON.parse(localStorage.getItem(DATA_KEY) || '[]'); }
  catch { return []; }
}

function saveData(data) {
  localStorage.setItem(DATA_KEY, JSON.stringify(data));
}

function loadPattern() {
  return localStorage.getItem(PATTERN_KEY) || null;
}

function savePattern(p) {
  localStorage.setItem(PATTERN_KEY, p);
}

/* ============================================================
   PATTERN LOCK
   ============================================================ */
function initPatternGrid() {
  grid.innerHTML = '';

  for (let i = 0; i < 9; i++) {
    const wrap = document.createElement('div');
    wrap.className = 'dot-wrap';
    wrap.dataset.i = i;

    const dot = document.createElement('div');
    dot.className = 'dot';
    dot.id = 'dot' + i;

    wrap.appendChild(dot);
    grid.appendChild(wrap);
  }

  // Measure dot positions after layout
  setTimeout(() => {
    const wraps = grid.querySelectorAll('.dot-wrap');
    const gr    = grid.getBoundingClientRect();
    wraps.forEach((w, i) => {
      const r = w.getBoundingClientRect();
      DOT_POS[i] = {
        x: r.left - gr.left + r.width  / 2,
        y: r.top  - gr.top  + r.height / 2
      };
    });
  }, 200);

  // Mouse events
  grid.addEventListener('mousedown', startDraw);
  grid.addEventListener('mousemove', moveDraw);
  document.addEventListener('mouseup', endDraw);

  // Touch events
  grid.addEventListener('touchstart', e => { e.preventDefault(); startDraw(e.touches[0]); }, { passive: false });
  grid.addEventListener('touchmove',  e => { e.preventDefault(); moveDraw(e.touches[0]);  }, { passive: false });
  document.addEventListener('touchend', e => { if (drawing) { e.preventDefault(); endDraw(); } }, { passive: false });
}

function getClosestDot(clientX, clientY) {
  const gr = grid.getBoundingClientRect();
  const lx = clientX - gr.left;
  const ly = clientY - gr.top;
  for (let i = 0; i < 9; i++) {
    const p = DOT_POS[i];
    if (p && Math.hypot(lx - p.x, ly - p.y) < 28) return i;
  }
  return -1;
}

function startDraw(e) {
  drawing = true;
  patternDots = [];
  clearDots();
  drawLines([]);
  const i = getClosestDot(e.clientX, e.clientY);
  if (i >= 0) addDot(i);
}

function moveDraw(e) {
  if (!drawing) return;
  const i = getClosestDot(e.clientX, e.clientY);
  if (i >= 0 && !patternDots.includes(i)) addDot(i);
  const gr = grid.getBoundingClientRect();
  drawLines(patternDots, [e.clientX - gr.left, e.clientY - gr.top]);
}

function endDraw() {
  if (!drawing) return;
  drawing = false;
  drawLines(patternDots);

  if (patternDots.length < 4) {
    setStatus('Connect at least 4 dots', 'hint');
    clearAfter();
    return;
  }

  const pat   = patternDots.join('-');
  const saved = loadPattern();

  if (lockMode === 'set') {
    savePattern(pat);
    setStatus('Pattern saved! ✓', 'ok');
    setTimeout(() => setLockMode('unlock'), 900);

  } else {
    if (!saved) {
      savePattern(pat);
      setStatus('Pattern set! Unlocking...', 'ok');
      setTimeout(() => unlockApp(), 600);
    } else if (pat === saved) {
      setStatus('Unlocked! ✓', 'ok');
      setTimeout(() => unlockApp(), 400);
    } else {
      patternDots.forEach(i => document.getElementById('dot' + i).classList.add('error'));
      setStatus('Wrong pattern — try again', 'err');
      clearAfter();
    }
  }
}

function addDot(i) {
  patternDots.push(i);
  document.getElementById('dot' + i).classList.add('active');
}

function clearDots() {
  for (let i = 0; i < 9; i++) {
    document.getElementById('dot' + i).className = 'dot';
  }
}

function clearAfter() {
  setTimeout(() => {
    clearDots();
    drawLines([]);
    setStatus('Connect at least 4 dots', 'hint');
  }, 800);
}

function setStatus(msg, type) {
  const s = document.getElementById('pat-status');
  s.textContent = msg;
  s.className = 'pattern-status ' + type;
}

function drawLines(dots, cur) {
  ctx.clearRect(0, 0, 220, 220);
  if (dots.length < 1) return;

  ctx.strokeStyle = 'rgba(0,255,231,0.65)';
  ctx.lineWidth   = 2.5;
  ctx.lineCap     = 'round';
  ctx.lineJoin    = 'round';
  ctx.beginPath();

  dots.forEach((d, idx) => {
    const p = DOT_POS[d];
    if (!p) return;
    idx === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
  });

  if (cur && dots.length > 0) ctx.lineTo(cur[0], cur[1]);
  ctx.stroke();
}

function setLockMode(mode) {
  lockMode = mode;
  document.getElementById('btn-unlock').className = 'lock-mode-btn' + (mode === 'unlock' ? ' active' : '');
  document.getElementById('btn-setpat').className = 'lock-mode-btn' + (mode === 'set'    ? ' active' : '');
  document.getElementById('lock-subtitle').textContent =
    mode === 'set' ? 'Draw New Pattern' : 'Draw Pattern to Unlock';
  clearDots();
  drawLines([]);
  setStatus('Connect at least 4 dots', 'hint');
  patternDots = [];
}

function unlockApp() {
  document.getElementById('lock-screen').style.display = 'none';
  const main = document.getElementById('main-app');
  main.style.display = 'flex';
  renderStats();
  renderCats();
  renderList();
}

function lockApp() {
  document.getElementById('main-app').style.display = 'none';
  document.getElementById('lock-screen').style.display = 'flex';
  clearDots();
  drawLines([]);
  patternDots = [];
  setStatus('Connect at least 4 dots', 'hint');
  setLockMode('unlock');
}

/* ============================================================
   HELPERS
   ============================================================ */
const CAT_LABEL = { social: 'Social', banking: 'Banking', email: 'Email', app: 'App', other: 'Other' };
const CAT_ICON  = { social: '🌐',     banking: '🏦',      email: '📧',   app: '📱',  other: '🔑'    };

function catLabel(c) { return CAT_LABEL[c] || 'Other'; }
function catIcon(c)  { return CAT_ICON[c]  || '🔑';    }
function maskPw(pw)  { return pw ? '•'.repeat(Math.min(pw.length, 14)) : ''; }

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

/* ============================================================
   STATS
   ============================================================ */
function renderStats() {
  const data = loadData();
  const cats = new Set(data.map(e => e.cat));
  document.getElementById('stats-bar').innerHTML = `
    <div class="stat">
      <div class="stat-val">${data.length}</div>
      <div class="stat-label">Total</div>
    </div>
    <div class="stat">
      <div class="stat-val">${cats.size}</div>
      <div class="stat-label">Categories</div>
    </div>
    <div class="stat">
      <div class="stat-val">${data.filter(e => e.url).length}</div>
      <div class="stat-label">Linked</div>
    </div>
  `;
}

/* ============================================================
   CATEGORY CHIPS
   ============================================================ */
function renderCats() {
  const data    = loadData();
  const allCats = ['all', ...new Set(data.map(e => e.cat))];
  document.getElementById('cats').innerHTML = allCats.map(cat => `
    <div class="cat-chip${activeCat === cat ? ' on' : ''}" onclick="setCat('${cat}')">
      ${cat === 'all' ? 'All' : catIcon(cat) + ' ' + catLabel(cat)}
    </div>
  `).join('');
}

function setCat(cat) {
  activeCat = cat;
  renderCats();
  renderList();
}

/* ============================================================
   VAULT LIST
   ============================================================ */
const shownPws = {};

function renderList() {
  let data = loadData();
  const q  = document.getElementById('search').value.trim().toLowerCase();

  if (q) data = data.filter(e =>
    e.title.toLowerCase().includes(q) || e.user.toLowerCase().includes(q)
  );

  if (activeCat !== 'all') data = data.filter(e => e.cat === activeCat);
  if (sortAZ) data = [...data].sort((a, b) => a.title.localeCompare(b.title));

  const list = document.getElementById('vault-list');

  if (!data.length) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔐</div>
        <div>VAULT EMPTY</div>
        <div style="font-size:11px;opacity:0.5;margin-top:4px;">Add your first entry below</div>
      </div>`;
    return;
  }

  list.innerHTML = data.map(e => `
    <div class="entry-card ${e.cat}">
      <div class="entry-top">
        <div class="entry-icon">${catIcon(e.cat)}</div>
        <div class="entry-info">
          <div class="entry-title">${esc(e.title)}</div>
          <div class="entry-user">${esc(e.user)}</div>
        </div>
        <span class="entry-cat cat-${e.cat}">${catLabel(e.cat)}</span>
      </div>
      <div class="entry-pw-row">
        <div class="pw-display" id="pw-disp-${e.id}">${maskPw(e.pw)}</div>
        <div class="pw-actions">
          <button class="pw-btn"     onclick="toggleEntryPw('${e.id}')"  title="Show/Hide">👁</button>
          <button class="pw-btn"     id="cpbtn-${e.id}" onclick="copyPw('${e.id}')" title="Copy">📋</button>
          ${e.url ? `<button class="pw-btn" onclick="window.open('${esc(e.url)}','_blank')" title="Open">🔗</button>` : ''}
          <button class="pw-btn"     onclick="editEntry('${e.id}')" title="Edit">✏️</button>
          <button class="pw-btn del" onclick="delEntry('${e.id}')"  title="Delete">🗑</button>
        </div>
      </div>
    </div>
  `).join('');
}

function toggleEntryPw(id) {
  const entry = loadData().find(x => x.id === id);
  if (!entry) return;
  shownPws[id] = !shownPws[id];
  document.getElementById('pw-disp-' + id).textContent =
    shownPws[id] ? entry.pw : maskPw(entry.pw);
}

function copyPw(id) {
  const entry = loadData().find(x => x.id === id);
  if (!entry) return;
  navigator.clipboard.writeText(entry.pw).then(() => {
    const btn = document.getElementById('cpbtn-' + id);
    btn.textContent = '✅';
    btn.classList.add('copy-ok');
    showToast('Password copied!');
    setTimeout(() => { btn.textContent = '📋'; btn.classList.remove('copy-ok'); }, 1500);
  });
}

function delEntry(id) {
  if (!confirm('Delete this entry?')) return;
  saveData(loadData().filter(e => e.id !== id));
  renderStats(); renderCats(); renderList();
}

function toggleSort() {
  sortAZ = !sortAZ;
  document.getElementById('sort-btn').textContent = sortAZ ? 'A-Z' : 'Latest';
  renderList();
}

/* ============================================================
   ADD / EDIT MODAL
   ============================================================ */
function openAdd() {
  editId = null;
  ['f-title', 'f-user', 'f-pw', 'f-url'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('f-pw').type   = 'password';
  document.getElementById('f-cat').value = 'social';
  document.getElementById('modal-title').textContent = 'NEW ENTRY';
  document.getElementById('strength-fill').style.width = '0';
  document.getElementById('strength-label').textContent = '';
  showFPw = false;
  showModal('add-modal');
}

function closeAdd() {
  hideModal('add-modal');
  editId = null;
}

function editEntry(id) {
  const entry = loadData().find(x => x.id === id);
  if (!entry) return;
  editId = id;
  document.getElementById('f-title').value = entry.title;
  document.getElementById('f-user').value  = entry.user;
  document.getElementById('f-pw').value    = entry.pw;
  document.getElementById('f-pw').type     = 'password';
  document.getElementById('f-url').value   = entry.url || '';
  document.getElementById('f-cat').value   = entry.cat;
  document.getElementById('modal-title').textContent = 'EDIT ENTRY';
  showFPw = false;
  updateStrength();
  showModal('add-modal');
}

function saveEntry() {
  const title = document.getElementById('f-title').value.trim();
  const user  = document.getElementById('f-user').value.trim();
  const pw    = document.getElementById('f-pw').value;
  const url   = document.getElementById('f-url').value.trim();
  const cat   = document.getElementById('f-cat').value;

  if (!title || !user || !pw) {
    showToast('Fill all required fields', 'error');
    return;
  }

  let data = loadData();

  if (editId) {
    const idx = data.findIndex(e => e.id === editId);
    if (idx >= 0) data[idx] = { ...data[idx], title, user, pw, url, cat };
  } else {
    data.push({
      id:      Date.now().toString(36) + Math.random().toString(36).slice(2),
      title, user, pw, url, cat,
      created: Date.now()
    });
  }

  saveData(data);
  closeAdd();
  renderStats(); renderCats(); renderList();
  showToast(editId ? 'Entry updated!' : 'Entry saved!');
}

function toggleFPw() {
  showFPw = !showFPw;
  document.getElementById('f-pw').type = showFPw ? 'text' : 'password';
}

function genAndFill() {
  document.getElementById('f-pw').value = generatePassword();
  updateStrength();
}

function updateStrength() {
  const pw = document.getElementById('f-pw').value;
  let score = 0;
  if (pw.length >= 8)  score++;
  if (pw.length >= 12) score++;
  if (pw.length >= 16) score++;
  if (/[A-Z]/.test(pw))       score++;
  if (/[a-z]/.test(pw))       score++;
  if (/[0-9]/.test(pw))       score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;

  const pct    = Math.min(100, Math.round(score / 7 * 100));
  const colors = ['#ff3366', '#ff6600', '#ffaa00', '#00ccff', '#00ffaa'];
  const labels = ['Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'];
  const idx    = Math.min(4, Math.floor(pct / 21));

  const fill  = document.getElementById('strength-fill');
  const label = document.getElementById('strength-label');
  fill.style.width      = pct + '%';
  fill.style.background = colors[idx];
  label.textContent     = pw.length ? labels[idx] : '';
  label.style.color     = colors[idx];
}

document.getElementById('f-pw').addEventListener('input', updateStrength);

/* ============================================================
   PASSWORD GENERATOR
   ============================================================ */
function generatePassword() {
  const len = parseInt(document.getElementById('gen-len').value) || 16;
  let chars = '';
  if (genOpts.upper) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (genOpts.lower) chars += 'abcdefghijklmnopqrstuvwxyz';
  if (genOpts.nums)  chars += '0123456789';
  if (genOpts.syms)  chars += '!@#$%^&*()_+-=[]{}|;:,.<>?';
  if (!chars) chars = 'abcdefghijklmnopqrstuvwxyz0123456789';

  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => chars[b % chars.length]).join('');
}

function generatePw() {
  document.getElementById('gen-pw-display').textContent = generatePassword();
}

function toggleGenOpt(key, btn) {
  genOpts[key] = !genOpts[key];
  btn.className = 'gen-toggle' + (genOpts[key] ? ' on' : '');
  generatePw();
}

function openGen() {
  showModal('gen-modal');
  generatePw();
}

function closeGen() {
  hideModal('gen-modal');
}

function copyGen() {
  const pw = document.getElementById('gen-pw-display').textContent;
  if (!pw || pw === 'Click generate ↓') return;
  navigator.clipboard.writeText(pw).then(() => showToast('Password copied!'));
}

/* ============================================================
   AUTOFILL
   ============================================================ */
function openAutoFill() {
  const data = loadData();
  const list = document.getElementById('af-list');

  if (!data.length) {
    list.innerHTML = `
      <div style="text-align:center;color:var(--text3);font-family:var(--mono);
                  font-size:13px;padding:20px;letter-spacing:2px;">
        VAULT IS EMPTY
      </div>`;
  } else {
    list.innerHTML = data.map(e => `
      <div class="autofill-row" onclick="afCopy('${e.id}')">
        <div style="font-size:22px;">${catIcon(e.cat)}</div>
        <div class="autofill-info">
          <div class="autofill-site">${esc(e.title)}</div>
          <div class="autofill-user">${esc(e.user)}</div>
        </div>
        <span class="autofill-copy-label">COPY ⚡</span>
      </div>
    `).join('');
  }

  showModal('af-modal');
}

function closeAutoFill() {
  hideModal('af-modal');
}

function afCopy(id) {
  const entry = loadData().find(x => x.id === id);
  if (!entry) return;
  navigator.clipboard.writeText(entry.pw).then(() => {
    showToast('Copied: ' + entry.title);
    closeAutoFill();
  });
}

/* ============================================================
   MODAL HELPERS
   ============================================================ */
function showModal(id) {
  const el = document.getElementById(id);
  el.style.display = 'flex';
}

function hideModal(id) {
  document.getElementById(id).style.display = 'none';
}

// Close modal on background tap
document.querySelectorAll('.modal-bg').forEach(bg => {
  bg.addEventListener('click', e => {
    if (e.target === bg) bg.style.display = 'none';
  });
});

/* ============================================================
   TOAST
   ============================================================ */
function showToast(msg, type = 'success') {
  const old = document.getElementById('_toast');
  if (old) old.remove();

  const t = document.createElement('div');
  t.className = 'toast' + (type === 'error' ? ' error' : '');
  t.id = '_toast';
  t.textContent = msg;
  document.body.appendChild(t);

  setTimeout(() => { if (t.parentNode) t.remove(); }, 2400);
}

/* ============================================================
   INIT
   ============================================================ */
initPatternGrid();