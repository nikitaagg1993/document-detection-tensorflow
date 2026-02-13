import React, { useRef, useEffect } from 'react';
import Webcam from 'react-webcam';

const videoConstraints = {
  width: 1920,
  height: 1080,
  facingMode: "user"
};

const CameraFeed = ({ onVideoReady }) => {
  const webcamRef = useRef(null);

  useEffect(() => {
    if (webcamRef.current && webcamRef.current.video) {
      // Pass the video element up to the parent when ready
      onVideoReady(webcamRef.current.video);
    }
  }, [onVideoReady]);

  return (
    <div className="camera-container">
      <Webcam
        audio={false}
        ref={webcamRef}
        screenshotFormat="image/jpeg"
        videoConstraints={videoConstraints}
        className="webcam-video"
      />
    </div>
  );
};

export default CameraFeed;
