// Barcode Scanner — uses zxing-js for reliable cross-browser scanning
// Native BarcodeDetector API has poor Safari support, so we default to zxing

const Scanner = {
  _stream: null,
  _zxingReader: null,
  _scanning: false,
  _controls: null,

  async startScanner(videoElement, onDetected) {
    this._scanning = true;

    // Always load zxing — it's the most reliable cross-browser approach
    await this._loadZxing();

    // Use zxing's built-in continuous decode from video
    // It handles camera access, frame capture, and barcode detection internally
    try {
      this._controls = await this._zxingReader.decodeFromVideoDevice(
        undefined, // use default camera (rear on phones)
        videoElement,
        (result, error, controls) => {
          if (!this._scanning) {
            controls.stop();
            return;
          }
          if (result) {
            const isbn = result.getText();
            if (this._isValidISBN(isbn)) {
              this._vibrate();
              this._scanning = false;
              controls.stop();
              onDetected(isbn);
            }
          }
          // error is normal when no barcode in frame — just keep scanning
        }
      );
    } catch (err) {
      // If zxing's camera access fails, try manual stream approach
      console.warn('zxing camera failed, trying manual stream:', err.message);
      await this._manualScan(videoElement, onDetected);
    }
  },

  stopScanner() {
    this._scanning = false;
    if (this._controls) {
      try { this._controls.stop(); } catch {}
      this._controls = null;
    }
    if (this._stream) {
      this._stream.getTracks().forEach(t => t.stop());
      this._stream = null;
    }
  },

  async _loadZxing() {
    if (this._zxingReader) return;

    return new Promise((resolve, reject) => {
      // Check if already loaded
      if (typeof ZXing !== 'undefined') {
        this._zxingReader = new ZXing.BrowserMultiFormatReader();
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'lib/zxing-browser.min.js';
      script.onload = () => {
        this._zxingReader = new ZXing.BrowserMultiFormatReader();
        resolve();
      };
      script.onerror = () => reject(new Error('Failed to load barcode scanner library'));
      document.head.appendChild(script);
    });
  },

  // Fallback: manual camera stream + canvas-based frame decoding
  async _manualScan(videoElement, onDetected) {
    this._stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    });
    videoElement.srcObject = this._stream;
    await videoElement.play();

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const scan = () => {
      if (!this._scanning) return;
      if (videoElement.videoWidth === 0) {
        requestAnimationFrame(scan);
        return;
      }

      canvas.width = videoElement.videoWidth;
      canvas.height = videoElement.videoHeight;
      ctx.drawImage(videoElement, 0, 0);

      try {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const luminances = new ZXing.RGBLuminanceSource(imageData.data, canvas.width, canvas.height);
        const bitmap = new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(luminances));

        const hints = new Map();
        hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [
          ZXing.BarcodeFormat.EAN_13,
          ZXing.BarcodeFormat.EAN_8
        ]);
        hints.set(ZXing.DecodeHintType.TRY_HARDER, true);

        const reader = new ZXing.MultiFormatReader();
        reader.setHints(hints);
        const result = reader.decode(bitmap);

        if (result && this._isValidISBN(result.getText())) {
          this._vibrate();
          this._scanning = false;
          onDetected(result.getText());
          return;
        }
      } catch {
        // No barcode in this frame — keep scanning
      }

      requestAnimationFrame(scan);
    };

    scan();
  },

  _isValidISBN(value) {
    const cleaned = value.replace(/[-\s]/g, '');
    return cleaned.length === 13 || cleaned.length === 10;
  },

  _vibrate() {
    if (navigator.vibrate) {
      navigator.vibrate(100);
    }
  }
};
