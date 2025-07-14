import React, { useEffect, useRef, useState } from 'react';

const isIPhone = /iPhone/i.test(navigator.userAgent);

const AutoFocusCamera = () => {
  const videoRef = useRef(null);
  const photoCanvasRef = useRef(null);
  const [imageCapture, setImageCapture] = useState(null);
  const [deviceList, setDeviceList] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [error, setError] = useState('');

  const stopStream = () => {
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
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
        if (photoCanvasRef.current) drawToCanvas(photoCanvasRef.current, bitmap);
      })
      .catch(err => console.error('Take photo error:', err));
  };

  const startCamera = async (deviceId = null) => {
    try {
      stopStream();
      const constraints = isIPhone
        ? { video: { facingMode: { exact: 'environment' } } }
        : { video: { deviceId: { exact: deviceId } } };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const track = stream.getVideoTracks()[0];
      const capture = new ImageCapture(track);
      videoRef.current.srcObject = stream;
      videoRef.current.play();
      setImageCapture(capture);
      setSelectedDeviceId(deviceId);
    } catch (err) {
      console.error('Start camera failed:', err);
      setError('🚫 無法啟用鏡頭，可能未授權或不支援。');
    }
  };

  const updateDeviceListWithFocus = async () => {
    try {
      // 🔓 必須先取得權限，iPhone 才能拿到 label
      await navigator.mediaDevices.getUserMedia({ video: true });

      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter(d => d.kind === 'videoinput');

      const enrichedDevices = await Promise.all(videoInputs.map(async (device) => {
        if (isIPhone) {
          return {
            deviceId: device.deviceId,
            label: device.label || '未命名相機',
            hasAutoFocus: null,
          };
        }

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
        } catch (_) {
          return {
            deviceId: device.deviceId,
            label: device.label || '未命名相機',
            hasAutoFocus: false
          };
        }
      }));

      setDeviceList(enrichedDevices);
      return enrichedDevices;
    } catch (err) {
      console.error('列出相機錯誤：', err);
      setError('⚠️ 無法取得鏡頭清單');
      return [];
    }
  };

  useEffect(() => {
    (async () => {
      const devices = await updateDeviceListWithFocus();
      if (isIPhone) {
        // iPhone 只能用 facingMode 啟動後鏡頭
        await startCamera();
      } else {
        const preferred = devices.find(d => d.hasAutoFocus);
        await startCamera(preferred?.deviceId || devices[0]?.deviceId);
      }
    })();

    return stopStream;
  }, []);

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '20px' }}>
      <h2>📷 自動對焦相機</h2>

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
        ref={photoCanvasRef}
        style={{
          marginTop: '10px',
          width: '240px',
          height: '180px',
          border: '1px solid #aaa'
        }}
      />

      <h3>🎛️ 可用相機裝置</h3>
      <ul>
        {deviceList.map(device => (
          <li key={device.deviceId} style={{ marginBottom: '10px' }}>
            <strong>{device.label}</strong>
            {device.hasAutoFocus === true && (
              <span style={{ color: 'green' }}> ✅ 自動對焦</span>
            )}
            {device.hasAutoFocus === false && (
              <span style={{ color: 'gray' }}> ⚠️ 無自動對焦</span>
            )}
            {device.hasAutoFocus === null && (
              <span style={{ color: 'gray' }}> 📱 無法偵測（iPhone 限制）</span>
            )}
            {device.deviceId === selectedDeviceId && (
              <strong style={{ color: 'blue' }}> ← 使用中</strong>
            )}
            {!isIPhone && (
              <>
                <br />
                <button onClick={() => startCamera(device.deviceId)}>切換</button>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default AutoFocusCamera;
