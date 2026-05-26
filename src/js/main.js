// ============================================================
// Main — 入口 + 事件绑定 + 初始化
// ============================================================

// ---- CSS imports ----
import '../css/variables.css';
import '../css/reset.css';
import '../css/layout.css';
import '../css/components.css';
import '../css/report.css';

// ---- JS imports ----
import { $, initDOMRefs, addSys, showSettings, closeSettings, showHistory, closeHistory,
         showBankSelector, hideBankSelector, showBankToast, updateBankIcon, closeScoreReport,
         showBtns, escHtml } from './ui.js';
import { STATES, state, setState, isIdle, isScoring } from './state.js';
import { getSettings, saveSettings, getCurrentBank, setCurrentBank,
         getCustomBanks, setCustomBanks } from './storage.js';
import { initBanks, getActiveBankObj } from './bank.js';
import { qBank, typeOrder } from '../data/classic-bank.js';
import { initNativeTTS } from './speech-out.js';
import { toggleMic, stopRecording, isRecording } from './speech-in.js';
import { startInterview, finishAnswer, skipTiming, doTimeoutReview, resetUI } from './interview.js';
import { loadHistory, viewHist, clearHistory, filterHist, startCreateFolder,
         renameItem, deleteItem, moveItem, doMove, createFolderAndMove, closeMoveMenu } from './history.js';
import { toggleAIPanel, aiGoNext, aiGoBack, editTopic, saveTopic,
         deleteTopic, addTopic, aiImportToBank } from './ai-gen.js';

// ---- Logger ----
window._log = function (msg) {
  console.log(`[Interviewer] ${msg}`);
};

// ======================== WeChat Height Fix ========================
function fixWeChatHeight() {
  // WeChat browser: use visualViewport to fix position:fixed issues
  if (/MicroMessenger/i.test(navigator.userAgent)) {
    document.body.classList.add('wechat-hack');
    const updateHeight = () => {
      const h = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      document.body.style.height = h + 'px';
    };
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', updateHeight);
      window.visualViewport.addEventListener('scroll', updateHeight);
    }
    updateHeight();
  }
}

// ======================== Keyboard Shortcuts ========================
function initKeyboard() {
  document.addEventListener('keydown', e => {
    // Ctrl+Enter = finish answer
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      const st = state; // current state
      if (st === STATES.Q1 || st === STATES.A1 || st === STATES.Q2 || st === STATES.A2) {
        finishAnswer();
      }
    }
  });
}

// ======================== Modal Backdrop Clicks ========================
function initModals() {
  document.querySelectorAll('.modal-overlay').forEach(o => {
    o.addEventListener('click', e => {
      if (e.target === o) o.classList.remove('show');
    });
  });

  // Score overlay close
  const scoreOverlay = $('scoreOverlay');
  if (scoreOverlay) {
    scoreOverlay.addEventListener('click', e => {
      if (e.target === scoreOverlay) closeScoreReport();
    });
  }
}

// ======================== Bank Selector Init ========================
function openBankSelector() {
  const bank = getCurrentBank();
  const classicCard = $('bankCardClassic');
  const customCard = $('bankCardCustom');
  const classicArea = $('classicArea');
  const customArea = $('customArea');

  if (classicCard) classicCard.classList.toggle('selected', bank === 'classic');
  if (customCard) customCard.classList.toggle('selected', bank === 'custom');

  if (bank === 'classic') {
    if (classicArea) classicArea.style.display = 'block';
    if (customArea) customArea.style.display = 'none';
    renderClassicTabs();
    renderClassicQList(classicActiveCat);
  } else if (bank === 'custom') {
    if (classicArea) classicArea.style.display = 'none';
    if (customArea) customArea.style.display = 'block';
    renderBankTabs();
    renderCustomQList();
  } else {
    if (classicArea) classicArea.style.display = 'none';
    if (customArea) customArea.style.display = 'none';
  }

  updateBankIcon();
  showBankSelector(false);
}

function initBankSelector() {
  const classicCard = $('bankCardClassic');
  const customCard = $('bankCardCustom');
  const customArea = $('customArea');

  // Bank card click
  if (classicCard) {
    classicCard.addEventListener('click', () => switchBank('classic'));
  }
  if (customCard) {
    customCard.addEventListener('click', () => switchBank('custom'));
  }
}

