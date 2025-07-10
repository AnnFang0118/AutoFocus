import { useEffect, useRef, useState } from "react";

const SmartCamera = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [videoDevices, setVideoDevices] = useState([]);
  const [currentDeviceId, setCurrentDeviceId] = useState(null);
  const [imageCapture, setImageCapture] = useState(null);

  const isVirtualCamera = (label) => /virtual|obs|snap|filter|manycam/i.test(label || "");
  const isFrontCamera = (label) => /前置|front|facetime|self/i.test(label || "");

  const drawCanvas = (canvas, imageBitmap) => {
    const ctx = canvas.getContext("2d");
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, width, height);

    const ratio = Math.min(width / imageBitmap.width, height / imageBitmap.height);
    const x = (width - imageBitmap.width * ratio) / 2;
    const y = (height - imageBitmap.height * ratio) / 2;

    ctx.drawImage(
      imageBitmap,
      0,
      0,
      imageBitmap.width,
      imageBitmap.height,
      x,
      y,
      imageBitmap.width * ratio,
      imageBitmap.height * ratio
    );
  };

  const takePhoto = () => {
    if (imageCapture) {
      imageCapture
        .takePhoto()
        .then(createImageBitmap)
        .then((img) => drawCanvas(canvasRef.current, img))
        .catch((err) => console.error("Take photo error:", err));
    } else {
      console.warn("ImageCapture not ready.");
    }
  };

  const scoreCamera = async (deviceId) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: deviceId } } });
      const track = stream.getVideoTracks()[0];
      const caps = track.getCapabilities?.() || {};
      const settings = track.getSettings?.() || {};

      let score = 0;

      // 評分邏輯
      if (caps.focusMode?.includes("continuous")) score += 30;
      if (caps.focusDistance?.min) score += Math.max(0, 20 - caps.focusDistance.min * 100); // 越小越好
      if (caps.zoom?.max) score += caps.zoom.max * 2;
      if (caps.width?.max && caps.height?.max) {
        const pixels = caps.width.max * caps.height.max;
        score += pixels / 100000; // 每10萬畫素加1分
      }

      track.stop();
      return { deviceId, score };
    } catch (err) {
      console.warn("Score failed for", deviceId, err);
      return { deviceId, score: 0 };
    }
  };

  const getVideoDevicesAndPickBest = async () => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const filtered = devices.filter(
      (d) => d.kind === "videoinput" && !isVirtualCamera(d.label) && !isFrontCamera(d.label)
    );

    setVideoDevices(filtered);

    const scores = await Promise.all(filtered.map((d) => scoreCamera(d.deviceId)));
    const best = scores.sort((a, b) => b.score - a.score)[0];

    if (best?.deviceId) {
      startCamera(best.deviceId);
    }
  };

  const startCamera = (deviceId) => {
    const constraints = {
      video: { deviceId: { exact: deviceId } },
    };

    navigator.mediaDevices
      .getUserMedia(constraints)
      .then((stream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        const track = stream.getVideoTracks()[0];
        setCurrentDeviceId(deviceId);

        try {
          setImageCapture(new ImageCapture(track));
        } catch (e) {
          console.warn("ImageCapture not supported:", e);
        }
      })
      .catch((err) => {
        console.error("startCamera error:", err);
      });
  };

  useEffect(() => {
    getVideoDevicesAndPickBest();
  }, []);

  return (
    <div style={{ fontFamily: "sans-serif", padding: "20px" }}>
      <h2>📷 相機預覽</h2>
      <video ref={videoRef} autoPlay playsInline style={{ width: "100%", maxWidth: "500px", border: "1px solid #ccc" }} />
      <div style={{ marginTop: "10px" }}>
        <button onClick={takePhoto}>Take Photo</button>
      </div>
      <canvas
        ref={canvasRef}
        style={{ width: "240px", height: "180px", marginTop: "10px", border: "1px solid #ccc" }}
      />
      <h3 style={{ marginTop: "20px" }}>🎦 可用鏡頭</h3>
      <ul>
        {videoDevices.map((d) => (
          <li key={d.deviceId}>
            {d.label || `Camera (${d.deviceId})`}
            {d.deviceId === currentDeviceId && <strong style={{ color: "green" }}> ← 使用中</strong>}
            <br />
            <button onClick={() => startCamera(d.deviceId)}>切換到這顆</button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default SmartCamera;
