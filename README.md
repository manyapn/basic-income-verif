# Basic Income Verification Tool

A JavaScript tool that parses a PDF income document and determines whether the identified income is above $150,000.

## Run Locally

No build step or dependencies to install. Start a local server from the project root:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`. An internet connection is required since Bootstrap and PDF.js load from CDNs.

## Approach

**PDF parsing**

The app uses PDF.js to extract text from the uploaded file in the browser. It reads each page via `getTextContent()`, joins the text chunks into a single string, and passes that to the extraction logic. 

**Income extraction**

The tool searches for income-specific field labels in priority order: 
- Adjusted Gross Income
- Gross Income
- Total Income
- Annual Income
- Yearly Income
- Net Income
- Employment Income
- Taxable Income. 

When a label is found, it checks the 80 characters immediately after it for a dollar amount.

Generic income, revenue, and profit terms (income tax, income limit, gross receipts, net profit, business revenue) are excluded so ambiguous financial documents fall through to Unable to Determine rather than returning a potentially wrong value.

**Decision**

- Above $150,000: Verified
- $150,000 or below: Not Verified
- No income field identified: Unable to Determine

**Input validation**

The tool checks that a file is selected, is under 10 MB, has a PDF MIME type, and starts with the `%PDF-` magic bytes. Extracted text is written via `textContent` rather than `innerHTML` so content from a malicious PDF cannot inject markup.

## Assumptions

- The document is text-based, not a scanned image. PDF.js does not perform OCR.
- The income figure is labeled with a recognizable field name.
- Currency is USD.

## Limitations

- No OCR support. Scanned or image-only PDFs return Unable to Determine.
- The keyword list is fixed. Non-standard field names will not be matched.
