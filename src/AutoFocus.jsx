import { useEffect, useRef, useState } from "react";

const isIOS = /iPhone|iPad/i.test(navigator.userAgent);

const SmartCamera = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [videoDevices, setVideoDevices] = useState([]);
  const [currentDeviceId, setCurrentDeviceId] = useState(null);
  const [imageCapture, setImageCapture] = useState(null);
  const [error, setError] = useState(null);

  const isVirtual = (label = "") => /virtual|obs|snap|manycam/i.test(label);
  const isFront = (label = "") => /front|前置|facetime|self/i.test(label);

  const stopCurrentStream = () => {
    const stream = videoRef.current?.srcObject;
    if (stream && stream.getTracks) {
      stream.getTracks().forEach((track) => track.stop());
    }
  };

  const drawImage = (bitmap) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    ctx.drawImage(bitmap, 0, 0);
  };

  const takePhoto = async () => {
    if (!imageCapture) return;
    try {
      if (!isIOS && imageCapture.takePhoto) {
        const blob = await imageCapture.takePhoto();
        const bitmap = await createImageBitmap(blob);
        drawImage(bitmap);
      } else {
        const bitmap = await imageCapture.grabFrame();
        drawImage(bitmap);
      }
    } catch (err) {
      console.warn("拍照失敗，使用 grabFrame 備案", err);
      try {
        const bitmap = await imageCapture.grabFrame();
        drawImage(bitmap);
      } catch (e) {
        console.error("grabFrame 也失敗", e);
      }
    }
  };

  const startCamera = async (deviceId = null) => {
    stopCurrentStream(); // 🛑 停止先前相機
    setImageCapture(null);
    setError(null);

    const constraints = {
      video: {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        facingMode: !deviceId ? { exact: "environment" } : undefined,
      },
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const track = stream.getVideoTracks()[0];
      const settings = track.getSettings();
      setCurrentDeviceId(settings.deviceId);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      try {
        const capture = new ImageCapture(track);
        setImageCapture(capture);
      } catch (err) {
        console.warn("ImageCapture 初始化失敗", err);
      }
    } catch (err) {
      console.error("相機啟用失敗", err);
      setError("無法啟動相機，請確認權限與裝置可用性。");
    }
  };

  const getCameras = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter(
        (d) => d.kind === "videoinput" && !isVirtual(d.label)
      );
      setVideoDevices(cameras);

      // 預設啟用第一支非前鏡頭
      const preferred = cameras.find((d) => !isFront(d.label)) || cameras[0];
      if (preferred) {
        startCamera(preferred.deviceId);
      }
    } catch (err) {
      console.error("取得鏡頭清單失敗", err);
    }
  };

  useEffect(() => {
    getCameras();
    navigator.mediaDevices.addEventListener("devicechange", getCameras);
    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", getCameras);
      stopCurrentStream();
    };
  }, []);

  return (
    <div style={{ fontFamily: "sans-serif", padding: "20px" }}>
      <h2>📷 智慧相機（多鏡頭支援）</h2>

      {error && <div style={{ color: "red" }}>⚠️ {error}</div>}

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ width: "100%", maxWidth: "500px", borderRadius: "10px" }}
      />

      <div style={{ marginTop: "10px" }}>
        <button onClick={takePhoto}>📸 拍照</button>
      </div>

      <canvas
        ref={canvasRef}
        style={{
          width: "300px",
          height: "auto",
          marginTop: "10px",
          border: "1px solid #ccc",
        }}
      />

      <div style={{ marginTop: "20px" }}>
        <h4>可用鏡頭</h4>
        <ul>
          {videoDevices.map((device) => (
            <li key={device.deviceId}>
              {device.label || `Camera (${device.deviceId.slice(0, 4)}...)`}
              {device.deviceId === currentDeviceId && (
                <strong style={{ color: "green" }}> ← 使用中</strong>
              )}
              <br />
              <button onClick={() => startCamera(device.deviceId)}>
                切換到此鏡頭
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default SmartCamera;

