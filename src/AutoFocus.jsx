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

  const classifyCameraLabel = (label = "") => ({
    isVirtual: /virtual|obs|snap|manycam/i.test(label),
    isFront: /front|前置|facetime|self/i.test(label),
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
      console.warn("拍照失敗，使用 grabFrame 備案", err);
      try {
        const bitmap = await imageCapture.grabFrame();
        drawAndShowBitmap(bitmap);
      } catch (e) {
        console.error("grabFrame 也失敗", e);
      }
    }
  };

  const checkAutoFocusSupport = async (track, deviceId) => {
    try {
      const capabilities = track.getCapabilities?.();
      const hasAutoFocus = capabilities?.focusMode?.includes("auto") || null;
      updateDeviceMap(setFocusSupportMap, deviceId, hasAutoFocus);
    } catch (err) {
      console.warn(`偵測 ${deviceId} 對焦能力失敗`, err);
      updateDeviceMap(setFocusSupportMap, deviceId, null);
    }
  };

  const startCamera = async (deviceId = null) => {
    stopCurrentStream();
    setImageCapture(null);

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
      console.error("相機啟用失敗", err);
    }
  };

  const selectBestCamera = (cameras) => {
    const scored = cameras.map((cam) => {
      const { isUltraWide } = classifyCameraLabel(cam.label);
      const auto = focusSupportMap[cam.deviceId] ? 1 : 0;
      const res = resolutionMap[cam.deviceId] || { width: 0, height: 0 };
      const totalPixels = res.width * res.height;
      const ultraPenalty = isUltraWide ? -1000000 : 0;

      return {
        device: cam,
        score: auto * 1000000 + totalPixels + ultraPenalty,
      };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored[0]?.device;
  };

  const getCameras = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter((d) => {
        const { isVirtual, isFront } = classifyCameraLabel(d.label);
        return d.kind === "videoinput" && !isVirtual && !isFront;
      });

      setVideoDevices(cameras);
      if (cameras.length === 0) return;

      await startCamera(cameras[0].deviceId);

      setTimeout(() => {
        const best = selectBestCamera(cameras);
        if (best) setBestCameraId(best.deviceId);
      }, 1500);
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
      <h2>📷 智慧相機（顯示最佳鏡頭建議）</h2>

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
        <h4>可用鏡頭（排除前鏡頭與虛擬鏡頭）</h4>
        <p style={{ fontSize: "12px", color: "#666" }}>
          * 自動對焦能力由瀏覽器回報，部分裝置可能無法判斷
        </p>
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
                  <strong style={{ color: "blue", marginLeft: "6px" }}>
                    ★ 推薦
                  </strong>
                )}
                <div>
                  🔍 自動對焦：{" "}
                  {supportsAutoFocus === true
                    ? "✅ 有"
                    : supportsAutoFocus === false
                    ? "❌ 無"
                    : "❓ 無法判斷"}
                </div>
                <div>
                  📏 解析度：{" "}
                  {resolution
                    ? `${resolution.width}×${resolution.height}`
                    : "讀取中..."}
                </div>
                <button onClick={() => startCamera(device.deviceId)}>
                  切換到此鏡頭
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};

export default SmartCamera;
