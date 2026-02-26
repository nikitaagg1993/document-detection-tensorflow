import React, { useRef, useEffect, useState } from 'react';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import '@tensorflow/tfjs';

const STABILITY_THRESHOLD = 15; // Snappier capture
const RELATIVE_MOVEMENT_LIMIT = 0.02; // 2% of frame width/height
const EMA_ALPHA = 0.3; // Smoothing factor (0-1), lower is smoother but slower

const DocumentDetector = ({ videoElement, onCapture }) => {
    const canvasRef = useRef(null);
    const lastDetectionRef = useRef(null);
    const smoothedCenterRef = useRef(null);
    const [model, setModel] = useState(null);
    const [status, setStatus] = useState("Loading model...");
    const [stabilityCounter, setStabilityCounter] = useState(0);
    const [isDetected, setIsDetected] = useState(false);
    const [liveDocType, setLiveDocType] = useState(null);
    const samplingCanvasRef = useRef(document.createElement('canvas'));

    const classifyDocument = (source, width, height) => {
        const samplingCanvas = samplingCanvasRef.current;
        const sWidth = 100;
        const sHeight = 100;
        samplingCanvas.width = sWidth;
        samplingCanvas.height = sHeight;
        const sCtx = samplingCanvas.getContext('2d', { willReadFrequently: true });

        sCtx.drawImage(source, 0, 0, width, height, 0, 0, sWidth, sHeight);
        const imageData = sCtx.getImageData(0, 0, sWidth, sHeight).data;
        let r = 0, g = 0, b = 0;
        const totalPixels = sWidth * sHeight;

        for (let i = 0; i < imageData.length; i += 4) {
            r += imageData[i];
            g += imageData[i + 1];
            b += imageData[i + 2];
        }

        const avgR = r / totalPixels;
        const avgG = g / totalPixels;
        const avgB = b / totalPixels;
        const maxRGB = Math.max(avgR, avgG, avgB);
        const minRGB = Math.min(avgR, avgG, avgB);
        const diff = maxRGB - minRGB;

        console.log(`Avg Colors: R=${avgR.toFixed(0)}, G=${avgG.toFixed(0)}, B=${avgB.toFixed(0)}, Diff=${diff.toFixed(0)}`);

        // Brightness Safeguard: IDs (DL, Voter, PAN) are generally light-colored.
        // If the document is too dark (e.g., a chair or shadow), don't classify it.
        const brightness = (avgR + avgG + avgB) / 3;
        if (brightness < 60) {
            return "Unknown Document";
        }

        // 1. PAN: Teal/Blue bias (High relative Blue)
        if (avgB > avgG && avgB > avgR - 5) {
            return "PAN";
        }

        // 2. Passport (Data Page): High brightness neutral/polycarbonate
        // Polycarbonate data pages are very bright and usually more neutral than DLs
        if (avgR > 180 && avgR > 180 && avgB > 180 && diff < 30) {
            return "Passport (Data Page)";
        }

        // 3. Driving License: Neutral or yellowish, moderate to high brightness
        if (avgR > 140 && avgG > 140 && diff < 45) {
            return "Driving License";
        }

        // 5. Voter ID / Neutral: Broad fallback for modern PVC cards
        if (avgR > 110 && avgG > 110 && avgB > 100 && diff < 60) {
            return "Voter ID";
        }

        return "Unknown Document";
    };

    // Load model
    useEffect(() => {
        const loadModel = async () => {
            try {
                const loadedModel = await cocoSsd.load({
                    base: 'lite_mobilenet_v2',
                    modelUrl: 'https://cdn.jsdelivr.net/gh/nikitaagg1993/document-detection-tensorflow@dev-v2/public/models/lite_mobilenet_v2/model.json'
                });
                setModel(loadedModel);
                setStatus("Align document to capture");
            } catch (err) {
                console.error("Failed to load model:", err);
                setStatus("Error loading model");
            }
        };
        loadModel();
    }, []);

    // Detection loop
    useEffect(() => {
        let animationId;
        let mounted = true;

        const detectFrame = async () => {
            if (!model || !videoElement || !canvasRef.current) return;

            if (videoElement.readyState !== 4) {
                animationId = requestAnimationFrame(detectFrame);
                return;
            }

            const { videoWidth, videoHeight } = videoElement;
            const canvas = canvasRef.current;
            canvas.width = videoWidth;
            canvas.height = videoHeight;
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Detect objects
            const predictions = await model.detect(videoElement);

            let documentDetected = false;
            let bestPrediction = null;

            predictions.forEach(prediction => {
                const [x, y, width, height] = prediction.bbox;

                // Detection criteria - Balanced for robustness and false-positive protection
                const isDocumentLike = ['book', 'cell phone', 'laptop', 'handbag'].includes(prediction.class);
                const area = width * height;
                const frameArea = videoWidth * videoHeight;
                const isLarge = area > (frameArea * 0.10);

                const centerX = x + width / 2;
                const centerY = y + height / 2;
                const isCentered = centerX > (videoWidth * 0.15) &&
                    centerX < (videoWidth * 0.85) &&
                    centerY > (videoHeight * 0.15) &&
                    centerY < (videoHeight * 0.85);

                const isPerson = prediction.class === 'person';
                // Confidence set to 0.4 (balanced)
                const isProminent = !isPerson && prediction.score > 0.40 && isLarge && isCentered;

                if ((isDocumentLike && prediction.score > 0.45) || isProminent) {
                    if (!bestPrediction || prediction.score > bestPrediction.score) {
                        bestPrediction = prediction;
                    }
                }
            });

            if (bestPrediction) {
                documentDetected = true;
                const [x, y, width, height] = bestPrediction.bbox;
                lastDetectionRef.current = bestPrediction.bbox;

                // Temporal Smoothing for Center (EMA)
                const currentCenter = { x: x + width / 2, y: y + height / 2 };
                if (!smoothedCenterRef.current) {
                    smoothedCenterRef.current = currentCenter;
                } else {
                    smoothedCenterRef.current = {
                        x: smoothedCenterRef.current.x * (1 - EMA_ALPHA) + currentCenter.x * EMA_ALPHA,
                        y: smoothedCenterRef.current.y * (1 - EMA_ALPHA) + currentCenter.y * EMA_ALPHA
                    };
                }

                // Draw bounding box (Subtle guide)
                ctx.strokeStyle = "rgba(99, 102, 241, 0.6)";
                ctx.lineWidth = 4;
                ctx.setLineDash([10, 5]);
                ctx.strokeRect(x, y, width, height);
                ctx.setLineDash([]);

                // Live classification for feedback (sample from video directly)
                const currentType = classifyDocument(videoElement, videoWidth, videoHeight);
                if (mounted) setLiveDocType(currentType);
            }

            if (mounted) {
                setIsDetected(documentDetected);
            }

            if (documentDetected) {
                const moveLimit = videoWidth * RELATIVE_MOVEMENT_LIMIT;
                const [dx, dy] = [
                    smoothedCenterRef.current.x - (lastDetectionRef.current[0] + lastDetectionRef.current[2] / 2),
                    smoothedCenterRef.current.y - (lastDetectionRef.current[1] + lastDetectionRef.current[3] / 2)
                ];
                const distance = Math.sqrt(dx * dx + dy * dy);

                setStabilityCounter(prev => {
                    // Adaptive stability check
                    if (distance > moveLimit) {
                        // More tolerant decay: only decay if movement is significant
                        return Math.max(0, prev - 1);
                    }

                    const newCount = prev + 1;
                    if (newCount >= STABILITY_THRESHOLD) {
                        // Trigger capture logic
                        const captureCanvas = document.createElement('canvas');
                        const [x, y, w, h] = lastDetectionRef.current;
                        const padding = 30;
                        const sx = Math.max(0, x - padding);
                        const sy = Math.max(0, y - padding);
                        const sw = Math.min(videoWidth - sx, w + (padding * 2));
                        const sh = Math.min(videoHeight - sy, h + (padding * 2));

                        captureCanvas.width = sw;
                        captureCanvas.height = sh;
                        captureCanvas.getContext('2d', { willReadFrequently: true }).drawImage(videoElement, sx, sy, sw, sh, 0, 0, sw, sh);

                        const docType = classifyDocument(captureCanvas, sw, sh);
                        onCapture(captureCanvas.toDataURL('image/jpeg', 0.9), docType);
                        return 0;
                    }
                    return newCount;
                });
            } else {
                setStabilityCounter(prev => Math.max(0, prev - 1)); // Slow decay when nothing detected
                smoothedCenterRef.current = null;
            }

            animationId = requestAnimationFrame(detectFrame);
        };

        if (model && videoElement) {
            detectFrame();
        }

        return () => {
            mounted = false;
            if (animationId) cancelAnimationFrame(animationId);
        };
    }, [model, videoElement, onCapture]);

    // Update status text based on state
    useEffect(() => {
        if (stabilityCounter > 0) {
            const progress = Math.round((stabilityCounter / STABILITY_THRESHOLD) * 100);
            setStatus(`Hold steady... ${progress}% (${liveDocType || "Detecting..."})`);
        } else if (isDetected) {
            setStatus(liveDocType ? `Detected: ${liveDocType}. Hold steady.` : "Hold steady to capture");
        } else if (model) {
            setStatus("Align document within frame");
        }
    }, [stabilityCounter, isDetected, model, liveDocType]);

    return (
        <>
            <canvas ref={canvasRef} className="detection-canvas" />

            {/* Static Guide Overlay */}
            <div className={`document-overlay ${isDetected ? 'active' : ''} ${stabilityCounter > 0 ? 'scanning' : ''}`}>
                <div className="scan-line"></div>
            </div>

            {/* Status Badge */}
            <div className="status-badge">
                {status}
            </div>
        </>
    );
};

export default DocumentDetector;
