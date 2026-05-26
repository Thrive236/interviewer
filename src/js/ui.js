// ============================================================
// UI — DOM 操作、消息渲染、按钮切换
// ============================================================

// ---- DOM Refs (lazy-init) ----
let _refs = {};
export function $ (id) {
  if (!_refs[id]) _refs[id] = document.getElementById(id);
  return _refs[id];
}

export function initDOMRefs() {
  const ids = [
    'transcript', 'mainScroll', 'timerBar', 'timerDisplay', 'stepIndicator',
    'answerInput', 'btnStart', 'btnDone', 'btnSkip', 'btnRow', 'micBtn',
    'scoreOverlay', 'scoreReport',
    'settingsModal', 'historyModal', 'bankSelector',
    'bankToast', 'bankTabs', 'customQList', 'customQCount',
    'folderTabs', 'historyList', 'aiPanel', 'aiContent',
    'aiBtnRow', 'aiBtnNext', 'aiBtnBack', 'aiBtnImport',
    'aiStepBar', 'aiStep1', 'aiStep2', 'aiStep3',
    'bankCardClassic', 'bankCardCustom', 'customArea',
    'classicArea', 'classicQList', 'classicQCount', 'classicTabs', 'btnClassicSelect',
    'customQInput', 'topFixed', 'bottomBar', 'btnBank'
  ];
  ids.forEach(id => { _refs[id] = document.getElementById(id); });
}

// ---- Messages ----
export function addMsg(type, html, isMe) {
  const transcript = $('transcript');
  const row = document.createElement('div');
  row.className = 'msg-row' + (isMe ? ' me' : '');

  if (!isMe) {
    const av = document.createElement('div');
    av.className = 'avatar';
    av.textContent = '\uD83C\uDF93'; // 🎓
    row.appendChild(av);
  }

  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  bubble.innerHTML = html;
  row.appendChild(bubble);

  if (isMe) {
    const av = document.createElement('div');
    av.className = 'avatar';
    av.textContent = '\uD83D\uDC64'; // 👤
    row.appendChild(av);
  }

  transcript.appendChild(row);
  scrollToBottom();
  return row;
}

export function addSys(html) {
  const transcript = $('transcript');
  const d = document.createElement('div');
  d.className = 'msg-system';
  d.innerHTML = html;
  transcript.appendChild(d);
  scrollToBottom();
  return d;
}

export function addInt(html) {
  return addMsg('interviewer', html, false);
}

export function addCand(text) {
  return addMsg('candidate', text, true);
}

export function showQCard(type, question) {
  return `<div class="question-card"><h3>\uD83D\uDCDD ${type}</h3><p>${escHtml(question)}</p></div>`;
}

export function showLoading(text) {
  const transcript = $('transcript');
  const d = document.createElement('div');
  d.className = 'loading';
  d.id = 'loadMsg';
  d.innerHTML = `<p style="font-size:1.3rem;font-family:var(--font-title);color:var(--accent2);margin-bottom:20px">正在打分中</p><div class="progress-bar"><div class="progress-fill"></div></div><p style="margin-top:8px">${text}</p>`;
  transcript.appendChild(d);
  scrollToBottom();
}

export function hideLoading() {
  const e = $('loadMsg');
  if (e) e.remove();
}

function scrollToBottom() {
  const ms = $('mainScroll');
  if (ms) ms.scrollTop = ms.scrollHeight;
}

// ---- Step Indicator ----
export function setStep(num, desc) {
  const si = $('stepIndicator');
  if (si) si.textContent = `第${num}步：${desc}`;
}

// ---- Timer Bar ----
export function showTimer(show) {
  const tb = $('timerBar');
  const ms = $('mainScroll');
  if (show) {
    if (tb) tb.classList.add('visible');
    if (ms) ms.classList.remove('no-timer');
  } else {
    if (tb) tb.classList.remove('visible');
    if (ms) ms.classList.add('no-timer');
  }
}

// ---- Buttons ----
export function showBtns(ids) {
  const all = ['btnStart', 'btnDone', 'btnSkip'];
  all.forEach(id => {
    const el = $(id);
    if (el) el.style.display = 'none';
  });
  ids.forEach(id => {
    const el = $(id);
    if (el) el.style.display = '';
  });
}

// ---- Input ----
export function enableInput(yes) {
  const ai = $('answerInput');
  const mb = $('micBtn');
  if (ai) ai.disabled = !yes;
  if (mb) mb.disabled = !yes;
  if (!yes) {
    if (ai) ai.value = '';
  }
}

// ---- Score Report ----
export function showScoreLoading() {
  const so = $('scoreOverlay');
  const sr = $('scoreReport');
  if (so) so.classList.add('show');
  if (sr) {
    sr.innerHTML = `<div class="score-loading"><p style="font-size:1.3rem;font-family:var(--font-title);color:var(--accent2);margin-bottom:20px">正在打分中</p><div class="progress-bar"><div class="progress-fill"></div></div><p style="font-size:1.1rem">正在打分中</p><p style="font-size:0.8rem;color:var(--muted);margin-top:4px">7位考官评审中，请稍候...</p></div>`;
  }
}

export function closeScoreReport() {
  const so = $('scoreOverlay');
  if (so) so.classList.remove('show');
}

export function buildErrorReport(msg) {
  return `<div class="score-loading"><p style="color:var(--danger);font-size:1rem">${msg}</p><div style="margin-top:16px"><button class="btn btn-outline" onclick="window._closeScore()" style="max-width:160px;margin:0 auto">关闭</button></div></div>`;
}

// ---- Modal helpers ----
export function showSettings() {
  const m = $('settingsModal');
  if (m) m.classList.add('show');
}

export function closeSettings() {
  const m = $('settingsModal');
  if (m) m.classList.remove('show');
}

export function showHistory() {
  const m = $('historyModal');
  if (m) m.classList.add('show');
}

export function closeHistory() {
  const m = $('historyModal');
  if (m) m.classList.remove('show');
}

// ---- Bank display helpers ----
export function showBankSelector(firstTime) {
  const overlay = $('bankSelector');
  if (!overlay) return;
  overlay.classList.add('show');
}

export function hideBankSelector() {
  const overlay = $('bankSelector');
  if (overlay) overlay.classList.remove('show');
}

export function showBankToast(msg) {
  const toast = $('bankToast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 2500);
}

export function updateBankIcon() {
  const btn = $('btnBank');
  if (!btn) return;
  const bank = (typeof getCurrentBank === 'function') ? getCurrentBank() : localStorage.getItem('currentBank') || 'classic';
  btn.textContent = bank === 'classic' ? '\uD83D\uDCDA' : '\uD83D\uDCDD';
}

// ---- Utility ----
export function escHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}
