// Reine Funktionen ohne Laufzeit-Importe (testbar mit Node); Texte kommen von außen.
import type { Getraenk, Hersteller, Tasting } from '../model';

export interface ExcelTexte {
  probiert: string;
  vorgemerkt: string;
  tasting: string;
  untertitel: string;
  datum: string;
  ort: string;
  verkoster: string;
}

const datumDeutsch = (iso: string) => iso.split('-').reverse().join('.');

export interface ExcelZeile {
  hersteller: string;
  standort: string;
  name: string;
  stil: string;
  bewertung?: number;
  abv?: number;
  menge?: number;
  preis?: number;
  notiz: string;
  zustand: string;
  /** ISO-Datum (JJJJ-MM-TT) oder leer */
  probiertAm: string;
}

const nachName = (a: string, b: string) => a.localeCompare(b, 'de', { numeric: true, sensitivity: 'base' });

/** Alle Getränke (auch vorgemerkte) flach: Hersteller alphabetisch, darin Erfassungsreihenfolge. */
export function excelZeilen(hersteller: Hersteller[], getraenke: Getraenk[], t: Pick<ExcelTexte, 'probiert' | 'vorgemerkt'>): ExcelZeile[] {
  const herstellerVon = new Map(hersteller.map((h) => [h.id, h]));
  return [...getraenke]
    .sort((a, b) => nachName(herstellerVon.get(a.herstellerId)?.name ?? '', herstellerVon.get(b.herstellerId)?.name ?? '') || a.erstelltAm.localeCompare(b.erstelltAm))
    .map((g) => {
      const h = herstellerVon.get(g.herstellerId);
      return {
        hersteller: h?.name ?? '',
        standort: h?.standort ?? '',
        name: g.name,
        stil: g.stilName ?? '',
        bewertung: g.bewertung,
        abv: g.abv,
        menge: g.menge,
        preis: g.preis,
        notiz: g.notiz ?? '',
        zustand: g.zustand === 'probiert' ? t.probiert : t.vorgemerkt,
        probiertAm: g.probiertAm?.slice(0, 10) ?? '',
      };
    });
}

/** Kopfbereich über der Tabelle: Beschriftung + Wert (leere Felder entfallen). */
export function excelKopf(tasting: Tasting, t: ExcelTexte): [string, string][] {
  const felder: [string, string | undefined][] = [
    [t.tasting, tasting.name],
    [t.untertitel, tasting.untertitel],
    [t.datum, tasting.datumBis && tasting.datumBis !== tasting.datumVon ? `${datumDeutsch(tasting.datumVon)} – ${datumDeutsch(tasting.datumBis)}` : datumDeutsch(tasting.datumVon)],
    [t.ort, tasting.ort],
    [t.verkoster, tasting.verkoster],
  ];
  return felder.filter((f): f is [string, string] => !!f[1]?.trim());
}

