// ============================================================
// Timer — 8分钟面试计时器
// ============================================================

import { $, showTimer, addSys, enableInput, showBtns } from './ui.js';
import { STATES, state, setState } from './state.js';
import { speak } from './speech-out.js';

const TOTAL_SEC = 480;
let timerInterval = null;
let elapsedSec = 0;

export function getElapsed() {
  return elapsedSec;
}

export function startTimer() {
  showTimer(true);
  elapsedSec = 0;
  const display = $('timerDisplay');
  if (display) {
    display.textContent = '8:00';
    display.className = 'timer-display';
  }
  timerInterval = setInterval(tick, 1000);
}

function tick() {
  elapsedSec++;
  const rem = TOTAL_SEC - elapsedSec;
  const m = Math.floor(rem / 60);
  const s = rem % 60;
  const display = $('timerDisplay');
  if (display) {
    display.textContent = `${m}:${String(s).padStart(2, '0')}`;
  }

  if (rem <= 60 && rem > 0) {
    if (display) display.className = 'timer-display warn';
    if (rem === 60) {
      addSys('\u23F0 <strong>提醒：答题时间剩余 1 分钟。</strong>');
      speak('提醒考生，答题时间剩余1分钟。');
    }
  } else if (rem <= 0) {
    if (display) {
      display.className = 'timer-display overtime';
      display.textContent = '超时!';
    }
    clearInterval(timerInterval);
    timerInterval = null;
    handleTimeout();
  }
}

export function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  const display = $('timerDisplay');
  if (display) display.className = 'timer-display';
}

function handleTimeout() {
  stopTimer();
  enableInput(false);
  showBtns([]);
  addSys('\u23F0 <strong>8分钟已到，面试结束。</strong>');
  addSys('\u26A0\uFE0F 超时 — 成绩直接判为 <strong style="color:var(--danger)">0 分</strong>');
  setState(STATES.TIMEOUT);
  setTimeout(() => {
    // trigger LLM for timeout review
    if (window._doTimeoutReview) window._doTimeoutReview();
  }, 2000);
}

export function isTimerRunning() {
  return timerInterval !== null;
}
