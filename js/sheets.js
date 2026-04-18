// Google Sheets integration — read from published sheet, write via Apps Script

const Sheets = {
  // CONFIG: Set these after deploying your Apps Script
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbx97WB6put2fHDe2ycLGKStSQKNyjWMl_Js0FMsJo_rDqyGNEpsHyGzLpOPu-EZ071psQ/exec',
  SHEET_CSV_URL: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRToAA3qOo8JbTQZ-kCO3h9rkvFW-wknFHKctk5Gu_PXPIWLe4AKjweZDJE9_dJMxISGK70nv3HZwZ2/pub?gid=0&single=true&output=csv',

  _cache: null,
  _cacheTime: 0,
  _CACHE_TTL: 60000, // 1 minute

  async loadBooks(forceRefresh = false) {
    if (!forceRefresh && this._cache && Date.now() - this._cacheTime < this._CACHE_TTL) {
      return this._cache;
    }

    if (!this.SHEET_CSV_URL) {
      console.warn('Sheet CSV URL not configured');
      return [];
    }

    try {
      const res = await fetch(this.SHEET_CSV_URL);
      const csv = await res.text();
      const books = this._parseCSV(csv);
      this._cache = books;
      this._cacheTime = Date.now();
      return books;
    } catch (err) {
      console.error('Failed to load books:', err);
      return this._cache || [];
    }
  },

  async refreshBooks() {
    return this.loadBooks(true);
  },

  async addBook(book, password) {
    return this._post({ action: 'add', book, password });
  },

  async updateBook(book, password) {
    return this._post({ action: 'update', book, password });
  },

  async deleteBook(isbn, password) {
    return this._post({ action: 'delete', isbn, password });
  },

  async _post(body) {
    if (!this.APPS_SCRIPT_URL) {
      throw new Error('Apps Script URL not configured. See README for setup.');
    }

    const res = await fetch(this.APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(body),
      redirect: 'follow'  // Apps Script redirects on deploy
    });

    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Unknown error');
    }

    // Invalidate cache after write
    this._cache = null;
    return data;
  },

  _parseCSV(csv) {
    const lines = csv.split('\n');
    if (lines.length < 2) return [];

    const headers = this._parseCSVLine(lines[0]);
    const books = [];

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const values = this._parseCSVLine(lines[i]);
      const book = {};

      headers.forEach((header, idx) => {
        const key = this._headerToKey(header);
        book[key] = values[idx] || '';
      });

      if (book.isbn || book.title) {
        books.push(book);
      }
    }

    return books;
  },

  _parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          current += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          current += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ',') {
          values.push(current.trim());
          current = '';
        } else {
          current += ch;
        }
      }
    }
    values.push(current.trim());
    return values;
  },

  _headerToKey(header) {
    const map = {
      'ISBN': 'isbn',
      'Title': 'title',
      'Author(s)': 'authors',
      'Genre/Category': 'genre',
      'Publication Date': 'publishedDate',
      'Edition': 'edition',
      'Page Count': 'pageCount',
      'Cover Image URL': 'coverUrl',
      'Description': 'description',
      'Rachel Status': 'rachelStatus',
      'Mason Status': 'masonStatus',
      'Date Added': 'dateAdded',
      'Lent To': 'lentTo',
      'Lent Date': 'lentDate'
    };
    return map[header] || header.toLowerCase().replace(/[^a-z0-9]/g, '');
  }
};
