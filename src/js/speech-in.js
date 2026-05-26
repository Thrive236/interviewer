// ============================================================
// 🎤 Speech-In — 语音输入（getUserMedia + 讯飞 WebSocket 实时流式）
//
// 流程：点击🎤 → getUserMedia 录音 → 讯飞 WebSocket 实时识别 → 文字填入 textarea
// 降级：讯飞未配置 → Web Speech API → 不可用则引导输入法语音
// ============================================================

import { getSettings } from './storage.js';
import { $ } from './ui.js';

let mediaStream = null;
let mediaRecorder = null;
let ws = null;
let recording = false;
let finalText = '';

// ---- 主入口 ----
export function isRecording() {
  return recording;
}

export async function toggleMic() {
  if (recording) {
    stopRecording();
    return;
  }

  // 第一优先：讯飞 WebSocket 实时识别
  const settings = getSettings();
  if (settings.xfAppId && settings.xfApiKey && settings.xfApiSecret) {
    startXfyunRecording(settings);
    return;
  }

  // 第二优先：Web Speech API（Google 引擎，海外可用）
  if (typeof window !== 'undefined' &&
      (window.SpeechRecognition || window.webkitSpeechRecognition)) {
    startWebSpeech();
    return;
  }

  // 不可用：引导输入法
  showInputMethodGuide();
}

// ---- 引导用户使用输入法语音 ----
function showInputMethodGuide() {
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const answerInput = $('answerInput');

  if (isMobile) {
    // 聚焦输入框，让键盘弹出，用户看到键盘上的语音按钮
    if (answerInput) {
      answerInput.focus();
      answerInput.placeholder = '💡 请点击键盘上的 🎤 语音按钮（讯飞/搜狗输入法均有）';
      setTimeout(() => {
        answerInput.placeholder = '在此输入你的回答，或点击🎤语音输入...';
      }, 5000);
    }
  } else {
    alert('⚠️ 语音输入需要配置讯飞 API\n\n请在右上角 ⚙️ 设置中填入讯飞 AppID、APIKey、APISecret。\n\n注册地址：https://console.xfyun.cn\n领取「语音听写」服务即可（每天 500 次免费）。\n\n或使用电脑端输入法自带的语音输入功能。');
  }
}

// ============== 讯飞 WebSocket 实时流式识别 ==============

