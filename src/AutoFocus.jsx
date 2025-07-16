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
    { keywords: ['ir', 'aux', 'unknown'], score: -5 }
  ];

  const scoreCameraLabel = (label = '') => {
    const l = label.toLowerCase();
    let score = 0;
    for (const { keywords, score: kwScore } of keywordWeights) {
      if (keywords.some(keyword => l.includes(keyword))) {
        score += kwScore;
      }
    }
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

        lines.push(`🧠 User Agent:\n${navigator.userAgent}\n`);
        lines.push(`📱 預測平台: ${detectDevicePlatform()}`);
        lines.push(`🏷️ 預測品牌: ${detectBrandFromUserAgent()}`);

        // UA-CH（高精度）
        if (navigator.userAgentData?.getHighEntropyValues) {
          try {
            const uaDetails = await navigator.userAgentData.getHighEntropyValues([
              'platform',
              'platformVersion',
              'model',
              'architecture',
              'bitness',
              'fullVersionList'
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

        // 相機裝置列表
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter(d => d.kind === 'videoinput');

        if (videoInputs.length === 0) throw new Error('找不到任何相機裝置');

        // 每顆相機評分
        lines.push('\n📋 可用相機裝置:');
        const scored = videoInputs.map((d, i) => {
          const score = scoreCameraLabel(d.label || '');
          lines.push(`相機 ${i + 1}:`);
          lines.push(`• label: ${d.label || '(無法取得)'}`);
          lines.push(`• deviceId: ${d.deviceId}`);
          lines.push(`• 推測用途: ${score >= 4 ? '🔍 微距/望遠' : score >= 2 ? '📷 主鏡頭' : score < 0 ? '🙈 前鏡頭或輔助鏡' : '❓ 無法判斷'}`);
          return { ...d, score };
        });

        const bestCamera = scored.sort((a, b) => b.score - a.score)[0];
        lines.push(`\n🌟 推薦鏡頭: ${bestCamera?.label || '(無法判斷)'}`);

        // 關閉舊串流
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop());
        }

        // 開啟最適合鏡頭
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: bestCamera.deviceId,
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            facingMode: 'environment'
          }
        });

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          lines.push('\n🎥 MediaTrack Settings:');
          const settings = videoTrack.getSettings();
          Object.entries(settings).forEach(([key, value]) => {
            lines.push(`• ${key}: ${value}`);
          });

          if (typeof videoTrack.getCapabilities === 'function') {
            lines.push('\n📈 MediaTrack Capabilities:');
            const capabilities = videoTrack.getCapabilities();
            Object.entries(capabilities).forEach(([key, value]) => {
              lines.push(`• ${key}: ${JSON.stringify(value)}`);
            });
          }
        }

        lines.push('\n📌 註：鏡頭用途是根據關鍵字比對推測，實際效果可能會因手機品牌與瀏覽器不同而異。');
        setInfo(lines.join('\n'));
      } catch (err) {
        console.error(err);
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
          background: '#f5f5f5',
          padding: '15px',
          borderRadius: '8px',
          width: '100%',
          overflowX: 'auto',
          fontSize: '14px',
          lineHeight: '1.5',
          wordBreak: 'break-word',
          color: '#222'
        }}
      >
        {info}
      </pre>
    </div>
  );
};

export default CameraViewer;
