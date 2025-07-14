import { useEffect, useRef, useState } from "react";

const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

const isFrontCamera = (label = "") =>
  /front|facetime|self|前/i.test(label);

const AutoCameraSimple = () => {
  const videoRef = useRef(null);
  const [deviceList, setDeviceList] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [error, setError] = useState("");

  const stopStream = () => {
    const stream = videoRef.current?.srcObject;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  const getAllDevices = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ video: true });
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter(
        (d) => d.kind === "videoinput" && !isFrontCamera(d.label)
      );
    } catch (err) {
      console.error("getDevices error:", err);
      setError("🚫 無法取得鏡頭列表");
      return [];
    }
  };

  const hasAutoFocus = async (deviceId) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId } },
      });
      const track = stream.getVideoTracks()[0];
      const caps = track.getCapabilities?.();
      track.stop();
      return caps?.focusMode?.includes("auto") || caps?.focusMode?.includes("continuous");
    } catch {
      return false;
    }
  };

  const pickBestCamera = async (devices) => {
    for (const d of devices) {
      if (await hasAutoFocus(d.deviceId)) return d.deviceId;
    }
    return devices[0]?.deviceId || null;
  };

  const startCamera = async (deviceId = null) => {
    stopStream();
    try {
      const constraints = isIOS
        ? { video: { facingMode: { exact: "environment" } } }
        : { video: { deviceId: { exact: deviceId } } };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      videoRef.current.srcObject = stream;
      setSelectedDeviceId(deviceId);
    } catch (err) {
      console.error("startCamera error:", err);
      setError("🚫 相機啟用失敗");
    }
  };

  useEffect(() => {
    (async () => {
      const allDevices = await getAllDevices();
      setDeviceList(allDevices);

      const bestId = isIOS
        ? null
        : await pickBestCamera(allDevices);

      await startCamera(bestId);
    })();

    return () => stopStream();
  }, []);

  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
      <h2>📷 相機預覽（排除前置）</h2>
      {error && <p style={{ color: "red" }}>{error}</p>}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ width: "100%", maxWidth: "480px", border: "1px solid #ccc" }}
      />
      <h3 style={{ marginTop: "20px" }}>🎛️ 可用後鏡頭</h3>
      <ul>
        {deviceList.map((d) => (
          <li key={d.deviceId}>
            {d.label || "未命名鏡頭"}
            {d.deviceId === selectedDeviceId && (
              <strong style={{ color: "green" }}> ← 使用中</strong>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default AutoCameraSimple;


