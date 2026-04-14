// Book Lookup — Google Books API + Open Library fallback

const BookLookup = {
  async lookupISBN(isbn) {
    isbn = isbn.replace(/[-\s]/g, '');

    // Try Google Books first
    let book = await this._googleBooks(isbn);

    // If key fields are missing, try Open Library to fill gaps
    if (!book.title || !book.authors || !book.coverUrl) {
      const olBook = await this._openLibrary(isbn);
      book = this._merge(book, olBook);
    }

    book.isbn = isbn;
    return book;
  },

  async _googleBooks(isbn) {
    try {
      const res = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`
      );
      const data = await res.json();

      if (!data.items || data.items.length === 0) return {};

      const info = data.items[0].volumeInfo;
      return {
        title: info.title || '',
        authors: (info.authors || []).join(', '),
        genre: (info.categories || []).join(', '),
        publishedDate: info.publishedDate || '',
        edition: info.edition || '',
        pageCount: info.pageCount || '',
        coverUrl: info.imageLinks
          ? (info.imageLinks.thumbnail || '').replace('http://', 'https://')
          : '',
        description: info.description || ''
      };
    } catch {
      return {};
    }
  },

  async _openLibrary(isbn) {
    try {
      // Get edition data
      const res = await fetch(
        `https://openlibrary.org/isbn/${isbn}.json`
      );
      if (!res.ok) return {};
      const data = await res.json();

      // Get author names (OL stores author refs, not names)
      let authors = '';
      if (data.authors && data.authors.length > 0) {
        const authorPromises = data.authors.map(async (a) => {
          try {
            const r = await fetch(`https://openlibrary.org${a.key}.json`);
            const ad = await r.json();
            return ad.name || '';
          } catch {
            return '';
          }
        });
        const names = await Promise.all(authorPromises);
        authors = names.filter(Boolean).join(', ');
      }

      // Get subjects from the work (parent of edition)
      let genre = '';
      if (data.works && data.works.length > 0) {
        try {
          const workRes = await fetch(
            `https://openlibrary.org${data.works[0].key}.json`
          );
          const workData = await workRes.json();
          genre = (workData.subjects || []).slice(0, 3).join(', ');
        } catch {
          // ignore
        }
      }

      const coverId = data.covers ? data.covers[0] : null;

      return {
        title: data.title || '',
        authors,
        genre,
        publishedDate: data.publish_date || '',
        edition: data.edition_name || '',
        pageCount: data.number_of_pages || '',
        coverUrl: coverId
          ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg`
          : '',
        description: typeof data.description === 'string'
          ? data.description
          : (data.description?.value || '')
      };
    } catch {
      return {};
    }
  },

  _merge(primary, fallback) {
    const result = { ...primary };
    for (const key of Object.keys(fallback)) {
      if (!result[key] && fallback[key]) {
        result[key] = fallback[key];
      }
    }
    return result;
  }
};
