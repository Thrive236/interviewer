// ============================================================
// 🔊 Speech-Out — 语音播报（三层兜底）
//
// ① 讯飞流式 TTS（超拟人发音 x4_lingxiaoxuan）— 首选
// ② SpeechSynthesis（浏览器原生，选 Xiaoxiao）— 降级
// ③ 纯文字显示 — 最终兜底
// ============================================================

import { getSettings } from './storage.js';
import { addSys } from './ui.js';

let ttsVoice = null;

// ---- 拟人化中文语音优先级列表 ----
// 按自然度从高到低排列，覆盖 Windows / macOS / Android / iOS
const VOICE_CANDIDATES = [
  // Windows 神经语音 — 女声（真人录音级自然度）
  'Xiaoxiao',          // Microsoft Xiaoxiao Online (Natural)
  'Xiaoyi',            // Microsoft Xiaoyi Online (Natural)
  'Xiaobei',           // Microsoft Xiaobei Online (Natural)
  // Windows 神经语音 — 男声
  'Yunyang',           // Microsoft Yunyang Online (Natural)
  'Yunxi',             // Microsoft Yunxi Online (Natural)
  'Yunjian',           // Microsoft Yunjian Online (Natural)
  'Yunxia',            // Microsoft Yunxia Online (Natural)
  // Windows 标准语音 — 女声
  'Yaoyao',            // 较自然
  'Huihui',            // 偏机械，兜底
  // Windows 标准语音 — 男声
  'Kangkang',
  // macOS / iOS — 女声
  'Tingting',
  'Mei-Jia',
  'Sin-Ji',
  // Android / Chrome
  'Google 普通话',
  'zh-CN',
];

// ---- 初始化原生语音 ----
export function initNativeTTS() {
  if (typeof speechSynthesis === 'undefined' || !speechSynthesis) return;

  const pickVoice = (voices) => {
    if (!voices || !voices.length) return null;

    // 1. 最佳：候选名 + Online + Natural（微软神经语音）
    for (const candidate of VOICE_CANDIDATES) {
      const found = voices.find(v =>
        v.lang.startsWith('zh') &&
        v.name.includes(candidate) &&
        v.name.includes('Online') &&
        v.name.includes('Natural')
      );
      if (found) { console.log('[TTS] 选中神经语音:', found.name); return found; }
    }

    // 2. 候选名 + Natural（某些系统可能没有 Online 标记）
    for (const candidate of VOICE_CANDIDATES) {
      const found = voices.find(v =>
        v.lang.startsWith('zh') &&
        v.name.includes(candidate) &&
        v.name.includes('Natural')
      );
      if (found) { console.log('[TTS] 选中自然语音:', found.name); return found; }
    }

    // 3. 候选名 + Online
    for (const candidate of VOICE_CANDIDATES) {
      const found = voices.find(v =>
        v.lang.startsWith('zh') &&
        v.name.includes(candidate) &&
        v.name.includes('Online')
      );
      if (found) { console.log('[TTS] 选中在线语音:', found.name); return found; }
    }

    // 4. 候选名 + Premium / Enhanced
    for (const candidate of VOICE_CANDIDATES) {
      const found = voices.find(v =>
        v.lang.startsWith('zh') &&
        v.name.includes(candidate) &&
        (v.name.includes('Premium') || v.name.includes('Enhanced') || v.name.includes('Wavenet'))
      );
      if (found) { console.log('[TTS] 选中增强语音:', found.name); return found; }
    }

    // 5. 仅匹配候选名
    for (const candidate of VOICE_CANDIDATES) {
      const found = voices.find(v =>
        v.lang.startsWith('zh') &&
        v.name.includes(candidate)
      );
      if (found) { console.log('[TTS] 选中标准语音:', found.name); return found; }
    }

    // 6. 任意中文语音兜底
    const fallback = voices.find(v => v.lang.startsWith('zh')) || null;
    if (fallback) console.log('[TTS] 兜底语音:', fallback.name);
    return fallback;
  };

  const loadVoices = () => {
    ttsVoice = pickVoice(speechSynthesis.getVoices());
  };

  loadVoices();
  speechSynthesis.onvoiceschanged = loadVoices;
}

// ---- 检查原生 TTS 是否可用 ----
function nativeTTSAvailable() {
  if (typeof speechSynthesis === 'undefined' || !speechSynthesis) return false;
  // 尝试获取中文语音列表
  const voices = speechSynthesis.getVoices();
  return voices.some(v => v.lang.startsWith('zh'));
}

