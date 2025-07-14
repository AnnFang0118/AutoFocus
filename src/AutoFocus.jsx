import { useEffect, useRef, useState } from "react";

const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
const isFrontCamera = (label = "") => /front|facetime|self|前/i.test(label);
const isVirtualCamera = (label = "") => /virtual|obs|snap|filter/i.test(label);

const AutoCameraSelectable = () => {
  const videoRef = useRef(null);
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [error, setError] = useState("");

  const stopStream = () => {
    const stream = videoRef.current?.srcObject;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  const getValidDevices = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ video: true }); // for permission
      const all = await navigator.mediaDevices.enumerateDevices();
      return all.filter(
        (d) =>
          d.kind === "videoinput" &&
          !isFrontCamera(d.label) &&
          !isVirtualCamera(d.label)
      );
    } catch (err) {
      setError("🚫 無法取得相機清單，請確認權限或瀏覽器支援性");
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

  const selectAutoFocusCamera = async (deviceList) => {
    for (const d of deviceList) {
      if (await hasAutoFocus(d.deviceId)) {
        return d.deviceId;
      }
    }
    return deviceList[0]?.deviceId || null;
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
      setError("🚫 無法啟用相機，可能未授權或不支援");
    }
  };

  useEffect(() => {
    (async () => {
      const deviceList = await getValidDevices();
      setDevices(deviceList);

      if (isIOS) {
        await startCamera(); // iOS 使用 facingMode
      } else {
        const preferredId = await selectAutoFocusCamera(deviceList);
        if (preferredId) await startCamera(preferredId);
      }
    })();

    return () => stopStream();
  }, []);

  return (
    <div style={{ fontFamily: "sans-serif", padding: "20px" }}>
      <h2>📷 自動對焦相機（可手動切換）</h2>
      {error && <p style={{ color: "red" }}>{error}</p>}

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          width: "100%",
          maxWidth: "480px",
          border: "1px solid #ccc",
          borderRadius: "8px",
        }}
      />

      <h3 style={{ marginTop: "20px" }}>🎛️ 可用鏡頭（不含前鏡頭）</h3>
      <ul>
        {devices.map((d) => (
          <li key={d.deviceId}>
            {d.label || "未命名鏡頭"}
            {d.deviceId === selectedDeviceId && (
              <strong style={{ color: "green" }}> ← 使用中</strong>
            )}
            {!isIOS && (
              <div>
                <button onClick={() => startCamera(d.deviceId)}>切換到這顆</button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default AutoCameraSelectable;