function switchBank(type) {
  const classicCard = $('bankCardClassic');
  const customCard = $('bankCardCustom');
  const classicArea = $('classicArea');
  const customArea = $('customArea');

  if (type === 'classic') {
    // 展示经典题库题目列表
    if (classicCard) classicCard.classList.add('selected');
    if (customCard) customCard.classList.remove('selected');
    if (classicArea) classicArea.style.display = 'block';
    if (customArea) customArea.style.display = 'none';
    renderClassicTabs();
    renderClassicQList(classicActiveCat);
  } else {
    // 展示自定义题库
    setCurrentBank('custom');
    if (classicCard) classicCard.classList.remove('selected');
    if (customCard) customCard.classList.add('selected');
    if (classicArea) classicArea.style.display = 'none';
    if (customArea) customArea.style.display = 'block';
    renderBankTabs();
    renderCustomQList();
    updateBankIcon();
    doFinalizeSwitch('custom');
  }
}

// 经典题库当前选中的分类（默认第一类）
let classicActiveCat = typeOrder[0];

const catEmojis = {
  '综合分析': '🔍', '组织计划': '📋', '应急处理': '🚨',
  '人际关系': '🤝', '宣讲说服': '🎤', '岗位认知': '💼'
};

// 渲染分类标签行
function renderClassicTabs() {
  const tabs = $('classicTabs');
  if (!tabs) return;

  let html = '';
  typeOrder.forEach(cat => {
    const questions = qBank[cat] || [];
    const active = classicActiveCat === cat ? ' active' : '';
    html += '<button class="classic-tab' + active + '" data-cat="' + escHtml(cat) + '">'
      + (catEmojis[cat] || '📌') + ' ' + escHtml(cat)
      + '<span class="tab-count">' + questions.length + '</span>'
      + '</button>';
  });
  tabs.innerHTML = html;

  // 绑定点击事件
  tabs.querySelectorAll('.classic-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      classicActiveCat = btn.dataset.cat;
      renderClassicTabs();
      renderClassicQList(classicActiveCat);
    });
  });
}

// 经典题库：渲染题目列表（按分类筛选 + 序号）
function renderClassicQList(cat) {
  const list = $('classicQList');
  const count = $('classicQCount');
  if (!list) return;

  const categories = [cat];
  let globalNum = 0;
  let totalQ = 0;
  let html = '';

  categories.forEach(c => {
    const questions = qBank[c] || [];
    if (!questions.length) return;
    totalQ += questions.length;
    html += '<div class="classic-cat">'
      + '<span class="cat-emoji">' + (catEmojis[c] || '📌') + '</span>'
      + escHtml(c)
      + '<span class="cat-count">' + questions.length + ' 题</span>'
      + '</div>';
    questions.forEach(q => {
      globalNum++;
      html += '<div class="classic-qitem">'
        + '<span class="classic-num">' + globalNum + '.</span>'
        + '<span class="classic-text">' + escHtml(q) + '</span>'
        + '</div>';
    });
  });

  if (count) count.textContent = '共 ' + totalQ + ' 题';
  list.innerHTML = html;
}

// 经典题库确认选择
function confirmClassicBank() {
  setCurrentBank('classic');
  updateBankIcon();
  doFinalizeSwitch('classic');
}

function doFinalizeSwitch(type) {
  // 不自动关闭 — 用户手动点击关闭按钮或遮罩退出
  const label = type === 'classic' ? '📚 经典题库' : '📝 自定义题库';
  showBankToast('已切换至 ' + label);

  if (!isIdle()) {
    setState(STATES.IDLE);
    const transcript = $('transcript');
    if (transcript) transcript.innerHTML = '';
    showBtns(['btnStart']);
    const btnStart = $('btnStart');
    if (btnStart) {
      btnStart.textContent = '开始面试';
      btnStart.className = 'btn btn-primary';
      btnStart.onclick = startInterview;
    }
    const ai = $('answerInput');
    if (ai) ai.disabled = true;
    const mb = $('micBtn');
    if (mb) mb.disabled = true;
    addSys('🔄 已切换题库，请重新开始面试');
  }
}

