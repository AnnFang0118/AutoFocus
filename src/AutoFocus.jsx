import { useEffect, useRef, useState } from "react";

const AutoFocus = () => {
  const videoRef = useRef(null);
  const photoCanvasRef = useRef(null);
  const [imageCapture, setImageCapture] = useState(null);
  const [videoDevices, setVideoDevices] = useState([]);
  const [currentDeviceId, setCurrentDeviceId] = useState(null);
  const streamRef = useRef(null); // 用於清理舊 stream

  const isVirtualCamera = (label) => /virtual|obs|snap|filter|manycam/i.test(label);
  const isFrontCamera = (label) => /前置|front|facetime|self/i.test(label || "");

  const stopCurrentStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const startCamera = async (deviceId = null) => {
    stopCurrentStream();

    const constraints = {
      video: deviceId
        ? { deviceId: { exact: deviceId } }
        : { facingMode: { exact: "environment" } },
    };

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = mediaStream;

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }

      const track = mediaStream.getVideoTracks()[0];
      setCurrentDeviceId(track.getSettings().deviceId || deviceId);

      // 嘗試建立 ImageCapture
      if ("ImageCapture" in window) {
        try {
          const capture = new ImageCapture(track);
          const capabilities = track.getCapabilities?.();
          if (capabilities && "focusDistance" in capabilities) {
            console.log("✅ 此鏡頭支援自動對焦能力");
          }
          setImageCapture(capture);
        } catch (err) {
          console.warn("⚠️ ImageCapture 建立失敗：", err);
          setImageCapture(null);
        }
      } else {
        console.warn("⚠️ 不支援 ImageCapture");
        setImageCapture(null);
      }
    } catch (error) {
      console.error("getUserMedia error:", error);
    }
  };

  const getVideoDevices = async () => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoInputs = devices.filter(
      (d) =>
        d.kind === "videoinput" &&
        !isVirtualCamera(d.label || "") &&
        !isFrontCamera(d.label || "")
    );

    setVideoDevices(videoInputs);

    // 自動啟用第一顆可用後鏡頭
    if (!currentDeviceId && videoInputs.length > 0) {
      startCamera(videoInputs[0].deviceId);
    }
  };

  useEffect(() => {
    getVideoDevices();
    navigator.mediaDevices.addEventListener("devicechange", getVideoDevices);
    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", getVideoDevices);
      stopCurrentStream();
    };
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
        .catch((error) => console.error("takePhoto error:", error));
    } else {
      console.warn("ImageCapture 不可用");
    }
  };

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "20px" }}>
      <div>
        <video ref={videoRef} autoPlay playsInline style={{ width: "100%", maxWidth: "500px" }} />
        <div style={{ marginTop: "10px" }}>
          <button onClick={onTakePhoto}>Take Photo</button>
        </div>
        <div style={{ marginTop: "10px" }}>
          <canvas
            ref={photoCanvasRef}
            style={{ width: "240px", height: "180px", border: "1px solid #ccc" }}
          />
        </div>
      </div>

      <div style={{ minWidth: "200px" }}>
        <h3>📋 可用鏡頭（後鏡頭）</h3>
        {videoDevices.length === 0 && <p>沒有偵測到後鏡頭</p>}
        <ul>
          {videoDevices.map((device) => (
            <li key={device.deviceId}>
              {device.label || `Camera (${device.deviceId})`}
              {device.deviceId === currentDeviceId && (
                <strong style={{ color: "green" }}> ← 使用中</strong>
              )}
              <br />
              <button onClick={() => startCamera(device.deviceId)}>切換到這顆</button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default AutoFocus;

