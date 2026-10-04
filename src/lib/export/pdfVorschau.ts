import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

/**
 * Die Seiten eines PDFs als Bilder rendern. Nötig, weil die installierte iOS-PWA (WKWebView)
 * in einem <iframe> nur Seite 1 eines PDFs zeigt.
 */
export async function pdfSeitenRendern(
  blob: Blob,
  onSeite: (bildDataUrl: string, seitenNr: number, seitenAnzahl: number) => void,
): Promise<void> {
  const buffer = await blob.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: buffer }).promise;

  for (let i = 1; i <= doc.numPages; i++) {
    const seite = await doc.getPage(i);
    const viewport = seite.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;
    await seite.render({ canvas, canvasContext: ctx, viewport }).promise;
    onSeite(canvas.toDataURL('image/jpeg', 0.85), i, doc.numPages);
  }
}
