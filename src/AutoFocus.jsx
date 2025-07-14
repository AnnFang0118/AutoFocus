import React, { useEffect, useState, useRef } from 'react';

const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
const isAndroid = /Android/i.test(navigator.userAgent);

const CrossPlatformCamera = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [imageCapture, setImageCapture] = useState(null);
  const [error, setError] = useState('');

  const stopStream = () => {
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
  };

  const startCamera = async (deviceId = null) => {
    stopStream();
    try {
      const constraints = isIOS
        ? { video: { facingMode: { exact: 'environment' } } }
        : deviceId
        ? { video: { deviceId: { exact: deviceId } } }
        : { video: true };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const track = stream.getVideoTracks()[0];
      const capture = new ImageCapture(track);

      videoRef.current.srcObject = stream;
      videoRef.current.play();

      setImageCapture(capture);
      setSelectedDeviceId(deviceId);
    } catch (err) {
      console.error('啟動鏡頭失敗:', err);
      setError('無法啟動鏡頭');
    }
  };

  const takePhoto = async () => {
    try {
      if (!imageCapture) return;
      const blob = await imageCapture.takePhoto();
      const bitmap = await createImageBitmap(blob);
      const canvas = canvasRef.current;
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      canvas.getContext('2d').drawImage(bitmap, 0, 0);
    } catch (err) {
      console.error('拍照失敗:', err);
    }
  };

  const detectCameras = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ video: true });

      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = allDevices.filter(d => d.kind === 'videoinput');

      const result = await Promise.all(
        videoDevices.map(async (d) => {
          let hasAutoFocus = null;

          if (!isIOS) {
            try {
              const stream = await navigator.mediaDevices.getUserMedia({
                video: { deviceId: { exact: d.deviceId } }
              });
              const track = stream.getVideoTracks()[0];
              const caps = track.getCapabilities?.();
              hasAutoFocus = caps?.focusMode?.includes('auto') || caps?.focusMode?.includes('continuous');
              track.stop();
            } catch (e) {
              hasAutoFocus = false;
            }
          }

          return {
            deviceId: d.deviceId,
            label: d.label || '未命名鏡頭',
            hasAutoFocus
          };
        })
      );

      setDevices(result);
    } catch (err) {
      console.error('無法列出鏡頭:', err);
      setError('無法取得鏡頭清單');
    }
  };

  useEffect(() => {
    (async () => {
      await detectCameras();
      await startCamera();
    })();

    return stopStream;
  }, []);

  return (
    <div style={{ padding: 20, fontFamily: 'sans-serif' }}>
      <h2>📷 拍攝身分證（跨平台）</h2>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        style={{ width: '100%', maxWidth: 500, border: '1px solid #ccc', borderRadius: 8 }}
      />

      <div style={{ marginTop: 10 }}>
        <button onClick={takePhoto}>📸 拍照</button>
      </div>

      <canvas
        ref={canvasRef}
        style={{ marginTop: 10, width: 300, height: 200, border: '1px solid #aaa' }}
      />

      <h3>🎛️ 鏡頭裝置列表</h3>
      <ul>
        {devices.map((d) => (
          <li key={d.deviceId}>
            <strong>{d.label}</strong>{' '}
            {d.hasAutoFocus === true && <span style={{ color: 'green' }}>✅ 自動對焦</span>}
            {d.hasAutoFocus === false && <span style={{ color: 'gray' }}>❌ 無自動對焦</span>}
            {d.hasAutoFocus === null && <span style={{ color: 'gray' }}>📱 無法偵測（iOS）</span>}

            {(!isIOS && (
              <>
                <br />
                <button onClick={() => startCamera(d.deviceId)}>
                  {selectedDeviceId === d.deviceId ? '✔️ 使用中' : '切換'}
                </button>
              </>
            )) || <span style={{ color: 'blue' }}>（iOS 無法切換鏡頭）</span>}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default CrossPlatformCamera;
