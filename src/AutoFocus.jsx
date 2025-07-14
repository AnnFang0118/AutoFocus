import React, { useEffect, useRef, useState } from 'react';

const AutoFocusCamera = () => {
  const videoRef = useRef(null);
  const photoCanvasRef = useRef(null);
  const [imageCapture, setImageCapture] = useState(null);
  const [deviceList, setDeviceList] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [platform, setPlatform] = useState('unknown');

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
      .catch((err) => console.error('📸 Take photo error:', err));
  };

  const startCamera = async (deviceId, useFacingMode = false) => {
    try {
      stopStream();
      const constraints = useFacingMode
        ? { video: { facingMode: { exact: 'environment' } } }
        : { video: { deviceId: { exact: deviceId } } };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const track = stream.getVideoTracks()[0];
      const capture = new ImageCapture(track);

      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setImageCapture(capture);
      if (!useFacingMode) setSelectedDeviceId(deviceId);
    } catch (err) {
      console.error('🚫 startCamera error:', err);
    }
  };

  const isVirtualCamera = (label = '') =>
    /virtual|obs|snap|filter|manycam/i.test(label);
  const isFrontCamera = (label = '') =>
    /front|facetime|self|前/i.test(label);

  const detectPlatform = () => {
    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) return 'ios';
    if (/android/.test(ua)) return 'android';
    return 'other';
  };

  const findBestBackCamera = async () => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videos = devices.filter(
      (d) => d.kind === 'videoinput' && !isVirtualCamera(d.label) && !isFrontCamera(d.label)
    );
    setDeviceList(videos);

    for (const d of videos) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: d.deviceId } },
        });
        const track = stream.getVideoTracks()[0];
        const caps = track.getCapabilities?.();
        const hasAutoFocus =
          caps?.focusMode?.includes('continuous') ||
          caps?.focusMode?.includes('auto');
        track.stop();

        if (hasAutoFocus) return d.deviceId;
      } catch (_) {}
    }

    // fallback
    return videos[0]?.deviceId || null;
  };

  useEffect(() => {
    const init = async () => {
      const os = detectPlatform();
      setPlatform(os);

      if (os === 'ios') {
        try {
          await startCamera(null, true);
        } catch (err) {
          console.error('📱 iOS 啟用後鏡頭失敗:', err);
        }
      } else {
        const bestId = await findBestBackCamera();
        if (bestId) {
          await startCamera(bestId);
        }
      }
    };

    init();

    return () => stopStream();
  }, []);

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '20px' }}>
      <h2>📷 自動對焦相機（跨平台支援）</h2>
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
      {platform !== 'ios' && (
        <>
          <h3>🎛️ 可用相機</h3>
          <ul>
            {deviceList.map((device) => (
              <li key={device.deviceId}>
                {device.label || '未命名相機'}
                {device.deviceId === selectedDeviceId && (
                  <strong style={{ color: 'green' }}> ← 使用中</strong>
                )}
                <br />
                <button onClick={() => startCamera(device.deviceId)}>切換</button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
};

export default AutoFocusCamera;




