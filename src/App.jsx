import { useState } from 'react';
import CameraFeed from './components/CameraFeed';
import DocumentDetector from './components/DocumentDetector';
import { performOCR } from './services/ocr';
import './App.css';

function App() {
  const [videoElement, setVideoElement] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [ocrResult, setOcrResult] = useState("");

  const handleVideoReady = (video) => {
    setVideoElement(video);
  };

  const handleCapture = async (imageData) => {
    setCapturedImage(imageData);
    setIsProcessing(true);
    setOcrResult("");

    console.log("Image captured! Starting OCR...");
    const text = await performOCR(imageData);
    setOcrResult(text);
    setIsProcessing(false);
  };

  const resetCapture = () => {
    setCapturedImage(null);
    setOcrResult("");
    setIsProcessing(false);
  };

  return (
    <div className="app-container">
      <header>
        <h1>Self-KYC Verifier</h1>
        <p>{capturedImage ? "Review Capture" : "Align your document within the frame"}</p>
      </header>

      <main>
        <div className="camera-wrapper">
          {!capturedImage ? (
            <>
              <CameraFeed onVideoReady={handleVideoReady} />
              {videoElement && (
                <DocumentDetector
                  videoElement={videoElement}
                  onCapture={handleCapture}
                />
              )}
            </>
          ) : (
            <div className="preview-container">
              <img src={capturedImage} alt="Captured Document" className="captured-image" />

              <div className="ocr-results">
                <h2>Extracted Text</h2>
                {isProcessing ? (
                  <p className="processing-text">Processing OCR... (this may take a moment)</p>
                ) : (
                  <div className="text-output">
                    {ocrResult ? <pre>{ocrResult}</pre> : <p>No text found.</p>}
                  </div>
                )}
              </div>

              <button className="action-button" onClick={resetCapture}>Retake</button>
              <a
                href={capturedImage}
                download="captured_document.jpg"
                className="action-button download-button"
                style={{ marginLeft: '10px', textDecoration: 'none', display: 'inline-block' }}
              >
                Download
              </a>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
