// ============================================================
// Report — 成绩单渲染
// ============================================================

import { $, escHtml, closeScoreReport } from './ui.js';
import { parseReportSections } from './llm.js';

export function renderScoreReport(text) {
  const s = parseReportSections(text);
  let html = '';

  // Close button
  html += '<div style="text-align:right;margin-bottom:16px"><button class="icon-btn" onclick="window._closeScore()" style="font-size:1.2rem;width:36px;height:36px">\u2715</button></div>';

  // Hero score
  if (s.score !== null) {
    const cls = s.score === 0 ? 'zero' : '';
    html += '<div class="score-hero"><div class="score-num ' + cls + '">' +
      (s.score === 0 ? '0' : s.score.toFixed(2)) +
      '</div><div class="score-label">最终得分' +
      (s.score === 0 ? '（超时）' : '') + '</div></div>';
  }

  // Judge table
  if (s.judges && s.judges.length > 0) {
    html += '<div class="score-section"><h3><span class="emoji">\u{1f3c6}</span>7位考官打分明细</h3>';
    html += '<table class="judge-table"><thead><tr><th>考官</th><th>类型</th><th>分数</th><th>理由</th></tr></thead><tbody>';

    s.judges.forEach(j => {
      let cls = '';
      if (j.score === s.hiScore) cls = ' judge-hi';
      if (j.score === s.loScore) cls = ' judge-lo';
      html += '<tr><td>' + j.id + '</td><td style="font-size:0.72rem;color:var(--muted)">' +
        j.type + '</td><td class="judge-score' + cls + '">' + j.score +
        '</td><td style="text-align:left;font-size:0.72rem">' + escHtml(j.reason) + '</td></tr>';
    });

    html += '</tbody></table>';
    if (s.hiScore !== null && s.loScore !== null) {
      html += '<div class="final-score-row">去最高 ' + s.hiScore +
        ' 分 &nbsp;|&nbsp; 去最低 ' + s.loScore +
        ' 分 &nbsp;\u2192&nbsp; 最终 ' +
        (s.score !== null ? s.score.toFixed(2) : '?') + ' 分</div>';
    }
    html += '</div>';
  } else if (s.timeout) {
    html += '<div class="score-section"><h3>\u26a0\ufe0f 超时</h3><p style="color:var(--danger)">答题超时，成绩为 <strong>0 分</strong>，跳过 7 考官打分。</p></div>';
  }

  // Highlights & Weakness — 上下并列
  if (s.highlights) {
    html += '<div class="score-section col-highlights"><h3>\u2728 亮点</h3>' + fmtMd(s.highlights) + '</div>';
  }
  if (s.weakness) {
    html += '<div class="score-section col-weakness"><h3>\u26a0\ufe0f 不足</h3>' + fmtMd(s.weakness) + '</div>';
  }

  // Replay
  if (s.replayItems && s.replayItems.length > 0) {
    html += '<div class="score-section"><h3><span class="emoji">\u{1f4d6}</span>逐题复盘</h3>';
    s.replayItems.forEach(item => {
      html += '<div class="replay-item"><h4>' + escHtml(item.title) + '</h4>';
      html += '<div>' + fmtMd(item.body) + '</div>';
      if (item.demoAnswer) html += '<div class="demo-answer"><strong>高分示范：</strong>' + fmtMd(item.demoAnswer) + '</div>';
      if (item.secret) html += '<div class="score-secret">\u{1f511} ' + item.secret + '</div>';
      html += '</div>';
    });
    html += '</div>';
  } else if (s.replay) {
    html += '<div class="score-section"><h3><span class="emoji">\u{1f4d6}</span>逐题复盘</h3>' + fmtMd(s.replay) + '</div>';
  }

  // Framework
  if (s.framework) {
    html += '<div class="score-section"><h3><span class="emoji">\u{1f9e9}</span>总结答题框架</h3><div class="framework-box">' + fmtMd(s.framework) + '</div></div>';
  }

  // Rotation
  if (s.rotation) {
    html += '<div class="score-section"><h3><span class="emoji">\u{1f4ca}</span>轮转记录</h3><div class="rotation-info">' + fmtMd(s.rotation) + '</div></div>';
  }

  // Close
  html += '<div class="report-close"><button class="btn btn-accent" onclick="window._closeScore()">关闭成绩单</button></div>';

  const sr = $('scoreReport');
  if (sr) sr.innerHTML = html;

  const so = $('scoreOverlay');
  if (so) so.classList.add('show');
}

function fmtMd(t) {
  if (!t) return '';
  return t
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/^- (.*)/gm, '\u2022 $1')
    .replace(/^\* (.*)/gm, '\u2022 $1')
    .replace(/^(\d+)\. /gm, '$1. ')
    .replace(/\n/g, '<br>');
}
