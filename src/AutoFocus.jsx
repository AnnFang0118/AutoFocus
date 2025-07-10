import { useEffect, useRef, useState } from "react";

const AutoFocus = () => {
  const videoRef = useRef(null);
  const photoCanvasRef = useRef(null);
  const [imageCapture, setImageCapture] = useState(null);
  const [videoDevices, setVideoDevices] = useState([]);
  const [currentDeviceId, setCurrentDeviceId] = useState(null);

  const isVirtualCamera = (label) => /virtual|obs|snap|filter|manycam/i.test(label);
  const isFrontCamera = (label) => /前置|front|facetime|self/i.test(label || "");

  const startCamera = (deviceId = null) => {
    const constraints = {
      video: deviceId
        ? { deviceId: { exact: deviceId } }
        : { facingMode: { exact: "environment" } },
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

        try {
          setImageCapture(new ImageCapture(track));
        } catch (err) {
          console.warn("ImageCapture 初始化失敗，可能是裝置或瀏覽器不支援。", err);
        }
      })
      .catch((error) => console.error("getUserMedia error:", error));
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

    if (!currentDeviceId && videoInputs.length > 0) {
      startCamera(videoInputs[0].deviceId);
    }
  };

  useEffect(() => {
    getVideoDevices();
    navigator.mediaDevices.addEventListener("devicechange", getVideoDevices);
    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", getVideoDevices);
    };
  }, []);

  const takePhoto = () => {
    if (imageCapture && imageCapture.takePhoto) {
      imageCapture
        .takePhoto()
        .then((blob) => createImageBitmap(blob))
        .then((bitmap) => {
          drawToCanvas(bitmap);
        })
        .catch((err) => {
          console.warn("ImageCapture 無效，fallback 到 video 擷取", err);
          fallbackCaptureFromVideo();
        });
    } else {
      fallbackCaptureFromVideo();
    }
  };

  const fallbackCaptureFromVideo = () => {
    const video = videoRef.current;
    const canvas = photoCanvasRef.current;
    if (video && canvas) {
      const ctx = canvas.getContext("2d");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    }
  };

  const drawToCanvas = (bitmap) => {
    const canvas = photoCanvasRef.current;
    const ctx = canvas.getContext("2d");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    ctx.drawImage(bitmap, 0, 0);
  };

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "20px" }}>
      <div>
        <video ref={videoRef} autoPlay playsInline style={{ width: "100%", maxWidth: "500px" }} />
        <div style={{ marginTop: "10px" }}>
          <button onClick={takePhoto}>Take Photo</button>
        </div>
        <div style={{ marginTop: "10px" }}>
          <canvas
            ref={photoCanvasRef}
            style={{ width: "240px", height: "180px", border: "1px solid #ccc" }}
          />
        </div>
      </div>

      <div style={{ minWidth: "200px" }}>
        <h3>可用鏡頭（後鏡頭）</h3>
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

