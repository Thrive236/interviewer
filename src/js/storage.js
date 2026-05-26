// ============================================================
// Storage — localStorage 封装
// ============================================================

import { typeOrder } from '../data/classic-bank.js';

// ---- API 设置 ----
export function getSettings() {
  return {
    url: (localStorage.getItem('apiUrl') || 'https://api.deepseek.com/v1').replace(/\/+$/, ''),
    key: localStorage.getItem('apiKey') || '',
    model: localStorage.getItem('apiModel') || 'deepseek-chat',
    // 讯飞语音
    xfAppId: localStorage.getItem('xfAppId') || '',
    xfApiKey: localStorage.getItem('xfApiKey') || '',
    xfApiSecret: localStorage.getItem('xfApiSecret') || ''
  };
}

export function saveSettings({ url, key, model, xfAppId, xfApiKey, xfApiSecret }) {
  if (url !== undefined) localStorage.setItem('apiUrl', url);
  if (key !== undefined) localStorage.setItem('apiKey', key);
  if (model !== undefined) localStorage.setItem('apiModel', model);
  if (xfAppId !== undefined) localStorage.setItem('xfAppId', xfAppId);
  if (xfApiKey !== undefined) localStorage.setItem('xfApiKey', xfApiKey);
  if (xfApiSecret !== undefined) localStorage.setItem('xfApiSecret', xfApiSecret);
}

// ---- 题库 ----
export function getCurrentBank() {
  return localStorage.getItem('currentBank') || 'classic';
}

export function setCurrentBank(type) {
  localStorage.setItem('currentBank', type);
}

// customBanks: [{ id, name, questions: [{ id, text, category }] }]
export function getCustomBanks() {
  try {
    return JSON.parse(localStorage.getItem('customBanks') || '[]');
  } catch (e) {
    return [];
  }
}

export function setCustomBanks(banks) {
  localStorage.setItem('customBanks', JSON.stringify(banks));
}

export function getActiveCustomBankId() {
  const stored = localStorage.getItem('activeCustomBankId') || '';
  const banks = getCustomBanks();
  if (banks.length && !banks.find(b => b.id === stored)) {
    return banks[0].id;
  }
  return stored;
}

export function setActiveCustomBankId(id) {
  localStorage.setItem('activeCustomBankId', id);
}

// ---- 题型轮转计数 ----
export function getTypeCounters() {
  try {
    return JSON.parse(localStorage.getItem('ivCounters') || '{}');
  } catch (e) {
    return {};
  }
}

export function setTypeCounters(counters) {
  localStorage.setItem('ivCounters', JSON.stringify(counters));
}

// ---- 题目随机顺序 ----
export function getQuestionShuffle() {
  try {
    return JSON.parse(localStorage.getItem('questionShuffle') || '{}');
  } catch (e) {
    return {};
  }
}

export function setQuestionShuffle(shuffle) {
  localStorage.setItem('questionShuffle', JSON.stringify(shuffle));
}

// ---- 练习历史 ----
export function getHist() {
  try {
    return JSON.parse(localStorage.getItem('ivHist') || '[]');
  } catch (e) {
    return [];
  }
}

export function setHist(h) {
  if (h.length > 300) h.length = 300;
  localStorage.setItem('ivHist', JSON.stringify(h));
}

// ---- 文件夹 ----
export function getFolders() {
  try {
    return JSON.parse(localStorage.getItem('ivFolders') || '[]');
  } catch (e) {
    return [];
  }
}

export function setFolders(f) {
  localStorage.setItem('ivFolders', JSON.stringify(f));
}
