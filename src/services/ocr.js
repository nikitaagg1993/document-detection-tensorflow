import Tesseract from 'tesseract.js';

const preprocessImage = (imagePath) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;

            // Convert to Grayscale
            for (let i = 0; i < data.length; i += 4) {
                const avg = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
                data[i] = avg;     // Red
                data[i + 1] = avg; // Green
                data[i + 2] = avg; // Blue
            }

            // Adaptive Thresholding (Simple Local Mean)
            // We'll use a second pass to determine threshold based on local window
            // Since strict local adaptive is slow in JS without optimization, 
            // we will use a global Otsu-like threshold or a high-contrast enhancement.
            // Let's stick to high contrast + binarization for now which is faster.

            // 1. Contrast Stretching
            const contrast = 1.2; // Moderate contrast (1.0 is no change)
            const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));

            for (let i = 0; i < data.length; i += 4) {
                const val = data[i];
                const newValue = factor * (val - 128) + 128;
                const clamped = Math.max(0, Math.min(255, newValue));

                data[i] = clamped;
                data[i + 1] = clamped;
                data[i + 2] = clamped;
            }

            ctx.putImageData(imageData, 0, 0);
            resolve(canvas.toDataURL('image/jpeg'));
        };
        img.onerror = reject;
        img.src = imagePath;
    });
};

export const performOCR = async (imagePath) => {
    try {
        const processedImage = await preprocessImage(imagePath);

        const result = await Tesseract.recognize(
            processedImage,
            'eng',
            {
                logger: m => console.log(m)
            }
        );
        return {
            text: result.data.text,
            debugImage: processedImage
        };
    } catch (error) {
        console.error("OCR Error:", error);
        return {
            text: "Failed to extract text.",
            debugImage: null
        };
    }
};
