import React, { useEffect, useRef, useState } from 'react';

const CameraViewer = () => {
  const videoRef = useRef(null);
  const photoCanvasRef = useRef(null);
  const streamRef = useRef(null);
  const imageCaptureRef = useRef(null);
  const [info, setInfo] = useState('載入中...');

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

  const onTakePhoto = () => {
    if (!imageCaptureRef.current) return;

    imageCaptureRef.current
      .takePhoto()
      .then(blob => createImageBitmap(blob))
      .then(imageBitmap => {
        const canvas = photoCanvasRef.current;
        if (!canvas) return;
        canvas.width = imageBitmap.width;
        canvas.height = imageBitmap.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(imageBitmap, 0, 0);
      })
      .catch(err => {
        console.error('takePhoto error:', err);
      });
  };

  useEffect(() => {
    const gatherInfo = async () => {
      try {
        const lines = [];

        lines.push(`🧠 User Agent:\n${navigator.userAgent}\n`);
        lines.push(`📱 預測平台: ${detectDevicePlatform()}`);
        lines.push(`🏷️ 預測品牌: ${detectBrandFromUserAgent()}`);

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
          } catch (err) {
            lines.push('\n⚠️ 無法取得 UA-CH 裝置資訊（可能未授權）');
          }
        } else {
          lines.push('\n⚠️ 瀏覽器不支援 User-Agent Client Hints (UA-CH)');
        }

        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        });

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(err => {
            throw new Error('Failed to start video playback');
          });
        }

        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          imageCaptureRef.current = new ImageCapture(videoTrack);

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

        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter(d => d.kind === 'videoinput');
        lines.push('\n📋 可用相機裝置:');
        videoInputs.forEach((device, idx) => {
          lines.push(`相機 ${idx + 1}:`);
          lines.push(`• label: ${device.label || '(無法取得)'}`);
          lines.push(`• deviceId: ${device.deviceId}\n`);
        });

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
      <div style={{ marginTop: '10px' }}>
        <button onClick={onTakePhoto}>📸 Take Photo</button>
      </div>
      <canvas
        ref={photoCanvasRef}
        style={{ marginTop: '10px', width: '100%', maxWidth: '500px', border: '1px solid #ccc' }}
      />

      <h2 style={{ marginTop: '20px' }}>📦 裝置詳細資訊</h2>
      <pre
        style={{
          whiteSpace: 'pre-wrap',
          background: '#f5f5f5',
          padding: '15px',
          borderRadius: '8px',
          maxWidth: '500px',
        }}
      >
        {info}
      </pre>
    </div>
  );
};

export default CameraViewer;
