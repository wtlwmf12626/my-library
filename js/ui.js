// UI Rendering — cards, modals, filters, scan confirmation
// All DOM construction uses safe methods (createElement/textContent) to prevent XSS

const UI = {
  // -- Book Card Grid --

  renderBookGrid(books, container) {
    container.textContent = '';

    if (books.length === 0) {
      const p = document.createElement('p');
      p.className = 'empty-state';
      p.textContent = 'No books found. Start scanning to build your library!';
      container.appendChild(p);
      return;
    }

    books.forEach(book => {
      container.appendChild(this._createBookCard(book));
    });
  },

  _createBookCard(book) {
    const card = document.createElement('div');
    card.className = 'book-card';
    card.onclick = () => this.showBookDetail(book);

    const cover = document.createElement('div');
    cover.className = 'book-cover';

    if (book.coverUrl) {
      const img = document.createElement('img');
      img.src = book.coverUrl;
      img.alt = book.title || '';
      img.loading = 'lazy';
      cover.appendChild(img);
    } else {
      const placeholder = document.createElement('div');
      placeholder.className = 'no-cover';
      const span = document.createElement('span');
      span.textContent = book.title || '';
      placeholder.appendChild(span);
      cover.appendChild(placeholder);
    }

    const statusBadge = document.createElement('span');
    statusBadge.className = 'status-badge ' + (book.readStatus === 'Read' ? 'status-read' : 'status-to-read');
    statusBadge.textContent = book.readStatus || 'To Read';
    cover.appendChild(statusBadge);

    if (book.lentTo) {
      const lentBadge = document.createElement('span');
      lentBadge.className = 'lent-badge';
      lentBadge.textContent = 'Lent to ' + book.lentTo;
      cover.appendChild(lentBadge);
    }

    const info = document.createElement('div');
    info.className = 'book-info';
    const title = document.createElement('h3');
    title.className = 'book-title';
    title.textContent = book.title || '';
    const author = document.createElement('p');
    author.className = 'book-author';
    author.textContent = book.authors || '';
    info.appendChild(title);
    info.appendChild(author);

    card.appendChild(cover);
    card.appendChild(info);
    return card;
  },

  // -- Book Detail Modal --

  showBookDetail(book) {
    const existing = document.querySelector('.modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    const modal = document.createElement('div');
    modal.className = 'modal';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'modal-close';
    closeBtn.textContent = '\u00d7';
    closeBtn.onclick = () => overlay.remove();
    modal.appendChild(closeBtn);

    const body = document.createElement('div');
    body.className = 'modal-body';

    // Cover
    const coverDiv = document.createElement('div');
    coverDiv.className = 'detail-cover';
    if (book.coverUrl) {
      const img = document.createElement('img');
      img.src = book.coverUrl;
      img.alt = book.title || '';
      coverDiv.appendChild(img);
    } else {
      const ph = document.createElement('div');
      ph.className = 'no-cover large';
      const span = document.createElement('span');
      span.textContent = book.title || '';
      ph.appendChild(span);
      coverDiv.appendChild(ph);
    }
    body.appendChild(coverDiv);

    // Info
    const infoDiv = document.createElement('div');
    infoDiv.className = 'detail-info';

    const h2 = document.createElement('h2');
    h2.textContent = book.title || '';
    infoDiv.appendChild(h2);

    const authorP = document.createElement('p');
    authorP.className = 'detail-author';
    authorP.textContent = 'by ' + (book.authors || '');
    infoDiv.appendChild(authorP);

    const metaFields = [
      { label: 'Genre', value: book.genre },
      { label: 'Published', value: book.publishedDate },
      { label: 'Edition', value: book.edition },
      { label: 'Pages', value: book.pageCount },
      { label: 'ISBN', value: book.isbn },
      { label: 'Status', value: book.readStatus || 'To Read' }
    ];

    metaFields.forEach(({ label, value }) => {
      if (!value) return;
      const p = document.createElement('p');
      p.className = 'detail-meta';
      const strong = document.createElement('strong');
      strong.textContent = label + ': ';
      p.appendChild(strong);
      p.appendChild(document.createTextNode(String(value)));
      infoDiv.appendChild(p);
    });

    if (book.lentTo) {
      const lentP = document.createElement('p');
      lentP.className = 'detail-meta lent-info';
      const strong = document.createElement('strong');
      strong.textContent = 'Lent to: ';
      lentP.appendChild(strong);
      let lentText = book.lentTo;
      if (book.lentDate) lentText += ' (' + book.lentDate + ')';
      lentP.appendChild(document.createTextNode(lentText));
      infoDiv.appendChild(lentP);
    }

    if (book.description) {
      const descP = document.createElement('p');
      descP.className = 'detail-description';
      descP.textContent = book.description;
      infoDiv.appendChild(descP);
    }

    // Admin actions
    if (sessionStorage.getItem('libraryPassword')) {
      const actions = document.createElement('div');
      actions.className = 'detail-actions';

      const editBtn = document.createElement('button');
      editBtn.className = 'btn btn-small';
      editBtn.textContent = 'Edit';
      editBtn.onclick = () => App.editBook(book.isbn);
      actions.appendChild(editBtn);

      const delBtn = document.createElement('button');
      delBtn.className = 'btn btn-small btn-danger';
      delBtn.textContent = 'Delete';
      delBtn.onclick = () => App.deleteBook(book.isbn);
      actions.appendChild(delBtn);

      infoDiv.appendChild(actions);
    }

    body.appendChild(infoDiv);
    modal.appendChild(body);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  },

  // -- Scan Confirmation Card --

  showScanConfirmation(book, onConfirm) {
    const container = document.getElementById('scan-result');
    container.textContent = '';

    const confirm = document.createElement('div');
    confirm.className = 'scan-confirm';

    // Cover
    const coverDiv = document.createElement('div');
    coverDiv.className = 'scan-confirm-cover';
    if (book.coverUrl) {
      const img = document.createElement('img');
      img.src = book.coverUrl;
      img.alt = book.title || '';
      coverDiv.appendChild(img);
    } else {
      const ph = document.createElement('div');
      ph.className = 'no-cover';
      const span = document.createElement('span');
      span.textContent = book.title || 'Unknown';
      ph.appendChild(span);
      coverDiv.appendChild(ph);
    }
    confirm.appendChild(coverDiv);

    // Info
    const infoDiv = document.createElement('div');
    infoDiv.className = 'scan-confirm-info';

    const h3 = document.createElement('h3');
    h3.textContent = book.title || 'Book not found';
    infoDiv.appendChild(h3);

    if (book.authors) {
      const authorP = document.createElement('p');
      authorP.className = 'book-author';
      authorP.textContent = 'by ' + book.authors;
      infoDiv.appendChild(authorP);
    }

    if (book.genre) {
      const genreP = document.createElement('p');
      genreP.className = 'detail-meta';
      genreP.textContent = book.genre;
      infoDiv.appendChild(genreP);
    }

    if (book.publishedDate) {
      const dateP = document.createElement('p');
      dateP.className = 'detail-meta';
      dateP.textContent = book.publishedDate;
      infoDiv.appendChild(dateP);
    }

    // Read status toggle
    const toggleDiv = document.createElement('div');
    toggleDiv.className = 'read-toggle';

    const btnToRead = document.createElement('button');
    btnToRead.className = 'btn toggle-btn active';
    btnToRead.textContent = 'To Read';

    const btnRead = document.createElement('button');
    btnRead.className = 'btn toggle-btn';
    btnRead.textContent = 'Read';

    let readStatus = 'To Read';

    btnToRead.onclick = () => {
      readStatus = 'To Read';
      btnToRead.classList.add('active');
      btnRead.classList.remove('active');
    };

    btnRead.onclick = () => {
      readStatus = 'Read';
      btnRead.classList.add('active');
      btnToRead.classList.remove('active');
    };

    toggleDiv.appendChild(btnToRead);
    toggleDiv.appendChild(btnRead);
    infoDiv.appendChild(toggleDiv);

    // Add button
    const addBtn = document.createElement('button');
    addBtn.className = 'btn btn-primary';
    addBtn.textContent = 'Add to Library';
    addBtn.onclick = () => {
      book.readStatus = readStatus;
      onConfirm(book);
    };
    infoDiv.appendChild(addBtn);

    confirm.appendChild(infoDiv);
    container.appendChild(confirm);
  },

  clearScanResult() {
    const container = document.getElementById('scan-result');
    if (container) container.textContent = '';
  },

  // -- Edit Modal --

  showEditModal(book, onSave) {
    const existing = document.querySelector('.modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    const modal = document.createElement('div');
    modal.className = 'modal';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'modal-close';
    closeBtn.textContent = '\u00d7';
    closeBtn.onclick = () => overlay.remove();
    modal.appendChild(closeBtn);

    const body = document.createElement('div');
    body.className = 'modal-body';

    const h2 = document.createElement('h2');
    h2.textContent = 'Edit: ' + (book.title || '');
    body.appendChild(h2);

    const form = document.createElement('div');
    form.className = 'edit-form';

    // Status select
    const statusLabel = document.createElement('label');
    statusLabel.textContent = 'Read Status';
    const statusSelect = document.createElement('select');
    statusSelect.id = 'edit-status';
    const optToRead = document.createElement('option');
    optToRead.value = 'To Read';
    optToRead.textContent = 'To Read';
    optToRead.selected = book.readStatus !== 'Read';
    const optRead = document.createElement('option');
    optRead.value = 'Read';
    optRead.textContent = 'Read';
    optRead.selected = book.readStatus === 'Read';
    statusSelect.appendChild(optToRead);
    statusSelect.appendChild(optRead);
    statusLabel.appendChild(statusSelect);
    form.appendChild(statusLabel);

    // Lent To
    const lentLabel = document.createElement('label');
    lentLabel.textContent = 'Lent To';
    const lentInput = document.createElement('input');
    lentInput.type = 'text';
    lentInput.id = 'edit-lent-to';
    lentInput.value = book.lentTo || '';
    lentInput.placeholder = 'Name of borrower';
    lentLabel.appendChild(lentInput);
    form.appendChild(lentLabel);

    // Lent Date
    const dateLabel = document.createElement('label');
    dateLabel.textContent = 'Lent Date';
    const dateInput = document.createElement('input');
    dateInput.type = 'date';
    dateInput.id = 'edit-lent-date';
    dateInput.value = book.lentDate || '';
    dateLabel.appendChild(dateInput);
    form.appendChild(dateLabel);

    // Save button
    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn btn-primary';
    saveBtn.textContent = 'Save Changes';
    saveBtn.onclick = () => {
      const updated = {
        isbn: book.isbn,
        readStatus: statusSelect.value,
        lentTo: lentInput.value,
        lentDate: dateInput.value
      };
      overlay.remove();
      onSave(updated);
    };
    form.appendChild(saveBtn);

    body.appendChild(form);
    modal.appendChild(body);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  },

  // -- Password Prompt --

  showPasswordPrompt(onSubmit) {
    const existing = document.querySelector('.modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    const modal = document.createElement('div');
    modal.className = 'modal modal-small';

    const h2 = document.createElement('h2');
    h2.textContent = 'Admin Access';
    modal.appendChild(h2);

    const p = document.createElement('p');
    p.textContent = 'Enter your library password to add or edit books.';
    modal.appendChild(p);

    const input = document.createElement('input');
    input.type = 'password';
    input.className = 'input';
    input.placeholder = 'Password';
    input.autofocus = true;
    modal.appendChild(input);

    const btn = document.createElement('button');
    btn.className = 'btn btn-primary';
    btn.style.marginTop = '1rem';
    btn.textContent = 'Enter';
    modal.appendChild(btn);

    const submit = () => {
      if (input.value) {
        overlay.remove();
        onSubmit(input.value);
      }
    };

    btn.onclick = submit;
    input.onkeydown = (e) => { if (e.key === 'Enter') submit(); };

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Focus the input after it's in the DOM
    requestAnimationFrame(() => input.focus());
  },

  // -- Toast Notifications --

  showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.textContent = message;
    document.body.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  },

  // -- Filters --

  populateGenreFilter(books) {
    const select = document.getElementById('filter-genre');
    if (!select) return;

    const genres = new Set();
    books.forEach(book => {
      if (book.genre) {
        book.genre.split(',').forEach(g => genres.add(g.trim()));
      }
    });

    const sorted = [...genres].sort();
    select.textContent = '';
    const allOption = document.createElement('option');
    allOption.value = '';
    allOption.textContent = 'All Genres';
    select.appendChild(allOption);

    sorted.forEach(genre => {
      const opt = document.createElement('option');
      opt.value = genre;
      opt.textContent = genre;
      select.appendChild(opt);
    });
  }
};
