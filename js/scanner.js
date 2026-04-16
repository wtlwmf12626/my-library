// Barcode Scanner — uses html5-qrcode for reliable iOS Safari scanning

const Scanner = {
  _scanner: null,
  _scanning: false,

  async startScanner(containerId, onDetected) {
    this._scanning = true;

    await this._loadLibrary();

    // Clean up any previous scanner instance
    if (this._scanner) {
      try { await this._scanner.stop(); } catch {}
      try { await this._scanner.clear(); } catch {}
    }

    this._scanner = new Html5Qrcode(containerId);

    const config = {
      fps: 10,
      qrbox: { width: 250, height: 150 },
      formatsToSupport: [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8
      ]
    };

    try {
      await this._scanner.start(
        { facingMode: 'environment' },
        config,
        (decodedText) => {
          if (!this._scanning) return;
          if (this._isValidISBN(decodedText)) {
            this._vibrate();
            this._scanning = false;
            this._scanner.pause(true); // pause instead of stop for faster resume
            onDetected(decodedText);
          }
        },
        () => {
          // No barcode found in this frame — normal, keep scanning
        }
      );
    } catch (err) {
      console.error('Scanner start error:', err);
      throw err;
    }
  },

  async resumeScanner() {
    if (this._scanner) {
      this._scanning = true;
      try {
        this._scanner.resume();
      } catch {
        // If resume fails, the scanner was stopped not paused — restart needed
      }
    }
  },

  async stopScanner() {
    this._scanning = false;
    if (this._scanner) {
      try { await this._scanner.stop(); } catch {}
      try { await this._scanner.clear(); } catch {}
      this._scanner = null;
    }
  },

  async _loadLibrary() {
    if (typeof Html5Qrcode !== 'undefined') return;

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'lib/html5-qrcode.min.js';
      script.onload = resolve;
      script.onerror = () => reject(new Error('Failed to load barcode scanner library'));
      document.head.appendChild(script);
    });
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
