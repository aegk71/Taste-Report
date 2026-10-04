/** Wert auf 0,25 runden und auf 0..5 begrenzen. */
export function bewertungNormalisieren(wert: number): number {
  const geklemmt = Math.max(0, Math.min(5, wert));
  return Math.round(geklemmt * 4) / 4;
}

/** Deutsche Anzeige: ganze/halbe Werte mit einer, Viertel mit zwei Nachkommastellen (4,5 / 4,25 / 3,0). */
export function formatBewertung(wert: number): string {
  const gerundet = Math.round(wert * 100) / 100;
  const text = gerundet * 2 === Math.round(gerundet * 2) ? gerundet.toFixed(1) : gerundet.toFixed(2);
  return text.replace('.', ',');
}
