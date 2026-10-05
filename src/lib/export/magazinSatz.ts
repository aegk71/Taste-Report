// Spaltensatz für das Magazin: verteilt Zeilen (Höhen in mm) auf zwei Spalten einer Seite.
// Reine Funktion ohne Importe (testbar mit Node).

export interface Aufteilung {
  /** wie viele der Elemente auf diese Seite kommen */
  anzahl: number;
  /** wie viele davon in die linke Spalte (der Rest rechts) */
  links: number;
}

const summe = (h: number[], von: number, bis: number) => h.slice(von, bis).reduce((s, x) => s + x, 0);

/**
 * Passt möglichst viele Elemente in zwei Spalten der Höhe `platz`. Kommt alles auf die Seite, werden die Spalten
 * ausgeglichen (gleich hoch), sonst wird die linke Spalte gefüllt. anzahl = 0, wenn schon das erste Element nicht passt.
 */
export function seiteAufteilen(hoehen: number[], platz: number): Aufteilung {
  for (let n = hoehen.length; n >= 1; n--) {
    let beste: number | null = null;
    let bestesMass = Infinity;
    for (let k = 0; k <= n; k++) {
      const links = summe(hoehen, 0, k);
      const rechts = summe(hoehen, k, n);
      if (links > platz + 1e-9 || rechts > platz + 1e-9) continue;
      // alles passt: ausgleichen, sonst die linke Spalte so voll wie möglich
      const mass = n === hoehen.length ? Math.max(links, rechts) : -links;
      if (mass < bestesMass) {
        bestesMass = mass;
        beste = k;
      }
    }
    if (beste !== null) return { anzahl: n, links: beste };
  }
  return { anzahl: 0, links: 0 };
}
