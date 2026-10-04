const MAX_KANTE = 1600;
const JPEG_QUALITAET = 0.8;
const VORSCHAU_KANTE = 320;
const VORSCHAU_QUALITAET = 0.7;

export interface FotoEntwurf {
  blob: Blob;
  vorschau: Blob;
  breite: number;
  hoehe: number;
}

async function alsJpeg(bitmap: ImageBitmap, maxKante: number, qualitaet: number): Promise<{ blob: Blob; breite: number; hoehe: number }> {
  const skalierung = Math.min(1, maxKante / Math.max(bitmap.width, bitmap.height));
  const breite = Math.round(bitmap.width * skalierung);
  const hoehe = Math.round(bitmap.height * skalierung);

  const canvas = document.createElement('canvas');
  canvas.width = breite;
  canvas.height = hoehe;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas-Kontext nicht verfügbar');
  ctx.drawImage(bitmap, 0, 0, breite, hoehe);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', qualitaet));
  if (!blob) throw new Error('Foto konnte nicht komprimiert werden');
  return { blob, breite, hoehe };
}

/** Foto sofort verkleinern (lange Kante max. 1600 px, JPEG 0,8) und eine kleine Vorschau für Listen erzeugen. */
export async function verarbeiteFoto(datei: File): Promise<FotoEntwurf> {
  // Ausrichtung aus den EXIF-Daten übernehmen, sonst stehen iPhone-Hochformatfotos auf der Seite
  const bitmap = await createImageBitmap(datei, { imageOrientation: 'from-image' });
  try {
    const gross = await alsJpeg(bitmap, MAX_KANTE, JPEG_QUALITAET);
    const klein = await alsJpeg(bitmap, VORSCHAU_KANTE, VORSCHAU_QUALITAET);
    return { blob: gross.blob, vorschau: klein.blob, breite: gross.breite, hoehe: gross.hoehe };
  } finally {
    bitmap.close();
  }
}

// Fotos aus der IndexedDB lassen sich in Safari/WebKit manchmal nicht lesen
// ("An error occured reading the Blob argument", "The object can not be found
// here."). Neuaufbau über arrayBuffer() mit ein paar Wiederholversuchen behebt
// das in den meisten Fällen.
export async function blobSicherLesen(blob: Blob, versuche = 3): Promise<Blob> {
  let letzterFehler: unknown;
  for (let i = 0; i < versuche; i++) {
    try {
      const buffer = await blob.arrayBuffer();
      return new Blob([buffer], { type: blob.type || 'image/jpeg' });
    } catch (fehler) {
      letzterFehler = fehler;
      if (i < versuche - 1) await new Promise((resolve) => setTimeout(resolve, 150 * (i + 1)));
    }
  }
  throw letzterFehler instanceof Error ? letzterFehler : new Error('Foto konnte nicht gelesen werden.');
}
