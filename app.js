pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const fileInput    = document.getElementById('pdf-file');
const analyzeBtn   = document.getElementById('analyze-btn');
const clearBtn     = document.getElementById('clear-btn');
const statusArea   = document.getElementById('status-area');
const statusText   = document.getElementById('status-text');
const resultPanel  = document.getElementById('result-panel');
const resultTitle  = document.getElementById('result-title');
const resultBody   = document.getElementById('result-body');
const valueUsed    = document.getElementById('value-used');
const matchedField = document.getElementById('matched-field');

// Priority-ordered income field labels, with more specific terms ranked higher.
const INCOME_FIELDS = [
  'adjusted gross income',
  'gross income',
  'total income',
  'annual income',
  'yearly income',
  'net income',
  'employment income',
  'taxable income',
];

// Money regex to strip unneeded chars
const MONEY_RE = /\$?\s*([\d,]+(?:\.\d{1,2})?)/;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const RESULT_MAP = {
  verified: {
    cls:   'is-verified',
    title: 'Verified',
    body:  'Income is above $150,000.',
  },
  'not-verified': {
    cls:   'is-not-verified',
    title: 'Not Verified',
    body:  'Income is $150,000 or below.',
  },
  undetermined: {
    cls:   'is-undetermined',
    title: 'Unable to Determine',
    body:  'Could not confidently identify an income figure in this document.',
  },
};

analyzeBtn.addEventListener('click', handleAnalyze);
clearBtn.addEventListener('click', handleClear);
fileInput.addEventListener('change', onFileChange);

async function handleAnalyze() {
  const file = fileInput.files[0];

  if (!file) {
    reveal(statusArea);
    setStatus('Please select a PDF file first.');
    return;
  }
  if (file.size > MAX_FILE_SIZE) {
    reveal(statusArea);
    setStatus('File is too large. Please upload a PDF under 10 MB.');
    return;
  }
  // accounts for empty MIME type
  const hasPdfMimeType = file.type === 'application/pdf';
  const hasPdfExtension = file.name.toLowerCase().endsWith('.pdf');
  if (file.type && !hasPdfMimeType && !hasPdfExtension) {
    reveal(statusArea);
    setStatus('File must be a PDF.');
    return;
  }

  // All valid PDFs start with the magic bytes %PDF-.
  const headerSlice = await file.slice(0, 5).arrayBuffer();
  const header = String.fromCharCode(...new Uint8Array(headerSlice));
  if (!header.startsWith('%PDF-')) {
    reveal(statusArea);
    setStatus('File does not appear to be a valid PDF.');
    return;
  }

  analyzeBtn.disabled = true;
  reveal(statusArea);
  setStatus('Analyzing PDF…');

  try {
    const arrayBuffer = await file.arrayBuffer();
    const fullText = await extractText(arrayBuffer);
    const incomeResult = findIncome(fullText);
    const decision = decide(incomeResult);
    showResult(decision);
    setStatus('Analysis complete.');
  } catch {
    showResult({ verdict: 'undetermined' });
    setStatus('Could not parse the PDF. The file may be corrupted or encrypted.');
  } finally {
    analyzeBtn.disabled = false;
  }
}

async function extractText(arrayBuffer) {
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    fullText += content.items.map(item => item.str).join(' ') + '\n';
  }
  return fullText;
}

function findIncome(text) {
  const lower = text.toLowerCase();

  // search income field terms in priority order
  for (const field of INCOME_FIELDS) {
    let searchFrom = 0;

    // searches for all occurences of term in text
    while (searchFrom < lower.length) {
      const idx = lower.indexOf(field, searchFrom);
      if (idx === -1) break;

      // Look at the 80 characters immediately after the matched label.
      const windowStart = idx + field.length;
      const nearby = text.slice(windowStart, windowStart + 80);
      const match = nearby.match(MONEY_RE);

      if (match) {
        const amount = parseFloat(match[1].replace(/,/g, ''));
        if (!isNaN(amount) && amount > 0) {
          return {
            amount,
            rawValue:  match[0].trim(),
            fieldName: toTitleCase(field),
          };
        }
      }

      searchFrom = windowStart;
    }
  }

  return null;
}

function decide(result) {
  if (!result) return { verdict: 'undetermined' };
  if (result.amount > 150000) return { verdict: 'verified', ...result };
  return { verdict: 'not-verified', ...result };
}

function showResult({ verdict, rawValue, fieldName }) {
  const { cls, title, body } = RESULT_MAP[verdict];

  resultPanel.classList.remove('is-verified', 'is-not-verified', 'is-undetermined');
  resultPanel.classList.add(cls);
  reveal(resultPanel);

  resultTitle.textContent = title;
  resultBody.textContent  = body;
  // textContent is intentional, so extracted PDF text cannot inject markup into the page.
  valueUsed.textContent    = rawValue   ?? 'Not available';
  matchedField.textContent = fieldName  ?? 'Not available';
}

function onFileChange() {
  // Hide stale result when a new file is selected.
  hide(resultPanel);
  resetResultContent();
}

function handleClear() {
  fileInput.value = '';
  hide(statusArea);
  hide(resultPanel);
  resetResultContent();
}

function resetResultContent() {
  resultPanel.classList.remove('is-verified', 'is-not-verified');
  resultPanel.classList.add('is-undetermined');
  resultTitle.textContent  = 'Awaiting PDF';
  resultBody.textContent   = 'Upload and analyze a PDF to see the result.';
  valueUsed.textContent    = 'Not available';
  matchedField.textContent = 'Not available';
}

function setStatus(message) {
  statusText.textContent = message;
}

function reveal(el) { el.classList.remove('d-none'); }
function hide(el)   { el.classList.add('d-none'); }

function toTitleCase(str) {
  return str.replace(/\b\w/g, c => c.toUpperCase());
}
