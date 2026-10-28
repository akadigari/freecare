// Reads the text off a photo of a bill, on the device. The recognizer (tesseract.js) and its
// English model are the page's own files; they load only when someone picks a photo, and the
// photo never leaves the browser.

const here = (path) => new URL(path, import.meta.url).href;

export const OCR_FILES = Object.freeze({
  module: '../vendor/tesseract/tesseract.esm.min.js',
  worker: here('../vendor/tesseract/worker.min.js'),
  core: here('../vendor/tesseract/'),
  lang: here('../vendor/tesseract/lang'),
});

// Returns the recognized text. `onProgress` gets a number from 0 to 1 while it works.
export async function readBillImage(file, { onProgress = () => {} } = {}) {
  // The ESM build puts everything on its default export.
  const { createWorker } = (await import('../vendor/tesseract/tesseract.esm.min.js')).default;
  const worker = await createWorker('eng', 1, {
    workerPath: OCR_FILES.worker,
    corePath: OCR_FILES.core,
    langPath: OCR_FILES.lang,
    gzip: true,
    legacyCore: false,
    legacyLang: false,
    workerBlobURL: false,
    logger: (m) => { if (m.status === 'recognizing text') onProgress(m.progress); },
  });
  try {
    const { data } = await worker.recognize(file);
    return data.text;
  } finally {
    await worker.terminate();
  }
}
