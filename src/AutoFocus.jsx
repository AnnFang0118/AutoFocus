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

  const findBestAutoFocusCamera = async () => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoInputs = devices.filter(d => d.kind === 'videoinput');
    const backCameras = videoInputs.filter(d => /back|rear|environment|廣角|主|後/i.test(d.label));
    setDeviceList(backCameras);

    for (const device of backCameras) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: device.deviceId } }
        });
        const track = stream.getVideoTracks()[0];
        const caps = track.getCapabilities?.();
        const hasAutoFocus = caps?.focusMode?.includes('continuous') || caps?.focusMode?.includes('auto');
        track.stop();
        if (hasAutoFocus) return device.deviceId;
      } catch (_) {}
    }

    return backCameras[0]?.deviceId || videoInputs[0]?.deviceId || null;
  };

  useEffect(() => {
    (async () => {
      if (isIPhone) {
        await startCamera(); // iPhone: use facingMode only
      } else {
        const bestId = await findBestAutoFocusCamera();
        if (bestId) {
          await startCamera(bestId);
        } else {
          setError('⚠️ 找不到後鏡頭');
        }
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

      {!isIPhone && (
        <>
          <h3>🎛️ 可選相機</h3>
          <ul>
            {deviceList.map(device => (
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




