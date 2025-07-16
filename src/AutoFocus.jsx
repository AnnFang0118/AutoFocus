import React, { useRef, useState } from 'react';

const CameraViewer = () => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [info, setInfo] = useState('請點擊「啟動偵測」按鈕以啟動相機偵測');

  // 關鍵字窮舉法評分表
  const keywordWeights = [
    { keywords: ['macro', 'microscope', 'close-up'], score: 5 },
    { keywords: ['tele', 'telephoto', 'zoom'], score: 4 },
    { keywords: ['main', 'standard', 'default'], score: 3 },
    { keywords: ['ultrawide', 'wide-angle'], score: 2 },
    { keywords: ['back'], score: 1 },
    { keywords: ['front', 'selfie'], score: -2 },
    { keywords: ['depth', 'bokeh', 'tof', '3d'], score: -3 },
    { keywords: ['ir', 'aux', 'unknown'], score: -5 },
  ];

  const scoreCameraLabel = (label = '') => {
    const l = label.toLowerCase();
    if (!l) return -999;
    let score = 0;
    for (const { keywords, score: kwScore } of keywordWeights) {
      if (keywords.some(k => l.includes(k))) score += kwScore;
    }
    if (/camera\s*0/.test(l)) score += 3;
    if (/camera\s*1/.test(l)) score -= 2;
    if (/camera\s*2/.test(l)) score += 2;
    return score;
  };

  const detectDevicePlatform = () => {
    const ua = navigator.userAgent;
    if (/android/i.test(ua)) return 'Android';
    if (/iphone/i.test(ua)) return 'iPhone';
    if (/ipad/i.test(ua)) return 'iPad';
    if (/macintosh/i.test(ua)) return 'Mac';
    if (/windows/i.test(ua)) return 'Windows';
    if (/linux/i.test(ua)) return 'Linux';
    return '未知平台';
  };

  const detectBrandFromUserAgent = () => {
    const ua = navigator.userAgent;
    if (/SM-|Galaxy|Samsung/i.test(ua)) return 'Samsung';
    if (/XQ-|SO-|Sony/i.test(ua)) return 'Sony';
    if (/Pixel/i.test(ua)) return 'Google Pixel';
    if (/iPhone/i.test(ua)) return 'Apple iPhone';
    if (/iPad/i.test(ua)) return 'Apple iPad';
    if (/MI|Redmi|Xiaomi/i.test(ua)) return 'Xiaomi';
    if (/OnePlus/i.test(ua)) return 'OnePlus';
    if (/OPPO/i.test(ua)) return 'OPPO';
    if (/Vivo/i.test(ua)) return 'Vivo';
    if (/ASUS|Zenfone/i.test(ua)) return 'ASUS';
    if (/HUAWEI|HONOR/i.test(ua)) return 'Huawei/Honor';
    return '未知品牌';
  };

  const gatherInfo = async () => {
    const lines = [];

    // 1. 先請求最寬鬆的相機權限，立即停掉串流
    try {
      const permStream = await navigator.mediaDevices.getUserMedia({ video: true });
      permStream.getTracks().forEach(t => t.stop());
      lines.push('✅ 已取得相機使用權限');
    } catch (permErr) {
      lines.push(`❌ 相機權限請求失敗：${permErr.message}`);
      setInfo(lines.join('\n'));
      return;
    }

    // 2. 顯示基本 UA / 平台 / 品牌
    lines.push(`\n🧠 User Agent:\n${navigator.userAgent}\n`);
    lines.push(`📱 預測平台: ${detectDevicePlatform()}`);
    lines.push(`🏷️ 預測品牌: ${detectBrandFromUserAgent()}`);

    // 3. UA-CH 高精度裝置資訊
    if (navigator.userAgentData?.getHighEntropyValues) {
      try {
        const uaDetails = await navigator.userAgentData.getHighEntropyValues([
          'platform','platformVersion','model','architecture','bitness','fullVersionList'
        ]);
        lines.push('\n🔍 UA-CH 裝置資訊（高精度）:');
        Object.entries(uaDetails).forEach(([k,v]) =>
          lines.push(`• ${k}: ${v}`)
        );
      } catch {
        lines.push('\n⚠️ 無法取得 UA-CH 裝置資訊');
      }
    } else {
      lines.push('\n⚠️ 瀏覽器不支援 UA-CH');
    }

    // 4. 列出所有 videoinput，並過濾後置鏡頭
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoInputs = devices.filter(d => d.kind === 'videoinput');
    const rearCameras = videoInputs.filter(d => !/(front|selfie)/i.test(d.label || ''));
    const candidates = rearCameras.length ? rearCameras : videoInputs;

    lines.push('\n📋 可用後置鏡頭（不含前鏡頭）:');
    candidates.forEach((d,i) => {
      lines.push(`相機 ${i+1}:`);
      lines.push(`• label: ${d.label || '(無標籤)'}`);
      lines.push(`• deviceId: ${d.deviceId || '(undefined)'}`);
    });

    // 5. Label 打分並顯示每支候選鏡頭的分數
    const scored = candidates.map(d => ({
      device: d,
      score: scoreCameraLabel(d.label)
    }));
    lines.push('\n📊 候選鏡頭與打分:');
    scored.forEach((s, i) => {
      lines.push(`鏡頭 ${i+1}: ${s.device.label || s.device.deviceId} → 分數 ${s.score}`);
    });

    // 6. 同分時優先 camera 0 的 tie-breaker
    // 暫排序看前兩名是否同分
    const temp = [...scored].sort((a, b) => b.score - a.score);
    if (temp.length > 1 && temp[0].score === temp[1].score) {
      const zeroCam = temp.find(s => /camera\s*0/i.test(s.device.label || ''));
      if (zeroCam) {
        scored.sort((a, b) => {
          if (a.device.deviceId === zeroCam.device.deviceId) return -1;
          if (b.device.deviceId === zeroCam.device.deviceId) return 1;
          return b.score - a.score;
        });
        lines.push('\n🔀 Tie-breaker: 同分時優先 camera 0');
      }
    }

    // 7. 選出最高分者並說明理由
    scored.sort((a, b) => b.score - a.score);
    let best = scored[0];
    if (best.score > 0) {
      lines.push(`\n💡 選擇理由：${best.device.label || best.device.deviceId} 擁有最高分 ${best.score}`);
    } else {
      lines.push('\n💡 選擇理由：所有關鍵字比對分數均 ≤ 0，使用第一支候選');
      best = scored[2];
    }
    lines.push(`\n🌟 推薦後置鏡頭: ${best.device.label || best.device.deviceId}`);

    // 8. 停掉舊串流
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }

    // 9. 啟動推薦鏡頭
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: best.device.deviceId,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          facingMode: 'environment',
        }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      lines.push('\n✅ 已啟動推薦後置鏡頭');
    } catch (e) {
      lines.push(`\n❌ 啟動推薦鏡頭失敗：${e.message}`);
    }

    // 10. 顯示 MediaTrack Settings & Capabilities
    if (streamRef.current) {
      const track = streamRef.current.getVideoTracks()[0];
      lines.push('\n🎥 MediaTrack Settings:');
      Object.entries(track.getSettings()).forEach(([k,v]) =>
        lines.push(`• ${k}: ${v}`)
      );
      if (typeof track.getCapabilities === 'function') {
        lines.push('\n📈 MediaTrack Capabilities:');
        Object.entries(track.getCapabilities()).forEach(([k,v]) =>
          lines.push(`• ${k}: ${JSON.stringify(v)}`)
        );
      }
    }

    setInfo(lines.join('\n'));
  };

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '20px' }}>
      <button
        onClick={gatherInfo}
        style={{ marginBottom: '10px', padding: '8px 16px', fontSize: '16px' }}
      >
        啟動偵測最佳後鏡頭
      </button>

      <h2>📷 相機畫面</h2>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          width: '100%',
          maxWidth: '500px',
          border: '1px solid black',
          borderRadius: '8px',
        }}
      />

      <h2 style={{ marginTop: '20px' }}>📦 裝置詳細資訊</h2>
      <pre
        style={{
          whiteSpace: 'pre-wrap',
          background: '#000000ff',
          color: 'white',
          padding: '15px',
          borderRadius: '8px',
          maxWidth: '500px',
          overflowX: 'auto',
          fontSize: '14px',
          lineHeight: '1.5',
          wordBreak: 'break-word',
        }}
      >
        {info}
      </pre>
    </div>
  );
};

export default CameraViewer;