// ======================== Bank Tab Management ========================
function renderBankTabs() {
  const tabs = $('bankTabs');
  if (!tabs) return;

  const banks = getCustomBanks();
  const activeId = banks.length ? banks[0].id : '';
  // Use stored active ID
  const storedId = localStorage.getItem('activeCustomBankId') || activeId;

  let html = '';
  banks.forEach(b => {
    const active = b.id === storedId ? ' active' : '';
    html += '<button class="bank-tab' + active + '" data-bank-id="' + b.id + '" id="bankTab_' + b.id + '">'
      + escHtml(b.name)
      + ' <span class="tab-rename" id="rename_' + b.id + '">✏️</span>'
      + '</button>';
  });
  html += '<button class="bank-tab add" id="btnNewBank">+ 新建</button>';

  tabs.innerHTML = html;

  // Bind events
  banks.forEach(b => {
    const tab = document.getElementById('bankTab_' + b.id);
    if (tab) {
      tab.addEventListener('click', (e) => {
        if (e.target.classList.contains('tab-rename')) return;
        selectCustomBank(b.id);
      });
    }
    const rename = document.getElementById('rename_' + b.id);
    if (rename) {
      rename.addEventListener('click', (e) => {
        e.stopPropagation();
        startRenameBank(b.id);
      });
    }
  });

  const newBtn = $('btnNewBank');
  if (newBtn) {
    newBtn.addEventListener('click', createNewCustomBank);
  }
}

function selectCustomBank(id) {
  const banks = getCustomBanks();
  const activeId = localStorage.getItem('activeCustomBankId');
  if (id === activeId) return;
  localStorage.setItem('activeCustomBankId', id);
  renderBankTabs();
  renderCustomQList();
}

function createNewCustomBank() {
  const banks = getCustomBanks();
  if (banks.length >= 20) {
    showBankToast('⚠️ 最多支持 20 个题库');
    return;
  }
  const nid = 'b_' + Date.now();
  const num = banks.length + 1;
  banks.push({ id: nid, name: '题库 ' + num, questions: [] });
  setCustomBanks(banks);
  localStorage.setItem('activeCustomBankId', nid);
  renderBankTabs();
  renderCustomQList();
  showBankToast('✅ 已创建新题库「题库 ' + num + '」');
  setTimeout(() => startRenameBank(nid), 100);
}

function startRenameBank(id) {
  const tabs = $('bankTabs');
  if (!tabs) return;
  const btn = tabs.querySelector('[data-bank-id="' + id + '"]');
  if (!btn) return;

  const banks = getCustomBanks();
  const bank = banks.find(b => b.id === id);
  const origName = bank ? bank.name : '';

  btn.innerHTML = '';
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'bank-tab-input';
  input.value = origName;
  btn.appendChild(input);
  input.focus();
  input.select();

  function finish() {
    const name = input.value.trim();
    if (name) {
      const b = getCustomBanks();
      const found = b.find(x => x.id === id);
      if (found) { found.name = name; setCustomBanks(b); }
    }
    renderBankTabs();
  }

  input.addEventListener('blur', finish);
  input.addEventListener('keydown', ev => {
    if (ev.key === 'Enter') { ev.preventDefault(); input.blur(); }
    if (ev.key === 'Escape') { input.value = origName; input.blur(); }
  });
}

function deleteActiveCustomBank() {
  const banks = getCustomBanks();
  if (banks.length <= 1) {
    showBankToast('⚠️ 至少保留一个题库');
    return;
  }
  const activeId = localStorage.getItem('activeCustomBankId') || '';
  const bank = banks.find(b => b.id === activeId);
  if (!bank) return;
  let msg = '确认删除题库「' + bank.name + '」？';
  if (bank.questions.length) msg += '（内含 ' + bank.questions.length + ' 道题）';
  if (!confirm(msg + '\n此操作不可恢复。')) return;

  const filtered = banks.filter(b => b.id !== activeId);
  setCustomBanks(filtered);
  localStorage.setItem('activeCustomBankId', filtered[0].id);
  renderBankTabs();
  renderCustomQList();
  showBankToast('🗑 已删除题库');
}

// ======================== Custom Q List ========================
function renderCustomQList() {
  const list = $('customQList');
  const count = $('customQCount');
  if (!list || !count) return;

  const banks = getCustomBanks();
  const activeId = localStorage.getItem('activeCustomBankId') || '';
  const bank = banks.find(b => b.id === activeId) || banks[0];
  const questions = bank ? bank.questions : [];

  count.textContent = '共 ' + questions.length + ' 题';

  if (!questions.length) {
    list.innerHTML = '<div class="custom-empty">暂无题目，请在下方粘贴添加</div>';
    return;
  }

  list.innerHTML = questions.map((q, i) => {
    const cat = q.category || '';
    const catTag = cat ? ' <span style="color:var(--muted);font-size:0.7rem">[' + escHtml(cat) + ']</span>' : '';
    const hotBadge = q.hot ? ' <span title="近期网络热点" style="font-size:0.75rem">🔥</span>' : '';
    return '<div class="custom-qitem">'
      + '<span class="qitem-num">' + (i + 1) + ')</span>'
      + hotBadge
      + '<span class="qitem-text">' + escHtml(q.text) + catTag + '</span>'
      + '<button class="qitem-del" data-qid="' + q.id + '">✕</button>'
      + '</div>';
  }).join('');

  // Bind delete buttons
  list.querySelectorAll('.qitem-del').forEach(btn => {
    btn.addEventListener('click', () => deleteQuestion(btn.dataset.qid));
  });
}

