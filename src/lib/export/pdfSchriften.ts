import type { jsPDF } from 'jspdf';

export const SCHRIFT_TITEL = 'AlfaSlab';
export const SCHRIFT_TEXT = 'SourceSans';

const DATEIEN: { datei: string; name: string; stil: 'normal' | 'bold' }[] = [
  { datei: 'AlfaSlabOne-Regular.ttf', name: SCHRIFT_TITEL, stil: 'normal' },
  { datei: 'SourceSans3-Regular.ttf', name: SCHRIFT_TEXT, stil: 'normal' },
  { datei: 'SourceSans3-Bold.ttf', name: SCHRIFT_TEXT, stil: 'bold' },
];

const cache = new Map<string, string>();

function alsBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let text = '';
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(text);
}

/** TTF-Schriften (aus dem Offline-Speicher) laden und im PDF einbetten. */
export async function schriftenRegistrieren(doc: jsPDF): Promise<void> {
  for (const { datei, name, stil } of DATEIEN) {
    let base64 = cache.get(datei);
    if (!base64) {
      const antwort = await fetch(`${import.meta.env.BASE_URL}fonts/${datei}`);
      if (!antwort.ok) throw new Error(`Schrift ${datei} nicht ladbar`);
      base64 = alsBase64(await antwort.arrayBuffer());
      cache.set(datei, base64);
    }
    doc.addFileToVFS(datei, base64);
    doc.addFont(datei, name, stil);
  }
}
