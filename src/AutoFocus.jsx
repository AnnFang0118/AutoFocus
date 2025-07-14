import React, { useEffect, useRef, useState } from "react";

const isIOS = /iPhone|iPad/i.test(navigator.userAgent);

const SmartCameraAutoFocus = () => {
  const videoRef = useRef(null);
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [error, setError] = useState("");

  const stopStream = () => {
    if (videoRef.current?.srcObject) {
      videoRef.current.getTracks?.forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
  };

  const isBackCamera = (label = "") =>
    /back|rear|environment|主|廣角|wide|後/i.test(label);

  const startCamera = async (deviceId = null) => {
    stopStream();

    try {
      let constraints;

      if (isIOS) {
        constraints = { video: { facingMode: { exact: "environment" } } };
      } else {
        constraints = deviceId
          ? { video: { deviceId: { exact: deviceId } } }
          : { video: true };
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const track = stream.getVideoTracks()[0];

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setSelectedDeviceId(track.getSettings().deviceId);
    } catch (err) {
      console.error("🚫 鏡頭啟用失敗", err);
      setError("⚠️ 無法啟用鏡頭");
    }
  };

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

  const listBackCameras = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ video: true }); // 要求權限
      const all = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = all.filter((d) => d.kind === "videoinput");

      const backCameras = isIOS
        ? videoDevices // iPhone 上無法分辨，直接顯示所有
        : videoDevices.filter((d) => isBackCamera(d.label));

      const enriched = await Promise.all(
        backCameras.map((d) => checkAutoFocusSupport(d))
      );

      setDevices(enriched);

      if (!isIOS && enriched.length > 0) {
        await startCamera(enriched[0].deviceId); // Android/桌機啟用第一個後鏡頭
      } else if (isIOS) {
        await startCamera(); // iPhone 使用 facingMode
      }
    } catch (err) {
      console.error("⚠️ 列出鏡頭失敗", err);
      setError("⚠️ 無法列出鏡頭");
    }
  };

  useEffect(() => {
    listBackCameras();
    return stopStream;
  }, []);

  return (
    <div style={{ fontFamily: "sans-serif", padding: "20px" }}>
      <h2>📷 自動對焦相機（後鏡頭限定）</h2>

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

      {!isIOS && (
        <>
          <h3 style={{ marginTop: "20px" }}>🎛️ 可切換後鏡頭</h3>
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
                <button onClick={() => startCamera(device.deviceId)}>
                  切換
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {isIOS && (
        <p style={{ color: "#666", fontSize: "14px", marginTop: "20px" }}>
          📱 iPhone 上僅能啟用預設後鏡頭，無法選擇多鏡頭。
        </p>
      )}
    </div>
  );
};

export default SmartCameraAutoFocus;
