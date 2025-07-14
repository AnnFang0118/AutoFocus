import React, { useEffect, useRef, useState } from 'react';

const isIPhone = /iPhone|iPad|iPod/i.test(navigator.userAgent);
const isFrontCamera = (label = '') => /front|facetime|self|前/i.test(label);
const isVirtualCamera = (label = '') => /virtual|obs|snap|filter/i.test(label);

const AutoFocusRearCameraOnly = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [imageCapture, setImageCapture] = useState(null);
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [error, setError] = useState('');

  const stopStream = () => {
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  const drawToCanvas = (canvas, bitmap) => {
    const ctx = canvas.getContext('2d');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    ctx.drawImage(bitmap, 0, 0);
  };

  const handleTakePhoto = () => {
    if (!imageCapture) return;
    imageCapture.takePhoto()
      .then(blob => createImageBitmap(blob))
      .then(bitmap => {
        if (canvasRef.current) drawToCanvas(canvasRef.current, bitmap);
      })
      .catch(err => console.error('Take photo error:', err));
  };

  const getValidRearDevices = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ video: true });
      const all = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = all.filter(d => d.kind === 'videoinput');

      const valid = await Promise.all(videoInputs.map(async (device) => {
        if (isFrontCamera(device.label) || isVirtualCamera(device.label)) return null;

        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: device.deviceId } }
          });
          const track = stream.getVideoTracks()[0];
          const caps = track.getCapabilities?.();
          const hasAutoFocus = caps?.focusMode?.includes('continuous') || caps?.focusMode?.includes('auto');
          track.stop();
          return {
            deviceId: device.deviceId,
            label: device.label || '未命名相機',
            hasAutoFocus
          };
        } catch {
          return {
            deviceId: device.deviceId,
            label: device.label || '未命名相機',
            hasAutoFocus: false
          };
        }
      }));

      return valid.filter(Boolean);
    } catch (err) {
      console.error('列出相機錯誤：', err);
      setError('⚠️ 無法取得鏡頭清單');
      return [];
    }
  };

  const startCamera = async (deviceId = null) => {
    stopStream();
    try {
      const constraints = isIPhone
        ? { video: { facingMode: { exact: 'environment' } } }
        : { video: { deviceId: { exact: deviceId } } };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const track = stream.getVideoTracks()[0];
      const capture = new ImageCapture(track);

      // 嘗試設定 auto focus（如果支援）
      const caps = track.getCapabilities?.();
      if (caps?.focusMode?.includes('continuous')) {
        await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] });
      }

      videoRef.current.srcObject = stream;
      videoRef.current.play();
      setImageCapture(capture);
      setSelectedDeviceId(deviceId);
    } catch (err) {
      console.error('Start camera failed:', err);
      setError('🚫 無法啟用鏡頭，可能未授權或不支援。');
    }
  };

  useEffect(() => {
    (async () => {
      const deviceList = await getValidRearDevices();
      setDevices(deviceList);

      if (isIPhone) {
        await startCamera(); // 使用 facingMode 啟動後鏡頭
      } else {
        const preferred = deviceList.find(d => d.hasAutoFocus);
        await startCamera(preferred?.deviceId || deviceList[0]?.deviceId);
      }
    })();

    return stopStream;
  }, []);

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '20px' }}>
      <h2>🎯 後鏡頭相機（自動對焦 + 拍照）</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          width: '100%',
          maxWidth: '500px',
          border: '1px solid #ccc',
          borderRadius: '8px'
        }}
      />

      <div style={{ marginTop: '10px' }}>
        <button onClick={handleTakePhoto}>📸 拍照</button>
      </div>

      <canvas
        ref={canvasRef}
        style={{
          marginTop: '10px',
          width: '240px',
          height: '180px',
          border: '1px solid #aaa'
        }}
      />

      {!isIPhone && (
        <>
          <h3>🔀 可切換後鏡頭（非 iPhone）</h3>
          <ul>
            {devices.map((device) => (
              <li key={device.deviceId}>
                <strong>{device.label}</strong>
                {device.hasAutoFocus && <span style={{ color: 'green' }}> ✅ 自動對焦</span>}
                {!device.hasAutoFocus && <span style={{ color: 'gray' }}> ⚠️ 無自動對焦</span>}
                {device.deviceId === selectedDeviceId && <span style={{ color: 'blue' }}> ← 使用中</span>}
                <br />
                <button onClick={() => startCamera(device.deviceId)}>切換</button>
              </li>
            ))}
          </ul>
        </>
      )}

      {isIPhone && (
        <p style={{ color: 'gray' }}>📱 iPhone 裝置僅使用預設後鏡頭，無法切換多顆鏡頭（Safari 限制）。</p>
      )}
    </div>
  );
};

export default AutoFocusRearCameraOnly;




