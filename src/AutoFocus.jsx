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
        console.error("grabFrame \u4e5f\u5931\u6557", e);
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

    const isBest = deviceId === bestCameraId;

    const constraints = {
      video: {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        facingMode: !deviceId ? { exact: "environment" } : undefined,
        ...(isBest && {
          width: { ideal: 1280 },
          height: { ideal: 720 },
        }),
      },
    };

    try {
      console.log("\uD83C\uDFA5 \u5617\u8A66\u555F\u7528\u93E1\u982D\uff1a", deviceId, constraints);

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const track = stream.getVideoTracks()[0];

      if (!track) {
        alert("\u26D4\uFE0F \u555F\u7528\u5931\u6557\uff1a\u7121\u6CD5\u53D6\u5F97 video track");
        setCameraDebugInfo({ error: "無法取得 video track", deviceId });
        return;
      }

      const settings = track.getSettings();
      const capabilities = track.getCapabilities?.();

      console.log("\u2705 \u76F8\u6A5F\u555F\u7528\u6210\u529F:", {
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
        console.warn("ImageCapture \u521D\u59CB\u5316\u5931\u6557", err);
      }

      checkAutoFocusSupport(track, settings.deviceId);
    } catch (err) {
      console.error("\u274C \u76F8\u6A5F\u555F\u7528\u5931\u6557\uff1A", err);
      alert("\u26A0\uFE0F \u93E1\u982D\u555F\u7528\u5931\u6557\uff1A" + err.message);
      setCameraDebugInfo({
        error: err.message,
        deviceId,
        constraints,
      });
    }
  };

  // 將 cameraDebugInfo 放在 render 中下方使用（略）...

  return (
    <div>
      {/* 其他原有 UI... */}

      {cameraDebugInfo && (
        <div style={{ marginTop: "30px", padding: "10px", background: "#f9f9f9", border: "1px dashed #ccc" }}>
          <h4>🐛 鏡頭偵錯資訊</h4>
          {cameraDebugInfo.error ? (
            <div style={{ color: "red" }}>
              ❌ 啟用失敗：{cameraDebugInfo.error}
              <br />
              deviceId: {cameraDebugInfo.deviceId}
            </div>
          ) : (
            <div>
              <div>📷 Label：{cameraDebugInfo.label}</div>
              <div>🆔 ID：{cameraDebugInfo.deviceId}</div>
              <div>
                📏 解析度：{cameraDebugInfo.settings.width} × {cameraDebugInfo.settings.height}
              </div>
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


