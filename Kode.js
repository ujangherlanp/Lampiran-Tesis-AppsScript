
const SHEET_ID = ''; 

/**
 * Menyajikan antarmuka Web App (File Index.html)
 */
function doGet(e) {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Evaluasi Adaptive Scaffolding')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Mengambil objek Spreadsheet yang sedang aktif
 */
function getDB() {
  if (SHEET_ID && SHEET_ID.trim() !== '') {
    return SpreadsheetApp.openById(SHEET_ID);
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * Memastikan sheet dengan nama tertentu sudah ada.
 */
function ensureSheetExists(sheetName, headers) {
  const ss = getDB();
  let sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    if (headers && headers.length > 0) {
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#f1f5f9');
    }
  }
  return sheet;
}

/**
 * Menerima string Base64 dari Front-End, membuat file gambar di Google Drive, 
 * dan mengembalikan Direct Link.
 */
function uploadImageToDrive(base64Data, fileName) {
  try {
    const folderId = "1fn3TlAAY63-YPVJGcqDl-hfDm7h7SglL";
    const folder = DriveApp.getFolderById(folderId);

    const splitBase = base64Data.split(',');
    const contentType = splitBase[0].split(':')[1].split(';')[0];
    const byteString = splitBase[1];
    
    const blob = Utilities.newBlob(Utilities.base64Decode(byteString), contentType, fileName || ("img_" + new Date().getTime() + ".jpg"));
    
    const file = folder.createFile(blob);
    
    return "https://lh3.googleusercontent.com/d/" + file.getId();
  } catch (err) {
    Logger.log("Error uploadImageToDrive: " + err.toString());
    throw new Error("Gagal mengunggah gambar ke Drive: " + err.message);
  }
}

/**
 * Menyimpan Kuis Baru atau Mengupdate Kuis yang Sudah Ada
 */
function saveQuizToDB(quizJson) {
  try {
    const db = ensureSheetExists('Quizzes', ['ID Kuis', 'Kode Kuis', 'Judul Kuis', 'Terakhir Diubah', 'JSON Data']);
    const quizObj = typeof quizJson === 'string' ? JSON.parse(quizJson) : quizJson;
    
    if (!quizObj || !quizObj.id) {
      throw new Error("ID Kuis tidak valid.");
    }

    const data = db.getDataRange().getValues();
    
    let startIndex = 0;
    if (data.length > 0 && String(data[0][0]).toLowerCase().includes('id')) {
      startIndex = 1;
    }
    
    let existingRowIndex = -1;
    for (let i = startIndex; i < data.length; i++) {
      if (String(data[i][0]).trim() === String(quizObj.id).trim()) {
        existingRowIndex = i + 1;
        break;
      }
    }

    const timestamp = new Date().toISOString();
    quizObj.updatedAt = timestamp;
    
    const finalJsonStr = JSON.stringify(quizObj);
    const MAX_CHARS = 45000;
    const chunks = [];
    for (let j = 0; j < finalJsonStr.length; j += MAX_CHARS) {
      chunks.push(finalJsonStr.substring(j, j + MAX_CHARS));
    }

    const baseRowData = [
      String(quizObj.id || ''),
      String(quizObj.code || ''),
      String(quizObj.title || ''),
      timestamp
    ];
    
    const rowData = baseRowData.concat(chunks);

    if (existingRowIndex > -1) {
      db.getRange(existingRowIndex, 5, 1, 20).clearContent();
      db.getRange(existingRowIndex, 1, 1, rowData.length).setValues([rowData]);
    } else {
      db.appendRow(rowData);
    }
    
    return true;
  } catch (err) {
    Logger.log("Error pada saveQuizToDB: " + err.toString());
    throw new Error("Gagal menyimpan kuis ke database Spreadsheet: " + err.message);
  }
}

/**
 * Mengambil semua daftar kuis dari database Spreadsheet
 */
function getQuizzesFromDB() {
  try {
    const db = ensureSheetExists('Quizzes', ['ID Kuis', 'Kode Kuis', 'Judul Kuis', 'Terakhir Diubah', 'JSON Data']);
    const data = db.getDataRange().getValues();
    
    if (data.length === 0) return [];
    
    let startIndex = 0;
    if (data.length > 0 && String(data[0][0]).toLowerCase().includes('id')) {
      startIndex = 1;
    }
    
    let quizzes = [];
    for (let i = startIndex; i < data.length; i++) {
      let jsonChunks = "";
      for (let c = 4; c < data[i].length; c++) {
        if (data[i][c]) {
          jsonChunks += data[i][c].toString();
        }
      }
      
      if (jsonChunks) {
        quizzes.push(jsonChunks);
      }
    }
    return quizzes;
  } catch (err) {
    Logger.log("Error pada getQuizzesFromDB: " + err.toString());
    return [];
  }
}

/**
 * Menyimpan progress pengerjaan siswa setelah kuis selesai
 */
function saveProgressToDB(progressJson) {
  try {
    const db = ensureSheetExists('Progress', ['Waktu', 'Nama Siswa', 'Kelas', 'Kode Kuis', 'Judul Kuis', 'Skor', 'Raw Logs JSON']);
    const progressObj = typeof progressJson === 'string' ? JSON.parse(progressJson) : progressJson;
    
    const rowData = [
      progressObj.date || new Date().toISOString(),
      progressObj.studentName || '',
      progressObj.kelas || '',
      progressObj.quizCode || '',
      progressObj.quizTitle || '',
      progressObj.score !== undefined ? progressObj.score : 0,
      typeof progressJson === 'string' ? progressJson : JSON.stringify(progressJson)
    ];
    
    db.appendRow(rowData);
    return true;
  } catch (err) {
    Logger.log("Error pada saveProgressToDB: " + err.toString());
    throw new Error("Gagal menyimpan progress siswa: " + err.message);
  }
}

/**
 * Mengambil semua progress pengerjaan siswa untuk Dashboard Peneliti
 */
function getProgressFromDB() {
  try {
    const db = ensureSheetExists('Progress', ['Waktu', 'Nama Siswa', 'Kelas', 'Kode Kuis', 'Judul Kuis', 'Skor', 'Raw Logs JSON']);
    const data = db.getDataRange().getValues();
    
    if (data.length === 0) return [];
    
    let startIndex = 0;
    if (data.length > 0 && String(data[0][0]).toLowerCase().includes('waktu')) {
      startIndex = 1;
    }
    
    let progressData = [];
    for (let i = startIndex; i < data.length; i++) {
      if (data[i][6]) {
        progressData.push(data[i][6].toString());
      }
    }
    return progressData;
  } catch (err) {
    Logger.log("Error pada getProgressFromDB: " + err.toString());
    return [];
  }
}

/**
 * Generasi cetak Storyboard Kuis Adaptif
 */
function generateQuizPdf(quizJson) {
  try {
    const quiz = typeof quizJson === 'string' ? JSON.parse(quizJson) : quizJson;

    const css = `
      @page { margin: 1cm; size: A4 landscape; }
      body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 20px; color: #1e293b; background: #fff; }
      h1 { color: #0f172a; font-size: 22px; border-bottom: 2px solid #cbd5e1; padding-bottom: 8px; margin-bottom: 12px; }
      .meta { font-size: 14px; color: #64748b; margin-bottom: 20px; }
      .code-tag { background: #dbeafe; color: #1e40af; padding: 3px 8px; border-radius: 6px; font-weight: bold; font-family: monospace; }
      .note { background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px; font-size: 13px; color: #475569; }
    `;
    
    const htmlStr = "<html><head><style>" + css + "</style></head><body>" +
                  "<h1>Storyboard Evaluasi Adaptif: " + (quiz.title || 'Tanpa Judul') + "</h1>" +
                  "<div class='meta'>Kode Kuis: <span class='code-tag'>" + (quiz.code || '-') + "</span></div>" +
                  "<div class='note'>Gunakan fitur cetak browser (<strong>Ctrl + P</strong> atau <strong>Cmd + P</strong>) lalu pilih opsi <strong>Simpan sebagai PDF</strong> untuk mengunduh dokumen ini.</div>" +
                  "</body></html>";

    return HtmlService.createHtmlOutput(htmlStr).getContent();
  } catch (err) {
    return "<html><body><h3>Gagal membuat Storyboard: " + err.message + "</h3></body></html>";
  }
}

function mintaIzinDriveFull() {
  DriveApp.createFile("tes_izin.txt", "Ini cuma tes pancingan izin");
}
