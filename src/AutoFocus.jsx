import { useEffect, useRef, useState } from "react";

const AndroidSafeCamera = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [videoDevices, setVideoDevices] = useState([]);
  const [currentDeviceId, setCurrentDeviceId] = useState(null);
  const [imageCapture, setImageCapture] = useState(null);
  const streamRef = useRef(null);

  const isFrontCamera = (label) => /front|前|face/i.test(label || "");
  const isVirtualCamera = (label) => /virtual|snap|obs|manycam/i.test(label || "");

  const drawToCanvas = (bitmap) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, width, height);
    const ratio = Math.min(width / bitmap.width, height / bitmap.height);
    const x = (width - bitmap.width * ratio) / 2;
    const y = (height - bitmap.height * ratio) / 2;
    ctx.drawImage(bitmap, 0, 0, bitmap.width, bitmap.height, x, y, bitmap.width * ratio, bitmap.height * ratio);
  };

  const takePhoto = () => {
    if (!imageCapture) return;
    imageCapture
      .takePhoto()
      .then(createImageBitmap)
      .then(drawToCanvas)
      .catch((err) => console.error("TakePhoto Error:", err));
  };

  const stopCurrentStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const startCamera = async (deviceId) => {
    try {
      stopCurrentStream();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId } },
      });

      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;

      const track = stream.getVideoTracks()[0];
      setImageCapture(new ImageCapture(track));
      setCurrentDeviceId(deviceId);
    } catch (err) {
      console.error("startCamera failed:", err);
    }
  };

  const listDevicesAndStartBest = async () => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const filtered = devices.filter(
      (d) =>
        d.kind === "videoinput" &&
        !isVirtualCamera(d.label) &&
        !isFrontCamera(d.label)
    );

    setVideoDevices(filtered);

    // fallback: 第 1 顆可用鏡頭
    if (filtered.length > 0) {
      startCamera(filtered[0].deviceId);
    } else {
      console.warn("沒有後鏡頭可用");
    }
  };

  useEffect(() => {
    listDevicesAndStartBest();
    return () => stopCurrentStream();
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h2>📷 後鏡頭預覽</h2>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ width: "100%", maxWidth: 480, border: "1px solid #ccc" }}
      />
      <div style={{ marginTop: 10 }}>
        <button onClick={takePhoto}>Take Photo</button>
      </div>
      <canvas
        ref={canvasRef}
        style={{ width: 240, height: 180, marginTop: 10, border: "1px solid #ccc" }}
      />
      <h3 style={{ marginTop: 20 }}>📋 可用後鏡頭</h3>
      <ul>
        {videoDevices.map((d) => (
          <li key={d.deviceId}>
            {d.label || "Camera"}
            {d.deviceId === currentDeviceId && <strong> ← 使用中</strong>}
            <br />
            <button onClick={() => startCamera(d.deviceId)}>切換到這顆</button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default AndroidSafeCamera;
