/**
 * Hands the browser a generated text file as a download, cleaning up the temporary
 * blob URL afterwards. Shared by every "export my data" button so they all produce
 * the same download behaviour.
 */
export function downloadTextFile(filename: string, contents: string, mimeType: string): void {
  const blob = new Blob([contents], { type: `${mimeType};charset=utf-8;` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
