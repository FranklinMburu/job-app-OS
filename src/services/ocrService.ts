import Tesseract from 'tesseract.js';

export const ocrService = {
  /**
   * Pre-processes base64 image data to improve OCR accuracy.
   * Uses a canvas to convert to grayscale and increase contrast.
   */
  async preprocessImage(dataUrl: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Grayscale + Contrast Enhancement
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          
          // Grayscale (ITU-R 601)
          let gray = 0.299 * r + 0.587 * g + 0.114 * b;
          
          // Simple Thresholding/Contrast boost
          // Values below 128 go darker, above go lighter
          gray = gray < 128 ? Math.max(0, gray - 20) : Math.min(255, gray + 20);
          
          data[i] = gray;
          data[i + 1] = gray;
          data[i + 2] = gray;
        }

        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = reject;
      img.src = dataUrl;
    });
  },

  /**
   * Robust OCR using Tesseract.js as a fallback
   */
  async tesseractOCR(dataUrl: string): Promise<string> {
    try {
      const processedImage = await this.preprocessImage(dataUrl);
      const { data: { text } } = await Tesseract.recognize(processedImage, 'eng', {
        logger: m => console.log(`[Tesseract] ${m.status}: ${Math.round(m.progress * 100)}%`)
      });
      return text;
    } catch (error) {
      console.error("[OCR Service] Tesseract failed:", error);
      throw error;
    }
  }
};
