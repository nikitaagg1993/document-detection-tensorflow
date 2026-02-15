import React, { useRef, useEffect, useState } from 'react';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import '@tensorflow/tfjs';

const STABILITY_THRESHOLD = 25; // Number of consistent frames to trigger capture (Approx 0.8s at 30fps)
const MOVEMENT_THRESHOLD = 5; // Max pixels moved between frames to be considered stable

const DocumentDetector = ({ videoElement, onCapture }) => {
    const canvasRef = useRef(null);
    const lastDetectionRef = useRef(null);
    const lastCenterRef = useRef(null);
    const [model, setModel] = useState(null);
    const [status, setStatus] = useState("Loading model...");
    const [stabilityCounter, setStabilityCounter] = useState(0);
    const [isDetected, setIsDetected] = useState(false);

    // Load model
    useEffect(() => {
        const loadModel = async () => {
            try {
                const loadedModel = await cocoSsd.load({
                    base: 'lite_mobilenet_v2',
                    modelUrl: '/models/lite_mobilenet_v2/model.json'
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

            // Prepare canvas
            const displaySize = {
                width: videoElement.videoWidth,
                height: videoElement.videoHeight
            };

            const canvas = canvasRef.current;
            canvas.width = displaySize.width;
            canvas.height = displaySize.height;
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Detect objects
            const predictions = await model.detect(videoElement);

            let documentDetected = false;

            predictions.forEach(prediction => {
                const isDocumentLike = ['book', 'cell phone', 'laptop', 'handbag', 'suitcase'].includes(prediction.class);

                const [x, y, width, height] = prediction.bbox;
                const area = width * height;
                const frameArea = displaySize.width * displaySize.height;
                const isLarge = area > (frameArea * 0.15);

                const centerX = x + width / 2;
                const centerY = y + height / 2;
                const isCentered = centerX > (displaySize.width * 0.25) &&
                    centerX < (displaySize.width * 0.75) &&
                    centerY > (displaySize.height * 0.25) &&
                    centerY < (displaySize.height * 0.75);

                const isPerson = prediction.class === 'person';
                const isProminent = !isPerson && prediction.score > 0.5 && isLarge && isCentered;

                if ((isDocumentLike && prediction.score > 0.6) || isProminent) {
                    documentDetected = true;
                    lastDetectionRef.current = prediction.bbox;

                    // Draw bounding box (Subtle guide)
                    ctx.strokeStyle = "rgba(99, 102, 241, 0.5)"; // Indigo with opacity
                    ctx.lineWidth = 4;
                    ctx.setLineDash([10, 5]);
                    ctx.strokeRect(x, y, width, height);
                    ctx.setLineDash([]);
                }
            });

            if (mounted) {
                setIsDetected(documentDetected);
            }

            if (documentDetected) {
                // Calculate current center
                const [x, y, w, h] = lastDetectionRef.current;
                const currentCenter = { x: x + w / 2, y: y + h / 2 };

                setStabilityCounter(prev => {
                    // Check for movement
                    if (lastCenterRef.current) {
                        const dx = currentCenter.x - lastCenterRef.current.x;
                        const dy = currentCenter.y - lastCenterRef.current.y;
                        const distance = Math.sqrt(dx * dx + dy * dy);

                        if (distance > MOVEMENT_THRESHOLD) {
                            lastCenterRef.current = currentCenter;
                            return 0; // Reset if moved too much
                        }
                    }

                    lastCenterRef.current = currentCenter;
                    const newCount = prev + 1;

                    if (newCount >= STABILITY_THRESHOLD) {
                        // Trigger capture
                        const captureCanvas = document.createElement('canvas');
                        const [x, y, w, h] = lastDetectionRef.current;
                        const padding = 20;
                        const sx = Math.max(0, x - padding);
                        const sy = Math.max(0, y - padding);
                        const sw = Math.min(videoElement.videoWidth - sx, w + (padding * 2));
                        const sh = Math.min(videoElement.videoHeight - sy, h + (padding * 2));

                        captureCanvas.width = sw;
                        captureCanvas.height = sh;
                        captureCanvas.getContext('2d').drawImage(videoElement, sx, sy, sw, sh, 0, 0, sw, sh);

                        const imageData = captureCanvas.toDataURL('image/jpeg');
                        onCapture(imageData);
                        return 0; // Reset after capture
                    }
                    return newCount;
                });
            } else {
                setStabilityCounter(0);
                lastDetectionRef.current = null;
                lastCenterRef.current = null;
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
            setStatus(`Hold steady... ${progress}%`);
        } else if (isDetected) {
            setStatus("Hold steady to capture");
        } else if (model) {
            setStatus("Align document within frame");
        }
    }, [stabilityCounter, isDetected, model]);

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
