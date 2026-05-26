// ============================================================
// Bank — 题库管理（经典题库 + 自定义多题库）
// ============================================================

import { qBank, typeOrder } from '../data/classic-bank.js';
import {
  getCurrentBank, setCurrentBank,
  getCustomBanks, setCustomBanks,
  getActiveCustomBankId, setActiveCustomBankId,
  getTypeCounters, setTypeCounters,
  getQuestionShuffle, setQuestionShuffle
} from './storage.js';
import { showBankToast, updateBankIcon, $ } from './ui.js';

// ---- 初始化 bank state ----
export function initBanks() {
  let banks = getCustomBanks();
  if (!banks.length) {
    const defId = 'b_' + Date.now();
    banks = [{ id: defId, name: '题库 1', questions: [] }];
    setCustomBanks(banks);
    setActiveCustomBankId(defId);
  }

  let activeId = getActiveCustomBankId();
  if (!banks.find(b => b.id === activeId)) {
    setActiveCustomBankId(banks[0].id);
  }

  // Migrate old formats
  migrateOldBank();
}

function migrateOldBank() {
  if (getCustomBanks().length > 0 && localStorage.getItem('customBanks')) return;

  let oldSingle;
  try { oldSingle = JSON.parse(localStorage.getItem('customQuestions') || 'null'); } catch (e) { oldSingle = null; }
  let oldBank;
  try { oldBank = JSON.parse(localStorage.getItem('customQBank') || 'null'); } catch (e) { oldBank = null; }

  let migrated = [];
  if (Array.isArray(oldSingle)) {
    migrated = oldSingle;
  } else if (oldBank && typeof oldBank === 'object') {
    Object.keys(oldBank).forEach(cat => {
      oldBank[cat].forEach((q, i) => {
        migrated.push({ id: 'q_' + Date.now() + '_' + i, text: q, category: cat });
      });
    });
  }

  if (migrated.length) {
    const mid = 'b_' + Date.now();
    setCustomBanks([{ id: mid, name: '我的题库', questions: migrated }]);
    setActiveCustomBankId(mid);
  }

  localStorage.removeItem('customQuestions');
  localStorage.removeItem('customQBank');
  localStorage.removeItem('customQInputText');
}

// ---- 获取当前有效的题库 ----
export function getActiveBank() {
  if (getCurrentBank() === 'classic') return qBank;

  const obj = getActiveBankObj();
  const bank = {};
  if (obj) {
    obj.questions.forEach(q => {
      const cat = q.category || '自定义题';
      if (!bank[cat]) bank[cat] = [];
      bank[cat].push(q.text);
    });
  }
  if (!Object.keys(bank).length) bank['自定义题'] = [];
  return bank;
}

export function getActiveBankObj() {
  const banks = getCustomBanks();
  const activeId = getActiveCustomBankId();
  const found = banks.find(b => b.id === activeId);
  return found || banks[0] || null;
}

export function getActiveTypes() {
  if (getCurrentBank() === 'classic') return typeOrder;

  const obj = getActiveBankObj();
  if (!obj || !obj.questions.length) return ['自定义题'];

  const types = [];
  obj.questions.forEach(q => {
    const cat = q.category || '自定义题';
    if (types.indexOf(cat) === -1) types.push(cat);
  });
  return types;
}

// ---- 选题 ----
export function selectQuestions() {
  const bank = getActiveBank();
  const types = getActiveTypes();
  const isClassic = getCurrentBank() === 'classic';

  let sorted;
  if (isClassic) {
    const counters = getTypeCounters();
    typeOrder.forEach(t => { if (counters[t] === undefined) counters[t] = 0; });
    sorted = [...typeOrder].sort((a, b) => (counters[a] || 0) - (counters[b] || 0));
  } else {
    sorted = [...types].sort(() => Math.random() - 0.5);
  }

  const t1 = sorted[0];
  let t2 = sorted[1] || sorted[0];
  if (t1 === t2 && sorted.length > 1) t2 = sorted[2] || sorted[1];

  const q1 = pickQ(t1, bank);
  const q2 = pickQ(t2, bank);

  if (!q1 && !q2) return null;

  if (isClassic) {
    const counters = getTypeCounters();
    counters[t1] = (counters[t1] || 0) + 1;
    counters[t2] = (counters[t2] || 0) + 1;
    setTypeCounters(counters);
  }

  return { q1: q1 || '(暂无题目)', q2: q2 || '(暂无题目)', q1Type: t1, q2Type: t2 };
}

function pickQ(type, bank) {
  const pool = bank[type] || [];
  if (!pool.length) return null;

  const bankId = getCurrentBank() === 'classic' ? 'classic' : getActiveCustomBankId();
  const key = bankId + '::' + type;
  const shuffle = getQuestionShuffle();
  let shState = shuffle[key];

  if (!shState || shState.order.length !== pool.length || shState.idx >= shState.order.length) {
    const indices = pool.map((_, i) => i);
    shState = { order: shuffleArray(indices), idx: 0 };
  }

  const pickIdx = shState.order[shState.idx];
  shState.idx++;
  shuffle[key] = shState;
  setQuestionShuffle(shuffle);

  return pool[pickIdx];
}

function shuffleArray(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
