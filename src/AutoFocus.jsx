import React, { useEffect, useRef, useState } from 'react';

const SmartCamera = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [imageCapture, setImageCapture] = useState(null);

  const isFrontCamera = (label = '') =>
    /front|facetime|前|self/i.test(label);

  const isBackCamera = (label = '') =>
    /back|rear|environment|wide|主|後/i.test(label);

  const stopStream = () => {
    const stream = videoRef.current?.srcObject;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  const drawToCanvas = (canvas, bitmap) => {
    const ctx = canvas.getContext('2d');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    ctx.drawImage(bitmap, 0, 0);
  };

  const takePhoto = () => {
    if (!imageCapture) return;
    imageCapture
      .takePhoto()
      .then(createImageBitmap)
      .then((bitmap) => drawToCanvas(canvasRef.current, bitmap))
      .catch((err) => console.error('takePhoto error:', err));
  };

  const startCamera = async (deviceId) => {
    stopStream();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId } },
      });
      const track = stream.getVideoTracks()[0];
      const capture = new ImageCapture(track);
      videoRef.current.srcObject = stream;
      videoRef.current.play();
      setSelectedDeviceId(deviceId);
      setImageCapture(capture);
    } catch (err) {
      console.error('startCamera error:', err);
    }
  };

  const findBestCamera = async () => {
    const allDevices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = allDevices.filter((d) => d.kind === 'videoinput');
    setDevices(videoDevices);

    // 先嘗試找支援自動對焦的
    for (const device of videoDevices) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: device.deviceId } },
        });
        const track = stream.getVideoTracks()[0];
        const caps = track.getCapabilities?.();
        const hasAF =
          caps?.focusMode?.includes('continuous') || caps?.focusMode?.includes('auto');
        track.stop();

        if (hasAF) {
          return device.deviceId;
        }
      } catch {
        continue;
      }
    }

    // 退而求其次：找後鏡頭
    const backCam = videoDevices.find((d) => isBackCamera(d.label));
    if (backCam) return backCam.deviceId;

    // 最後備案：回傳第一顆鏡頭
    return videoDevices[0]?.deviceId || null;
  };

  useEffect(() => {
    (async () => {
      try {
        // iOS 需要先主動呼叫一次權限
        await navigator.mediaDevices.getUserMedia({ video: true });

        const bestDeviceId = await findBestCamera();
        if (bestDeviceId) {
          await startCamera(bestDeviceId);
        } else {
          console.warn('找不到適合的鏡頭');
        }
      } catch (err) {
        console.error('初始化錯誤:', err);
      }
    })();

    return () => stopStream();
  }, []);

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h2>📷 智慧相機（自動挑選可對焦鏡頭）</h2>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ width: '100%', maxWidth: '480px', border: '1px solid #ccc' }}
      />
      <div style={{ marginTop: '10px' }}>
        <button onClick={takePhoto}>📸 拍照</button>
      </div>
      <canvas
        ref={canvasRef}
        style={{ marginTop: '10px', border: '1px solid #ccc', width: '240px', height: '180px' }}
      />
      <h3>🎛️ 鏡頭清單</h3>
      <ul>
        {devices.map((device) => (
          <li key={device.deviceId}>
            {device.label || '未知鏡頭'}
            {device.deviceId === selectedDeviceId && (
              <strong style={{ color: 'green' }}> ← 使用中</strong>
            )}
            <br />
            <button onClick={() => startCamera(device.deviceId)}>切換</button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default SmartCamera;


