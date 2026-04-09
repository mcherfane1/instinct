/**
 * Text extraction service (PRD §7.2.1).
 *
 * Supported file types:
 *   Documents:    .docx, .doc, .txt, .md
 *   PDFs:         .pdf (text-extractable + scanned → OCR stub)
 *   Spreadsheets: .xlsx, .xlsm, .csv
 *   PowerPoints:  .pptx (OCR stub for scanned)
 *
 * OCR (PRD §7.2.4):
 *   Phase 1: OCR is stubbed. Files that return < 100 chars of native text
 *            are flagged as requiring OCR, and their ingestion_status is
 *            set to 'Failed - OCR Error' with a note. This preserves the
 *            PRD's decision boundary while deferring Azure Document Intelligence
 *            integration to Phase 3.
 *
 * Max file size: 50 MB (PRD §7.2.1). Enforced by multer in the route.
 */

const fs      = require('fs');
const path    = require('path');
const mammoth = require('mammoth');
const XLSX    = require('exceljs');

// Threshold below which we consider native extraction insufficient (PRD §7.2.4)
const OCR_CHAR_THRESHOLD = 100;

/**
 * Extract plain text from a file.
 *
 * @param {string} filePath — absolute path to the uploaded file
 * @param {string} fileFormat — 'PDF' | 'DOCX' | 'XLSX' | 'TXT' | 'CSV' | 'PPTX' | 'MD' | 'Other'
 * @returns {Promise<{text: string, ocrRequired: boolean, ocrApplied: boolean}>}
 */
async function extractText(filePath, fileFormat) {
  const format = (fileFormat || '').toUpperCase();

  switch (format) {
    case 'TXT':
    case 'MD':
      return { text: fs.readFileSync(filePath, 'utf-8'), ocrRequired: false, ocrApplied: false };

    case 'DOCX':
    case 'DOC':
      return extractDocx(filePath);

    case 'PDF':
      return extractPdf(filePath);

    case 'XLSX':
    case 'XLSM':
      return extractXlsx(filePath);

    case 'CSV':
      return { text: fs.readFileSync(filePath, 'utf-8'), ocrRequired: false, ocrApplied: false };

    case 'PPTX':
      return extractPptxStub(filePath);

    default:
      throw Object.assign(
        new Error(`Unsupported file format: ${fileFormat}`),
        { status: 415 }
      );
  }
}

async function extractDocx(filePath) {
  const result = await mammoth.extractRawText({ path: filePath });
  return { text: result.value, ocrRequired: false, ocrApplied: false };
}

async function extractPdf(filePath) {
  // Dynamic require: pdf-parse has side effects on require at module load time
  // that break tests. Lazy-load to avoid this.
  let pdfParse;
  try {
    pdfParse = require('pdf-parse');
  } catch {
    throw new Error('pdf-parse is not installed. Run: npm install --workspace=server');
  }

  const buffer = fs.readFileSync(filePath);
  const data   = await pdfParse(buffer);
  const text   = data.text || '';

  if (text.trim().length < OCR_CHAR_THRESHOLD && buffer.length > 1000) {
    // Scanned PDF — OCR required
    // PHASE 3: Call Azure Document Intelligence here
    console.warn('[TextExtractor] Scanned PDF detected — OCR stub active. File will be flagged.');
    return {
      text:        '',
      ocrRequired: true,
      ocrApplied:  false,
    };
  }

  return { text, ocrRequired: false, ocrApplied: false };
}

async function extractXlsx(filePath) {
  const workbook = new XLSX.Workbook();
  await workbook.xlsx.readFile(filePath);

  const lines = [];
  workbook.eachSheet(sheet => {
    lines.push(`=== Sheet: ${sheet.name} ===`);
    sheet.eachRow(row => {
      const cells = [];
      row.eachCell({ includeEmpty: false }, cell => {
        cells.push(String(cell.value ?? '').trim());
      });
      if (cells.length > 0) lines.push(cells.join(' | '));
    });
  });

  return { text: lines.join('\n'), ocrRequired: false, ocrApplied: false };
}

function extractPptxStub(filePath) {
  // PHASE 3: Use Azure Document Intelligence for PPTX text extraction
  console.warn('[TextExtractor] PPTX extraction is stubbed in Phase 1.');
  return {
    text:        '',
    ocrRequired: true,
    ocrApplied:  false,
  };
}

/**
 * Determine file format from extension.
 */
function detectFormat(filename) {
  const ext = path.extname(filename || '').toLowerCase().replace('.', '');
  const MAP = {
    pdf: 'PDF', docx: 'DOCX', doc: 'DOCX',
    txt: 'TXT', md: 'MD', xlsx: 'XLSX',
    xlsm: 'XLSX', csv: 'CSV', pptx: 'PPTX',
  };
  return MAP[ext] || 'Other';
}

module.exports = { extractText, detectFormat, OCR_CHAR_THRESHOLD };
