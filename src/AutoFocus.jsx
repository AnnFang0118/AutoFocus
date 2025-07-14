
import React, { useEffect, useRef, useState } from "react";

const AutoSelectCamera = () => {
  const videoRef = useRef(null);
  const photoCanvasRef = useRef(null);
  const [devices, setDevices] = useState([]);
  const [currentDeviceId, setCurrentDeviceId] = useState(null);
  const [imageCapture, setImageCapture] = useState(null);
  const [message, setMessage] = useState("");

  const isVirtualCamera = (label) => /virtual|obs|snap|filter|manycam/i.test(label);
  const isFrontCamera = (label) => /front|前置|facetime|self/i.test(label);

  const getCapabilitiesForDevice = async (deviceId) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: deviceId } } });
      const track = stream.getVideoTracks()[0];
      const capabilities = track.getCapabilities ? track.getCapabilities() : {};
      track.stop();
      return capabilities;
    } catch (err) {
      return null;
    }
  };

  const isGoodCamera = (capabilities, label = "") => {
    if (!capabilities) return false;
    const hasFocus = capabilities?.focusMode?.includes("continuous");
    const isNotUltraWide = !/ultra|超廣角/i.test(label);
    const goodResolution = capabilities?.width?.max >= 1920;
    return hasFocus && isNotUltraWide && goodResolution;
  };

  const startCamera = async (deviceId) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: deviceId } } });
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCurrentDeviceId(deviceId);

      const track = stream.getVideoTracks()[0];
      if ("ImageCapture" in window) {
        try {
          setImageCapture(new ImageCapture(track));
        } catch (e) {
          console.warn("ImageCapture init error", e);
        }
      }
    } catch (err) {
      setMessage("🚫 無法啟用相機：" + err.message);
    }
  };

  useEffect(() => {
    const initialize = async () => {
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = allDevices.filter(
        (d) => d.kind === "videoinput" && !isVirtualCamera(d.label) && !isFrontCamera(d.label)
      );
      setDevices(videoInputs);

      for (let device of videoInputs) {
        const capabilities = await getCapabilitiesForDevice(device.deviceId);
        if (isGoodCamera(capabilities, device.label)) {
          startCamera(device.deviceId);
          return;
        }
      }

      if (videoInputs.length > 0) {
        setMessage("⚠️ 沒有找到理想相機，啟用第一個可用相機");
        startCamera(videoInputs[0].deviceId);
      } else {
        setMessage("❌ 找不到可用的後鏡頭");
      }
    };

    initialize();
  }, []);

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
        .catch((err) => setMessage("📸 拍照失敗：" + err.message));
    } else {
      setMessage("⚠️ ImageCapture 尚未就緒");
    }
  };

  return (
    <div style={{ fontFamily: "sans-serif", padding: "20px" }}>
      <h2>📷 自動選擇最佳後鏡頭</h2>
      <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", maxWidth: "500px", border: "1px solid #ccc", borderRadius: "8px" }} />
      <div style={{ marginTop: "10px" }}>
        <button onClick={onTakePhoto}>📸 拍照</button>
      </div>
      <canvas ref={photoCanvasRef} style={{ width: "240px", height: "180px", marginTop: "10px", border: "1px solid #ccc" }} />
      <p style={{ color: "red", marginTop: "10px" }}>{message}</p>
    </div>
  );
};

export default AutoSelectCamera;