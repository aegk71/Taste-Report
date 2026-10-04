import { formatBewertung } from '../bewertung';
import type { Getraenk } from '../model';

// Codepunkte, die in allen eingebetteten PDF-Schriften vorhanden sind (Alfa Slab One, Source Sans 3, Subset "latin").
const ERLAUBT: [number, number][] = [
  [0x20, 0x7e], [0xa0, 0xff], [0x131, 0x131], [0x152, 0x153], [0x2bb, 0x2bc], [0x2c6, 0x2c6], [0x2da, 0x2da],
  [0x2dc, 0x2dc], [0x2009, 0x2009], [0x2013, 0x2014], [0x2018, 0x201a], [0x201c, 0x201e], [0x2022, 0x2022],
  [0x2026, 0x2026], [0x2032, 0x2033], [0x2039, 0x203a], [0x20ac, 0x20ac], [0x2122, 0x2122], [0x2212, 0x2212],
];

const istErlaubt = (code: number) => ERLAUBT.some(([von, bis]) => code >= von && code <= bis);

/**
 * Entfernt Zeichen, die die PDF-Schriften nicht kennen (Emoji, kyrillisch, …). Zeichen mit Akzent
 * werden auf den Grundbuchstaben zurückgeführt (ž → z), Zeilenumbrüche bleiben erhalten.
 */
export function bereinigeText(text: string): string {
  let ergebnis = '';
  for (const zeichen of text.replace(/\r\n?/g, '\n')) {
    const code = zeichen.codePointAt(0)!;
    if (zeichen === '\n' || istErlaubt(code)) {
      ergebnis += zeichen;
      continue;
    }
    const basis = zeichen.normalize('NFD')[0];
    if (basis && istErlaubt(basis.codePointAt(0)!)) ergebnis += basis;
  }
  return ergebnis;
}

const komma = (zahl: number, stellen?: number) =>
  (stellen === undefined ? String(zahl) : zahl.toFixed(stellen)).replace('.', ',');

/** "5,2 % Vol. · 0,4 L · 4,50 €" (nur die vorhandenen Angaben) */
export function metaZeile(g: Pick<Getraenk, 'abv' | 'menge' | 'preis'>): string {
  return [
    g.abv !== undefined ? `${komma(g.abv)} % Vol.` : undefined,
    g.menge !== undefined ? `${komma(g.menge)} L` : undefined,
    g.preis !== undefined ? `${komma(g.preis, 2)} €` : undefined,
  ]
    .filter(Boolean)
    .join(' · ');
}

export { formatBewertung };
