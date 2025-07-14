import { useEffect, useRef, useState } from "react";

const isIOS = /iPhone|iPad/i.test(navigator.userAgent);

const SmartCamera = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [videoDevices, setVideoDevices] = useState([]);
  const [currentDeviceId, setCurrentDeviceId] = useState(null);
  const [imageCapture, setImageCapture] = useState(null);
  const [focusSupportMap, setFocusSupportMap] = useState({});
  const [focusControl, setFocusControl] = useState(null);

  const isVirtual = (label = "") => /virtual|obs|snap|manycam/i.test(label);
  const isFront = (label = "") => /front|前置|facetime|self/i.test(label);

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

  const checkFocusSupport = async (track, deviceId) => {
    try {
      const capabilities = track.getCapabilities?.() || {};
      const focusModes = capabilities.focusMode || [];
      const hasAuto = focusModes.includes("auto");

      setFocusSupportMap((prev) => ({
        ...prev,
        [deviceId]: hasAuto,
      }));

      if (capabilities.focusDistance) {
        const { min, max, step } = capabilities.focusDistance;
        const current = track.getSettings().focusDistance || min;
        setFocusControl({ min, max, step, current });
      } else {
        setFocusControl(null);
      }
    } catch (err) {
      console.warn("偵測對焦能力失敗", err);
      setFocusControl(null);
    }
  };

  const startCamera = async (deviceId = null) => {
    stopCurrentStream();
    setImageCapture(null);
    setFocusControl(null);

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

      try {
        const capture = new ImageCapture(track);
        setImageCapture(capture);
      } catch (err) {
        console.warn("ImageCapture 初始化失敗", err);
      }

      checkFocusSupport(track, settings.deviceId);
    } catch (err) {
      console.error("相機啟用失敗", err);
    }
  };

  const getCameras = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter(
        (d) => d.kind === "videoinput" && !isVirtual(d.label) && !isFront(d.label)
      );

      setVideoDevices(cameras);

      if (cameras.length > 0) {
        startCamera(cameras[0].deviceId);
      }
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
      <h2>📷 智慧相機（後鏡頭 + 自動／手動對焦）</h2>

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

      {focusControl && (
        <div style={{ marginTop: "10px" }}>
          <label>🔧 手動焦距：</label>
          <input
            type="range"
            min={focusControl.min}
            max={focusControl.max}
            step={focusControl.step}
            value={focusControl.current}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setFocusControl((prev) => ({ ...prev, current: val }));
              const stream = videoRef.current?.srcObject;
              const track = stream?.getVideoTracks()[0];
              if (track?.applyConstraints) {
                track
                  .applyConstraints({ advanced: [{ focusDistance: val }] })
                  .catch((err) => {
                    console.warn("套用手動對焦失敗", err);
                  });
              }
            }}
          />
          <span> {focusControl.current}</span>
        </div>
      )}

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
        <h4>可用鏡頭（排除前鏡頭）</h4>
        <ul>
          {videoDevices.map((device) => {
            const supportsAutoFocus = focusSupportMap[device.deviceId];
            return (
              <li key={device.deviceId}>
                {device.label || `Camera (${device.deviceId.slice(0, 4)}...)`}
                {device.deviceId === currentDeviceId && (
                  <strong style={{ color: "green" }}> ← 使用中</strong>
                )}
                <div>
                  🔍 自動對焦：{" "}
                  {supportsAutoFocus === undefined
                    ? "偵測中..."
                    : supportsAutoFocus
                    ? "✅ 有"
                    : "❌ 無"}
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




