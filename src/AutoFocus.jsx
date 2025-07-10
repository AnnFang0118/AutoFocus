import React, { useEffect, useRef, useState } from "react";

const AutoFocusCamera = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [imageCapture, setImageCapture] = useState(null);
  const [videoDevices, setVideoDevices] = useState([]);
  const [currentDeviceId, setCurrentDeviceId] = useState(null);

  // 過濾掉不適合拍證件照的鏡頭（例如：macro、depth）
  const isValidBackCamera = (label = "") => {
    return (
      /back|rear|wide|main/i.test(label) &&
      !/depth|macro|blackwhite|mono|infrared/i.test(label)
    );
  };

  // 判斷支不支援自動對焦
  const supportsAutoFocus = (capabilities) => {
    return (
      capabilities?.focusMode?.includes("continuous") ||
      capabilities?.focusMode?.includes("auto")
    );
  };

  // 開啟指定鏡頭
  const startCamera = async (deviceId) => {
    try {
      const constraints = {
        video: {
          deviceId: { exact: deviceId },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const track = stream.getVideoTracks()[0];
      const capabilities = track.getCapabilities();

      if (!supportsAutoFocus(capabilities)) {
        console.warn("⚠️ 該鏡頭不支援自動對焦");
        return;
      }

      if (videoRef.current) videoRef.current.srcObject = stream;
      setCurrentDeviceId(deviceId);

      try {
        const capture = new window.ImageCapture(track);
        setImageCapture(capture);
      } catch (err) {
        console.warn("⚠️ 無法初始化 ImageCapture:", err);
      }
    } catch (err) {
      console.error("🚫 鏡頭啟用失敗:", err);
    }
  };

  // 初始化鏡頭
  const getAvailableBackCameras = async () => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoInputs = devices.filter(
      (d) => d.kind === "videoinput" && isValidBackCamera(d.label)
    );

    const validDevices = [];

    for (const device of videoInputs) {
      try {
        const testStream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: device.deviceId } },
        });
        const track = testStream.getVideoTracks()[0];
        const capabilities = track.getCapabilities();
        track.stop();

        if (supportsAutoFocus(capabilities)) {
          validDevices.push(device);
        }
      } catch (err) {
        // 跳過無法啟用的裝置
      }
    }

    setVideoDevices(validDevices);

    if (validDevices.length > 0) {
      await startCamera(validDevices[0].deviceId);
    }
  };

  useEffect(() => {
    getAvailableBackCameras();
  }, []);

  const takePhoto = async () => {
    if (!imageCapture) return console.warn("ImageCapture 尚未準備好");

    try {
      const blob = await imageCapture.takePhoto();
      const bitmap = await createImageBitmap(blob);

      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      ctx.drawImage(bitmap, 0, 0, bitmap.width, bitmap.height);
    } catch (err) {
      console.error("📷 拍照失敗:", err);
    }
  };

  return (
    <div style={{ fontFamily: "sans-serif", padding: "20px" }}>
      <h2>📷 後鏡頭（自動對焦）</h2>

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ width: "100%", maxWidth: "480px", borderRadius: "8px" }}
      />

      <div style={{ marginTop: "10px" }}>
        <button onClick={takePhoto}>Take Photo</button>
      </div>

      <canvas
        ref={canvasRef}
        style={{
          width: "240px",
          height: "180px",
          border: "1px solid #ccc",
          marginTop: "10px",
        }}
      />

      <h3 style={{ marginTop: "20px" }}>📋 可用後鏡頭</h3>
      <ul>
        {videoDevices.map((device) => (
          <li key={device.deviceId}>
            {device.label || "未知鏡頭"}
            {device.deviceId === currentDeviceId && (
              <strong style={{ color: "green" }}> ← 使用中</strong>
            )}
            <br />
            <button onClick={() => startCamera(device.deviceId)}>切換到這顆</button>
          </li>
        ))}
        {videoDevices.length === 0 && <p>找不到可自動對焦的後鏡頭</p>}
      </ul>
    </div>
  );
};

export default AutoFocusCamera;
