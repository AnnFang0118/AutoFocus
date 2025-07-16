import React, { useEffect, useRef, useState } from 'react';

const CameraViewer = () => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [info, setInfo] = useState('載入中...');

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
    let score = 0;
    if (!l) return -999; // 未授權、無標籤的鏡頭
    for (const { keywords, score: kwScore } of keywordWeights) {
      if (keywords.some(keyword => l.includes(keyword))) {
        score += kwScore;
      }
    }
    // Fallback：根據 Camera 0/1/2 推測
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

  useEffect(() => {
    const gatherInfo = async () => {
      try {
        const lines = [];

        // 基本 UA / 平台 / 品牌
        lines.push(`🧠 User Agent:\n${navigator.userAgent}\n`);
        lines.push(`📱 預測平台: ${detectDevicePlatform()}`);
        lines.push(`🏷️ 預測品牌: ${detectBrandFromUserAgent()}`);

        // UA-CH 高精度資訊
        if (navigator.userAgentData?.getHighEntropyValues) {
          try {
            const uaDetails = await navigator.userAgentData.getHighEntropyValues([
              'platform',
              'platformVersion',
              'model',
              'architecture',
              'bitness',
              'fullVersionList',
            ]);
            lines.push(`\n🔍 UA-CH 裝置資訊（高精度）:`);
            Object.entries(uaDetails).forEach(([key, value]) => {
              lines.push(`• ${key}: ${value}`);
            });
          } catch {
            lines.push('\n⚠️ 無法取得 UA-CH 裝置資訊');
          }
        } else {
          lines.push('\n⚠️ 瀏覽器不支援 UA-CH');
        }

        // 列出所有相機裝置
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter(d => d.kind === 'videoinput');

        // 過濾掉前鏡頭（label 包含 front/selfie）
        const rearCameras = videoInputs.filter(d =>
          !/(front|selfie)/i.test(d.label || '')
        );
        // 若全部都被過濾，退回原列表
        const candidates = rearCameras.length ? rearCameras : videoInputs;

        lines.push('\n📋 可用後置鏡頭（不含前鏡頭）:');
        candidates.forEach((device, idx) => {
          lines.push(`相機 ${idx + 1}:`);
          lines.push(`• label: ${device.label || '(無法取得)'}`);
          lines.push(`• deviceId: ${device.deviceId}\n`);
        });

        // 根據 label 計分並找出最高分
        const scored = candidates.map(d => ({
          ...d,
          score: scoreCameraLabel(d.label),
        }));
        const best = scored.sort((a, b) => b.score - a.score)[0];
        lines.push(`\n🌟 推薦後置鏡頭: ${best.label || '(無法判斷)'}`);

        // 停掉舊串流
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop());
        }

        // 打開推薦鏡頭
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: best.deviceId,
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            facingMode: 'environment',
          },
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        // 顯示 MediaTrack Settings & Capabilities
        const track = stream.getVideoTracks()[0];
        if (track) {
          lines.push('\n🎥 MediaTrack Settings:');
          const settings = track.getSettings();
          Object.entries(settings).forEach(([k, v]) => {
            lines.push(`• ${k}: ${v}`);
          });
          if (typeof track.getCapabilities === 'function') {
            lines.push('\n📈 MediaTrack Capabilities:');
            const caps = track.getCapabilities();
            Object.entries(caps).forEach(([k, v]) => {
              lines.push(`• ${k}: ${JSON.stringify(v)}`);
            });
          }
        }

        lines.push(
          '\n📌 註：已過濾前鏡頭，僅從後置鏡頭中自動推薦最適合拍證件的鏡頭。'
        );
        setInfo(lines.join('\n'));
      } catch (err) {
        console.error(err);
        setInfo(`❌ 錯誤：${err.message}`);
      }
    };

    gatherInfo();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
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
