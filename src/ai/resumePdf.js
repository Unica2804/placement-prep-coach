// Resume PDF intake: PDF.js text layer first, Tesseract.js OCR fallback for scans.
// Pure routing helpers are unit-tested; CDN library calls happen only in-browser.
export const OCR_CHAR_FLOOR = 100;

export function needsOcr(text) {
  return String(text || "").trim().length < OCR_CHAR_FLOOR;
}

export function joinPages(pages) {
  return pages.map((p) => String(p || "").replace(/[ \t]+\n/g, "\n")).join("\n").trim();
}

export async function extractPdfTextLayer(file, onProgress = () => {}) {
  const pdfjs = await import(
    "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs"
  );
  pdfjs.GlobalWorkerOptions.workerSrc =
    "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs";
  const buf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buf }).promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    pages.push(tc.items.map((it) => it.str).join(" "));
    onProgress({ phase: "text", page: i, of: pdf.numPages });
  }
  return { text: joinPages(pages), pages: pdf.numPages, method: "text" };
}

export async function ocrPdfPages(file, onProgress = () => {}) {
  const pdfjs = await import(
    "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs"
  );
  pdfjs.GlobalWorkerOptions.workerSrc =
    "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs";
  const Tesseract = (
    await import("https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.esm.min.js")
  ).default;
  const buf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buf }).promise;
  const worker = await Tesseract.createWorker("eng");
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width; canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
    const { data } = await worker.recognize(canvas);
    pages.push(data.text);
    onProgress({ phase: "ocr", page: i, of: pdf.numPages });
  }
  await worker.terminate();
  return { text: joinPages(pages), pages: pdf.numPages, method: "ocr" };
}

// Full intake: text layer → OCR fallback when the layer is empty (scanned PDF).
export async function intakeResumePdf(file, onProgress = () => {}) {
  if (!/pdf$/i.test(file.type) && !/\.pdf$/i.test(file.name)) {
    throw new Error("not a PDF — paste text instead");
  }
  const layered = await extractPdfTextLayer(file, onProgress);
  if (!needsOcr(layered.text)) return layered;
  return ocrPdfPages(file, onProgress);
}
