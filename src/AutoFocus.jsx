import React, { useEffect, useRef, useState } from 'react';

const AutoFocusCamera = () => {
  const videoRef = useRef(null);
  const photoCanvasRef = useRef(null);
  const [imageCapture, setImageCapture] = useState(null);
  const [deviceList, setDeviceList] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [info, setInfo] = useState('初始化中...');

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

  const updateDeviceList = async () => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices.filter(d => d.kind === 'videoinput');
    setDeviceList(cameras);
  };

  useEffect(() => {
    (async () => {
      try {
        // 1. 初次啟動時先開啟預設後鏡頭（iPhone 上必要）
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        // 2. 擷取裝置資訊（才能正確列出 label）
        await updateDeviceList();

        // 3. 選擇第一個後鏡頭並重啟（選擇支援 autofocus 的）
        const backCams = deviceList.filter(d =>
          /back|rear|wide|主|後|environment/i.test(d.label)
        );
        const targetDevice = backCams[0] || deviceList[0];
        if (targetDevice?.deviceId) await startCamera(targetDevice.deviceId);
        else setInfo('⚠️ 無可用鏡頭');

      } catch (err) {
        console.error('初始化錯誤:', err);
        setInfo('❌ 初始化失敗');
      }
    })();

    return () => stopStream();
  }, []);

  return (
    <div style={{ fontFamily: 'sans-serif', padding: 20 }}>
      <h2>📷 自動對焦相機（支援 iPhone 切換鏡頭）</h2>
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

      <h3>🎛️ 可選鏡頭</h3>
      <ul>
        {deviceList.map(d => (
          <li key={d.deviceId}>
            {d.label || '未命名相機'}
            {d.deviceId === selectedDeviceId && (
              <strong style={{ color: 'green' }}> ← 使用中</strong>
            )}
            <br />
            <button onClick={() => startCamera(d.deviceId)}>切換</button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default AutoFocusCamera;




