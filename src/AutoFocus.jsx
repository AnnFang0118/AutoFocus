import { useEffect, useRef, useState } from "react";

const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

const AutoCamera = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [devices, setDevices] = useState([]);
  const [stream, setStream] = useState(null);
  const [imageCapture, setImageCapture] = useState(null);
  const [currentDeviceId, setCurrentDeviceId] = useState(null);
  const [error, setError] = useState("");

  const isVirtual = (label) => /virtual|snap|obs|filter/i.test(label);
  const isFrontCamera = (label) => /front|facetime|self|前/i.test(label);

  const stopStream = () => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
    }
    setImageCapture(null);
  };

  const getDevices = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ video: true }); // 取得權限才能拿 label
      const all = await navigator.mediaDevices.enumerateDevices();
      const filtered = all.filter(
        (d) =>
          d.kind === "videoinput" &&
          !isVirtual(d.label || "") &&
          !isFrontCamera(d.label || "")
      );
      return filtered;
    } catch (err) {
      setError("🚫 無法取得相機裝置，請確認權限或瀏覽器支援性。");
      return [];
    }
  };

  const detectAutoFocus = async (list) => {
    const results = [];

    for (const d of list) {
      try {
        const testStream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: d.deviceId } },
        });
        const track = testStream.getVideoTracks()[0];
        const caps = track.getCapabilities?.();
        const hasAF =
          caps?.focusMode?.includes("continuous") ||
          caps?.focusMode?.includes("auto");
        track.stop();
        if (hasAF) {
          results.push(d);
        }
      } catch (_) {
        // skip errored
      }
    }

    return results;
  };

  const startCamera = async (deviceId = null) => {
    try {
      stopStream();

      const constraints = isIOS
        ? { video: { facingMode: { exact: "environment" } } }
        : { video: { deviceId: { exact: deviceId } } };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      setCurrentDeviceId(deviceId);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }

      const track = mediaStream.getVideoTracks()[0];
      if (!isIOS && "ImageCapture" in window) {
        try {
          const capture = new ImageCapture(track);
          setImageCapture(capture);
        } catch (err) {
          console.warn("ImageCapture 建立失敗：", err);
        }
      }
    } catch (err) {
      console.error("無法啟用相機：", err);
      setError("🚫 啟用相機失敗，可能不支援或未授權。");
    }
  };

  const takePhoto = async () => {
    if (!canvasRef.current || !videoRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext("2d");

    if (!isIOS && imageCapture) {
      try {
        const blob = await imageCapture.takePhoto();
        const bitmap = await createImageBitmap(blob);
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        ctx.drawImage(bitmap, 0, 0);
        return;
      } catch (err) {
        console.warn("ImageCapture 拍照失敗，改用截圖", err);
      }
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  };

  useEffect(() => {
    (async () => {
      const allDevices = await getDevices();

      let chosen = null;

      if (isIOS) {
        chosen = allDevices[0];
        await startCamera();
      } else {
        const withAF = await detectAutoFocus(allDevices);
        chosen = withAF[0] || allDevices[0];
        if (chosen) await startCamera(chosen.deviceId);
      }

      setDevices(allDevices);
    })();

    return stopStream;
  }, []);

  return (
    <div style={{ fontFamily: "sans-serif", padding: "20px" }}>
      <h2>📷 自動對焦相機</h2>
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
          borderRadius: "8px",
        }}
      />

      <button onClick={takePhoto} style={{ marginTop: "10px" }}>
        📸 拍照
      </button>

      <canvas
        ref={canvasRef}
        style={{
          width: "100%",
          maxWidth: "500px",
          marginTop: "10px",
          border: "1px solid #aaa",
        }}
      />

      <h3>🎛️ 可用後鏡頭</h3>
      <ul>
        {devices.map((d) => (
          <li key={d.deviceId}>
            {d.label || "Camera"}
            {currentDeviceId === d.deviceId && (
              <strong style={{ color: "green" }}> ← 使用中</strong>
            )}
            {!isIOS && (
              <div>
                <button onClick={() => startCamera(d.deviceId)}>切換</button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default AutoCamera;

