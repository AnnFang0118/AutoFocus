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
  const [failedDevices, setFailedDevices] = useState(new Set());

  const isVirtual = (label = "") => /virtual|obs|snap|manycam/i.test(label);
  const isFront = (label = "") =>
    /front|前置|facetime|self/i.test(label) && !/usb|camera|webcam/i.test(label);
  const isUltraWide = (label = "") => /ultra[- ]?wide/i.test(label);

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

  const checkAutoFocusSupport = async (track, deviceId) => {
    try {
      const capabilities = track.getCapabilities?.();
      const focusModes = capabilities?.focusMode || [];
      const hasAutoFocus = focusModes.includes("auto");
      setFocusSupportMap((prev) => ({
        ...prev,
        [deviceId]: hasAutoFocus,
      }));
    } catch (err) {
      console.warn(`偵測 ${deviceId} 對焦能力失敗`, err);
    }
  };

  const startCamera = async (deviceId = null) => {
    stopCurrentStream();
    setImageCapture(null);

    console.log("⚙️ 嘗試啟用鏡頭", deviceId);

    const constraints = {
      video: {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        facingMode: !deviceId ? { ideal: "environment" } : undefined,
      },
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const track = stream.getVideoTracks()[0];
      const settings = track.getSettings();
      console.log("✅ getUserMedia 成功", settings);

      videoRef.current.srcObject = stream;
      setCurrentDeviceId(settings.deviceId);

      let capture = null;
      try {
        capture = new ImageCapture(track);
        setImageCapture(capture);
      } catch (e) {
        console.warn("⚠️ ImageCapture 初始化失敗", e);
      }

      try {
        if (capture) {
          const bitmap = await capture.grabFrame();
          drawImage(bitmap);
          setResolutionMap((prev) => ({
            ...prev,
            [settings.deviceId]: {
              width: bitmap.width,
              height: bitmap.height,
            },
          }));
        }
      } catch (e) {
        console.warn("⚠️ 無法 grabFrame", e);
      }

      checkAutoFocusSupport(track, settings.deviceId);
      return true;
    } catch (err) {
      console.error("❌ 相機啟用失敗", deviceId, err);

      // Fallback 嘗試一般 video:true，避免某些裝置 exact 失敗
      try {
        console.warn("🔁 嘗試 fallback 到 video:true");
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        videoRef.current.srcObject = fallbackStream;
        const track = fallbackStream.getVideoTracks()[0];
        const fallbackSettings = track.getSettings();
        setCurrentDeviceId(fallbackSettings.deviceId);
        return true;
      } catch (fallbackErr) {
        console.error("❌ fallback 也失敗", fallbackErr);
        setFailedDevices((prev) => new Set(prev).add(deviceId));
        return false;
      }
    }
  };

  const selectBestCamera = (cameras) => {
    const scored = cameras.map((cam) => {
      const auto = focusSupportMap[cam.deviceId] ? 1 : 0;
      const res = resolutionMap[cam.deviceId] || { width: 0, height: 0 };
      const totalPixels = res.width * res.height;
      const ultraPenalty = isUltraWide(cam.label) ? -1000000 : 0;

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
      const cameras = devices.filter((d) => d.kind === "videoinput");
      setVideoDevices(cameras);

      const validCameras = cameras.filter(
        (d) => !isVirtual(d.label) && !isFront(d.label)
      );

      if (validCameras.length === 0) return;

      // 啟用第一顆
      for (let cam of validCameras) {
        const success = await startCamera(cam.deviceId);
        if (success) break;
      }

      // 過一段時間後選最佳
      setTimeout(async () => {
        const available = validCameras.filter(
          (d) => !failedDevices.has(d.deviceId)
        );
        const best = selectBestCamera(available);
        if (best && best.deviceId !== currentDeviceId) {
          const success = await startCamera(best.deviceId);
          if (!success) console.warn("最佳鏡頭打不開，維持原狀");
        }
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
      <h2>📷 智慧相機（自動選擇最佳後鏡頭）</h2>

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
        <h4>鏡頭清單</h4>
        <ul>
          {videoDevices.map((device) => {
            const isFrontCam = isFront(device.label);
            const isVirtualCam = isVirtual(device.label);
            const supportsAutoFocus = focusSupportMap[device.deviceId];
            const resolution = resolutionMap[device.deviceId];
            const failed = failedDevices.has(device.deviceId);

            return (
              <li key={device.deviceId}>
                {device.label || `Camera (${device.deviceId.slice(0, 4)}...)`}{" "}
                {isFrontCam && <span style={{ color: "red" }}>（前鏡頭）</span>}
                {isVirtualCam && (
                  <span style={{ color: "gray" }}>（虛擬鏡頭）</span>
                )}
                {device.deviceId === currentDeviceId && (
                  <strong style={{ color: "green" }}> ← 使用中</strong>
                )}
                {failed && (
                  <span style={{ color: "orange" }}> ⚠️ 開啟失敗</span>
                )}
                <div>
                  🔍 自動對焦：{" "}
                  {supportsAutoFocus === undefined
                    ? "偵測中..."
                    : supportsAutoFocus
                    ? "✅ 有"
                    : "❌ 無"}
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
