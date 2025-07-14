import React, { useEffect, useRef, useState } from "react";

const isIOS = /iPhone|iPad/i.test(navigator.userAgent);

const CameraAutoFocusChecker = () => {
  const videoRef = useRef(null);
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [error, setError] = useState("");

  const stopStream = () => {
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
  };

  const startCamera = async (deviceId) => {
    stopStream();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId } }
      });

      const track = stream.getVideoTracks()[0];
      const settings = track.getSettings();
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      setSelectedDeviceId(settings.deviceId);
    } catch (e) {
      console.error("啟用鏡頭失敗", e);
      setError("🚫 鏡頭啟用失敗");
    }
  };

  const isBackCamera = (label = "") =>
    /back|rear|environment|主|廣角|wide|後/i.test(label);

  const checkAutoFocusSupport = async (device) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: device.deviceId } }
      });
      const track = stream.getVideoTracks()[0];
      const capabilities = track.getCapabilities?.();
      const hasAutoFocus =
        capabilities?.focusMode?.includes("continuous") ||
        capabilities?.focusMode?.includes("auto");
      track.stop();
      return { ...device, hasAutoFocus: !!hasAutoFocus };
    } catch {
      return { ...device, hasAutoFocus: false };
    }
  };

  const getBackCameras = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ video: true });

      const all = await navigator.mediaDevices.enumerateDevices();
      const cameras = all.filter(
        (d) => d.kind === "videoinput" && isBackCamera(d.label)
      );

      const enriched = await Promise.all(
        cameras.map((device) => checkAutoFocusSupport(device))
      );

      setDevices(enriched);

      if (enriched.length > 0) {
        await startCamera(enriched[0].deviceId);
      } else {
        setError("⚠️ 沒有找到後鏡頭");
      }
    } catch (e) {
      console.error("列出鏡頭失敗", e);
      setError("⚠️ 無法取得鏡頭列表");
    }
  };

  useEffect(() => {
    getBackCameras();
    return stopStream;
  }, []);

  return (
    <div style={{ fontFamily: "sans-serif", padding: "20px" }}>
      <h2>📷 後鏡頭對焦檢查</h2>

      {error && <p style={{ color: "red" }}>{error}</p>}

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          width: "100%",
          maxWidth: "500px",
          border: "1px solid #ccc",
          borderRadius: "10px"
        }}
      />

      <h3 style={{ marginTop: "20px" }}>🎛️ 可用後鏡頭</h3>
      <ul>
        {devices.map((device) => (
          <li key={device.deviceId} style={{ marginBottom: "10px" }}>
            <strong>{device.label || "未命名鏡頭"}</strong>
            {device.hasAutoFocus ? (
              <span style={{ color: "green" }}> ✅ 支援自動對焦</span>
            ) : (
              <span style={{ color: "gray" }}> ⚠️ 無自動對焦</span>
            )}
            {device.deviceId === selectedDeviceId && (
              <strong style={{ color: "blue" }}> ← 使用中</strong>
            )}
            <br />
            <button onClick={() => startCamera(device.deviceId)}>切換</button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default CameraAutoFocusChecker;