async function startXfyunRecording(settings) {
  // 请求麦克风权限
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: 16000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true
      }
    });
  } catch (e) {
    alert('无法访问麦克风：' + e.message + '\n\n请允许浏览器使用麦克风权限。');
    return;
  }

  // 创建 AudioContext 用于 PCM 采集
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
  const source = audioCtx.createMediaStreamSource(mediaStream);
  const processor = audioCtx.createScriptProcessor(2048, 1, 1);
  source.connect(processor);
  processor.connect(audioCtx.destination);

  // 初始化 UI
  recording = true;
  const existingText = $('answerInput')?.value || '';
  const micBtn = $('micBtn');
  if (micBtn) {
    micBtn.classList.add('recording');
    micBtn.textContent = '\u23F9'; // ⏹
  }
  const answerInput = $('answerInput');
  if (answerInput) {
    answerInput.placeholder = '正在聆听...（讯飞实时识别）';
  }

  // 构建鉴权 URL
  const hostUrl = 'iat-api.xfyun.cn';
  const path = '/v2/iat';
  const date = new Date().toUTCString();

  // HMAC-SHA256 签名
  const signatureOrigin = `host: ${hostUrl}\ndate: ${date}\nGET ${path} HTTP/1.1`;
  const encoder = new TextEncoder();
  const keyData = encoder.encode(settings.xfApiSecret);
  const msgData = encoder.encode(signatureOrigin);
  const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)));
  const authorizationOrigin = `api_key="${settings.xfApiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signatureB64}"`;
  const authorization = btoa(authorizationOrigin);

  const wsUrl = `wss://${hostUrl}${path}?authorization=${encodeURIComponent(authorization)}&date=${encodeURIComponent(date)}&host=${encodeURIComponent(hostUrl)}`;

  // 连接 WebSocket
  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    // 发送开始帧
    const frame = {
      common: { app_id: settings.xfAppId },
      business: {
        language: 'zh_cn',
        domain: 'iat',
        accent: 'mandarin',
        vad_eos: 10000, // 静音10秒不断开会话，sn 自然递增不重置
        dwa: 'wpgs',    // 动态修正
        ptt: 1,         // 标点
        rlang: 'zh-cn',
        nunum: 0
      },
      data: {
        status: 0,  // 开始
        format: 'audio/L16;rate=16000',
        encoding: 'raw',
        audio: ''
      }
    };
    ws.send(JSON.stringify(frame));
  };

  // 逐句累积：sn 为 key 保存每句话，中间结果自动覆盖同句的旧文本
  const sentences = {};
  if (existingText) sentences[-1] = existingText;

  ws.onmessage = (event) => {
    try {
      const result = JSON.parse(event.data);
      if (result.code !== 0) {
        console.error('讯飞识别错误:', result);
        return;
      }

      if (result.data && result.data.result) {
        const wsData = result.data.result;
        const sn = wsData.sn;

        let text = '';
        if (wsData.ws) {
          wsData.ws.forEach(w => {
            w.cw.forEach(c => { text += c.w; });
          });
        }

        if (text) {
          // 同 sn 覆盖（修正），新 sn 新增（新句子），互不干扰
          sentences[sn] = text;

          // 按 sn 升序拼接
          const fullText = Object.keys(sentences)
            .sort((a, b) => Number(a) - Number(b))
            .map(k => sentences[k])
            .join('');

          if (answerInput) {
            answerInput.value = fullText;
            answerInput.scrollTop = answerInput.scrollHeight;
          }
        }
      }
    } catch (e) {}
  };

  ws.onerror = (e) => {
    console.error('讯飞 WebSocket 错误');
    stopRecording();
    showInputMethodGuide();
  };

  ws.onclose = () => {
    // Normal closure
  };

  // 音频处理：发送 PCM 数据
  processor.onaudioprocess = (e) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    const inputData = e.inputBuffer.getChannelData(0);
    const pcm16 = new Int16Array(inputData.length);

    for (let i = 0; i < inputData.length; i++) {
      let s = Math.max(-1, Math.min(1, inputData[i]));
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }

    const base64 = arrayBufferToBase64(pcm16.buffer);
    const frame = {
      data: {
        status: 1,  // 中间帧
        format: 'audio/L16;rate=16000',
        encoding: 'raw',
        audio: base64
      }
    };
    ws.send(JSON.stringify(frame));
  };

  // Store for cleanup
  window._xfAudioCtx = audioCtx;
  window._xfProcessor = processor;
}

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function stopRecording() {
  if (!recording) return;
  recording = false;

  // 停止 Web Speech
  if (window._webSpeech) {
    try { window._webSpeech.stop(); } catch (e) {}
    window._webSpeech = null;
  }

  // 发送结束帧
  if (ws && ws.readyState === WebSocket.OPEN) {
    const frame = {
      data: {
        status: 2,  // 结束
        format: 'audio/L16;rate=16000',
        encoding: 'raw',
        audio: ''
      }
    };
    try { ws.send(JSON.stringify(frame)); } catch (e) {}
  }

  // 等 500ms 让最后的结果回来再关闭
  setTimeout(() => {
    if (ws) {
      ws.close();
      ws = null;
    }
  }, 500);

  // 停止录音
  if (mediaStream) {
    mediaStream.getTracks().forEach(t => t.stop());
    mediaStream = null;
  }

  // 关闭 AudioContext
  if (window._xfAudioCtx) {
    try { window._xfAudioCtx.close(); } catch (e) {}
    window._xfAudioCtx = null;
  }
  if (window._xfProcessor) {
    window._xfProcessor.disconnect();
    window._xfProcessor = null;
  }

  // 恢复 UI
  const micBtn = $('micBtn');
  if (micBtn) {
    micBtn.classList.remove('recording');
    micBtn.textContent = '\uD83C\uDFA4'; // 🎤
  }

  const answerInput = $('answerInput');
  if (answerInput) {
    answerInput.placeholder = '在此输入你的回答，或点击🎤语音输入...';
  }
}

// ============== Web Speech API（降级方案） ==============

let webSpeechFinal = '';

function startWebSpeech() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    showInputMethodGuide();
    return;
  }

  const recognition = new SR();
  recognition.lang = 'zh-CN';
  recognition.interimResults = true;
  recognition.continuous = true;
  recognition.maxAlternatives = 1;

  recording = true;
  webSpeechFinal = $('answerInput')?.value || '';

  const micBtn = $('micBtn');
  if (micBtn) {
    micBtn.classList.add('recording');
    micBtn.textContent = '\u23F9';
  }

  const answerInput = $('answerInput');
  if (answerInput) answerInput.placeholder = '正在聆听...（Google 语音）';

  recognition.onresult = e => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const transcript = e.results[i][0].transcript;
      if (e.results[i].isFinal) {
        webSpeechFinal += transcript;
      } else {
        interim += transcript;
      }
    }
    if (answerInput) {
      answerInput.value = webSpeechFinal + interim;
      answerInput.scrollTop = answerInput.scrollHeight;
    }
  };

  recognition.onerror = (e) => {
    console.error('Web Speech 错误:', e.error);
    // 如果是 no-speech 或 audio-capture 错误，忽略继续
    if (e.error === 'no-speech' || e.error === 'aborted') return;
    stopRecording();
    showInputMethodGuide();
  };

  recognition.onend = () => {
    if (recording) {
      // continuous 模式下通常自动重启，手动兜底
      try { recognition.start(); } catch (e) {}
    }
  };

  recognition.start();

  // Store for cleanup
  window._webSpeech = recognition;
}
