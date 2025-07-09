import { useEffect, useRef, useState } from "react";

const AutoFocus = () => {
  const videoRef = useRef(null);
  const photoCanvasRef = useRef(null);
  const [imageCapture, setImageCapture] = useState(null);
  const [cameraList, setCameraList] = useState([]);
  const [currentDeviceId, setCurrentDeviceId] = useState(null);

  const stopCurrentStream = () => {
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
    }
  };

  const startCamera = async (deviceId) => {
    stopCurrentStream();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId } }
      });

      const track = stream.getVideoTracks()[0];
      const imageCap = new ImageCapture(track);

      videoRef.current.srcObject = stream;
      setImageCapture(imageCap);
      setCurrentDeviceId(deviceId);
    } catch (error) {
      alert("無法啟用此鏡頭");
      console.error("startCamera error:", error);
    }
  };

  const drawCanvas = (canvas, img) => {
    const canvasWidth = canvas.clientWidth;
    const canvasHeight = canvas.clientHeight;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    const ratio = Math.min(canvasWidth / img.width, canvasHeight / img.height);
    const x = (canvasWidth - img.width * ratio) / 2;
    const y = (canvasHeight - img.height * ratio) / 2;

    ctx.drawImage(img, 0, 0, img.width, img.height, x, y, img.width * ratio, img.height * ratio);
  };

  const onTakePhoto = () => {
    if (imageCapture) {
      imageCapture
        .takePhoto()
        .then((blob) => createImageBitmap(blob))
        .then((imageBitmap) => {
          if (photoCanvasRef.current) {
            drawCanvas(photoCanvasRef.current, imageBitmap);
          }
        })
        .catch((error) => console.error("takePhoto error:", error));
    }
  };

  const scanCameras = async () => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoInputs = devices.filter((d) => d.kind === "videoinput");
    const results = [];

    for (let device of videoInputs) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: device.deviceId } }
        });

        const track = stream.getVideoTracks()[0];
        const capabilities = track.getCapabilities();

        const supportsFocus =
          "focusMode" in capabilities &&
          (capabilities.focusMode.includes("continuous") || capabilities.focusMode.includes("manual"));

        results.push({
          label: device.label || "未命名鏡頭",
          deviceId: device.deviceId,
          supportsFocus
        });

        stream.getTracks().forEach((t) => t.stop());
      } catch (err) {
        console.warn("無法啟用：", device.label, err);
      }
    }

    setCameraList(results);

    // 預設啟用第一顆可用鏡頭
    if (results.length > 0) {
      startCamera(results[0].deviceId);
    }
  };

  useEffect(() => {
    scanCameras();
    navigator.mediaDevices.addEventListener("devicechange", scanCameras);
    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", scanCameras);
      stopCurrentStream();
    };
  }, []);

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "20px" }}>
      <div>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          style={{ width: "100%", maxWidth: "500px", border: "1px solid black" }}
        />
        <div style={{ marginTop: "10px" }}>
          <button onClick={onTakePhoto}>📸 Take Photo</button>
        </div>
        <canvas
          ref={photoCanvasRef}
          style={{ width: "240px", height: "180px", marginTop: "10px", border: "1px solid #ccc" }}
        />
      </div>

      <div style={{ minWidth: "280px" }}>
        <h3>📋 所有鏡頭</h3>
        {cameraList.length === 0 && <p>沒有找到任何鏡頭</p>}
        <ul>
          {cameraList.map((cam) => (
            <li key={cam.deviceId} style={{ marginBottom: "10px" }}>
              <strong>{cam.label}</strong> {cam.supportsFocus ? "✅ 自動對焦" : "❌ 無對焦"}
              {cam.deviceId === currentDeviceId && (
                <span style={{ color: "green" }}> ← 使用中</span>
              )}
              <br />
              <button onClick={() => startCamera(cam.deviceId)}>使用這顆鏡頭</button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default AutoFocus;

