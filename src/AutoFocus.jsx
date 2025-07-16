import { useEffect, useRef, useState } from "react";

const isIOS = /iPhone|iPad/i.test(navigator.userAgent);

const SmartCamera = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [videoDevices, setVideoDevices] = useState([]);
  const [currentDeviceId, setCurrentDeviceId] = useState(null);
  const [imageCapture, setImageCapture] = useState(null);
  const [focusSupportMap, setFocusSupportMap] = useState({});
  const [resolutionMap, setResolutionMap] = useState({});
  const [bestCameraId, setBestCameraId] = useState(null);
  const [cameraDebugInfo, setCameraDebugInfo] = useState(null);

  const classifyCameraLabel = (label = "") => ({
    isVirtual: /virtual|obs|snap|manycam/i.test(label),
    isFront: /front|\u524d\u7f6e|facetime|self/i.test(label),
    isUltraWide: /ultra[- ]?wide/i.test(label),
  });

  const updateDeviceMap = (setter, deviceId, value) => {
    setter((prev) => ({ ...prev, [deviceId]: value }));
  };

  const drawAndShowBitmap = (bitmap) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    ctx.drawImage(bitmap, 0, 0);
  };

  const stopCurrentStream = () => {
    const stream = videoRef.current?.srcObject;
    if (stream && stream.getTracks) {
      stream.getTracks().forEach((track) => track.stop());
    }
  };

  const takePhoto = async () => {
    if (!imageCapture) return;
    try {
      if (!isIOS && imageCapture.takePhoto) {
        const blob = await imageCapture.takePhoto();
        const bitmap = await createImageBitmap(blob);
        drawAndShowBitmap(bitmap);
      } else {
        const bitmap = await imageCapture.grabFrame();
        drawAndShowBitmap(bitmap);
      }
    } catch (err) {
      console.warn("\u62cd\u7167\u5931\u6557\uff0c\u4f7f\u7528 grabFrame \u5099\u6848", err);
      try {
        const bitmap = await imageCapture.grabFrame();
        drawAndShowBitmap(bitmap);
      } catch (e) {
        console.error("grabFrame \u4e5f\u5931\u6551", e);
      }
    }
  };

  const checkAutoFocusSupport = async (track, deviceId) => {
    try {
      const capabilities = track.getCapabilities?.();
      const hasAutoFocus = capabilities?.focusMode?.includes("auto") ?? null;
      updateDeviceMap(setFocusSupportMap, deviceId, hasAutoFocus);
    } catch (err) {
      console.warn(`\u5075\u6e2c ${deviceId} \u5c0d\u7126\u80fd\u529b\u5931\u6557`, err);
      updateDeviceMap(setFocusSupportMap, deviceId, null);
    }
  };

  const startCamera = async (deviceId = null) => {
    stopCurrentStream();
    setImageCapture(null);

    const constraints = {
      video: {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        facingMode: !deviceId ? { exact: "environment" } : undefined
      }
    };

    try {
      console.log("\uD83C\uDFA5 嘗試啟用鏡頭：", deviceId, constraints);

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const track = stream.getVideoTracks()[0];

      if (!track) {
        alert("\u26D4\uFE0F 無法取得 video track");
        setCameraDebugInfo({ error: "無法取得 video track", deviceId });
        return;
      }

      const settings = track.getSettings();
      const capabilities = track.getCapabilities?.();

      console.log("\u2705 鏡頭啟用成功:", {
        settings,
        capabilities,
        label: track.label,
      });

      setCameraDebugInfo({
        deviceId: settings.deviceId,
        label: track.label,
        settings,
        capabilities,
      });

      setCurrentDeviceId(settings.deviceId);
      videoRef.current.srcObject = stream;

      updateDeviceMap(setResolutionMap, settings.deviceId, {
        width: settings.width || 0,
        height: settings.height || 0,
      });

      try {
        const capture = new ImageCapture(track);
        setImageCapture(capture);
      } catch (err) {
        console.warn("ImageCapture 初始化失敗", err);
      }

      checkAutoFocusSupport(track, settings.deviceId);
    } catch (err) {
      console.error("\u274C 鏡頭啟用失敗：", err);
      alert("⚠️ 鏡頭啟用失敗：" + err.message);

      // fallback：啟用第一顆成功過的鏡頭
      const fallback = videoDevices.find((d) => d.deviceId !== deviceId);
      if (fallback) {
        alert("➡️ 改用其他鏡頭");
        startCamera(fallback.deviceId);
      }

      setCameraDebugInfo({
        error: err.message,
        deviceId,
        constraints,
      });
    }
  };

  // 其他程式碼保持不變...

  return (
    <div style={{ fontFamily: "sans-serif", padding: "20px" }}>
      <h2>📷 智慧相機（推薦鏡頭會自動啟用一次）</h2>

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        onError={() => alert("⚠️ video 播放失敗（可能是鏡頭問題）")}
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
        <h4>可用鏡頭（排除前鏡頭與虛擬鏡頭）</h4>
        <ul>
          {videoDevices.map((device) => {
            const supportsAutoFocus = focusSupportMap[device.deviceId];
            const resolution = resolutionMap[device.deviceId];
            return (
              <li key={device.deviceId}>
                {device.label || `Camera (${device.deviceId.slice(0, 4)}...)`}
                {device.deviceId === currentDeviceId && (
                  <strong style={{ color: "green" }}> ← 使用中</strong>
                )}
                {device.deviceId === bestCameraId && (
                  <strong style={{ color: "blue", marginLeft: "6px" }}>★ 推薦</strong>
                )}
                <div>
                  🔍 自動對焦：{supportsAutoFocus === true ? "✅ 有" : supportsAutoFocus === false ? "❌ 無" : "❓ 無法判斷"}
                </div>
                <div>
                  📏 解析度：{resolution ? `${resolution.width}×${resolution.height}` : "讀取中..."}
                </div>
                <button onClick={() => startCamera(device.deviceId)}>切換到此鏡頭</button>
              </li>
            );
          })}
        </ul>
      </div>

      {cameraDebugInfo && (
        <div style={{ marginTop: "30px", padding: "10px", background: "#f9f9f9", border: "1px dashed #ccc" }}>
          <h4>🐛 鏡頭偵錯資訊</h4>
          {cameraDebugInfo.error ? (
            <div style={{ color: "red" }}>
              ❌ 啟用失敗：{cameraDebugInfo.error}<br />
              deviceId: {cameraDebugInfo.deviceId}
            </div>
          ) : (
            <div>
              <div>📷 Label：{cameraDebugInfo.label}</div>
              <div>🆔 ID：{cameraDebugInfo.deviceId}</div>
              <div>📏 解析度：{cameraDebugInfo.settings.width} × {cameraDebugInfo.settings.height}</div>
              <div>
                🔍 對焦能力：
                {cameraDebugInfo.capabilities?.focusMode
                  ? cameraDebugInfo.capabilities.focusMode.join(", ")
                  : "（無資料）"}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SmartCamera;

