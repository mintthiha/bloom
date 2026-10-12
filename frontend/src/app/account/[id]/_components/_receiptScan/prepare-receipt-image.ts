/** Receipt text is read across the short edge, so this is what keeps small print legible. */
const MAX_SHORT_EDGE_PIXELS = 1500;
/** Receipts are tall, so the long edge gets far more room before it forces a downscale. */
const MAX_LONG_EDGE_PIXELS = 4000;

/**
 * Works out how much to shrink a photo before text recognition. A phone photo is several times
 * larger than recognition needs, and running it at full size is slow and memory-hungry in the
 * browser. Returns a factor between 0 and 1; images already within both limits are left alone.
 */
export function calculateReceiptImageScale(width: number, height: number): number {
  const shortEdge = Math.min(width, height);
  const longEdge = Math.max(width, height);
  if (shortEdge <= 0) return 1;
  return Math.min(1, MAX_SHORT_EDGE_PIXELS / shortEdge, MAX_LONG_EDGE_PIXELS / longEdge);
}

/**
 * Decodes a receipt photo and draws it onto a canvas at a size suited to text recognition.
 * Rejects when the browser can't decode the file (not an image, or a format it doesn't support).
 */
export async function prepareReceiptImage(imageFile: File): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(imageFile);
  try {
    const scale = calculateReceiptImageScale(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser can't process images");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    bitmap.close();
  }
}
