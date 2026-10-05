import type { jsPDF } from 'jspdf';
import type { PdfBild } from './pdfBild';
import { SCHRIFT_TEXT, SCHRIFT_TITEL } from './pdfSchriften';
import { PT, SEITE_B, SEITE_H, type pdfWerkzeug } from './pdfWerkzeug';
import { doldeZeichnen, doldenReihe, doldenReiheBreite, FARBE, wortmarkeZeichnen } from './pdfZeichnen';

export interface CoverInhalt {
  titel: string;
  untertitel?: string;
  /** Zeitraum und Ort in einer Zeile */
  zeile: string;
  /** z. B. „Verkostungsbericht von Alex“ */
  byline: string;
  durchschnitt?: number;
  bild?: PdfBild;
}

/** Titelseite im Etiketten-Look (gemeinsam für den Bericht und den Gruppenbericht): Seite 1 des Dokuments. */
export function coverSeiteZeichnen(doc: jsPDF, w: ReturnType<typeof pdfWerkzeug>, c: CoverInhalt) {
  const { farbeFuellen, farbeLinie, farbeText, schrift, text, zeilen, hintergrund, bildEinpassen } = w;
  hintergrund(FARBE.ocker);
  farbeLinie(FARBE.ink);
  doc.setLineWidth(1.4);
  doc.roundedRect(12, 12, SEITE_B - 24, SEITE_H - 24, 7, 7, 'S');

  const wb = 64;
  wortmarkeZeichnen(doc, (SEITE_B - wb) / 2, 24, wb, FARBE.ink);

  const bx = 50;
  const by = 62;
  const bs = 110;
  // Cover-Bild ungeschnitten: Hochformat bis 110 mm hoch, Querformat bis 130 mm breit
  if (c.bild) bildEinpassen(c.bild, (SEITE_B - 130) / 2, by, 130, bs, 5, true);
  else {
    farbeFuellen(FARBE.papier);
    farbeLinie(FARBE.ink);
    doc.setLineWidth(0.5);
    doc.roundedRect(bx, by, bs, bs, 5, 5, 'FD');
    const dh = 72;
    doldeZeichnen(doc, bx + (bs - (dh * 58.9) / 83.7) / 2, by + (bs - dh) / 2, dh, 1, [236, 200, 120]);
  }

  let pt = 30;
  schrift(SCHRIFT_TITEL, 'normal', pt);
  let titel = zeilen(c.titel, 164);
  while (titel.length > 3 && pt > 20) {
    pt -= 2;
    schrift(SCHRIFT_TITEL, 'normal', pt);
    titel = zeilen(c.titel, 164);
  }
  const lh = pt * PT * 1.12;
  let y = by + bs + 17;
  for (const zeile of titel) {
    farbeText(FARBE.ink);
    text(zeile, SEITE_B / 2 + 0.6, y + 0.6, 'center');
    farbeText(FARBE.rot);
    text(zeile, SEITE_B / 2, y, 'center');
    y += lh;
  }
  farbeText(FARBE.ink);
  if (c.untertitel) {
    schrift(SCHRIFT_TEXT, 'bold', 14);
    for (const zeile of zeilen(c.untertitel, 160)) {
      text(zeile, SEITE_B / 2, y + 1, 'center');
      y += 6.2;
    }
  }
  schrift(SCHRIFT_TEXT, 'bold', 12.5);
  text(c.zeile, SEITE_B / 2, y + 2.5, 'center');

  farbeLinie(FARBE.ink);
  doc.setLineWidth(0.8);
  doc.line(26, 255, SEITE_B - 26, 255);
  schrift(SCHRIFT_TEXT, 'bold', 12);
  text(c.byline, SEITE_B / 2, 263, 'center');
  if (c.durchschnitt !== undefined) {
    const dH = 7.5;
    const gesamt = doldenReiheBreite(dH);
    doldenReihe(doc, (SEITE_B - gesamt) / 2, 267, dH, c.durchschnitt, FARBE.hop, [236, 200, 120]);
  }
}
