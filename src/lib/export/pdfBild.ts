import { blobSicherLesen } from '../foto';

export interface PdfBild {
  dataUrl: string;
  breite: number;
  hoehe: number;
}

/** Foto für das PDF verkleinern (spart Dateigröße) und als JPEG-DataURL liefern. Fehlerhafte Fotos ergeben undefined. */
export async function bildFuerPdf(blob: Blob, maxKante: number): Promise<PdfBild | undefined> {
  try {
    const sicher = await blobSicherLesen(blob);
    const bitmap = await createImageBitmap(sicher);
    try {
      const skalierung = Math.min(1, maxKante / Math.max(bitmap.width, bitmap.height));
      const breite = Math.round(bitmap.width * skalierung);
      const hoehe = Math.round(bitmap.height * skalierung);
      const canvas = document.createElement('canvas');
      canvas.width = breite;
      canvas.height = hoehe;
      const ctx = canvas.getContext('2d');
      if (!ctx) return undefined;
      ctx.drawImage(bitmap, 0, 0, breite, hoehe);
      return { dataUrl: canvas.toDataURL('image/jpeg', 0.82), breite, hoehe };
    } finally {
      bitmap.close();
    }
  } catch (fehler) {
    console.error('Foto für PDF nicht lesbar, wird übersprungen', fehler);
    return undefined;
  }
}
