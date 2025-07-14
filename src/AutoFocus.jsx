import React, { useEffect, useRef, useState } from 'react';

const AutoFocusCamera = () => {
  const videoRef = useRef(null);
  const photoCanvasRef = useRef(null);
  const [imageCapture, setImageCapture] = useState(null);
  const [info, setInfo] = useState('🔍 檢查中...');
  const [deviceList, setDeviceList] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);

  const isIPhone = /iPhone/i.test(navigator.userAgent);

  const stopStream = () => {
    const stream = videoRef.current?.srcObject;
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
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
      .then(blob => createImageBitmap(blob))
      .then(bitmap => drawToCanvas(photoCanvasRef.current, bitmap))
      .catch(err => console.error('拍照錯誤:', err));
  };

  const startCamera = async (deviceIdOrFacingMode) => {
    stopStream();
    try {
      const constraints = {
        video: typeof deviceIdOrFacingMode === 'string' && deviceIdOrFacingMode.startsWith('facingMode:')
          ? { facingMode: deviceIdOrFacingMode.split(':')[1] }
          : { deviceId: { exact: deviceIdOrFacingMode } }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const track = stream.getVideoTracks()[0];

      if ('ImageCapture' in window) {
        try {
          setImageCapture(new ImageCapture(track));
        } catch {
          setImageCapture(null);
        }
      }

      videoRef.current.srcObject = stream;
      videoRef.current.play();
      setSelectedDeviceId(track.getSettings().deviceId || deviceIdOrFacingMode);
    } catch (err) {
      console.error('開啟相機錯誤:', err);
      setInfo('❌ 鏡頭開啟失敗');
    }
  };

  const findAutoFocusCamera = async () => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices.filter(d =>
      d.kind === 'videoinput' &&
      !/front|facetime|self/i.test(d.label) &&
      !/virtual|obs|snap|filter|manycam/i.test(d.label)
    );

    setDeviceList(cameras);

    for (const device of cameras) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: device.deviceId } }
        });
        const track = stream.getVideoTracks()[0];
        const caps = track.getCapabilities?.();
        const hasAF = caps?.focusMode?.includes('continuous') || caps?.focusMode?.includes('auto');
        track.stop();
        if (hasAF) return device.deviceId;
      } catch { }
    }

    const fallback = cameras.find(d => /back|rear|wide|主|後|environment/i.test(d.label));
    return fallback?.deviceId || cameras[0]?.deviceId || null;
  };

  useEffect(() => {
    (async () => {
      setInfo('📦 初始化中...');
      if (isIPhone) {
        setInfo('🍎 iPhone：使用後鏡頭');
        await startCamera('facingMode:environment');
      } else {
        const best = await findAutoFocusCamera();
        if (best) {
          setInfo('✅ 使用支援自動對焦鏡頭');
          await startCamera(best);
        } else {
          setInfo('⚠️ 找不到支援自動對焦的鏡頭，使用第一顆');
          const devices = await navigator.mediaDevices.enumerateDevices();
          const fallback = devices.find(d => d.kind === 'videoinput');
          if (fallback) await startCamera(fallback.deviceId);
          else setInfo('❌ 沒有可用鏡頭');
        }
      }
    })();

    return () => stopStream();
  }, []);

  return (
    <div style={{ fontFamily: 'sans-serif', padding: 20 }}>
      <h2>📷 自動對焦相機（跨平台）</h2>
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
      <button onClick={takePhoto} style={{ marginTop: 10 }}>📸 拍照</button>
      <canvas
        ref={photoCanvasRef}
        style={{
          marginTop: 10,
          width: 240,
          height: 180,
          border: '1px solid #aaa'
        }}
      />
      <p style={{ marginTop: 20, color: '#555' }}>{info}</p>
      {!isIPhone && deviceList.length > 1 && (
        <>
          <h3>🔁 可用鏡頭</h3>
          <ul>
            {deviceList.map(d => (
              <li key={d.deviceId}>
                {d.label || '未命名鏡頭'}
                {d.deviceId === selectedDeviceId && (
                  <strong style={{ color: 'green' }}> ← 使用中</strong>
                )}
                <br />
                <button onClick={() => startCamera(d.deviceId)}>切換</button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
};

export default AutoFocusCamera;




