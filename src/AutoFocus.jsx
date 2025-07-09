import React, { useEffect, useRef, useState } from "react";

const AutoFocusCameras = () => {
  const videoRef = useRef(null);
  const [devices, setDevices] = useState([]);
  const [currentDeviceId, setCurrentDeviceId] = useState(null);
  const streamRef = useRef(null);

  // 啟用指定裝置
  const startCamera = async (deviceId) => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: { deviceId: { exact: deviceId } },
    });

    streamRef.current = stream;
    const track = stream.getVideoTracks()[0];
    setCurrentDeviceId(track.getSettings().deviceId);
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  };

  // 檢查裝置是否支援自動對焦
  const checkIfSupportsAutoFocus = async (deviceId) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId } },
      });
      const track = stream.getVideoTracks()[0];
      const capabilities = track.getCapabilities();

      const supportsFocus =
        capabilities.focusMode?.includes("manual") ||
        capabilities.focusMode?.includes("continuous");

      track.stop();
      return supportsFocus;
    } catch (err) {
      console.warn("無法讀取裝置功能:", err);
      return false;
    }
  };

  // 掃描所有裝置 + 過濾支援 autofocus 的
  const findAutoFocusDevices = async () => {
    const allDevices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = allDevices.filter((d) => d.kind === "videoinput");

    const results = [];
    for (const device of videoDevices) {
      const supports = await checkIfSupportsAutoFocus(device.deviceId);
      if (supports) {
        results.push(device);
      }
    }

    setDevices(results);

    if (results.length > 0 && !currentDeviceId) {
      startCamera(results[0].deviceId);
    }
  };

  useEffect(() => {
    findAutoFocusDevices();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
      <h2>🎥 支援自動對焦的鏡頭</h2>
      {devices.length === 0 ? (
        <p>未偵測到支援自動對焦的鏡頭</p>
      ) : (
        <ul>
          {devices.map((device) => (
            <li key={device.deviceId}>
              {device.label || "(無法取得名稱)"}
              {device.deviceId === currentDeviceId && (
                <strong style={{ color: "green" }}> ← 使用中</strong>
              )}
              <br />
              <button onClick={() => startCamera(device.deviceId)}>
                切換到這顆
              </button>
            </li>
          ))}
        </ul>
      )}

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ marginTop: "20px", width: "100%", maxWidth: "500px", border: "1px solid #ccc" }}
      />
    </div>
  );
};

export default AutoFocusCameras;

