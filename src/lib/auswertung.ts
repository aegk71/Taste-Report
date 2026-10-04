// Auswertung eines Tastings. Reine Funktionen ohne Datenbankzugriff (testbar mit Node).
// Es zählen nur Getränke mit zustand = 'probiert' und gesetzter Bewertung; "nicht bewertet" (undefined) ist nicht 0.
import type { Getraenk, Hersteller, Tasting } from './model';

export function mittelwert(werte: (number | undefined)[]): number | undefined {
  const zahlen = werte.filter((w): w is number => w !== undefined);
  return zahlen.length > 0 ? zahlen.reduce((summe, w) => summe + w, 0) / zahlen.length : undefined;
}

export interface Platzierung {
  getraenk: Getraenk;
  /** Gleichstand = gleicher Platz (1, 1, 3) */
  platz: number;
}

export function istBewertet(g: Getraenk): boolean {
  return g.zustand === 'probiert' && g.bewertung !== undefined;
}

const fruehestensZuerst = (a: Getraenk, b: Getraenk) =>
  (a.probiertAm ?? a.erstelltAm).localeCompare(b.probiertAm ?? b.erstelltAm) || a.erstelltAm.localeCompare(b.erstelltAm);

/** Rangliste absteigend nach Bewertung, bei Gleichstand nach Zeitpunkt des Probierens. */
export function rangliste(getraenke: Getraenk[]): Platzierung[] {
  const sortiert = getraenke
    .filter(istBewertet)
    .sort((a, b) => (b.bewertung ?? 0) - (a.bewertung ?? 0) || fruehestensZuerst(a, b));
  return sortiert.map((getraenk, index) => {
    const erster = sortiert.findIndex((g) => g.bewertung === getraenk.bewertung);
    return { getraenk, platz: erster + 1 };
  });
}

export interface Sieger {
  getraenk: Getraenk;
  /** true, wenn das Bier von Hand gewählt wurde, false = automatisch das beste */
  gewaehlt: boolean;
}

/** "Bier des Festivals": manuell gewähltes Bier (falls noch bewertet), sonst das beste (bei Gleichstand das zuerst probierte). */
export function sieger(tasting: Pick<Tasting, 'siegerId'>, getraenke: Getraenk[]): Sieger | undefined {
  const liste = rangliste(getraenke);
  if (liste.length === 0) return undefined;
  const gewaehlt = tasting.siegerId ? liste.find((p) => p.getraenk.id === tasting.siegerId) : undefined;
  return gewaehlt ? { getraenk: gewaehlt.getraenk, gewaehlt: true } : { getraenk: liste[0].getraenk, gewaehlt: false };
}

export interface HerstellerWertung {
  hersteller: Hersteller;
  durchschnitt: number;
  /** Anzahl der bewerteten Getränke */
  anzahl: number;
}

/** Durchschnitt je Hersteller (nur bewertete Getränke), absteigend, bei Gleichstand alphabetisch. */
export function herstellerWertungen(hersteller: Hersteller[], getraenke: Getraenk[]): HerstellerWertung[] {
  return hersteller
    .map((h) => {
      const bewertete = getraenke.filter((g) => g.herstellerId === h.id && istBewertet(g));
      return { hersteller: h, durchschnitt: mittelwert(bewertete.map((g) => g.bewertung)), anzahl: bewertete.length };
    })
    .filter((w): w is HerstellerWertung => w.durchschnitt !== undefined)
    .sort((a, b) => b.durchschnitt - a.durchschnitt || a.hersteller.name.localeCompare(b.hersteller.name, 'de'));
}

export interface Kennzahlen {
  biere: number;
  hersteller: number;
  durchschnitt?: number;
}

export function kennzahlen(getraenke: Getraenk[]): Kennzahlen {
  const probiert = getraenke.filter((g) => g.zustand === 'probiert');
  return {
    biere: probiert.length,
    hersteller: new Set(probiert.map((g) => g.herstellerId)).size,
    durchschnitt: mittelwert(probiert.map((g) => g.bewertung)),
  };
}
