import { useEffect, useRef, useState } from "react";

const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

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
      return devices.filter((d) => d.kind === "videoinput");
    } catch (err) {
      console.error("getDevices error:", err);
      setError("🚫 取得鏡頭清單失敗");
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
    for (const device of devices) {
      if (await hasAutoFocus(device.deviceId)) return device.deviceId;
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
      <h2>📷 相機預覽</h2>
      {error && <p style={{ color: "red" }}>{error}</p>}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ width: "100%", maxWidth: "480px", border: "1px solid #ccc" }}
      />
      <h3 style={{ marginTop: "20px" }}>🎛️ 所有相機裝置</h3>
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
    setError("");

    try {
      stopStream();
      await new Promise((r) => setTimeout(r, 200));

      const constraints = isIOS
        ? { video: { facingMode: { exact: "environment" } } }
        : { video: { deviceId: { exact: deviceId } } };

      let mediaStream;

      try {
        mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err) {
        // fallback: 若 deviceId 無效則改用 facingMode
        console.warn("使用 deviceId 啟動失敗，嘗試 fallback:", err);
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { exact: "environment" } },
        });
      }

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
      console.error("啟用相機失敗：", err);
      setError("🚫 無法啟用相機，請檢查權限與瀏覽器相容性");
    } finally {
      setLoading(false);
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
        console.warn("ImageCapture 拍照失敗，使用截圖方式", err);
      }
    }

    // fallback：畫面截圖方式
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
        await startCamera(); // iOS 改用 facingMode
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
                <button onClick={() => startCamera(d.deviceId)} disabled={loading}>
                  切換
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default AutoCamera;


