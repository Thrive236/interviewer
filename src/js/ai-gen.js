// ============================================================
// AI-Gen — AI 出题（热点搜索 + 题目生成）
// ============================================================

import { getSettings } from './storage.js';
import { getCustomBanks, setCustomBanks, setActiveCustomBankId, setCurrentBank } from './storage.js';
import { $, escHtml, showBankToast, updateBankIcon } from './ui.js';

const AI_TYPES = ['观点分析', '时政分析', '计划组织', '人际关系', '宣讲说服', '应急处理'];

let aiStep = 0;
let aiTopics = [];
let aiQuestions = {};
let aiHotSet = new Set();

export function toggleAIPanel() {
  const panel = $('aiPanel');
  if (!panel) return;

  if (panel.classList.contains('show')) {
    panel.classList.remove('show');
    return;
  }

  panel.classList.add('show');

  const btnRow = $('aiBtnRow');
  if (btnRow) btnRow.style.display = 'flex';

  if (aiStep === 0) {
    resetAIState();
    const nextBtn = $('aiBtnNext');
    if (nextBtn) {
      nextBtn.textContent = '\uD83D\uDE80 开始搜索热点';
      nextBtn.style.display = '';
    }
    const backBtn = $('aiBtnBack');
    if (backBtn) backBtn.style.display = 'none';
    const importBtn = $('aiBtnImport');
    if (importBtn) importBtn.style.display = 'none';

    updateAISteps(0);
    const content = $('aiContent');
    if (content) content.innerHTML = '<p style="color:var(--muted);font-size:0.85rem;text-align:center;padding:16px">AI 将搜索近期公务员面试热点话题<br>你可以审核、编辑、删除或补充热点<br>确认后一键生成 12 道面试题（6类×2）</p>';
  }
}

function resetAIState() {
  aiStep = 0;
  aiTopics = [];
  aiQuestions = {};
  aiHotSet = new Set();
}

function updateAISteps(step) {
  const steps = [$('aiStep1'), $('aiStep2'), $('aiStep3')];
  steps.forEach((el, i) => {
    if (!el) return;
    if (i < step) el.className = 'ai-step done';
    else if (i === step) el.className = 'ai-step active';
    else el.className = 'ai-step';
  });
}

export async function aiGoNext() {
  if (aiStep === 0) {
    await aiFetchTopics();
  } else if (aiStep === 1) {
    await aiGenerateQuestions();
  }
}

export function aiGoBack() {
  if (aiStep === 2) {
    aiStep = 1;
    aiQuestions = {};
    updateAISteps(1);
    renderTopicsReview();
    const nextBtn = $('aiBtnNext');
    if (nextBtn) {
      nextBtn.textContent = '\uD83D\uDCDD 生成题目';
      nextBtn.style.display = '';
    }
    const backBtn = $('aiBtnBack');
    if (backBtn) backBtn.style.display = 'none';
    const importBtn = $('aiBtnImport');
    if (importBtn) importBtn.style.display = 'none';
  }
}

async function aiFetchTopics() {
  const settings = getSettings();
  if (!settings.key) {
    const content = $('aiContent');
    if (content) content.innerHTML = '<div class="ai-error-box">⚠️ 未设置 LLM API Key，请在右上角 ⚙️ 设置中配置</div>';
    return;
  }

  showAILoading('正在搜索近期公务员面试热点...');

  try {
    const resp = await fetch(`${settings.url}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${settings.key}` },
      body: JSON.stringify({
        model: settings.model,
        messages: [
          { role: 'system', content: '你是一位熟悉中国公务员考试和时政热点的出题专家。请只输出JSON对象。' },
          { role: 'user', content: buildTopicPrompt() }
        ],
        temperature: 0.7,
        max_tokens: 3000,
        response_format: { type: 'json_object' }
      })
    });

    if (!resp.ok) { const e = await resp.text(); throw new Error('HTTP ' + resp.status); }
    const data = await resp.json();
    parseTopics(data.choices[0].message.content);

    aiStep = 1;
    updateAISteps(1);
    renderTopicsReview();

    const nextBtn = $('aiBtnNext');
    if (nextBtn) {
      nextBtn.textContent = '\uD83D\uDCDD 生成题目';
      nextBtn.style.display = '';
    }
    const backBtn = $('aiBtnBack');
    if (backBtn) backBtn.style.display = 'none';
    const importBtn = $('aiBtnImport');
    if (importBtn) importBtn.style.display = 'none';

  } catch (err) {
    const content = $('aiContent');
    if (content) content.innerHTML = '<div class="ai-error-box">\u274C 获取热点失败：' + escHtml(err.message) + '</div>';
  }
}

