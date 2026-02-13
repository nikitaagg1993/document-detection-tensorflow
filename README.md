# Self-KYC Verifier

A React-based web application for automated document capture and verification. This tool leverages TensorFlow.js for real-time object detection and Tesseract.js for Optical Character Recognition (OCR), providing a seamless "Self-KYC" experience.

## 🚀 Key Features

*   **Real-time Document Detection**: Uses the COCO-SSD model to identify document-like objects (books, cell phones, etc.) in the camera feed.
*   **Smart Detection Heuristics**:
    *   **Prominent Object Detection**: Falls back to detecting any large, centered object if a specific class isn't found (useful for ID cards like PAN or Aadhaar).
    *   **Face Exclusion**: Explicitly ignores faces to prevent accidental selfies from being captured as documents.
*   **Stability Check**: Ensures the document is held steady for ~0.8 seconds before capturing to prevent motion blur.
*   **Automatic Cropping**: Detects the bounding box of the document and crops the image to remove background noise.
*   **Enhanced OCR**:
    *   **Preprocessing**: Applies grayscale conversion, contrast enhancement, and adaptive binarization (thresholding) to the image before text extraction.
    *   **Tesseract.js Integration**: Extracts text from the processed image directly in the browser.
*   **High-Resolution Capture**: configured to use 1080p resolution for maximum clarity.

## 🛠️ Tech Stack

*   **Frontend Framework**: React + Vite
*   **ML / AI**: TensorFlow.js (`@tensorflow-models/coco-ssd`)
*   **OCR**: Tesseract.js
*   **Camera Handling**: `react-webcam`
*   **Styling**: CSS Modules / Standard CSS

## 📦 Installation

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/nikitaagg1993/document-detection-tensorflow.git
    cd document-detection-tensorflow
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Start the development server**:
    ```bash
    npm run dev
    ```

4.  **Open in Browser**:
    Navigate to `http://localhost:5173` (or the port shown in your terminal).

## 📖 How to Use

1.  **Allow Camera Access**: When prompted, allow the browser to access your webcam.
2.  **Align Document**: Hold your ID document (PAN Card, Aadhaar, etc.) in front of the camera.
    *   Ensure it is centered and takes up a good portion of the frame.
    *   Avoid holding it too close to your face.
3.  **Hold Steady**: Watch the "Hold steady..." indicator. Keep the document still until the progress bar reaches 100%.
4.  **Review & Capture**:
    *   The app will automatically capture and crop the document.
    *   OCR will run automatically to extract text.
    *   **Retake**: Click to try again.
    *   **Download**: Save the cropped image to your device.

## ⚙️ Configuration

Key parameters in `src/components/DocumentDetector.jsx`:

*   `STABILITY_THRESHOLD`: Number of consistent frames required for capture (default: 25 frames / ~0.8s).
*   `MOVEMENT_THRESHOLD`: Max pixels the document can move between frames to still be considered "stable" (default: 5px).

## 🤝 Contributing

1.  Fork the repository.
2.  Create a new branch (`git checkout -b feature/improvement`).
3.  Commit your changes.
4.  Push to the branch and open a Pull Request.

## 📄 License

MIT
