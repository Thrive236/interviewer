// ============================================================
// State — 面试状态机
// ============================================================

export const STATES = {
  IDLE: 0,
  OPENING: 1,
  READY_WAIT: 2,
  Q1: 3,
  A1: 4,
  Q2: 5,
  A2: 6,
  TIMEOUT: 7,
  SCORING: 8,
  REVIEWING: 9,
  DONE: 10
};

export const stateNames = [
  '空闲', '开场', '等待就绪', '第一题', '答第一题',
  '第二题', '答第二题', '超时', '评分中', '评审中', '完成'
];

export let state = STATES.IDLE;

export function setState(s) {
  state = s;
  if (typeof window !== 'undefined' && window._log) {
    window._log(`State → ${stateNames[s]}`);
  }
}

export function isIdle() {
  return state === STATES.IDLE || state === STATES.DONE;
}

export function isAnswering() {
  return state === STATES.Q1 || state === STATES.A1 ||
         state === STATES.Q2 || state === STATES.A2;
}

export function isScoring() {
  return state === STATES.SCORING || state === STATES.REVIEWING;
}
