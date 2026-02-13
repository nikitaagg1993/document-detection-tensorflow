import { useState } from 'react';
import CameraFeed from './components/CameraFeed';
import DocumentDetector from './components/DocumentDetector';
import { performOCR } from './services/ocr';
import './App.css';

function App() {
  const [videoElement, setVideoElement] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [ocrText, setOcrText] = useState("Scanning...");
  const [debugImage, setDebugImage] = useState(null);

  const handleVideoReady = (video) => {
    setVideoElement(video);
  };

  const handleCapture = async (imageData) => {
    setCapturedImage(imageData);
    setIsProcessing(true);
    setOcrText("");
    setDebugImage(null);

    console.log("Image captured! Starting OCR...");
    const { text, debugImage } = await performOCR(imageData);
    setOcrText(text);
    if (debugImage) {
      setDebugImage(debugImage);
    }
    setIsProcessing(false);
  };

  const resetCapture = () => {
    setCapturedImage(null);
    setOcrText("");
    setDebugImage(null);
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
              <div className="images-row">
                <div className="image-col">
                  <h3>Original</h3>
                  <img src={capturedImage} alt="Captured Document" className="captured-image" />
                </div>
                {debugImage && (
                  <div className="image-col">
                    <h3>Preprocessed (OCR Input)</h3>
                    <img src={debugImage} alt="Debug Preprocessed" className="captured-image debug-image" />
                  </div>
                )}
              </div>

              <div className="ocr-results">
                <h2>Extracted Text</h2>
                {isProcessing ? (
                  <p className="processing-text">Processing OCR... (this may take a moment)</p>
                ) : (
                  <div className="text-output">
                    {ocrText ? <pre>{ocrText}</pre> : <p>No text found.</p>}
                  </div>
                )}
              </div>

              <div className="actions">
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
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
