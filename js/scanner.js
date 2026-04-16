// Barcode Scanner — uses ZXingBrowser for reliable cross-browser ISBN scanning

const Scanner = {
  _controls: null,
  _reader: null,
  _scanning: false,

  async startScanner(videoElement, onDetected) {
    this._scanning = true;

    await this._loadZxing();

    try {
      // decodeFromVideoDevice(deviceId, videoElement, callback)
      // null deviceId = default camera (rear on phones)
      this._controls = await this._reader.decodeFromVideoDevice(
        null,
        videoElement,
        (result, error) => {
          if (!this._scanning) return;

          if (result) {
            const isbn = result.getText();
            if (this._isValidISBN(isbn)) {
              this._vibrate();
              this._scanning = false;
              if (this._controls) {
                this._controls.stop();
                this._controls = null;
              }
              onDetected(isbn);
            }
          }
          // error is normal when no barcode in frame — just keeps scanning
        }
      );
    } catch (err) {
      console.error('Scanner error:', err);
      throw err;
    }
  },

  stopScanner() {
    this._scanning = false;
    if (this._controls) {
      try { this._controls.stop(); } catch {}
      this._controls = null;
    }
  },

  async _loadZxing() {
    if (this._reader) return;

    return new Promise((resolve, reject) => {
      if (typeof ZXingBrowser !== 'undefined') {
        this._reader = new ZXingBrowser.BrowserMultiFormatReader();
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'lib/zxing-browser.min.js';
      script.onload = () => {
        this._reader = new ZXingBrowser.BrowserMultiFormatReader();
        resolve();
      };
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
