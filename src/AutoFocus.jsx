import { useEffect, useRef, useState } from "react";

const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

const AutoCamera = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [devices, setDevices] = useState([]);
  const [stream, setStream] = useState(null);
  const [imageCapture, setImageCapture] = useState(null);
  const [currentDeviceId, setCurrentDeviceId] = useState(null);

  const isVirtual = (label) => /virtual|snap|obs/i.test(label);
  const isFrontCamera = (label) => /front|facetime|self/i.test(label);

  const getDevices = async () => {
    const all = await navigator.mediaDevices.enumerateDevices();
    const filtered = all.filter(
      (d) =>
        d.kind === "videoinput" &&
        !isVirtual(d.label || "") &&
        !isFrontCamera(d.label || "")
    );
    setDevices(filtered);
    return filtered;
  };

  const stopStream = () => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
    }
    setImageCapture(null);
  };

  const startCamera = async (deviceId) => {
    try {
      stopStream();
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: deviceId
          ? { deviceId: { exact: deviceId } }
          : { facingMode: { exact: "environment" } },
      });

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
    }
  };

  useEffect(() => {
    getDevices().then((list) => {
      if (list.length > 0) {
        startCamera(list[0].deviceId);
      }
    });

    return stopStream;
  }, []);

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
        console.warn("ImageCapture 拍照失敗，回退到畫面截圖法", err);
      }
    }

    // fallback for iOS
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  };

  return (
    <div style={{ fontFamily: "sans-serif", padding: "20px" }}>
      <h2>📷 相機預覽</h2>
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
        拍照
      </button>
      <h3>📸 拍照結果</h3>
      <canvas
        ref={canvasRef}
        style={{ width: "100%", maxWidth: "500px", border: "1px solid #aaa" }}
      />

      <h3>🎛️ 可用後鏡頭</h3>
      <ul>
        {devices.map((d) => (
          <li key={d.deviceId}>
            {d.label || "Camera"}
            {currentDeviceId === d.deviceId && (
              <strong style={{ color: "green" }}> ← 使用中</strong>
            )}
            <br />
            <button onClick={() => startCamera(d.deviceId)}>切換到這顆</button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default AutoCamera;

