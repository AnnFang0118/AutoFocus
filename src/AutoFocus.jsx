import React, { useEffect, useRef, useState } from 'react';

const AutoFocusCamera = () => {
  const videoRef = useRef(null);
  const photoCanvasRef = useRef(null);
  const [imageCapture, setImageCapture] = useState(null);
  const [deviceList, setDeviceList] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [log, setLog] = useState('');

  const appendLog = (msg) => {
    setLog((prev) => prev + msg + '\n');
  };

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
    imageCapture
      .takePhoto()
      .then((blob) => createImageBitmap(blob))
      .then((bitmap) => {
        if (photoCanvasRef.current) {
          drawToCanvas(photoCanvasRef.current, bitmap);
        }
      })
      .catch((err) => console.error('❌ 拍照失敗:', err));
  };

  const startCamera = async (deviceId) => {
    try {
      stopStream();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId } },
      });
      const track = stream.getVideoTracks()[0];
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      try {
        const capture = new ImageCapture(track);
        setImageCapture(capture);
      } catch (e) {
        console.warn('⚠️ 不支援 ImageCapture:', e);
        setImageCapture(null);
      }

      setSelectedDeviceId(deviceId);
      appendLog(`🎥 啟用鏡頭: ${deviceId}`);
    } catch (err) {
      console.error('❌ 鏡頭啟動失敗:', err);
    }
  };

  const getAvailableDevices = async () => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoInputs = devices.filter(
      (d) =>
        d.kind === 'videoinput' &&
        !/front|face|前/i.test(d.label) // 過濾前鏡頭
    );
    setDeviceList(videoInputs);
    return videoInputs;
  };

  const findBestCamera = async () => {
    const candidates = await getAvailableDevices();

    for (const device of candidates) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: device.deviceId } },
        });
        const track = stream.getVideoTracks()[0];
        const caps = track.getCapabilities?.();
        track.stop();

        const hasAF =
          caps?.focusMode?.includes('continuous') ||
          caps?.focusMode?.includes('auto');

        if (hasAF) {
          appendLog(`✅ 找到自動對焦鏡頭: ${device.label}`);
          return device.deviceId;
        }
      } catch (e) {
        appendLog(`⚠️ 鏡頭錯誤（略過）: ${device.label}`);
      }
    }

    // 沒有自動對焦，使用第一個能開的鏡頭
    for (const device of candidates) {
      try {
        await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: device.deviceId } },
        });
        appendLog(`⚠️ 使用非自動對焦鏡頭: ${device.label}`);
        return device.deviceId;
      } catch (e) {}
    }

    appendLog('❌ 沒有可用鏡頭');
    return null;
  };

  useEffect(() => {
    (async () => {
      const best = await findBestCamera();
      if (best) {
        await startCamera(best);
      }
    })();

    return () => stopStream();
  }, []);

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h2>📷 自動對焦鏡頭選擇器</h2>

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          width: '100%',
          maxWidth: '500px',
          border: '1px solid #ccc',
          borderRadius: '8px',
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
          border: '1px solid #aaa',
        }}
      />

      <h3>🎛️ 可切換鏡頭</h3>
      <ul>
        {deviceList.map((device) => (
          <li key={device.deviceId}>
            {device.label || '未命名鏡頭'}
            {device.deviceId === selectedDeviceId && (
              <strong style={{ color: 'green' }}> ← 使用中</strong>
            )}
            <br />
            <button onClick={() => startCamera(device.deviceId)}>切換</button>
          </li>
        ))}
      </ul>

      <h4>📝 Log</h4>
      <pre style={{ whiteSpace: 'pre-wrap', background: '#f0f0f0', padding: '10px' }}>{log}</pre>
    </div>
  );
};

export default AutoFocusCamera;



