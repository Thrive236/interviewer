// ============================================================
// History — 练习历史 + 文件夹管理
// ============================================================

import { getHist, setHist, getFolders, setFolders, setTypeCounters } from './storage.js';
import { $, escHtml } from './ui.js';
import { closeHistory } from './ui.js';
import { typeOrder } from '../data/classic-bank.js';
import { addSys, addInt, addCand, showQCard } from './ui.js';
import { renderScoreReport } from './report.js';

let _histFilter = '';

// ---- 保存记录 ----
export function saveHistory(h) {
  const hist = getHist();
  h.id = h.id || Date.now();
  h.name = h.name || h.date;
  h.folderId = h.folderId || '';
  hist.unshift(h);
  setHist(hist);
}

// ---- 加载历史列表 ----
export function loadHistory() {
  migrateHist();
  const fullHist = getHist();
  const hist = _histFilter ? fullHist.filter(h => h.folderId === _histFilter) : fullHist;

  renderFolders();

  const list = $('historyList');
  if (!list) return;

  if (!hist.length) {
    list.innerHTML = '<div style="color:var(--muted);text-align:center;padding:20px">暂无记录</div>';
    return;
  }

  list.innerHTML = hist.map((h, i) => {
    const realIdx = fullHist.findIndex(x => x.id === h.id);
    const sc = h.score !== null
      ? `<span class="score">${h.score.toFixed(2)}分</span>`
      : '<span style="color:var(--danger)">0分(超时)</span>';
    const folder = h.folderId
      ? ((getFolders().find(f => f.id === h.folderId) || {}).name || '?')
      : '';
    return `<div class="history-item" onclick="window._viewHist(${realIdx})">
      <span class="hist-name" id="hn-${h.id}">${escHtml(h.name)}</span>
      <span class="date">${h.date}</span> ${sc} <span style="color:var(--muted);font-size:0.72rem">${h.q1Type}+${h.q2Type}</span>${folder ? ` <span style="color:var(--info);font-size:0.68rem">📁${escHtml(folder)}</span>` : ''}
      <div class="hist-actions" onclick="event.stopPropagation()">
        <button class="hist-act" onclick="window._moveItem(${realIdx})" title="移动到文件夹">📂</button>
        <button class="hist-act" onclick="window._renameItem(${realIdx})" title="重命名">✏️</button>
        <button class="hist-act del" onclick="window._deleteItem(${realIdx})" title="删除">🗑</button>
      </div>
    </div>`;
  }).join('');
}

function migrateHist() {
  const hist = getHist();
  let changed = false;
  hist.forEach((h, i) => {
    if (!h.id) {
      h.id = Date.now() - i;
      h.name = h.name || h.date;
      changed = true;
    }
  });
  if (changed) setHist(hist);
}

// ---- Folders ----
function renderFolders() {
  const tabs = $('folderTabs');
  if (!tabs) return;

  const folders = getFolders();
  let html = `<button class="folder-tab${_histFilter ? '' : ' active'}" onclick="window._filterHist('')">全部</button>`;
  folders.forEach(f => {
    html += `<button class="folder-tab${_histFilter === f.id ? ' active' : ''}" onclick="window._filterHist('${f.id}')">📁 ${escHtml(f.name)}</button>`;
  });
  html += '<button class="folder-tab add" id="btnNewFolder" onclick="window._startCreateFolder()">+ 新建</button>';
  tabs.innerHTML = html;
}

export function filterHist(fid) {
  _histFilter = fid;
  loadHistory();
}

export function startCreateFolder() {
  const btn = $('btnNewFolder');
  if (!btn) return;

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'folder-tab-input';
  input.placeholder = '文件夹名...';
  btn.replaceWith(input);
  input.focus();

  function finish() {
    const name = input.value.trim();
    if (name) {
      const folders = getFolders();
      folders.push({ id: 'f' + Date.now(), name, createdAt: new Date().toISOString() });
      setFolders(folders);
    }
    loadHistory();
  }

  input.addEventListener('blur', finish);
  input.addEventListener('keydown', ev => {
    if (ev.key === 'Enter') { ev.preventDefault(); input.blur(); }
    if (ev.key === 'Escape') { input.value = ''; input.blur(); }
  });
}

// ---- CRUD ----
export function renameItem(i) {
  const hist = getHist();
  if (!hist[i]) return;

  const span = document.getElementById('hn-' + hist[i].id);
  if (!span || span.classList.contains('editing')) return;

  const origText = span.textContent;
  span.contentEditable = 'true';
  span.classList.add('editing');
  span.focus();

  const range = document.createRange();
  range.selectNodeContents(span);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);

  function finish() {
    span.contentEditable = 'false';
    span.classList.remove('editing');
    span.removeEventListener('blur', onBlur);
    span.removeEventListener('keydown', onKey);
    const newName = span.textContent.trim();
    if (!newName || newName === origText) {
      span.textContent = origText;
      return;
    }
    let h = getHist();
    const idx = h.findIndex(x => x.id === hist[i].id);
    if (idx < 0) return;
    h[idx].name = newName;
    setHist(h);
  }

  function onBlur() { finish(); }
  function onKey(ev) {
    if (ev.key === 'Enter') { ev.preventDefault(); span.blur(); }
    if (ev.key === 'Escape') { span.textContent = origText; span.blur(); }
  }

  span.addEventListener('blur', onBlur);
  span.addEventListener('keydown', onKey);
}