function deleteQuestion(id) {
  const banks = getCustomBanks();
  const activeId = localStorage.getItem('activeCustomBankId') || '';
  const bank = banks.find(b => b.id === activeId);
  if (!bank) return;
  bank.questions = bank.questions.filter(q => q.id !== id);
  setCustomBanks(banks);
  renderCustomQList();
}

function parsePastedQuestions() {
  const input = $('customQInput');
  if (!input) return;
  const text = input.value.trim();
  if (!text) { showBankToast('⚠️ 请先粘贴题目'); return; }

  let currentCategory = '未分类';
  const parsed = [];
  const lines = text.split('\n');

  lines.forEach((line, li) => {
    let l = line.trim();
    if (!l) { currentCategory = '未分类'; return; }
    if ((l.endsWith('类') || l.endsWith('题') || l.endsWith('型')) && l.length <= 12) {
      currentCategory = l.replace(/[：:]/g, '');
      return;
    }
    const qText = l.replace(/^\(?\d+\)?[\.\)、）\s]+/, '').replace(/^[-—•·]\s*/, '').trim();
    if (qText.length <= 4) return;
    const id = 'q_' + Date.now() + '_' + li + '_' + Math.random().toString(36).substr(2, 4);
    parsed.push({ id, text: qText, category: currentCategory });
  });

  if (!parsed.length) {
    showBankToast('⚠️ 未能识别出有效题目，请检查格式');
    return;
  }

  const banks = getCustomBanks();
  const activeId = localStorage.getItem('activeCustomBankId') || '';
  const bank = banks.find(b => b.id === activeId);
  if (!bank) return;
  bank.questions = bank.questions.concat(parsed);
  setCustomBanks(banks);
  input.value = '';
  renderCustomQList();
  showBankToast('✅ 已解析 ' + parsed.length + ' 道题目');
}

function saveCustomBank() {
  const banks = getCustomBanks();
  const activeId = localStorage.getItem('activeCustomBankId') || '';
  const bank = banks.find(b => b.id === activeId);
  if (!bank || !bank.questions.length) {
    showBankToast('⚠️ 题库为空，请先粘贴并解析题目');
    return;
  }
  setCustomBanks(banks);
  setCurrentBank('custom');
  showBankToast('💾 已保存 ' + bank.questions.length + ' 道题目');
  updateBankIcon();
}

// ======================== Settings ========================
function openSettingsModal() {
  const s = getSettings();
  const apiUrl = $('apiUrl');
  const apiKey = $('apiKey');
  const apiModel = $('apiModel');
  const xfAppId = $('xfAppId');
  const xfApiKey = $('xfApiKey');
  const xfApiSecret = $('xfApiSecret');

  if (apiUrl) apiUrl.value = s.url;
  if (apiKey) apiKey.value = s.key;
  if (apiModel) apiModel.value = s.model;
  if (xfAppId) xfAppId.value = s.xfAppId;
  if (xfApiKey) xfApiKey.value = s.xfApiKey;
  if (xfApiSecret) xfApiSecret.value = s.xfApiSecret;

  showSettings();
}

function saveSettingsForm() {
  saveSettings({
    url: ($('apiUrl')?.value || '').trim(),
    key: ($('apiKey')?.value || '').trim(),
    model: ($('apiModel')?.value || '').trim(),
    xfAppId: ($('xfAppId')?.value || '').trim(),
    xfApiKey: ($('xfApiKey')?.value || '').trim(),
    xfApiSecret: ($('xfApiSecret')?.value || '').trim()
  });
  closeSettings();
  addSys('✅ API 设置已保存');
}

