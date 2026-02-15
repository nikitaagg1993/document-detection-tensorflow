import React, { useRef, useEffect } from 'react';

const CameraFeed = ({ onVideoReady }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    let stream = null;

    const setupCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            facingMode: "user"
          },
          audio: false
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // Wait for metadata to load to get dimensions
          videoRef.current.onloadedmetadata = () => {
            onVideoReady(videoRef.current);
          };
        }
      } catch (err) {
        console.error("Error accessing camera:", err);
      }
    };

    setupCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [onVideoReady]);

  return (
    <div className="camera-container">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="webcam-video"
      />
    </div>
  );
};

export default CameraFeed;
