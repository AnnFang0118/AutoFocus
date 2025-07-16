import React, { useEffect, useRef, useState } from 'react';

const CameraViewer = () => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [info, setInfo] = useState('載入中...');

  // 打分關鍵字表
  const keywordWeights = [
    { keywords: ['macro', 'microscope', 'close-up'], score: 5 },
    { keywords: ['tele', 'telephoto', 'zoom'], score: 4 },
    { keywords: ['main', 'standard', 'default'], score: 3 },
    { keywords: ['back'], score: 2 },
    { keywords: ['ultrawide', 'wide-angle', 'wide'], score: 1 },
    { keywords: ['front', 'selfie'], score: -2 },
    { keywords: ['depth', 'bokeh', 'tof', '3d'], score: -3 },
    { keywords: ['ir', 'aux', 'unknown'], score: -5 }
  ];

  // 根據 label 打分
  const scoreCameraLabel = (label = '') => {
    const l = label.toLowerCase();
    if (!l) return -999;
    let score = 0;
    for (const { keywords, score: kwScore } of keywordWeights) {
      if (keywords.some(k => l.includes(k))) score += kwScore;
    }
    // fallback：Camera 0 通常為主鏡頭
    if (/camera\s?0/.test(l)) score += 2;
    return score;
  };

  // 探測鏡頭 focusDistance 能力
  const probeFocusDistance = async (deviceId) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { deviceId } });
      const track = stream.getVideoTracks()[0];
      const caps = track.getCapabilities();
      stream.getTracks().forEach(t => t.stop());
      return caps.focusDistance || null;
    } catch {
      return null;
    }
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

  useEffect(() => {
    const gatherInfo = async () => {
      try {
        const lines = [];
        
        // 基本 UA 與裝置資訊
        lines.push(`🧠 User Agent:\n${navigator.userAgent}\n`);
        lines.push(`📱 預測平台: ${detectDevicePlatform()}`);
        lines.push(`🏷️ 預測品牌: ${detectBrandFromUserAgent()}`);

        // UA-CH
        if (navigator.userAgentData?.getHighEntropyValues) {
          try {
            const uaDetails = await navigator.userAgentData.getHighEntropyValues([
              'platform', 'platformVersion', 'model', 'architecture', 'bitness', 'fullVersionList'
            ]);
            lines.push(`\n🔍 UA-CH 裝置資訊（高精度）:`);
            Object.entries(uaDetails).forEach(([key, value]) => {
              lines.push(`• ${key}: ${value}`);
            });
          } catch {
            lines.push('\n⚠️ 無法取得 UA-CH 裝置資訊（可能未授權）');
          }
        } else {
          lines.push('\n⚠️ 瀏覽器不支援 User-Agent Client Hints (UA-CH)');
        }

        // 列出並評估所有鏡頭，排除前置鏡頭
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter(
          d => d.kind === 'videoinput' && !/(front|selfie)/i.test(d.label || '')
        );
        if (videoInputs.length === 0) throw new Error('找不到任何後置或主鏡頭裝置');

        // 打分 & 探測
        const cams = await Promise.all(
          videoInputs.map(async (d, idx) => {
            const label = d.label || `Camera ${idx}`;
            const labelScore = scoreCameraLabel(label);
            const focusDist = await probeFocusDistance(d.deviceId);
            return { ...d, label, labelScore, focusDist };
          })
        );

        lines.push('\n📋 可用鏡頭裝置 (排除前鏡頭):');
        cams.forEach((cam, i) => {
          lines.push(`鏡頭 ${i + 1}:`);
          lines.push(`• label: ${cam.label}`);
          lines.push(`• labelScore: ${cam.labelScore}`);
          lines.push(`• focusDistance: ${cam.focusDist ? `min=${cam.focusDist.min}, max=${cam.focusDist.max}` : '(不支援)'}`);
        });

        // 選出最佳鏡頭
        let best = cams[0];
        const withFocus = cams.filter(c => c.focusDist);
        if (withFocus.length > 0) {
          best = withFocus.reduce((a, b) => (a.focusDist.min < b.focusDist.min ? a : b));
        } else {
          best = cams.reduce((a, b) => (a.labelScore > b.labelScore ? a : b));
        }
        lines.push(`\n🌟 推薦鏡頭 (不含前鏡頭): ${best.label}`);

        // 關閉舊串流
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop());
        }

        // 啟用最佳鏡頭
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: best.deviceId, width: { ideal: 1920 }, height: { ideal: 1080 } }
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        // 顯示 MediaTrack 設定與能力
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          lines.push('\n🎥 MediaTrack Settings:');
          Object.entries(videoTrack.getSettings()).forEach(([key, value]) => {
            lines.push(`• ${key}: ${value}`);
          });
          if (typeof videoTrack.getCapabilities === 'function') {
            lines.push('\n📈 MediaTrack Capabilities:');
            Object.entries(videoTrack.getCapabilities()).forEach(([key, value]) => {
              lines.push(`• ${key}: ${JSON.stringify(value)}`);
            });
          }
        }

        lines.push('\n📌 註：此推薦排除前鏡頭，僅選擇後置鏡頭。');
        setInfo(lines.join('\n'));
      } catch (err) {
        console.error('Error:', err);
        setInfo(`❌ 錯誤：${err.message}`);
      }
    };

    gatherInfo();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, []);

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '20px' }}>
      <h2>📷 相機畫面</h2>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ width: '100%', maxWidth: '500px', border: '1px solid black', borderRadius: '8px' }}
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
          wordBreak: 'break-word'
        }}
      >
        {info}
      </pre>
    </div>
  );
};

export default CameraViewer;
