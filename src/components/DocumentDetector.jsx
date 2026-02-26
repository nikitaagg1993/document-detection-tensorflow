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
        const sWidth = 100; // Small size for performance
        const sHeight = 100;
        samplingCanvas.width = sWidth;
        samplingCanvas.height = sHeight;
        const sCtx = samplingCanvas.getContext('2d', { willReadFrequently: true });

        // Draw the source (can be video or canvas) to the small sampling canvas
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

        console.log(`Average Colors - R: ${avgR.toFixed(1)}, G: ${avgG.toFixed(1)}, B: ${avgB.toFixed(1)}`);

        const maxRGB = Math.max(avgR, avgG, avgB);
        const minRGB = Math.min(avgR, avgG, avgB);
        const diff = maxRGB - minRGB;

        // PAN: Subtle blue/cyan bias.
        if (avgB > avgG + 2 && avgB > avgR - 10) {
            return "PAN";
        }
        // Passport Data Page: Bright white/neutral profile
        else if (avgR > 180 && avgG > 180 && avgB > 180 && diff < 30) {
            return "Passport (Data Page)";
        }
        // Passport Outer Cover (Navy/Black): Very deep navy blue/black
        else if (avgR < 50 && avgG < 50 && avgB < 80) {
            return "Passport (Cover)";
        }
        // Passport Outer Cover (Orange/ECR): High Red, Moderate Green, Low Blue
        else if (avgR > 150 && avgG > 100 && avgR > avgB + 50) {
            return "Passport (Cover)";
        }
        // Voter ID: Tricolor background (Saffron, White, Green)
        else if (avgR > 140 && avgG > 140 && avgB > 120 && Math.abs(avgR - avgG) < 20) {
            return "Voter ID";
        }
        // DL: Bright, neutral or yellowish, but restricted to avoid bright passport pages
        // Lowering max brightness for DL to distinguish from passport data page
        else if (avgR > 100 && avgG > 100 && avgR < 180 && diff < 40 && avgR < avgB + 40) {
            return "Driving License";
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

                // Detection criteria
                const isDocumentLike = ['book', 'cell phone', 'laptop', 'handbag', 'suitcase'].includes(prediction.class);
                const area = width * height;
                const frameArea = videoWidth * videoHeight;
                const isLarge = area > (frameArea * 0.12); // Account for documents further away

                const centerX = x + width / 2;
                const centerY = y + height / 2;
                const isCentered = centerX > (videoWidth * 0.2) &&
                    centerX < (videoWidth * 0.8) &&
                    centerY > (videoHeight * 0.2) &&
                    centerY < (videoHeight * 0.8);

                const isPerson = prediction.class === 'person';
                const isProminent = !isPerson && prediction.score > 0.4 && isLarge && isCentered;

                if ((isDocumentLike && prediction.score > 0.5) || isProminent) {
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
                        return Math.max(0, prev - 2); // Soft reset: decay instead of instant wipe
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
