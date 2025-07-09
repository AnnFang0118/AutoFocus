import { useEffect, useRef, useState } from "react";

const AutoFocus = () => {
  const videoRef = useRef(null);
  const grabCanvasRef = useRef(null);
  const photoCanvasRef = useRef(null);
  const [imageCapture, setImageCapture] = useState(null);
  const [videoDevices, setVideoDevices] = useState([]);
  const [currentDeviceId, setCurrentDeviceId] = useState(null);

  const isVirtualCamera = (label) => {
    return /virtual|obs|snap|filter|manycam/i.test(label);
  };

  const startCamera = (deviceId = null) => {
    const constraints = {
      video: deviceId ? { deviceId: { exact: deviceId } } : true,
    };

    navigator.mediaDevices
      .getUserMedia(constraints)
      .then((mediaStream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }

        const track = mediaStream.getVideoTracks()[0];
        const settings = track.getSettings();
        setCurrentDeviceId(settings.deviceId || deviceId);
        setImageCapture(new ImageCapture(track));
      })
      .catch((error) => console.error("getUserMedia error:", error));
  };

  const getVideoDevices = async () => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoInputs = devices.filter(
      (d) => d.kind === "videoinput" && !isVirtualCamera(d.label || "")
    );

    setVideoDevices(videoInputs);

    // 如果還沒設 deviceId，預設啟用第一個實體鏡頭
    if (!currentDeviceId && videoInputs.length > 0) {
      startCamera(videoInputs[0].deviceId);
    }
  };

  useEffect(() => {
    getVideoDevices();

    navigator.mediaDevices.addEventListener("devicechange", () => {
      getVideoDevices();
    });
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

  const onGrabFrame = () => {
    if (imageCapture) {
      imageCapture
        .grabFrame()
        .then((imageBitmap) => {
          if (grabCanvasRef.current) {
            drawCanvas(grabCanvasRef.current, imageBitmap);
          }
        })
        .catch((error) => console.error("grabFrame error:", error));
    }
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

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "20px" }}>
      <div>
        <video ref={videoRef} autoPlay playsInline style={{ width: "100%", maxWidth: "500px" }} />
        <div style={{ marginTop: "10px" }}>
          <button onClick={onGrabFrame}>Grab Frame</button>
          <button onClick={onTakePhoto}>Take Photo</button>
        </div>
        <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
          <canvas
            ref={grabCanvasRef}
            style={{ width: "240px", height: "180px", border: "1px solid #ccc" }}
          />
          <canvas
            ref={photoCanvasRef}
            style={{ width: "240px", height: "180px", border: "1px solid #ccc" }}
          />
        </div>
      </div>

      <div style={{ minWidth: "200px" }}>
        <h3>可用鏡頭（實體）</h3>
        {videoDevices.length === 0 && <p>沒有偵測到實體鏡頭</p>}
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
