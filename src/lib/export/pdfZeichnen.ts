import type { jsPDF } from 'jspdf';
import pfade from '../../assets/dolde-pfade.json';

export type Farbe = [number, number, number];

export const FARBE = {
  papier: [245, 232, 196] as Farbe,
  karte: [255, 249, 232] as Farbe,
  ink: [43, 29, 20] as Farbe,
  muted: [122, 102, 80] as Farbe,
  linie: [220, 200, 150] as Farbe,
  hop: [95, 127, 37] as Farbe,
  hopSoft: [221, 230, 184] as Farbe,
  rot: [201, 58, 34] as Farbe,
  ocker: [228, 174, 69] as Farbe,
  leer: [226, 212, 172] as Farbe,
};

const DOLDE_B = pfade.coneW;
const DOLDE_H = pfade.coneH;
const WORT_B = 220.446;
const WORT_H = 99.213;

type Befehl = ['M' | 'L', number, number] | ['C', number, number, number, number, number, number] | ['Z'];

function parse(d: string): Befehl[] {
  const befehle: Befehl[] = [];
  for (const [, art, rest] of d.matchAll(/([MLCZ])([^MLCZ]*)/g)) {
    const zahlen = (rest.match(/-?\d*\.?\d+/g) ?? []).map(Number);
    if (art === 'Z') befehle.push(['Z']);
    else if (art === 'C') befehle.push(['C', ...(zahlen as [number, number, number, number, number, number])]);
    else befehle.push([art as 'M' | 'L', zahlen[0], zahlen[1]]);
  }
  return befehle;
}

const doldeBefehle = parse(pfade.cone.join(' '));
const wortBefehle = parse(pfade.word.join(' '));

function pfadFuellen(doc: jsPDF, befehle: Befehl[], x: number, y: number, s: number): void {
  for (const b of befehle) {
    if (b[0] === 'M') doc.moveTo(x + b[1] * s, y + b[2] * s);
    else if (b[0] === 'L') doc.lineTo(x + b[1] * s, y + b[2] * s);
    else if (b[0] === 'C')
      doc.curveTo(x + b[1] * s, y + b[2] * s, x + b[3] * s, y + b[4] * s, x + b[5] * s, y + b[6] * s);
    else doc.close();
  }
  doc.fill();
}

export const doldeBreite = (hoehe: number) => (hoehe * DOLDE_B) / DOLDE_H;

/** Hopfendolde als Vektor. fuellung 0..1 füllt von links, der Rest erscheint blass. */
export function doldeZeichnen(doc: jsPDF, x: number, y: number, hoehe: number, fuellung: number, farbe: Farbe, leerFarbe: Farbe = FARBE.leer): void {
  const s = hoehe / DOLDE_H;
  const f = Math.max(0, Math.min(1, fuellung));
  if (f < 1) {
    doc.setFillColor(...leerFarbe);
    pfadFuellen(doc, doldeBefehle, x, y, s);
  }
  if (f <= 0) return;
  doc.setFillColor(...farbe);
  if (f >= 1) {
    pfadFuellen(doc, doldeBefehle, x, y, s);
    return;
  }
  doc.saveGraphicsState();
  doc.rect(x, y, doldeBreite(hoehe) * f, hoehe, null);
  doc.clip();
  doc.discardPath();
  pfadFuellen(doc, doldeBefehle, x, y, s);
  doc.restoreGraphicsState();
}

/** Fünf Dolden mit Viertelfüllung für einen Wert 0..5. Gibt die belegte Breite zurück. */
export function doldenReihe(doc: jsPDF, x: number, y: number, hoehe: number, wert: number | undefined, farbe: Farbe = FARBE.hop, leerFarbe: Farbe = FARBE.leer): number {
  const breite = doldeBreite(hoehe);
  const abstand = breite * 0.22;
  for (let i = 0; i < 5; i++) {
    const fuellung = wert === undefined ? 0 : Math.max(0, Math.min(1, wert - i));
    doldeZeichnen(doc, x + i * (breite + abstand), y, hoehe, fuellung, farbe, leerFarbe);
  }
  return 5 * breite + 4 * abstand;
}

export const doldenReiheBreite = (hoehe: number) => 5 * doldeBreite(hoehe) + 4 * doldeBreite(hoehe) * 0.22;

/** Wortmarke BRAU KRU mit Dolde im U (einfarbig). */
export function wortmarkeZeichnen(doc: jsPDF, x: number, y: number, breite: number, farbe: Farbe): void {
  const s = breite / WORT_B;
  doc.setFillColor(...farbe);
  pfadFuellen(doc, wortBefehle, x, y, s);
  pfadFuellen(doc, doldeBefehle, x + 144.8 * s, y, s);
}

export const wortmarkeHoehe = (breite: number) => (breite * WORT_H) / WORT_B;
