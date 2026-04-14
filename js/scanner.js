// Barcode Scanner — native BarcodeDetector API with zxing-js fallback

const Scanner = {
  _stream: null,
  _detector: null,
  _zxingReader: null,
  _scanning: false,
  _animFrame: null,

  isNativeSupported() {
    return 'BarcodeDetector' in window;
  },

  async startScanner(videoElement, onDetected) {
    this._scanning = true;

    // Get camera stream (prefer rear camera for phone scanning)
    this._stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }
    });
    videoElement.srcObject = this._stream;
    await videoElement.play();

    if (this.isNativeSupported()) {
      this._detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8'] });
      this._scanWithNative(videoElement, onDetected);
    } else {
      await this._loadZxing();
      this._scanWithZxing(videoElement, onDetected);
    }
  },

  stopScanner() {
    this._scanning = false;
    if (this._animFrame) {
      cancelAnimationFrame(this._animFrame);
      this._animFrame = null;
    }
    if (this._stream) {
      this._stream.getTracks().forEach(t => t.stop());
      this._stream = null;
    }
  },

  async _scanWithNative(video, onDetected) {
    if (!this._scanning) return;

    try {
      const barcodes = await this._detector.detect(video);
      if (barcodes.length > 0) {
        const isbn = barcodes[0].rawValue;
        if (this._isValidISBN(isbn)) {
          this._vibrate();
          onDetected(isbn);
          return; // Stop scanning after detection
        }
      }
    } catch {
      // Detection failed this frame, try again
    }

    this._animFrame = requestAnimationFrame(() => {
      this._scanWithNative(video, onDetected);
    });
  },

  async _loadZxing() {
    if (this._zxingReader) return;

    return new Promise((resolve, reject) => {
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

  _scanWithZxing(video, onDetected) {
    if (!this._scanning || !this._zxingReader) return;

    // ZXing's BrowserMultiFormatReader can decode directly from a video element
    // We poll frames using a canvas since we manage the stream ourselves
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const scan = () => {
      if (!this._scanning) return;

      if (video.videoWidth === 0) {
        this._animFrame = requestAnimationFrame(scan);
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);

      try {
        const result = this._zxingReader.decodeFromCanvas(canvas);
        if (result && this._isValidISBN(result.getText())) {
          this._vibrate();
          onDetected(result.getText());
          return;
        }
      } catch {
        // No barcode found this frame
      }

      this._animFrame = requestAnimationFrame(scan);
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