function buildTopicPrompt() {
  return '请搜索并整理近半年内适合出公务员面试题的热点事件，列出 8-10 条。\n\n要求：\n1. 优先选择与基层治理、民生保障、乡村振兴、生态文明、数字经济、作风建设、青年担当相关的话题\n2. 必须适合出公务员结构化面试题\n3. 兼顾山西省本地热点（如山西能源转型、文旅发展、生态治理等）\n4. 每条热点简要说明事件和可出题方向\n5. 【重要】每条热点必须是不同领域/不同事件，严禁出现内容重复或高度相似的话题\n6. 话题覆盖范围要广，不要集中在某一个领域（如全是数字经济或全是乡村振兴）\n\n请严格按以下JSON格式输出（只输出JSON对象，不要Markdown包裹）：\n\n{\n  "topics": [\n    {"title": "热点标题", "brief": "30-50字简述", "tags": ["标签1", "标签2", "标签3"]}\n  ]\n}\n\n共输出 8-10 条。';
}

function parseTopics(text) {
  aiTopics = [];
  try {
    const json = JSON.parse(text);
    const arr = json.topics || json;
    if (Array.isArray(arr)) {
      arr.forEach(item => {
        if (item.title) {
          aiTopics.push({
            title: item.title,
            brief: item.brief || '',
            tags: Array.isArray(item.tags) ? item.tags : []
          });
        }
      });
    }
    // 客户端去重：标题相似度 > 60% 的视为重复
    aiTopics = dedupTopics(aiTopics);
    if (aiTopics.length >= 5) return;
  } catch (e) { /* fall through */ }

  // Fallback parsing
  aiTopics = [];
  const lines = text.split('\n').filter(l => l.trim());
  let current = null;
  lines.forEach(l => {
    if (/热点\d+|^\d+[\.、]/.test(l)) {
      if (current) aiTopics.push(current);
      current = { title: l.replace(/^[\d\.、\s#]*(热点\d+\s*[:：]\s*)?/, '').trim(), brief: '', tags: [] };
    } else if (current && /简述|简介/.test(l)) {
      current.brief = l.replace(/简述[：:]\s*/, '').trim();
    } else if (current && /标签/.test(l)) {
      current.tags = l.replace(/标签[：:]\s*/, '').split(/[,，、]/).map(t => t.trim()).filter(Boolean);
    } else if (current && !current.brief) {
      current.brief = l.trim();
    }
  });
  if (current) aiTopics.push(current);
}

// 去重：基于标题字符重叠率过滤相似话题
function dedupTopics(topics) {
  const result = [];
  for (const t of topics) {
    let isDup = false;
    for (const r of result) {
      if (charOverlap(t.title, r.title) > 0.6) {
        isDup = true;
        break;
      }
    }
    if (!isDup) result.push(t);
  }
  return result;
}

// 计算两个字符串的字符重叠率
function charOverlap(a, b) {
  const setA = new Set(a.replace(/\s/g, ''));
  const setB = new Set(b.replace(/\s/g, ''));
  if (setB.size === 0) return 0;
  let common = 0;
  setA.forEach(c => { if (setB.has(c)) common++; });
  return common / Math.max(setA.size, setB.size);
}

function renderTopicsReview() {
  let html = '';
  html += '<p style="font-size:0.8rem;color:var(--muted);margin-bottom:8px">✅ 以下为 AI 搜索的热点，你可以编辑、删除或新增。确认后点击「生成题目」。</p>';
  html += '<div class="ai-topic-list">';

  aiTopics.forEach((t, i) => {
    let tagsHtml = '';
    t.tags.forEach(tag => { tagsHtml += '<span class="topic-tag">' + escHtml(tag) + '</span>'; });

    html += '<div class="ai-topic-card">';
    html += '<div class="topic-header"><span class="topic-num">' + (i + 1) + '.</span>';
    html += '<div style="flex:1"><span class="topic-title">' + escHtml(t.title) + '</span>';
    html += '<div class="topic-brief">' + escHtml(t.brief) + '</div>';
    if (tagsHtml) html += '<div class="topic-tags">' + tagsHtml + '</div>';
    html += '</div></div>';
    html += '<div class="topic-actions">';
    html += '<button class="btn btn-outline btn-sm" onclick="window._editTopic(' + i + ')" style="font-size:0.72rem;padding:4px 10px">✏️ 编辑</button>';
    html += '<button class="btn btn-outline btn-sm" onclick="window._deleteTopic(' + i + ')" style="font-size:0.72rem;padding:4px 10px;color:var(--danger)">🗑 删除</button>';
    html += '</div></div>';
  });

  html += '</div>';
  html += '<div class="ai-add-topic">';
  html += '<input type="text" id="aiNewTopicInput" placeholder="输入新热点标题 + 简述，用 | 分隔">';
  html += '<button class="btn btn-outline btn-sm" onclick="window._addTopic()" style="flex-shrink:0">➕ 添加</button>';
  html += '</div>';

  const content = $('aiContent');
  if (content) content.innerHTML = html;
}

export function editTopic(i) {
  const t = aiTopics[i];
  if (!t) return;
  const cards = document.querySelectorAll('.ai-topic-card');
  const card = cards[i];
  if (!card) return;
  card.innerHTML = '<textarea class="ai-topic-edit" id="editTopic' + i + '" onblur="window._saveTopic(' + i + ')">' +
    escHtml(t.title + ' | ' + t.brief + ' | ' + t.tags.join(',')) + '</textarea>';
  setTimeout(() => {
    const el = document.getElementById('editTopic' + i);
    if (el) el.focus();
  }, 50);
}

export function saveTopic(i) {
  const el = document.getElementById('editTopic' + i);
  if (!el) return;
  const parts = el.value.split('|').map(p => p.trim());
  aiTopics[i].title = parts[0] || aiTopics[i].title;
  aiTopics[i].brief = parts[1] || '';
  aiTopics[i].tags = parts[2] ? parts[2].split(/[,，、]/).map(t => t.trim()).filter(Boolean) : aiTopics[i].tags;
  renderTopicsReview();
}

export function deleteTopic(i) {
  aiTopics.splice(i, 1);
  renderTopicsReview();
}

export function addTopic() {
  const input = $('aiNewTopicInput');
  if (!input) return;
  const val = input.value.trim();
  if (!val) return;
  const parts = val.split('|').map(p => p.trim());
  aiTopics.push({
    title: parts[0] || '新热点',
    brief: parts[1] || '',
    tags: parts[2] ? parts[2].split(/[,，、]/).map(t => t.trim()).filter(Boolean) : []
  });
  renderTopicsReview();
}

async function aiGenerateQuestions(retryErrors) {
  if (!aiTopics.length) {
    const content = $('aiContent');
    if (content) content.innerHTML += '<div class="ai-error-box">⚠️ 请至少保留 1 条热点</div>';
    return;
  }

  const settings = getSettings();
  if (!settings.key) return;

  showAILoading(retryErrors
    ? '校验发现问题，正在修正...'
    : '正在根据热点生成 12 道面试题...<br><span style="font-size:0.75rem;color:var(--muted)">6类题型 × 2道 = 12题</span>');

  // 最多重试 3 次
  const maxRetries = 3;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      let userPrompt = buildQuestionPrompt();
      if (retryErrors) {
        userPrompt += '\n\n【上一次生成校验未通过，请修正以下问题后重新输出JSON】\n' + retryErrors;
      }

      const resp = await fetch(`${settings.url}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${settings.key}` },
        body: JSON.stringify({
          model: settings.model,
          messages: [
            { role: 'system', content: '你是一位精通公务员面试出题的专家，熟悉山西省考面试风格。请只输出JSON对象。' },
            { role: 'user', content: userPrompt }
          ],
          temperature: attempt === 0 ? 0.7 : 0.85 + attempt * 0.05,  // 重试时提高温度增加多样性
          max_tokens: 4000,
          response_format: { type: 'json_object' }
        })
      });

      if (!resp.ok) { const e = await resp.text(); throw new Error('HTTP ' + resp.status); }
      const data = await resp.json();
      parseQuestions(data.choices[0].message.content);

      // 跨会话去重检查
      const dupReport = checkCrossSessionDups();
      if (dupReport) {
        if (attempt < maxRetries - 1) {
          retryErrors = dupReport;
          continue;  // 重试
        }
        // 最后一次尝试，接受结果但标记
      }

      aiStep = 2;
      updateAISteps(2);
      renderQuestionsPreview();

      const nextBtn = $('aiBtnNext');
      if (nextBtn) nextBtn.style.display = 'none';
      const backBtn = $('aiBtnBack');
      if (backBtn) backBtn.style.display = '';
      const importBtn = $('aiBtnImport');
      if (importBtn) importBtn.style.display = '';
      return;  // 成功

    } catch (err) {
      if (attempt < maxRetries - 1) continue;
      const content = $('aiContent');
      if (content) content.innerHTML = '<div class="ai-error-box">\u274C 生成题目失败：' + escHtml(err.message) + '</div>';
    }
  }
}

