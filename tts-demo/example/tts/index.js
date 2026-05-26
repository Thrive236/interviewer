(function () {
  const APPID = "xxx";
  const API_SECRET = "xxx";
  const API_KEY = "xxx";

  let btnControl = document.getElementById("controll_tts");
  let btnStatus = "UNDEFINED"; // "UNDEFINED" "CONNECTING" "PLAY" "STOP"
  function changeBtnStatus(status) {
    btnStatus = status;
    if (status === "UNDEFINED") {
      btnControl.innerText = "立即合成";
    } else if (status === "CONNECTING") {
      btnControl.innerText = "正在合成";
    } else if (status === "PLAY") {
      btnControl.innerText = "停止播放";
    } else if (status === "STOP") {
      btnControl.innerText = "重新播放";
    }
  }

  const audioPlayer = new AudioPlayer("../../dist");
  audioPlayer.onPlay = () => {
    changeBtnStatus("PLAY");
  };
  audioPlayer.onStop = (audioDatas) => {
    console.log(audioDatas);
    btnStatus === "PLAY" && changeBtnStatus("STOP");
  };
  function getWebSocketUrl(apiKey, apiSecret) {
    var url = "wss://tts-api.xfyun.cn/v2/tts";
    var host = location.host;
    var date = new Date().toGMTString();
    var algorithm = "hmac-sha256";
    var headers = "host date request-line";
    var signatureOrigin = `host: ${host}\ndate: ${date}\nGET /v2/tts HTTP/1.1`;
    var signatureSha = CryptoJS.HmacSHA256(signatureOrigin, apiSecret);
    var signature = CryptoJS.enc.Base64.stringify(signatureSha);
    var authorizationOrigin = `api_key="${apiKey}", algorithm="${algorithm}", headers="${headers}", signature="${signature}"`;
    var authorization = btoa(authorizationOrigin);
    url = `${url}?authorization=${authorization}&date=${date}&host=${host}`;
    return url;
  }
  function encodeText(text, type) {
    if (type === "unicode") {
      let buf = new ArrayBuffer(text.length * 4);
      let bufView = new Uint16Array(buf);
      for (let i = 0, strlen = text.length; i < strlen; i++) {
        bufView[i] = text.charCodeAt(i);
      }
      let binary = "";
      let bytes = new Uint8Array(buf);
      let len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return window.btoa(binary);
    } else {
      return Base64.encode(text);
    }
  }

  let ttsWS;
  function connectWebSocket() {
    const url = getWebSocketUrl(API_KEY, API_SECRET);
    if ("WebSocket" in window) {
      ttsWS = new WebSocket(url);
    } else if ("MozWebSocket" in window) {
      ttsWS = new MozWebSocket(url);
    } else {
      alert("浏览器不支持WebSocket");
      return;
    }
    changeBtnStatus("CONNECTING");
    
    ttsWS.onopen = (e) => {
      audioPlayer.start({
        autoPlay: true,
        sampleRate: 16000,
        resumePlayDuration: 1000
      });
      changeBtnStatus("PLAY");
      var text =
        document.getElementById("textarea").value.trim() ||
        "请输入您要合成的文本";
      var tte = document.getElementById("tte").checked ? "unicode" : "UTF8";
      var params = {
        common: {
          app_id: APPID,
        },
        business: {
          aue: "raw",
          auf: "audio/L16;rate=16000",
          vcn: document.getElementById("vcn").value,
          speed: +document.getElementById("speed").value,
          volume: +document.getElementById("volume").value,
          pitch: +document.getElementById("pitch").value,
          bgs: 1,
          tte,
        },
        data: {
          status: 2,
          text: encodeText(text, tte),
        },
      };
      ttsWS.send(JSON.stringify(params));
    };
    ttsWS.onmessage = (e) => {
      let jsonData = JSON.parse(e.data);
      // 合成失败
      if (jsonData.code !== 0) {
        console.error(jsonData);
        changeBtnStatus("UNDEFINED");
        return;
      }
      audioPlayer.postMessage({
        type: "base64",
        data: jsonData.data.audio,
        isLastData: jsonData.data.status === 2,
      });
      if (jsonData.code === 0 && jsonData.data.status === 2) {
        ttsWS.close();
      }
    };
    ttsWS.onerror = (e) => {
      console.error(e);
    };
    ttsWS.onclose = (e) => {
      // console.log(e);
    };
  }


  document.getElementById("textarea").onchange =
    document.getElementById("speed").onchange =
    document.getElementById("volume").onchange =
    document.getElementById("pitch").onchange =
    document.getElementById("vcn").onchange =
      () => {
        changeBtnStatus("UNDEFINED");
        ttsWS?.close();
        audioPlayer.reset();
      };
  document.getElementById("tte").onchange = (e) => {
    let checked = e.target.checked;
    let text = `
            春江花月夜
    春江潮水连海平，海上明月共潮生。
    滟滟随波千万里，何处春江无月明。
    江流宛转绕芳甸，月照花林皆似霰。
    空里流霜不觉飞，汀上白沙看不见。
    江天一色无纤尘，皎皎空中孤月轮。
    江畔何人初见月？江月何年初照人？
    人生代代无穷已，江月年年望相似。
    不知江月待何人，但见长江送流水。
    白云一片去悠悠，青枫浦上不胜愁。
    谁家今夜扁舟子？何处相思明月楼？
    可怜楼上月徘徊，应照离人妆镜台。
    玉户帘中卷不去，捣衣砧上拂还来。
    此时相望不相闻，愿逐月华流照君。
    鸿雁长飞光不度，鱼龙潜跃水成文。
    昨夜闲潭梦落花，可怜春半不还家。
    江水流春去欲尽，江潭落月复西斜。
    斜月沉沉藏海雾，碣石潇湘无限路。
    不知乘月几人归，落月摇情满江树。`;
    document.getElementById("vcn").value = "xiaoyan";
    if (checked) {
      document.getElementById("vcn").value = "yingying";
      text =
        "สวัสดียินดีต้อนรับทุกท่านสู่การใช้ระบบการสังเคราะห์เสียงพูดในเที่ยวบินของมหาวิทยาลัยวิทยาศาสตร์และเทคโนโลยี";
    }
    document.getElementById("textarea").value = text;
    changeBtnStatus("UNDEFINED");
    ttsWS?.close();
    audioPlayer.reset();
  };
  document.getElementById("controll_tts").onclick = function () {
    
    if (btnStatus === "UNDEFINED") {
      // 开始合成
      connectWebSocket();
    } else if (btnStatus === "CONNECTING") {
      // 停止合成
      changeBtnStatus("UNDEFINED");
      ttsWS?.close();
      audioPlayer.reset();
      return;
    } else if (btnStatus === "PLAY") {
      audioPlayer.stop();
    } else if (btnStatus === "STOP") {
      audioPlayer.play();
    }
  };
  document.getElementById("download_pcm").onclick = function () {
    const blob = audioPlayer.getAudioDataBlob("pcm")
    if (!blob) {
      return
    }
    let defaultName = new Date().getTime();
    let node = document.createElement("a");
    node.href = window.URL.createObjectURL(blob);
    node.download = `${defaultName}.pcm`;
    node.click();
    node.remove();
  };
  
  document.getElementById("download_wav").onclick = function () {
    const blob = audioPlayer.getAudioDataBlob("wav")
  if (!blob) {
    return
  }
    let defaultName = new Date().getTime();
    let node = document.createElement("a");
    node.href = window.URL.createObjectURL(blob);
    node.download = `${defaultName}.wav`;
    node.click();
    node.remove();
  };
})();