export function deleteItem(i) {
  const hist = getHist();
  if (!hist[i]) return;
  hist.splice(i, 1);
  setHist(hist);
  loadHistory();
}

export function moveItem(i) {
  const hist = getHist();
  if (!hist[i]) return;
  const folders = getFolders();

  let menu = document.getElementById('moveMenu');
  if (!menu) {
    menu = document.createElement('div');
    menu.id = 'moveMenu';
    menu.className = 'move-menu';
    menu.style.cssText = 'display:none;position:fixed;bottom:0;left:0;right:0;z-index:300;background:var(--card-solid);border-radius:16px 16px 0 0;padding:16px;max-height:55vh;overflow-y:auto;border-top:1px solid var(--border);box-shadow:0 -4px 20px rgba(0,0,0,0.5);';
    document.body.appendChild(menu);

    const bd = document.createElement('div');
    bd.id = 'moveBackdrop';
    bd.style.cssText = 'display:none;position:fixed;inset:0;z-index:299;background:rgba(0,0,0,0.5);';
    bd.onclick = () => { menu.style.display = 'none'; bd.style.display = 'none'; };
    document.body.appendChild(bd);
  }

  const bd = document.getElementById('moveBackdrop');
  let html = '<div style="font-weight:600;margin-bottom:12px;font-size:0.9rem">移动到...</div>';
  html += `<div class="move-opt" onclick="window._doMove(${i},'')" style="padding:12px 8px;font-size:0.85rem;border-radius:8px;cursor:pointer;">📋 取消归类（显示在全部）</div>`;
  folders.forEach(f => {
    html += `<div class="move-opt" onclick="window._doMove(${i},'${f.id}')" style="padding:12px 8px;font-size:0.85rem;border-radius:8px;cursor:pointer;">📁 ${escHtml(f.name)}</div>`;
  });
  html += `<div class="move-opt" onclick="window._createFolderAndMove(${i})" style="padding:12px 8px;font-size:0.85rem;border-radius:8px;cursor:pointer;color:var(--accent)">+ 新建文件夹并移入</div>`;
  html += '<div style="margin-top:8px;padding:12px;text-align:center;color:var(--muted);cursor:pointer;border-top:1px solid var(--border)" onclick="window._closeMoveMenu()">取消</div>';
  menu.innerHTML = html;
  menu.style.display = 'block';
  bd.style.display = 'block';
}

export function closeMoveMenu() {
  const m = document.getElementById('moveMenu');
  const b = document.getElementById('moveBackdrop');
  if (m) m.style.display = 'none';
  if (b) b.style.display = 'none';
}

export function doMove(i, fid) {
  const hist = getHist();
  if (!hist[i]) return;
  hist[i].folderId = fid;
  setHist(hist);
  closeMoveMenu();
  loadHistory();
}

export function createFolderAndMove(i) {
  const name = prompt('新文件夹名称');
  if (!name || !name.trim()) return;
  const folders = getFolders();
  const fid = 'f' + Date.now();
  folders.push({ id: fid, name: name.trim(), createdAt: new Date().toISOString() });
  setFolders(folders);
  doMove(i, fid);
}

// ---- 查看历史 ----
export function viewHist(i) {
  const hist = getHist();
  const h = hist[i];
  if (!h) return;

  closeHistory();
  const transcript = $('transcript');
  if (transcript) transcript.innerHTML = '';

  addSys(`📋 历史记录 — ${h.name || h.date}`);
  addInt(showQCard(`${h.q1Type}类`, h.q1));
  addCand(h.a1);
  addInt(showQCard(`${h.q2Type}类`, h.q2));
  addCand(h.a2);
  renderScoreReport(h.results);
}

// ---- 清空 ----
export function clearHistory() {
  const hist = getHist();
  if (!hist.length) return;
  const n = _histFilter ? '当前文件夹内的' : '所有';
  if (!confirm(`确认清空${n}练习记录？此操作不可恢复。`)) return;

  if (_histFilter) {
    setHist(hist.filter(h => h.folderId !== _histFilter));
    const folders = getFolders().filter(f => f.id !== _histFilter);
    setFolders(folders);
    _histFilter = '';
  } else {
    localStorage.removeItem('ivHist');
    localStorage.removeItem('ivFolders');
    const counters = {};
    typeOrder.forEach(t => { counters[t] = 0; });
    setTypeCounters(counters);
  }
  loadHistory();
}