// ---- 主入口 ----
export function speak(text) {
  if (!text) return;

  const settings = getSettings();

  // 第一优先：讯飞 TTS
  if (settings.xfAppId && settings.xfApiKey && settings.xfApiSecret) {
    console.log('[TTS] 尝试讯飞语音合成，文本长度:', text.length);
    xfyunTTS(text, settings).then(() => {
      console.log('[TTS] ✅ 讯飞语音合成成功');
      addSys('🔊 讯飞超拟人语音');
    }).catch(err => {
      const msg = err.message || String(err);
      console.error('[TTS] 讯飞失败:', msg);
      addSys('⚠️ 讯飞语音失败: ' + msg.substring(0, 60) + '，降级到浏览器语音');
      nativeSpeak(text);
    });
    return;
  }

  // 第二优先：浏览器原生
  nativeSpeak(text);
}

// ---- 浏览器原生 TTS（拟人化参数） ----
function nativeSpeak(text) {
  if (typeof speechSynthesis === 'undefined' || !speechSynthesis) return;

  try {
    speechSynthesis.cancel();

    // 重新拉取 voice，防止 init 时 voices 尚未就绪
    if (!ttsVoice) {
      const voices = speechSynthesis.getVoices();
      for (const candidate of VOICE_CANDIDATES) {
        const found = voices.find(v =>
          v.lang.startsWith('zh') &&
          v.name.toLowerCase().includes(candidate.toLowerCase())
        );
        if (found) { ttsVoice = found; break; }
      }
      if (!ttsVoice) {
        ttsVoice = voices.find(v => v.lang.startsWith('zh')) || null;
      }
    }

    const u = new SpeechSynthesisUtterance(text);
    if (ttsVoice) u.voice = ttsVoice;
    u.lang = 'zh-CN';
    u.rate = 1.2;     // 面试官正常语速
    u.pitch = 1.0;     // 自然音高
    u.volume = 1.0;
    speechSynthesis.speak(u);
  } catch (e) {
    // 静默失败 — 文字已经在屏幕上显示
    console.log('TTS error:', e.message);
  }
}

// ---- 讯飞 WebSocket TTS（参照官方 JS demo） ----
async function xfyunTTS(text, settings) {
  const host = location.host;
  const path = '/v2/tts';
  const date = new Date().toGMTString();

  // HMAC-SHA256 签名（与官方 demo 一致）
  const signatureOrigin = `host: ${host}\ndate: ${date}\nGET /v2/tts HTTP/1.1`;
  const encoder = new TextEncoder();
  const keyData = encoder.encode(settings.xfApiSecret);
  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(signatureOrigin));
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)));

  const authRaw = `api_key="${settings.xfApiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signatureB64}"`;
  const authorization = btoa(authRaw);
  const wsUrl = `wss://tts-api.xfyun.cn${path}?authorization=${authorization}&date=${date}&host=${host}`;

  // UTF-8 Base64 编码（与官方 demo 的 encodeText(text, 'UTF8') 等效）
  const utf8Bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < utf8Bytes.length; i += 8192) {
    binary += String.fromCharCode(...utf8Bytes.slice(i, i + 8192));
  }
  const textB64 = btoa(binary);

  const params = {
    common: { app_id: settings.xfAppId },
    business: {
      aue: 'lame',
      auf: 'audio/L16;rate=16000',
      vcn: 'x4_lingxiaoxuan',
      speed: 50,
      volume: 100,
      pitch: 50,
      bgs: 1,
      tte: 'UTF8'
    },
    data: {
      status: 2,
      text: textB64
    }
  };

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const audioBase64Chunks = [];

    ws.onopen = () => {
      ws.send(JSON.stringify(params));
    };

    ws.onmessage = (e) => {
      // 官方 demo：每条消息都是 JSON 字符串，音频 base64 编码在内
      const jsonData = JSON.parse(e.data);
      if (jsonData.code !== 0) {
        console.error('[TTS] 讯飞返回错误:', jsonData);
        ws.close();
        reject(new Error(`讯飞TTS code=${jsonData.code}: ${jsonData.message || '未知'}`));
        return;
      }
      // 收集音频 base64 数据
      if (jsonData.data?.audio) {
        audioBase64Chunks.push(jsonData.data.audio);
      }
      // status === 2 表示传输完成
      if (jsonData.code === 0 && jsonData.data?.status === 2) {
        ws.close();
        if (audioBase64Chunks.length === 0) {
          reject(new Error('讯飞TTS: 未收到音频数据'));
          return;
        }
        // 合并 base64 并播放
        const mergedB64 = audioBase64Chunks.join('');
        const binaryStr = atob(mergedB64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'audio/mpeg' });
        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        audio.onended = () => { URL.revokeObjectURL(audioUrl); resolve(); };
        audio.onerror = () => { URL.revokeObjectURL(audioUrl); reject(new Error('音频播放失败')); };
        audio.play().catch(reject);
      }
    };

    ws.onerror = () => {
      reject(new Error('讯飞TTS WebSocket 连接失败（检查网络或凭证）'));
    };

    ws.onclose = (e) => {
      if (audioBase64Chunks.length === 0 && e.code !== 1000) {
        reject(new Error(`讯飞TTS 连接关闭 code=${e.code}`));
      }
    };
  });
}
