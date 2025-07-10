import { useEffect, useRef, useState } from "react";

const isIOS = /iPhone|iPad/i.test(navigator.userAgent);

const SmartCamera = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [videoDevices, setVideoDevices] = useState([]);
  const [currentDeviceId, setCurrentDeviceId] = useState(null);
  const [imageCapture, setImageCapture] = useState(null);
  const [mode, setMode] = useState("init");

  const isVirtual = (label = "") => /virtual|obs|snap|manycam/i.test(label);
  const isFront = (label = "") => /front|前置|facetime|self/i.test(label);

  const drawImage = (bitmap) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const { width, height } = bitmap;

    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(bitmap, 0, 0, width, height);
  };

  const takePhoto = async () => {
    if (!imageCapture) return;

    if (!isIOS && imageCapture.takePhoto) {
      try {
        const blob = await imageCapture.takePhoto();
        const bitmap = await createImageBitmap(blob);
        drawImage(bitmap);
      } catch (err) {
        console.warn("takePhoto 失敗，改用 grabFrame", err);
        grabFrameFallback();
      }
    } else {
      grabFrameFallback();
    }
  };

  const grabFrameFallback = async () => {
    if (!imageCapture || !imageCapture.grabFrame) return;
    try {
      const bitmap = await imageCapture.grabFrame();
      drawImage(bitmap);
    } catch (err) {
      console.error("grabFrame 失敗", err);
    }
  };

  const startCamera = async (deviceId = null) => {
    const constraints = {
      video: deviceId
        ? { deviceId: { exact: deviceId } }
        : { facingMode: { exact: "environment" } },
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const track = stream.getVideoTracks()[0];
      const settings = track.getSettings();
      setCurrentDeviceId(settings.deviceId);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // 嘗試初始化 ImageCapture
      try {
        const capture = new ImageCapture(track);
        setImageCapture(capture);
      } catch (err) {
        console.warn("ImageCapture 初始化失敗", err);
      }
    } catch (err) {
      console.error("無法啟用相機", err);
    }
  };

  const getCameras = async () => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices.filter(
      (d) => d.kind === "videoinput" && !isVirtual(d.label) && !isFront(d.label)
    );
    setVideoDevices(cameras);

    if (cameras.length > 0) {
      startCamera(cameras[0].deviceId);
    }
  };

  useEffect(() => {
    getCameras();
    navigator.mediaDevices.addEventListener("devicechange", getCameras);
    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", getCameras);
    };
  }, []);

  return (
    <div style={{ fontFamily: "sans-serif", padding: "20px" }}>
      <h2>📷 智慧相機（自動對焦優先）</h2>

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
        <h4>可選鏡頭</h4>
        <ul>
          {videoDevices.map((device) => (
            <li key={device.deviceId}>
              {device.label || `Camera (${device.deviceId.slice(0, 4)}...)`}
              {device.deviceId === currentDeviceId && (
                <strong style={{ color: "green" }}> ← 使用中</strong>
              )}
              <br />
              <button onClick={() => startCamera(device.deviceId)}>切換</button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default SmartCamera;