// 收集所有已导入题库的题目文本
function getAllImportedQuestions() {
  const banks = getCustomBanks();
  const all = [];
  banks.forEach(b => {
    (b.questions || []).forEach(q => {
      if (q.text) all.push(q.text);
    });
  });
  return all;
}

// 提取已用话题关键词（用于生成避重提示）
function getUsedTopicKeywords() {
  const allQs = getAllImportedQuestions();
  if (allQs.length < 5) return '';
  // 提取高频 2-3 字短语
  const words = new Map();
  allQs.forEach(q => {
    // 简单分词：取 2-4 字滑动窗口
    for (let len = 2; len <= 4; len++) {
      for (let i = 0; i <= q.length - len; i++) {
        const w = q.substring(i, i + len);
        if (/^[\u4e00-\u9fa5]+$/.test(w)) {
          words.set(w, (words.get(w) || 0) + 1);
        }
      }
    }
  });
  // 按频率排序，取前 20 个
  const sorted = [...words.entries()]
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);
  return sorted.map(([w]) => w).join('、');
}

// 跨会话去重：检查新题目与已导入题库的重复
function checkCrossSessionDups() {
  const existing = getAllImportedQuestions();
  if (!existing.length) return null;

  const allNew = [];
  AI_TYPES.forEach(t => {
    (aiQuestions[t] || []).forEach(q => allNew.push(q));
  });
  if (!allNew.length) return null;

  const dupPairs = [];
  allNew.forEach(newQ => {
    existing.forEach(oldQ => {
      if (charOverlap(newQ, oldQ) > 0.7) {
        dupPairs.push('"' + newQ.substring(0, 30) + '..." ≈ "' + oldQ.substring(0, 30) + '..."');
      }
    });
  });

  if (dupPairs.length === 0) return null;

  // 去重后的去重对
  const unique = [...new Set(dupPairs)].slice(0, 6);

  const usedKeywords = getUsedTopicKeywords();
  let report = '以下题目与之前已导入题库高度重复，请更换全新话题重新出题：\n';
  unique.forEach(p => { report += '- ' + p + '\n'; });
  if (usedKeywords) {
    report += '\n请尽量避免以下已多次使用的话题关键词：' + usedKeywords + '\n';
  }
  report += '\n请选择完全不同的事件、场景和话题角度，确保 12 道题都是新的。';
  return report;
}

