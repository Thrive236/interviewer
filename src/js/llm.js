// ============================================================
// LLM — API 调用 + 评分报告
// ============================================================

import { STATES, state, setState } from './state.js';
import { getSettings } from './storage.js';
import { getInterviewData, resetUI } from './interview.js';
import {
  $, showScoreLoading, buildErrorReport,
  showLoading, hideLoading
} from './ui.js';
import { renderScoreReport } from './report.js';
import { saveHistory } from './history.js';
import { getCurrentBank } from './storage.js';

export async function callLLM(isTimeout) {
  setState(STATES.SCORING);
  showScoreLoading();

  const settings = getSettings();
  if (!settings.key) {
    const sr = $('scoreReport');
    if (sr) sr.innerHTML = buildErrorReport('⚠️ 未设置 LLM API Key，请在右上角 ⚙️ 设置中配置');
    resetUI();
    return;
  }

  const { q1, q2, a1, a2, q1Type, q2Type } = getInterviewData();
  const currentBank = getCurrentBank();

  let result = '';
  let retryFeedback = '';

  for (let attempt = 0; attempt < 2; attempt++) {
    const prompt = isTimeout ? buildTimeoutPrompt(q1, q2, a1, a2, q1Type, q2Type) :
      buildScoringPrompt(q1, q2, a1, a2, q1Type, q2Type, currentBank);

    if (retryFeedback) {
      const rp = prompt + '\n\n【上一次评审输出校验未通过，请修正以下问题后重新输出完整的Markdown评审结果】\n' + retryFeedback;
      try {
        result = await fetchLLM(settings, rp);
      } catch (e) {
        const sr = $('scoreReport');
        if (sr) sr.innerHTML = buildErrorReport('❌ API 调用失败：' + e.message);
        resetUI();
        return;
      }
    } else {
      try {
        result = await fetchLLM(settings, prompt);
      } catch (e) {
        if (attempt >= 1) {
          const sr = $('scoreReport');
          if (sr) sr.innerHTML = buildErrorReport('❌ API 调用失败：' + e.message);
          resetUI();
          return;
        }
        retryFeedback = 'API调用异常: ' + e.message;
        continue;
      }
    }

    if (attempt < 1) {
      const validation = validateReport(result, isTimeout);
      if (!validation.valid) {
        retryFeedback = validation.errors.join('; ');
        showScoreLoading();
        continue;
      }
    }
    break;
  }

  // Render & save
  const parsed = parseReportSections(result);
  const score = parsed.score;
  renderScoreReport(result);
  saveInterviewHistory(score, result, q1, q2, a1, a2, q1Type, q2Type);
  resetUI();
}

async function fetchLLM(settings, prompt) {
  const resp = await fetch(`${settings.url}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${settings.key}` },
    body: JSON.stringify({
      model: settings.model,
      messages: [
        { role: 'system', content: '你是资深公务员面试考官。请严格按要求的格式输出完整评审结果，不要省略任何部分。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 4000
    })
  });

  if (!resp.ok) {
    const e = await resp.text();
    throw new Error(`HTTP ${resp.status}: ${e.substring(0, 200)}`);
  }

  const data = await resp.json();
  return data.choices[0].message.content;
}

function buildScoringPrompt(q1, q2, a1, a2, q1Type, q2Type, currentBank) {
  return `你正在模拟公务员面试评审。请对以下面试作答进行全流程评审。

【面试参数】2道题，8分钟。7位考官独立打分，去最高最低取平均(保留2位)。满分100。

【7位考官】
A-政策导向型(70-85)：看政策引用、政治站位
B-务实型(70-88)：看措施具体可落地
C-逻辑型(68-86)：看结构清晰论证严密
D-表达型(72-90)：看语言流畅感染力
E-严厉型(65-82)：扣分点抓得细
F-温和型(75-92)：给分偏高看整体
G-平衡型(70-88)：综合考量

【题目与回答】
第一题(${q1Type})：${q1}
回答：${a1}
第二题(${q2Type})：${q2}
回答：${a2}

请按以下格式输出（保持Markdown）：

## 🏆 7考官打分明细
|考官|类型|分数|理由|
|---|---|---|---|
|A|政策型|XX|...|
|B|务实型|XX|...|
|C|逻辑型|XX|...|
|D|表达型|XX|...|
|E|严厉型|XX|...|
|F|温和型|XX|...|
|G|平衡型|XX|...|
**最终得分：XX.XX分**（去最高XX，去最低XX）

## ✨ 亮点
（2-3个，每个说明好在哪、为什么加分）

## ⚠️ 不足与改进
（最多5条，每条附具体改进建议）

## 📖 逐题复盘
### 第一题
- 踩分点：
- 偏差点：
- **高分示范答案**：
- **得分密码**(1-2句)：
### 第二题
- 踩分点：
- 偏差点：
- **高分示范答案**：
- **得分密码**(1-2句)：

## 🧩 可复用答题框架
（提炼1个通用框架）`;
}

