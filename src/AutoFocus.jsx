import { useEffect, useRef, useState } from 'react';

const BestCameraForID = () => {
  const videoRef = useRef(null);
  const photoCanvasRef = useRef(null);
  const [imageCapture, setImageCapture] = useState(null);
  const [info, setInfo] = useState('載入中...');
  const [currentDeviceId, setCurrentDeviceId] = useState(null);

  const isBackCamera = (label) => /後置|back|rear|environment/i.test(label || '');
  const hasAutoFocus = (capabilities) =>
    capabilities.focusMode && (capabilities.focusMode.includes('continuous') || capabilities.focusMode.includes('single-shot'));
  const hasCloseFocus = (capabilities) =>
    capabilities.focusDistance && capabilities.focusDistance.min <= 0.3;
  const hasGoodResolution = (capabilities) =>
    capabilities.width && capabilities.width.max >= 1920;

  const selectBestCamera = async () => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const backCameras = devices.filter(
      (d) => d.kind === 'videoinput' && isBackCamera(d.label || '')
    );

    const candidates = [];

    for (const device of backCameras) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: device.deviceId } }
        });
        const track = stream.getVideoTracks()[0];
        const capabilities = track.getCapabilities?.() || {};
        if (
          hasAutoFocus(capabilities) &&
          hasCloseFocus(capabilities) &&
          hasGoodResolution(capabilities)
        ) {
          candidates.push({ device, score: 3, stream });
        } else {
          // keep track for fallback (no score system for now)
          stream.getTracks().forEach((t) => t.stop());
        }
      } catch (e) {
        console.warn(`無法使用裝置 ${device.label}`, e);
      }
    }

    if (candidates.length > 0) {
      const best = candidates[0];
      startCamera(best.device.deviceId);
    } else if (backCameras.length > 0) {
      startCamera(backCameras[0].deviceId); // fallback
    } else {
      setInfo('❌ 沒有可用的後置鏡頭');
    }
  };

  const startCamera = async (deviceId) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId } }
      });
      setCurrentDeviceId(deviceId);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      const track = stream.getVideoTracks()[0];
      if ('ImageCapture' in window) {
        setImageCapture(new ImageCapture(track));
      }
      const capabilities = track.getCapabilities?.() || {};
      const settings = track.getSettings?.() || {};
      const lines = [];
      lines.push(`🎥 使用鏡頭: ${deviceId}`);
      lines.push(`\nMediaTrack Settings:`);
      Object.entries(settings).forEach(([k, v]) => lines.push(`• ${k}: ${v}`));
      lines.push(`\nMediaTrack Capabilities:`);
      Object.entries(capabilities).forEach(([k, v]) => lines.push(`• ${k}: ${JSON.stringify(v)}`));
      setInfo(lines.join('\n'));
    } catch (e) {
      console.error('startCamera error:', e);
    }
  };

  const takePhoto = () => {
    if (imageCapture) {
      imageCapture
        .takePhoto()
        .then((blob) => createImageBitmap(blob))
        .then((bitmap) => {
          const canvas = photoCanvasRef.current;
          const ctx = canvas.getContext('2d');
          canvas.width = bitmap.width;
          canvas.height = bitmap.height;
          ctx.drawImage(bitmap, 0, 0);
        })
        .catch((err) => {
          console.error('takePhoto error:', err);
        });
    }
  };

  useEffect(() => {
    selectBestCamera();
  }, []);

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '20px' }}>
      <h2>📸 自動選擇最佳證件照鏡頭</h2>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ width: '100%', maxWidth: '500px', border: '1px solid #000', borderRadius: '8px' }}
      />
      <button onClick={takePhoto} style={{ marginTop: '10px' }}>
        Take Photo
      </button>
      <canvas
        ref={photoCanvasRef}
        style={{ width: '100%', maxWidth: '500px', border: '1px solid #ccc', marginTop: '10px' }}
      />
      <h3>📋 鏡頭資訊</h3>
      <pre
        style={{
          whiteSpace: 'pre-wrap',
          background: '#f5f5f5',
          padding: '10px',
          borderRadius: '6px',
          maxWidth: '500px'
        }}
      >
        {info}
      </pre>
    </div>
  );
};

export default BestCameraForID;
