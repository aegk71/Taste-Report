import { mittelwert } from './auswertung';
import { db } from './db';
import { bewertungNormalisieren } from './bewertung';
import type { Getraenk, Hersteller, Stil, Zustand } from './model';

export interface GetraenkEingabe {
  tastingId: string;
  herstellerName: string;
  herstellerStandort: string;
  name: string;
  zustand: Zustand;
  stilId?: string;
  bewertung?: number;
  notiz: string;
  abv?: number;
  menge?: number;
  preis?: number;
}

export interface Gruppe {
  hersteller: Hersteller;
  getraenke: Getraenk[];
  /** Mittel der bewerteten Getränke; undefined ohne Bewertung */
  durchschnitt?: number;
}

const normal = (text: string) => text.trim().toLocaleLowerCase('de');
const nachName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, 'de', { numeric: true, sensitivity: 'base' });
const nachErfassung = (a: Getraenk, b: Getraenk) => a.erstelltAm.localeCompare(b.erstelltAm);

/** Merkliste (vorgemerkt) und Herstellergruppen (probiert), Hersteller alphabetisch, Getränke in Erfassungsreihenfolge. */
export function gruppiere(hersteller: Hersteller[], getraenke: Getraenk[]): { merkliste: Getraenk[]; gruppen: Gruppe[] } {
  const merkliste = getraenke.filter((g) => g.zustand === 'vorgemerkt').sort(nachErfassung);
  const gruppen = [...hersteller]
    .sort(nachName)
    .map((h) => {
      const liste = getraenke.filter((g) => g.herstellerId === h.id && g.zustand === 'probiert').sort(nachErfassung);
      return { hersteller: h, getraenke: liste, durchschnitt: mittelwert(liste.map((g) => g.bewertung)) };
    })
    .filter((gruppe) => gruppe.getraenke.length > 0);
  return { merkliste, gruppen };
}

/** Reihenfolge für Vor/Zurück: erst Merkliste, dann die Gruppen, wie in der Übersicht. */
export function navigationsIds(hersteller: Hersteller[], getraenke: Getraenk[]): string[] {
  const { merkliste, gruppen } = gruppiere(hersteller, getraenke);
  return [...merkliste.map((g) => g.id), ...gruppen.flatMap((gr) => gr.getraenke.map((g) => g.id))];
}

/** Alle bisher erfassten Herstellernamen (alle Tastings, ohne Doppelte), jeweils mit dem zuletzt genutzten Standort. */
export async function herstellerVorschlaege(): Promise<{ name: string; standort?: string }[]> {
  const alle = await db.hersteller.toArray();
  const proName = new Map<string, { name: string; standort?: string }>();
  for (const h of alle) {
    const schluessel = normal(h.name);
    const vorhanden = proName.get(schluessel);
    if (!vorhanden || (!vorhanden.standort && h.standort)) proName.set(schluessel, { name: h.name, standort: h.standort });
  }
  return [...proName.values()].sort(nachName);
}

/** Hersteller des zuletzt erfassten Getränks dieses Tastings (Vorbelegung für das nächste Bier). */
export async function letzterHersteller(tastingId: string): Promise<Hersteller | undefined> {
  const getraenke = await db.getraenke.where('tastingId').equals(tastingId).toArray();
  const letztes = getraenke.sort(nachErfassung).at(-1);
  return letztes ? db.hersteller.get(letztes.herstellerId) : undefined;
}

async function leerenHerstellerEntfernen(herstellerId: string): Promise<void> {
  const rest = await db.getraenke.where('herstellerId').equals(herstellerId).count();
  if (rest === 0) await db.hersteller.delete(herstellerId);
}

/**
 * Legt ein Getränk an oder aktualisiert es (Autosave). Findet oder erzeugt den Hersteller im Tasting
 * (ohne Beachtung der Groß-/Kleinschreibung) und entfernt einen dadurch leeren alten Hersteller.
 */
export async function getraenkSpeichern(eingabe: GetraenkEingabe, bestehendId: string | null, stile: Stil[]): Promise<string> {
  return db.transaction('rw', db.hersteller, db.getraenke, async () => {
    const jetzt = new Date().toISOString();
    const herstellerName = eingabe.herstellerName.trim();
    const standort = eingabe.herstellerStandort.trim() || undefined;

    const imTasting = await db.hersteller.where('tastingId').equals(eingabe.tastingId).toArray();
    let hersteller = imTasting.find((h) => normal(h.name) === normal(herstellerName));
    if (!hersteller) {
      hersteller = { id: crypto.randomUUID(), tastingId: eingabe.tastingId, name: herstellerName, standort };
      await db.hersteller.put(hersteller);
    } else if (hersteller.standort !== standort) {
      hersteller = { ...hersteller, standort };
      await db.hersteller.put(hersteller);
    }

    const bestehend = bestehendId ? await db.getraenke.get(bestehendId) : undefined;
    const stil = eingabe.stilId ? stile.find((s) => s.id === eingabe.stilId) : undefined;
    const bewertung = eingabe.bewertung === undefined ? undefined : bewertungNormalisieren(eingabe.bewertung);

    const getraenk: Getraenk = {
      id: bestehend?.id ?? bestehendId ?? crypto.randomUUID(),
      tastingId: eingabe.tastingId,
      herstellerId: hersteller.id,
      name: eingabe.name.trim(),
      zustand: eingabe.zustand,
      stilId: stil?.id ?? (eingabe.stilId && bestehend?.stilId === eingabe.stilId ? bestehend.stilId : undefined),
      stilName: stil?.name ?? (eingabe.stilId && bestehend?.stilId === eingabe.stilId ? bestehend.stilName : undefined),
      bewertung,
      notiz: eingabe.notiz.trim() || undefined,
      abv: eingabe.abv,
      menge: eingabe.menge,
      preis: eingabe.preis,
      probiertAm:
        eingabe.zustand === 'probiert' ? (bestehend?.zustand === 'probiert' && bestehend.probiertAm ? bestehend.probiertAm : jetzt) : undefined,
      erstelltAm: bestehend?.erstelltAm ?? jetzt,
      geaendertAm: jetzt,
    };
    await db.getraenke.put(getraenk);

    if (bestehend && bestehend.herstellerId !== hersteller.id) await leerenHerstellerEntfernen(bestehend.herstellerId);
    return getraenk.id;
  });
}

export async function getraenkLoeschen(getraenkId: string): Promise<void> {
  await db.transaction('rw', db.hersteller, db.getraenke, db.fotos, async () => {
    const getraenk = await db.getraenke.get(getraenkId);
    if (!getraenk) return;
    await db.fotos.where('bezugId').equals(getraenkId).delete();
    await db.getraenke.delete(getraenkId);
    await leerenHerstellerEntfernen(getraenk.herstellerId);
  });
}
