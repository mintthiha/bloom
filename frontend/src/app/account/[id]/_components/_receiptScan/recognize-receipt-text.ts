/** Canadian receipts are printed in English, French, or both. */
const RECEIPT_LANGUAGES = ["eng", "fra"];

/**
 * Reads the text off a receipt image, entirely in the browser — the image is never uploaded.
 * The recognition engine is loaded on first use (it is several megabytes, so it stays out of the
 * main bundle) and reports its progress as a fraction from 0 to 1 while it reads.
 */
export async function recognizeReceiptText(
  image: HTMLCanvasElement,
  onProgress: (progressFraction: number) => void
): Promise<string> {
  const { createWorker, PSM } = await import("tesseract.js");
  const worker = await createWorker(RECEIPT_LANGUAGES, undefined, {
    logger: (message) => {
      if (message.status === "recognizing text") onProgress(message.progress);
    },
  });
  try {
    // Read the receipt as one block, line by line. The default layout analysis tends to split a
    // receipt into a column of names and a column of prices, separating each item from its price.
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK });
    const { data } = await worker.recognize(image);
    return data.text;
  } finally {
    await worker.terminate();
  }
}
