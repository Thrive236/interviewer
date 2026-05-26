// ============================================================
// Interview — 面试流程控制
// ============================================================

import { STATES, state, setState, isIdle, isAnswering } from './state.js';
import {
  $, initDOMRefs, addSys, addInt, addCand, showQCard,
  showTimer, setStep, showBtns, enableInput
} from './ui.js';
import { startTimer, stopTimer } from './timer.js';
import { speak } from './speech-out.js';
import { stopRecording } from './speech-in.js';
import { selectQuestions } from './bank.js';
import { callLLM } from './llm.js';

// ---- 面试状态 ----
export let q1 = '', q2 = '', a1 = '', a2 = '';
export let q1Type = '', q2Type = '';

// ---- 开始面试 ----
export function startInterview() {
  if (!isIdle()) return;

  const transcript = $('transcript');
  if (transcript) transcript.innerHTML = '';

  addSys('\uD83C\uDF93 公务员面试模拟');
  addSys('———————————————');

  a1 = ''; a2 = '';

  // 选题
  const selected = selectQuestions();
  if (!selected) {
    addSys('⚠️ 题库为空，请先在题库中添加题目');
    return;
  }
  q1 = selected.q1; q2 = selected.q2;
  q1Type = selected.q1Type; q2Type = selected.q2Type;

  setState(STATES.OPENING);
  setStep(1, '开场');
  showBtns(['btnStart']);

  const btnStart = $('btnStart');
  if (btnStart) {
    btnStart.textContent = '准备好了 ✓';
    btnStart.className = 'btn btn-accent';
    btnStart.onclick = onReady;
  }

  enableInput(false);

  // 面试官开场白
  const opening = '你好，首先祝贺你顺利通过了笔试，欢迎参加今天的面试。请你来是希望通过面对面的交谈，增进对你的了解。我们会问你一些问题，对于我们的问题，希望你能认真和实事求是地回答。你回答问题的时间是 <strong>8 分钟</strong>，不必紧张，好好把握回答时间。最后祝你成功！<br><br>好，现在开始。';
  addInt(opening);
  speak('你好，首先祝贺你顺利通过了笔试，欢迎参加今天的面试。请你来是希望通过面对面的交谈，增进对你的了解。我们会问你一些问题，对于我们的问题，希望你能认真和实事求是地回答。你回答问题的时间是8分钟，不必紧张，好好把握回答时间。最后祝你成功！好，现在开始。');
}

// ---- 考生就绪 ----
function onReady() {
  setState(STATES.Q1);
  setStep(2, '第一题');
  enableInput(true);
  showBtns(['btnDone', 'btnSkip']);

  const answerInput = $('answerInput');
  if (answerInput) answerInput.focus();

  addSys('<strong>考试正式开始。</strong>计时开始，保持安静作答。');
  addInt(showQCard(`${q1Type}类`, q1));
  speak(`请听第一题：${q1}`);

  startTimer();
}

// ---- 回答完毕 ----
export function finishAnswer() {
  if (state === STATES.Q1 || state === STATES.A1) {
    // 第一题答完 → 跳转到第二题
    setState(STATES.A1);
    a1 = ($('answerInput')?.value?.trim() || '(未作答)');
    addCand(a1);
    stopRecording();
    enableInput(false);
    showBtns([]);

    setTimeout(() => {
      setState(STATES.Q2);
      setStep(3, '第二题');
      enableInput(true);
      showBtns(['btnDone', 'btnSkip']);

      const answerInput = $('answerInput');
      if (answerInput) {
        answerInput.value = '';
        answerInput.focus();
      }

      addInt(showQCard(`${q2Type}类`, q2));
      speak(`第一题回答完毕。请听第二题：${q2}`);
    }, 1500);

  } else if (state === STATES.Q2 || state === STATES.A2) {
    // 第二题答完 → 打分
    setState(STATES.A2);
    a2 = ($('answerInput')?.value?.trim() || '(未作答)');
    addCand(a2);
    stopRecording();
    enableInput(false);
    showBtns([]);
    stopTimer();
    setStep(7, '打分');
    callLLM(false);
  }
}

// ---- 提前结束 ----
export function skipTiming() {
  stopTimer();
  addSys('\u23F9 考生提前结束面试。');
  enableInput(false);
  showBtns([]);

  if (state === STATES.Q1 || state === STATES.A1) {
    a1 = ($('answerInput')?.value?.trim() || '(未作答)');
    a2 = '(未作答)';
    addCand(a1);
  } else {
    a2 = ($('answerInput')?.value?.trim() || '(未作答)');
    addCand(a2);
  }

  stopRecording();
  setState(STATES.A2);
  setStep(7, '打分');
  callLLM(false);
}

// ---- 超时处理（由 timer.js 调用） ----
export function doTimeoutReview() {
  setStep(6, '超时处理');
  setState(STATES.REVIEWING);
  callLLM(true);
}

// ---- 重置 ----
export function resetUI() {
  setState(STATES.DONE);
  showBtns(['btnStart']);

  const btnStart = $('btnStart');
  if (btnStart) {
    btnStart.textContent = '再来一次';
    btnStart.className = 'btn btn-primary';
    btnStart.onclick = startInterview;
  }

  enableInput(false);
  showTimer(false);
}

// ---- 获取当前面试数据 ----
export function getInterviewData() {
  return { q1, q2, a1, a2, q1Type, q2Type };
}
