// Excel-Datenliste des Gruppen-Vergleichs: reine Funktionen ohne Laufzeit-Importe (testbar mit Node); Texte kommen von außen.
import type { Tasting } from '../model';
import type { HerstellerGruppe } from '../vergleich';

export interface GruppeExcelTexte {
  vergleich: string;
  verkoster: string;
  datum: string;
  ort: string;
  hersteller: string;
  standort: string;
  getraenk: string;
  stil: string;
  durchschnitt: string;
  anzahl: string;
  notiz: (verkoster: string) => string;
}

export interface GruppeZeile {
  hersteller: string;
  standort: string;
  name: string;
  stil: string;
  durchschnitt?: number;
  /** Anzahl der Verkoster, die das Bier bewertet haben */
  anzahl: number;
  /** je Verkoster in der Reihenfolge des Vergleichs; undefined = nicht probiert oder nicht bewertet */
  werte: (number | undefined)[];
  notizen: string[];
}

/** Eine Zeile je Bier (Hersteller alphabetisch), je Verkoster Bewertung und Notiz. */
export function gruppeZeilen(gruppen: HerstellerGruppe[], tastingIds: string[]): GruppeZeile[] {
  return gruppen.flatMap((g) =>
    g.biere.map((b) => {
      const eintrag = (tastingId: string) => b.eintraege.find((e) => e.tastingId === tastingId);
      return {
        hersteller: g.name,
        standort: g.standort ?? '',
        name: b.name,
        stil: b.stil ?? '',
        durchschnitt: b.durchschnitt,
        anzahl: b.anzahl,
        werte: tastingIds.map((id) => eintrag(id)?.bewertung),
        notizen: tastingIds.map((id) => eintrag(id)?.getraenk.notiz?.trim() ?? ''),
      };
    }),
  );
}

/** Spaltenüberschriften: feste Spalten, dann je Verkoster die Bewertung, dann je Verkoster die Notiz. */
export function gruppeSpalten(verkoster: string[], t: GruppeExcelTexte): string[] {
  return [t.hersteller, t.standort, t.getraenk, t.stil, t.durchschnitt, t.anzahl, ...verkoster, ...verkoster.map((v) => t.notiz(v))];
}

const datumDeutsch = (iso: string) => iso.split('-').reverse().join('.');

/** Kopfbereich: Vergleich, Verkoster, Datum und Ort des ersten Tastings (leere Felder entfallen). */
export function gruppeKopf(name: string, verkoster: string[], erstes: Pick<Tasting, 'datumVon' | 'datumBis' | 'ort'> | undefined, t: GruppeExcelTexte): [string, string][] {
  const felder: [string, string | undefined][] = [
    [t.vergleich, name],
    [t.verkoster, verkoster.join(', ')],
    [t.datum, erstes ? (erstes.datumBis && erstes.datumBis !== erstes.datumVon ? `${datumDeutsch(erstes.datumVon)} – ${datumDeutsch(erstes.datumBis)}` : datumDeutsch(erstes.datumVon)) : undefined],
    [t.ort, erstes?.ort],
  ];
  return felder.filter((f): f is [string, string] => !!f[1]?.trim());
}