function buildQuestionPrompt() {
  const topicList = aiTopics.map((t, i) => (i + 1) + '. ' + t.title + '：' + t.brief).join('\n');
  const usedKW = getUsedTopicKeywords();

  let prompt = '你是一位公务员面试出题专家。请基于以下热点话题，为山西省考面试出 12 道结构化面试题。\n\n' +
    '【热点话题】\n' + topicList + '\n\n';

  if (usedKW) {
    prompt += '【避重提示】以下话题在之前出题中已多次使用，请务必避开：' + usedKW + '\n请选择不同的事件、场景和角度。\n\n';
  }

  prompt +=
    '【出题要求】\n' +
    '严格按 6 类题型出题，每类 2 道，共 12 道：\n' +
    '1. 观点分析类 —— 给出一个观点/名言/双观点/哲理故事，问"谈谈你的理解/看法"\n' +
    '2. 时政分析类 —— 给出一个社会现象/政策/热点事件，问"你怎么看"\n' +
    '3. 计划组织类 —— 设定一个任务场景，问"你怎么组织/开展"\n' +
    '4. 人际关系类 —— 设定人际矛盾场景，问"你怎么办/如何处理"\n' +
    '5. 宣讲说服类 —— 设定劝说/演讲/致辞场景，问"请现场模拟/请做一个演讲"\n' +
    '6. 应急处理类 —— 设定突发事件/群体事件/舆情场景，问"你如何处理/应对"\n\n' +
    '【热点标注要求】\n' +
    '- 从 12 道题中选出 4 道与近期网络热搜、社会热议话题最密切相关的题目\n' +
    '- 这 4 道题必须紧扣当前社会最热门的讨论（如 AI、新能源、直播、文旅、考公热等）\n' +
    '- 在 JSON 中增加 "hot" 字段，列出这 4 道题的题面原文（必须与上面输出的完全一致）\n\n' +
    '【题目风格要求】\n' +
    '- 题目要简短精炼，每道题 20-120 字\n' +
    '- 设问自然，符合公务员面试真题风格\n' +
    '- 部分题目可融入山西本地元素\n' +
    '- 题目要接地气、贴近基层工作实际\n' +
    '- 【重要】同类题型下的 2 道题必须是完全不同的话题和场景，严禁雷同\n' +
    '- 【重要】不同题型之间也要避免使用同一热点事件，保持题目多样性\n\n' +
    '请严格按以下JSON格式输出（只输出JSON对象，不要Markdown包裹）：\n\n' +
    '{\n' +
    '  "观点分析": ["题目1", "题目2"],\n' +
    '  "时政分析": ["题目1", "题目2"],\n' +
    '  "计划组织": ["题目1", "题目2"],\n' +
    '  "人际关系": ["题目1", "题目2"],\n' +
    '  "宣讲说服": ["题目1", "题目2"],\n' +
    '  "应急处理": ["题目1", "题目2"],\n' +
    '  "hot": ["题面1", "题面2", "题面3", "题面4"]\n' +
    '}';
  return prompt;
}

