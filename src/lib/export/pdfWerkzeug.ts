import type { jsPDF } from 'jspdf';
import { formatBewertung } from '../bewertung';
import type { PdfBild } from './pdfBild';
import { SCHRIFT_TEXT } from './pdfSchriften';
import { bereinigeText } from './pdfText';
import { doldeZeichnen, FARBE, type Farbe } from './pdfZeichnen';

export const SEITE_B = 210;
export const SEITE_H = 297;
export const RAND = 15;
export const INNEN = SEITE_B - 2 * RAND;
export const INHALT_OBEN = 27;
export const INHALT_UNTEN = 278;
export const PT = 0.3528; // 1 pt in mm

/** Gemeinsame Zeichenhilfen für Bericht und Magazin (Schrift, Farbe, Text, Bilder ohne Zuschnitt, Dolde mit Wert). */
export function pdfWerkzeug(doc: jsPDF) {
  const farbeFuellen = (f: Farbe) => doc.setFillColor(...f);
  const farbeLinie = (f: Farbe) => doc.setDrawColor(...f);
  const farbeText = (f: Farbe) => doc.setTextColor(...f);
  const schrift = (name: string, stil: 'normal' | 'bold', pt: number) => {
    doc.setFont(name, stil);
    doc.setFontSize(pt);
  };
  const text = (s: string, x: number, y: number, ausrichtung: 'left' | 'center' | 'right' = 'left') =>
    doc.text(bereinigeText(s), x, y, { align: ausrichtung });
  const zeilen = (s: string, breite: number): string[] => doc.splitTextToSize(bereinigeText(s), breite) as string[];
  const hintergrund = (f: Farbe) => {
    farbeFuellen(f);
    doc.rect(0, 0, SEITE_B, SEITE_H, 'F');
  };

  /** Größe, mit der ein Bild ohne Zuschnitt in einen Rahmen passt (Hoch- und Querformat bleiben erhalten). */
  const passend = (bild: PdfBild, maxB: number, maxH: number) => {
    const skala = Math.min(maxB / bild.breite, maxH / bild.hoehe);
  return { b: bild.breite * skala, h: bild.hoehe * skala };
  };

  /** Ganzes Bild (object-fit: contain) im Rahmen maxB x maxH: mittig (mittig = true) oder oben links, mit Rundung und Rand. */
  const bildEinpassen = (bild: PdfBild, x: number, y: number, maxB: number, maxH: number, radius: number, mittig = false) => {
    const { b, h } = passend(bild, maxB, maxH);
    const bx = mittig ? x + (maxB - b) / 2 : x;
    const by = mittig ? y + (maxH - h) / 2 : y;
    doc.saveGraphicsState();
    doc.roundedRect(bx, by, b, h, radius, radius, null);
    doc.clip();
    doc.discardPath();
    doc.addImage(bild.dataUrl, 'JPEG', bx, by, b, h);
    doc.restoreGraphicsState();
    farbeLinie(FARBE.ink);
    doc.setLineWidth(0.5);
    doc.roundedRect(bx, by, b, h, radius, radius, 'S');
  };

  const platzhalter = (x: number, y: number, b: number, h: number, radius: number) => {
    farbeFuellen(FARBE.ocker);
    farbeLinie(FARBE.ink);
    doc.setLineWidth(0.5);
    doc.roundedRect(x, y, b, h, radius, radius, 'FD');
    const dh = Math.min(b, h) * 0.62;
    doldeZeichnen(doc, x + (b - (dh * 58.9) / 83.7) / 2, y + (h - dh) / 2, dh, 1, [196, 146, 52]);
  };

  /** Eine Dolde mit Zahl, rechtsbündig an xRechts. */
  const wertRechts = (wert: number | undefined, xRechts: number, yOben: number, doldeH: number, pt: number) => {
    schrift(SCHRIFT_TEXT, 'bold', pt);
    const zahl = wert === undefined ? '–' : formatBewertung(wert);
    farbeText(wert === undefined ? FARBE.muted : FARBE.ink);
    const w = doc.getTextWidth(zahl);
    text(zahl, xRechts, yOben + doldeH * 0.78, 'right');
    const dBreite = (doldeH * 58.9) / 83.7;
    doldeZeichnen(doc, xRechts - w - 1.6 - dBreite, yOben, doldeH, wert === undefined ? 0 : 1, FARBE.hop);
  };

  return { farbeFuellen, farbeLinie, farbeText, schrift, text, zeilen, hintergrund, passend, bildEinpassen, platzhalter, wertRechts };
}
