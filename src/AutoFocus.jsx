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
    if (!l) return -999; // 未授權或無標籤
    for (const { keywords, score: kwScore } of keywordWeights) {
      if (keywords.some(k => l.includes(k))) {
        score += kwScore;
      }
    }
    // Fallback：Camera 0/1/2
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

        // 1. 基本 UA / 平台 / 品牌
        lines.push(`🧠 User Agent:\n${navigator.userAgent}\n`);
        lines.push(`📱 預測平台: ${detectDevicePlatform()}`);
        lines.push(`🏷️ 預測品牌: ${detectBrandFromUserAgent()}`);

        // 2. UA-CH 高精度資訊
        if (navigator.userAgentData?.getHighEntropyValues) {
          try {
            const uaDetails = await navigator.userAgentData.getHighEntropyValues([
              'platform','platformVersion','model','architecture','bitness','fullVersionList'
            ]);
            lines.push(`\n🔍 UA-CH 裝置資訊（高精度）:`);
            Object.entries(uaDetails).forEach(([k,v]) => lines.push(`• ${k}: ${v}`));
          } catch {
            lines.push('\n⚠️ 無法取得 UA-CH 裝置資訊');
          }
        } else {
          lines.push('\n⚠️ 瀏覽器不支援 UA-CH');
        }

        // 3. 列出所有 videoinput，並過濾出後置鏡頭
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter(d => d.kind === 'videoinput');
        const rearCameras = videoInputs.filter(d =>
          !/(front|selfie)/i.test(d.label || '')
        );
        const candidates = rearCameras.length ? rearCameras : videoInputs;

        lines.push('\n📋 可選後置鏡頭:');
        candidates.forEach((d,i) => {
          lines.push(`相機 ${i+1}:`);
          lines.push(`• label: ${d.label || '(無標籤)'}`);
          lines.push(`• deviceId: ${d.deviceId}\n`);
        });

        // 定義探測函式
        const pickByFocusDistance = async list => {
          const probe = await Promise.all(list.map(async d => {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: d.deviceId }});
            const track = stream.getVideoTracks()[0];
            const caps = track.getCapabilities();
            stream.getTracks().forEach(t => t.stop());
            return { device: d, minFocus: caps.focusDistance?.min ?? Infinity };
          }));
          const avail = probe.filter(p => p.minFocus < Infinity);
          if (!avail.length) return null;
          const best = avail.reduce((a,b) => a.minFocus < b.minFocus ? a : b);
          return best.device;
        };

        const pickByMaxResolution = async list => {
          const probe = await Promise.all(list.map(async d => {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: d.deviceId }});
            const track = stream.getVideoTracks()[0];
            const caps = track.getCapabilities();
            stream.getTracks().forEach(t => t.stop());
            const maxW = caps.width?.max ?? 0;
            const maxH = caps.height?.max ?? 0;
            return { device: d, maxRes: maxW * maxH };
          }));
          const best = probe.reduce((a,b) => b.maxRes > a.maxRes ? b : a, probe[0]);
          return best.maxRes > 0 ? best.device : null;
        };

        // 4. 三階段推薦
        let bestDevice = null;

        // 4.1 focusDistance
        try { bestDevice = await pickByFocusDistance(candidates); } catch {}
        // 4.2 maxResolution
        if (!bestDevice) {
          try { bestDevice = await pickByMaxResolution(candidates); } catch {}
        }
        // 4.3 labelScore
        if (!bestDevice) {
          const scored = candidates
            .map(d => ({ device: d, score: scoreCameraLabel(d.label) }))
            .sort((a,b) => b.score - a.score);
          if (scored.length && scored[0].score > 0) {
            bestDevice = scored[0].device;
          }
        }
        // 4.4 ultimate fallback
        if (!bestDevice) {
          lines.push('\n⚠️ 自動推薦失敗，使用第一支後置鏡頭作為預設');
          bestDevice = candidates[0];
        }

        lines.push(`\n🌟 推薦後置鏡頭: ${bestDevice.label || `(無標籤，deviceId=${bestDevice.deviceId})`}`);

        // 5. 停掉舊串流並開啟推薦鏡頭
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop());
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: bestDevice.deviceId,
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

        // 6. 顯示 MediaTrack 設定與能力
        const track = stream.getVideoTracks()[0];
        if (track) {
          lines.push('\n🎥 MediaTrack Settings:');
          Object.entries(track.getSettings()).forEach(([k,v]) => lines.push(`• ${k}: ${v}`));
          if (typeof track.getCapabilities === 'function') {
            lines.push('\n📈 MediaTrack Capabilities:');
            Object.entries(track.getCapabilities()).forEach(([k,v]) =>
              lines.push(`• ${k}: ${JSON.stringify(v)}`)
            );
          }
        }

        lines.push('\n📌 註：已過濾前鏡頭，並依序使用 focusDistance、解析度、Label 分數進行自動推薦，最後 fallback。');
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
