import React, { useEffect, useState, useRef } from 'react';

const isIPhone = /iPhone/i.test(navigator.userAgent);

const CameraAutoFocusChecker = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [imageCapture, setImageCapture] = useState(null);
  const [error, setError] = useState('');

  const stopCurrentStream = () => {
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  const startCamera = async (deviceId) => {
    stopCurrentStream();
    try {
      const constraints = isIPhone
        ? { video: { facingMode: { exact: 'environment' } } }
        : { video: { deviceId: { exact: deviceId } } };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      videoRef.current.srcObject = stream;
      videoRef.current.play();

      const track = stream.getVideoTracks()[0];
      const capture = new ImageCapture(track);
      setImageCapture(capture);
      setSelectedDeviceId(deviceId);
    } catch (err) {
      console.error('啟動鏡頭失敗:', err);
      setError('無法啟動鏡頭');
    }
  };

  const takePhoto = async () => {
    if (!imageCapture) return;
    try {
      const blob = await imageCapture.takePhoto();
      const bitmap = await createImageBitmap(blob);
      const canvas = canvasRef.current;
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(bitmap, 0, 0);
    } catch (err) {
      console.error('拍照失敗:', err);
    }
  };

  const fetchDevicesAndCapabilities = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ video: true }); // 先要授權才能讀 label

      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = allDevices.filter(d => d.kind === 'videoinput');

      const enriched = await Promise.all(videoDevices.map(async (device) => {
        if (isIPhone) {
          return {
            deviceId: device.deviceId,
            label: device.label || '未命名相機',
            hasAutoFocus: null
          };
        }

        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: device.deviceId } }
          });
          const track = stream.getVideoTracks()[0];
          const capture = new ImageCapture(track);
          const capabilities = await capture.getPhotoCapabilities();
          const modes = capabilities.focusMode || [];
          const hasAutoFocus = modes.includes('continuous') || modes.includes('auto') || modes.includes('single-shot');
          track.stop();

          return {
            deviceId: device.deviceId,
            label: device.label || '未命名相機',
            hasAutoFocus
          };
        } catch (e) {
          return {
            deviceId: device.deviceId,
            label: device.label || '未命名相機',
            hasAutoFocus: false
          };
        }
      }));

      setDevices(enriched);
    } catch (err) {
      console.error('取得鏡頭清單失敗:', err);
      setError('無法取得鏡頭裝置清單');
    }
  };

  useEffect(() => {
    fetchDevicesAndCapabilities();
    return stopCurrentStream;
  }, []);

  return (
    <div style={{ fontFamily: 'sans-serif', padding: 20 }}>
      <h2>📷 身分證拍攝系統</h2>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ width: '100%', maxWidth: 500, border: '1px solid #ccc', borderRadius: 8 }}
      />

      <div style={{ marginTop: 10 }}>
        <button onClick={takePhoto}>📸 拍照</button>
      </div>

      <canvas
        ref={canvasRef}
        style={{ marginTop: 10, width: 300, height: 200, border: '1px solid #aaa' }}
      />

      <h3>🎛️ 鏡頭列表</h3>
      <ul>
        {devices.map(device => (
          <li key={device.deviceId}>
            <strong>{device.label}</strong>{' '}
            {device.hasAutoFocus === true && <span style={{ color: 'green' }}>✅ 自動對焦</span>}
            {device.hasAutoFocus === false && <span style={{ color: 'gray' }}>❌ 無自動對焦</span>}
            {device.hasAutoFocus === null && <span style={{ color: 'gray' }}>📱 無法偵測 (iPhone)</span>}
            <br />
            {!isIPhone && (
              <button onClick={() => startCamera(device.deviceId)}>
                {selectedDeviceId === device.deviceId ? '✔️ 使用中' : '切換'}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default CameraAutoFocusChecker;