function parseQuestions(text) {
  AI_TYPES.forEach(t => { aiQuestions[t] = []; });

  try {
    const json = JSON.parse(text);
    const allQs = []; // 跨类型去重
    AI_TYPES.forEach(t => {
      if (Array.isArray(json[t])) {
        json[t].forEach(q => {
          if (typeof q !== 'string' || !q.trim()) return;
          if (aiQuestions[t].length >= 2) return;
          const trimmed = q.trim();
          if (allQs.some(existing => charOverlap(trimmed, existing) > 0.7)) return;
          aiQuestions[t].push(trimmed);
          allQs.push(trimmed);
        });
      }
    });

    // 提取热点标记
    aiHotSet = new Set();
    if (Array.isArray(json.hot)) {
      json.hot.forEach(h => {
        if (typeof h === 'string') aiHotSet.add(h.trim());
      });
    }

    const found = allQs.length;
    if (found >= 8) return;
    AI_TYPES.forEach(t => { aiQuestions[t] = []; });
  } catch (e) { /* fall through */ }
}

function renderQuestionsPreview() {
  const container = $('aiContent');
  if (!container) return;

  let html = '<p style="font-size:0.8rem;color:var(--muted);margin-bottom:8px">✅ 已生成题目，请预览确认后导入题库</p>';
  html += '<div id="aiQPreview" class="ai-q-preview show">';

  AI_TYPES.forEach(type => {
    const qs = aiQuestions[type] || [];
    html += '<div class="ai-q-type-group"><h4>📝 ' + type + '（' + qs.length + '题）</h4>';
    qs.forEach((q, i) => {
      const isHot = aiHotSet.has(q);
      html += '<div class="ai-q-item"><span class="ai-q-num">' + (i + 1) + '.</span>';
      if (isHot) html += '<span class="ai-hot-badge" title="近期网络热点">🔥</span>';
      html += '<span class="ai-q-text">' + escHtml(q) + '</span>';
      html += '<span class="ai-q-type-tag">' + type + '</span>';
      html += '</div>';
    });
    html += '</div>';
  });

  html += '</div>';
  container.innerHTML = html;
}

export function aiImportToBank() {
  const newQuestions = [];
  AI_TYPES.forEach(type => {
    const qs = aiQuestions[type] || [];
    qs.forEach(q => {
      newQuestions.push({
        id: 'q_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        text: q,
        category: type,
        hot: aiHotSet.has(q)  // 保留热点标记
      });
    });
  });

  if (!newQuestions.length) {
    showBankToast('⚠️ 没有可导入的题目');
    return;
  }

  const now = new Date();
  const ds = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  const bankName = 'AI 出题 ' + ds;
  const nid = 'b_' + Date.now();

  const banks = getCustomBanks();
  banks.push({ id: nid, name: bankName, questions: newQuestions });
  setCustomBanks(banks);
  setActiveCustomBankId(nid);
  setCurrentBank('custom');
  updateBankIcon();

  // Refresh bank tabs
  if (typeof window._renderBankTabs === 'function') window._renderBankTabs();

  // Close panel
  const panel = $('aiPanel');
  if (panel) panel.classList.remove('show');
  resetAIState();

  const btnRow = $('aiBtnRow');
  if (btnRow) btnRow.style.display = 'none';

  showBankToast('✅ 已导入「' + bankName + '」（' + newQuestions.length + '题）');
}

function showAILoading(msg) {
  const content = $('aiContent');
  if (content) content.innerHTML = '<div class="ai-loading-box"><div class="spinner"></div><p>' + msg + '</p></div>';
}
