// Google Apps Script — Personal Library Write API
// Paste this into your Google Sheet's Apps Script editor
// Then deploy as web app (Execute as: Me, Access: Anyone)

// Set your password: File → Project properties → Script properties
// Add property: PASSWORD = your_chosen_password

const SHEET_NAME = 'Library';

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    // Validate password
    const password = PropertiesService.getScriptProperties().getProperty('PASSWORD');
    if (data.password !== password) {
      return jsonResponse({ success: false, error: 'Invalid password' }, 403);
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];

    switch (data.action) {
      case 'add':
        return addBook(sheet, data.book);
      case 'update':
        return updateBook(sheet, data.book);
      case 'delete':
        return deleteBook(sheet, data.isbn);
      default:
        return jsonResponse({ success: false, error: 'Unknown action' }, 400);
    }
  } catch (err) {
    return jsonResponse({ success: false, error: err.message }, 500);
  }
}

function doGet() {
  return jsonResponse({ status: 'ok', message: 'Library API is running' });
}

function addBook(sheet, book) {
  // Check for duplicate ISBN
  const isbnCol = getColumnIndex(sheet, 'ISBN');
  if (isbnCol > 0) {
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][isbnCol - 1]) === String(book.isbn)) {
        return jsonResponse({ success: false, error: 'Book already exists' }, 409);
      }
    }
  }

  const row = [
    book.isbn || '',
    book.title || '',
    book.authors || '',
    book.genre || '',
    book.publishedDate || '',
    book.edition || '',
    book.pageCount || '',
    book.coverUrl || '',
    book.description || '',
    book.readStatus || 'To Read',
    new Date().toISOString().split('T')[0],  // dateAdded
    book.lentTo || '',
    book.lentDate || ''
  ];

  sheet.appendRow(row);
  return jsonResponse({ success: true, message: 'Book added' });
}

function updateBook(sheet, book) {
  const data = sheet.getDataRange().getValues();
  const isbnCol = getColumnIndex(sheet, 'ISBN');

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][isbnCol - 1]) === String(book.isbn)) {
      const rowNum = i + 1;
      // Update mutable fields only
      if (book.readStatus !== undefined) sheet.getRange(rowNum, getColumnIndex(sheet, 'Read Status')).setValue(book.readStatus);
      if (book.lentTo !== undefined) sheet.getRange(rowNum, getColumnIndex(sheet, 'Lent To')).setValue(book.lentTo);
      if (book.lentDate !== undefined) sheet.getRange(rowNum, getColumnIndex(sheet, 'Lent Date')).setValue(book.lentDate);
      return jsonResponse({ success: true, message: 'Book updated' });
    }
  }

  return jsonResponse({ success: false, error: 'Book not found' }, 404);
}

function deleteBook(sheet, isbn) {
  const data = sheet.getDataRange().getValues();
  const isbnCol = getColumnIndex(sheet, 'ISBN');

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][isbnCol - 1]) === String(isbn)) {
      sheet.deleteRow(i + 1);
      return jsonResponse({ success: true, message: 'Book deleted' });
    }
  }

  return jsonResponse({ success: false, error: 'Book not found' }, 404);
}

function getColumnIndex(sheet, headerName) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  return headers.indexOf(headerName) + 1;
}

function jsonResponse(data, code) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
