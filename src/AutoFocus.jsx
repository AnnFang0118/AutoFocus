import React, { useEffect, useRef, useState } from "react";

const AutoCamera = () => {
  const videoRef = useRef(null);
  const photoCanvasRef = useRef(null);
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [imageCapture, setImageCapture] = useState(null);
  const [platform, setPlatform] = useState("unknown");

  const isIPhone = () => /iPhone/i.test(navigator.userAgent);
  const isAndroid = () => /Android/i.test(navigator.userAgent);

  const stopStream = () => {
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  const drawToCanvas = (canvas, bitmap) => {
    const ctx = canvas.getContext("2d");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    ctx.drawImage(bitmap, 0, 0);
  };

  const handleTakePhoto = () => {
    if (!imageCapture) return;
    imageCapture.takePhoto()
      .then(blob => createImageBitmap(blob))
      .then(bitmap => drawToCanvas(photoCanvasRef.current, bitmap))
      .catch(err => console.error("Take photo error:", err));
  };

  const startCamera = async (deviceId) => {
    stopStream();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId } }
      });
      const track = stream.getVideoTracks()[0];
      setImageCapture(new ImageCapture(track));
      videoRef.current.srcObject = stream;
      videoRef.current.play();
      setSelectedDeviceId(deviceId);
    } catch (err) {
      console.warn("啟用相機失敗：", err);
    }
  };

  const initDevices = async () => {
    try {
      // iPhone 需先觸發一次授權
      if (isIPhone()) {
        await navigator.mediaDevices.getUserMedia({ video: true });
      }

      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = allDevices.filter(d => d.kind === "videoinput");
      setDevices(videoInputs);

      if (isAndroid()) {
        // 自動選擇有 auto focus 的後鏡頭
        for (const device of videoInputs) {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({
              video: { deviceId: { exact: device.deviceId } }
            });
            const track = stream.getVideoTracks()[0];
            const caps = track.getCapabilities?.();
            const isAF = caps?.focusMode?.includes("continuous") || caps?.focusMode?.includes("auto");
            track.stop();
            if (isAF) {
              startCamera(device.deviceId);
              return;
            }
          } catch (e) {
            continue;
          }
        }
        // fallback
        if (videoInputs.length > 0) {
          startCamera(videoInputs[0].deviceId);
        }
      }
    } catch (err) {
      console.error("初始化失敗：", err);
    }
  };

  useEffect(() => {
    const plat = isIPhone() ? "iPhone" : isAndroid() ? "Android" : "其他";
    setPlatform(plat);
    initDevices();

    return () => stopStream();
  }, []);

  return (
    <div style={{ fontFamily: "sans-serif", padding: "20px" }}>
      <h2>📷 自動相機 ({platform})</h2>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          width: "100%",
          maxWidth: "500px",
          border: "1px solid #ccc",
          borderRadius: "8px"
        }}
      />
      <div style={{ marginTop: "10px" }}>
        <button onClick={handleTakePhoto}>📸 拍照</button>
      </div>
      <canvas
        ref={photoCanvasRef}
        style={{
          marginTop: "10px",
          width: "240px",
          height: "180px",
          border: "1px solid #aaa"
        }}
      />
      <h3>🎛️ 鏡頭選擇</h3>
      <ul>
        {devices.map((d) => (
          <li key={d.deviceId}>
            {d.label || "未命名相機"}
            {d.deviceId === selectedDeviceId && (
              <strong style={{ color: "green" }}> ← 使用中</strong>
            )}
            <br />
            <button onClick={() => startCamera(d.deviceId)}>切換</button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default AutoCamera;