// ======================== Global Functions (onclick bindings) ========================
window._closeScore = closeScoreReport;
window._viewHist = viewHist;
window._moveItem = moveItem;
window._renameItem = renameItem;
window._deleteItem = deleteItem;
window._doMove = doMove;
window._createFolderAndMove = createFolderAndMove;
window._closeMoveMenu = closeMoveMenu;
window._filterHist = filterHist;
window._startCreateFolder = startCreateFolder;
window._doTimeoutReview = doTimeoutReview;
window._editTopic = editTopic;
window._saveTopic = saveTopic;
window._deleteTopic = deleteTopic;
window._addTopic = addTopic;
window._renderBankTabs = renderBankTabs;

// ======================== Event Bindings ========================
function bindEvents() {
  // ---- Start ----
  const btnStart = $('btnStart');
  if (btnStart) btnStart.addEventListener('click', startInterview);

  // ---- Answer ----
  const btnDone = $('btnDone');
  if (btnDone) btnDone.addEventListener('click', finishAnswer);
  const btnSkip = $('btnSkip');
  if (btnSkip) btnSkip.addEventListener('click', skipTiming);

  // ---- Mic ----
  const micBtn = $('micBtn');
  if (micBtn) micBtn.addEventListener('click', toggleMic);

  // ---- Settings ----
  const btnSettings = $('btnSettings');
  if (btnSettings) btnSettings.addEventListener('click', openSettingsModal);
  const btnSettingsCancel = $('btnSettingsCancel');
  if (btnSettingsCancel) btnSettingsCancel.addEventListener('click', closeSettings);
  const btnSettingsSave = $('btnSettingsSave');
  if (btnSettingsSave) btnSettingsSave.addEventListener('click', saveSettingsForm);

  // ---- History ----
  const btnHistory = $('btnHistory');
  if (btnHistory) btnHistory.addEventListener('click', () => { loadHistory(); showHistory(); });
  const btnHistoryClose = $('btnHistoryClose');
  if (btnHistoryClose) btnHistoryClose.addEventListener('click', closeHistory);
  const btnHistoryClear = $('btnHistoryClear');
  if (btnHistoryClear) btnHistoryClear.addEventListener('click', clearHistory);

  // ---- Bank ----
  const btnBank = $('btnBank');
  if (btnBank) btnBank.addEventListener('click', () => {
    if (isScoring()) return;
    openBankSelector();
  });
  const btnBankClose = $('btnBankClose');
  if (btnBankClose) btnBankClose.addEventListener('click', hideBankSelector);

  // ---- Custom Bank Actions ----
  const btnDeleteBank = $('btnDeleteBank');
  if (btnDeleteBank) btnDeleteBank.addEventListener('click', deleteActiveCustomBank);
  const btnParseQ = $('btnParseQ');
  if (btnParseQ) btnParseQ.addEventListener('click', parsePastedQuestions);
  const btnSaveBank = $('btnSaveBank');
  if (btnSaveBank) btnSaveBank.addEventListener('click', saveCustomBank);

  // ---- Classic Bank Select ----
  const btnClassicSelect = $('btnClassicSelect');
  if (btnClassicSelect) btnClassicSelect.addEventListener('click', confirmClassicBank);

  // ---- AI ----
  const btnAIToggle = $('btnAIToggle');
  if (btnAIToggle) btnAIToggle.addEventListener('click', toggleAIPanel);
  const btnAINext = $('aiBtnNext');
  if (btnAINext) btnAINext.addEventListener('click', aiGoNext);
  const btnAIBack = $('aiBtnBack');
  if (btnAIBack) btnAIBack.addEventListener('click', aiGoBack);
  const btnAIImport = $('aiBtnImport');
  if (btnAIImport) btnAIImport.addEventListener('click', aiImportToBank);
}

// ======================== Init ========================
function init() {
  initDOMRefs();
  initBanks();
  fixWeChatHeight();
  initKeyboard();
  initModals();
  initBankSelector();
  bindEvents();
  initNativeTTS();

  // Show bank selector on first visit
  if (!localStorage.getItem('currentBank')) {
    setTimeout(() => showBankSelector(true), 300);
  } else {
    updateBankIcon();
    const bank = getCurrentBank();
    if (bank === 'custom') {
      const obj = getActiveBankObj();
      if (!obj || !obj.questions.length) {
        setTimeout(() => showBankSelector(true), 300);
      }
    }
  }

  // Initial bank UI state
  const customArea = $('customArea');
  if (customArea && getCurrentBank() === 'custom') {
    customArea.style.display = 'block';
    renderBankTabs();
    renderCustomQList();
  }

  // Register Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/interviewer/sw.js').catch(() => {});
  }

  window._log('✅ 面试模拟器就绪');
}

// Boot
document.addEventListener('DOMContentLoaded', init);
