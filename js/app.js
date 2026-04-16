// Main App — routing, state management, wiring everything together

const App = {
  _allBooks: [],
  _currentView: 'browse',

  async init() {
    // Route based on hash
    window.addEventListener('hashchange', () => this._route());

    // Wire up filter controls
    document.getElementById('search-input').addEventListener('input', () => this._applyFilters());
    document.getElementById('filter-status').addEventListener('change', () => this._applyFilters());
    document.getElementById('filter-genre').addEventListener('change', () => this._applyFilters());
    document.getElementById('filter-sort').addEventListener('change', () => this._applyFilters());

    // Wire up scan button
    document.getElementById('btn-scan').addEventListener('click', () => {
      window.location.hash = '#scan';
    });

    // Wire up manual ISBN entry
    document.getElementById('btn-manual-isbn').addEventListener('click', () => this._manualISBNLookup());
    document.getElementById('manual-isbn-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this._manualISBNLookup();
    });

    // Wire up back button in scan view
    document.getElementById('btn-back-browse').addEventListener('click', () => {
      window.location.hash = '#browse';
    });

    // Load books and show browse view
    await this._loadAndRender();
    this._route();
  },

  // -- Routing --

  _route() {
    const hash = window.location.hash || '#browse';

    if (hash === '#scan') {
      this._showScanView();
    } else {
      this._showBrowseView();
    }
  },

  _showBrowseView() {
    this._currentView = 'browse';
    document.getElementById('view-browse').style.display = '';
    document.getElementById('view-scan').style.display = 'none';
    Scanner.stopScanner();
  },

  _showScanView() {
    const password = sessionStorage.getItem('libraryPassword');
    if (!password) {
      UI.showPasswordPrompt((pw) => {
        sessionStorage.setItem('libraryPassword', pw);
        this._showScanView();
      });
      return;
    }

    this._currentView = 'scan';
    document.getElementById('view-browse').style.display = 'none';
    document.getElementById('view-scan').style.display = '';
    UI.clearScanResult();
    this._startScanning();
  },

  // -- Scanning --

  async _startScanning() {
    const status = document.getElementById('scan-status');
    status.textContent = 'Point camera at a barcode...';

    try {
      await Scanner.startScanner('scanner-container', (isbn) => this._onISBNDetected(isbn));
    } catch (err) {
      if (err.name === 'NotAllowedError' || (err.message && err.message.includes('Permission'))) {
        status.textContent = 'Camera permission denied. Please allow camera access and try again.';
      } else {
        status.textContent = 'Camera error: ' + err.message;
      }
    }
  },

  async _onISBNDetected(isbn) {

    const status = document.getElementById('scan-status');
    status.textContent = 'Found ISBN: ' + isbn + ' — Looking up book...';

    try {
      const book = await BookLookup.lookupISBN(isbn);

      if (!book.title) {
        status.textContent = 'ISBN ' + isbn + ' not found in book databases. Try entering details manually.';
        setTimeout(() => Scanner.resumeScanner(), 3000);
        return;
      }

      status.textContent = '';
      UI.showScanConfirmation(book, (confirmedBook) => this._addBook(confirmedBook));
    } catch (err) {
      status.textContent = 'Lookup error: ' + err.message;
      setTimeout(() => Scanner.resumeScanner(), 3000);
    }
  },

  async _manualISBNLookup() {
    const input = document.getElementById('manual-isbn-input');
    const isbn = input.value.trim();
    if (!isbn) return;

    input.value = '';
    await this._onISBNDetected(isbn);
  },

  async _addBook(book) {
    const password = sessionStorage.getItem('libraryPassword');
    const status = document.getElementById('scan-status');

    try {
      status.textContent = 'Adding to library...';
      await Sheets.addBook(book, password);
      UI.showToast('"' + book.title + '" added to library!');
      UI.clearScanResult();

      // Refresh book list in background
      this._loadAndRender();

      // Resume scanner for next book (faster than full restart)
      Scanner.resumeScanner();
    } catch (err) {
      if (err.message === 'Invalid password') {
        sessionStorage.removeItem('libraryPassword');
        UI.showToast('Invalid password. Please try again.', 'error');
        this._showScanView();
      } else if (err.message === 'Book already exists') {
        UI.showToast('This book is already in your library.', 'error');
        UI.clearScanResult();
        Scanner.resumeScanner();
      } else {
        UI.showToast('Error: ' + err.message, 'error');
        status.textContent = '';
      }
    }
  },

  // -- Browse & Filtering --

  async _loadAndRender() {
    const container = document.getElementById('book-grid');

    try {
      this._allBooks = await Sheets.loadBooks();
      UI.populateGenreFilter(this._allBooks);
      this._applyFilters();
    } catch (err) {
      container.textContent = '';
      const p = document.createElement('p');
      p.className = 'empty-state';
      p.textContent = 'Could not load books. Check your Sheet configuration.';
      container.appendChild(p);
    }
  },

  _applyFilters() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    const statusFilter = document.getElementById('filter-status').value;
    const genreFilter = document.getElementById('filter-genre').value;
    const sortBy = document.getElementById('filter-sort').value;

    let filtered = this._allBooks.filter(book => {
      // Search
      if (searchTerm) {
        const searchable = [book.title, book.authors, book.isbn]
          .join(' ').toLowerCase();
        if (!searchable.includes(searchTerm)) return false;
      }

      // Status
      if (statusFilter && book.readStatus !== statusFilter) return false;

      // Genre
      if (genreFilter && (!book.genre || !book.genre.includes(genreFilter))) return false;

      return true;
    });

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'title':
          return (a.title || '').localeCompare(b.title || '');
        case 'author':
          return (a.authors || '').localeCompare(b.authors || '');
        case 'added':
          return (b.dateAdded || '').localeCompare(a.dateAdded || '');
        case 'published':
          return (b.publishedDate || '').localeCompare(a.publishedDate || '');
        default:
          return 0;
      }
    });

    // Update count
    const count = document.getElementById('book-count');
    if (count) {
      count.textContent = filtered.length + ' book' + (filtered.length !== 1 ? 's' : '');
    }

    UI.renderBookGrid(filtered, document.getElementById('book-grid'));
  },

  // -- Admin Actions (called from detail modal) --

  async editBook(isbn) {
    // Close detail modal
    const overlay = document.querySelector('.modal-overlay');
    if (overlay) overlay.remove();

    const book = this._allBooks.find(b => b.isbn === isbn);
    if (!book) return;

    UI.showEditModal(book, async (updated) => {
      const password = sessionStorage.getItem('libraryPassword');
      try {
        await Sheets.updateBook(updated, password);
        UI.showToast('Book updated!');
        await this._loadAndRender();
      } catch (err) {
        UI.showToast('Error: ' + err.message, 'error');
      }
    });
  },

  async deleteBook(isbn) {
    const book = this._allBooks.find(b => b.isbn === isbn);
    if (!book) return;

    if (!confirm('Delete "' + book.title + '" from your library?')) return;

    // Close detail modal
    const overlay = document.querySelector('.modal-overlay');
    if (overlay) overlay.remove();

    const password = sessionStorage.getItem('libraryPassword');
    try {
      await Sheets.deleteBook(isbn, password);
      UI.showToast('"' + book.title + '" removed.');
      await this._loadAndRender();
    } catch (err) {
      UI.showToast('Error: ' + err.message, 'error');
    }
  }
};

// Start the app
document.addEventListener('DOMContentLoaded', () => App.init());