function buildTimeoutPrompt(q1, q2, a1, a2, q1Type, q2Type) {
  return `该考生面试超时(8分钟)，成绩0分。跳过打分环节，但请执行评审和复盘。

第一题(${q1Type})：${q1}
回答：${a1}
第二题(${q2Type})：${q2}
回答：${a2}

请按以下格式输出：

## ⚠️ 超时 - 成绩 0 分

## ✨ 亮点
...

## ⚠️ 不足与改进
...

## 📖 逐题复盘
### 第一题
...
### 第二题
...

## 🧩 可复用答题框架
...`;
}

function validateReport(text, isTimeout) {
  const errors = [];
  const s = parseReportSections(text);
  if (!isTimeout) {
    if (s.score === null) errors.push('未能提取到最终得分');
    if (!s.highlights || s.highlights.replace(/\s/g, '').length < 5) errors.push('缺少亮点分析内容');
    if (!s.weakness || s.weakness.replace(/\s/g, '').length < 5) errors.push('缺少不足与改进内容');
    if (!s.judges || s.judges.length < 5) errors.push('考官打分明细不完整（少于5位考官）');
    if (s.score !== null && (s.score < 0 || s.score > 100)) errors.push('得分超出有效范围(0-100): ' + s.score);
  }
  return { valid: errors.length === 0, errors };
}

export function parseReportSections(text) {
  const sections = {};
  const parts = text.split(/^##\s/gm).filter(s => s.trim());

  parts.forEach(part => {
    const lines = part.split('\n');
    const header = lines[0].trim();
    const body = lines.slice(1).join('\n').trim();

    if (header.indexOf('7考官') >= 0 || header.indexOf('打分明细') >= 0) sections.scoring = body;
    else if (header.indexOf('亮点') >= 0) sections.highlights = body;
    else if (header.indexOf('不足') >= 0) sections.weakness = body;
    else if (header.indexOf('逐题复盘') >= 0 || header.indexOf('复盘') >= 0) sections.replay = body;
    else if (header.indexOf('答题框架') >= 0 || header.indexOf('框架') >= 0 || header.indexOf('可复用') >= 0) sections.framework = body;
    else if (header.indexOf('轮转') >= 0) sections.rotation = body;
    else if (header.indexOf('超时') >= 0) sections.timeout = body;
  });

  // Extract score
  const sm = text.match(/最终得分[：:]\s*(\d+\.?\d*)/);
  sections.score = sm ? parseFloat(sm[1]) : null;

  // Parse judge table
  if (sections.scoring) {
    const jm = sections.scoring.match(/\|\s*([A-G])\s*\|\s*(\S+)\s*\|\s*(\d+)\s*\|(.*?)\|/g);
    if (jm) {
      sections.judges = jm.map(m => {
        const p = m.split('|').filter(x => x.trim());
        return { id: p[0].trim(), type: p[1].trim(), score: parseInt(p[2].trim()), reason: p[3].trim() };
      });
    }

    const hi = sections.scoring.match(/去最高\s*(\d+)/);
    const lo = sections.scoring.match(/去最低\s*(\d+)/);
    sections.hiScore = hi ? parseInt(hi[1]) : null;
    sections.loScore = lo ? parseInt(lo[1]) : null;
  }

  // Fallback score from judge table
  if (sections.score === null && sections.judges && sections.judges.length >= 5) {
    const scores = sections.judges.map(j => j.score).sort((a, b) => a - b);
    scores.pop(); scores.shift();
    sections.score = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 100) / 100;

    if (sections.hiScore === null && sections.judges.length) {
      const allScores = sections.judges.map(j => j.score);
      sections.hiScore = Math.max(...allScores);
      sections.loScore = Math.min(...allScores);
    }
  }

  // Timeout pattern
  if (sections.score === null && (text.indexOf('0 分') >= 0 || text.indexOf('0分') >= 0 || (sections.timeout && sections.timeout.length > 0))) {
    sections.score = 0;
  }

  // Parse replay items
  if (sections.replay) {
    const qParts = sections.replay.split(/###\s+/);
    sections.replayItems = qParts.map(p => {
      const ls = p.split('\n');
      const hdr = (ls[0] || '').trim();
      if (!hdr) return null;
      const bd = ls.slice(1).join('\n').trim();
      const demo = bd.match(/\*\*高分示范答案\*\*[：:]?\s*([\s\S]*?)(?=\n- \*\*得分密码|\n\*\*|\n##|$)/);
      const secret = bd.match(/\*\*得分密码\*\*[：:]?\s*(.*)/);
      return {
        title: hdr,
        body: bd,
        demoAnswer: demo ? demo[1].trim() : '',
        secret: secret ? secret[1].trim() : ''
      };
    }).filter(Boolean);
  }

  return sections;
}

function saveInterviewHistory(score, result, q1, q2, a1, a2, q1Type, q2Type) {
  const now = new Date();
  const ds = now.getFullYear() + '-' +
    String(now.getMonth() + 1).padStart(2, '0') + '-' +
    String(now.getDate()).padStart(2, '0') + ' ' +
    String(now.getHours()).padStart(2, '0') + ':' +
    String(now.getMinutes()).padStart(2, '0');

  saveHistory({
    date: ds,
    q1Type, q2Type,
    q1, q2, a1, a2,
    score,
    results: result
  });
}
