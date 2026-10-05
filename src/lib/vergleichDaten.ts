// Gruppen-Vergleich: Daten laden und speichern. Die Auswertung selbst steht in vergleich.ts (rein, mit Tests).
import { db } from './db';
import type { Tasting, Vergleich } from './model';
import { anzeigename, biereZuordnen, vergleichsRangliste, type Quelle, type VergleichsBier } from './vergleich';

export interface VergleichsDaten {
  vergleich: Vergleich;
  /** vorhandene Tastings in der Reihenfolge des Vergleichs */
  tastings: Tasting[];
  quellen: Quelle[];
  /** Tastings, die der Vergleich kennt, die es aber nicht mehr gibt */
  fehlend: number;
  biere: VergleichsBier[];
}

/** Liest Vergleich und Tastings (immer die aktuellen Daten). Gedacht für liveQuery. */
export async function ladeVergleich(vergleichId: string): Promise<VergleichsDaten | undefined> {
  const vergleich = await db.vergleiche.get(vergleichId);
  if (!vergleich) return undefined;
  const geladen = await db.tastings.bulkGet(vergleich.tastingIds);
  const tastings = geladen.filter((t): t is Tasting => !!t);
  const quellen: Quelle[] = [];
  for (const t of tastings) {
    quellen.push({
      tastingId: t.id,
      verkoster: anzeigename(vergleich, t),
      hersteller: await db.hersteller.where('tastingId').equals(t.id).toArray(),
      getraenke: await db.getraenke.where('tastingId').equals(t.id).toArray(),
    });
  }
  return { vergleich, tastings, quellen, fehlend: vergleich.tastingIds.length - tastings.length, biere: biereZuordnen(quellen, vergleich.zuordnung) };
}

export interface VergleichsKurz {
  vergleich: Vergleich;
  verkoster: number;
  biere: number;
  durchschnitt?: number;
}

/** Alle Vergleiche mit Kennzahlen für die Tasting-Liste, neueste zuerst. */
export async function ladeVergleichsListe(): Promise<VergleichsKurz[]> {
  const alle = (await db.vergleiche.toArray()).sort((a, b) => b.geaendertAm.localeCompare(a.geaendertAm));
  const liste: VergleichsKurz[] = [];
  for (const v of alle) {
    const daten = await ladeVergleich(v.id);
    if (!daten) continue;
    const rang = vergleichsRangliste(daten.biere);
    const werte = rang.map((p) => p.bier.durchschnitt!);
    liste.push({
      vergleich: v,
      verkoster: daten.tastings.length,
      biere: daten.biere.length,
      durchschnitt: werte.length > 0 ? werte.reduce((s, w) => s + w, 0) / werte.length : undefined,
    });
  }
  return liste;
}

export type VergleichEntwurf = Pick<Vergleich, 'name' | 'tastingIds' | 'anzeigenamen'>;

/** Neuen Vergleich anlegen. Gibt die ID zurück. */
export async function vergleichAnlegen(entwurf: VergleichEntwurf): Promise<string> {
  const jetzt = new Date().toISOString();
  const vergleich: Vergleich = {
    id: crypto.randomUUID(),
    name: entwurf.name.trim(),
    tastingIds: [...entwurf.tastingIds],
    anzeigenamen: { ...entwurf.anzeigenamen },
    zuordnung: {},
    erstelltAm: jetzt,
    geaendertAm: jetzt,
  };
  await db.vergleiche.put(vergleich);
  return vergleich.id;
}

/** Name, Tastings und Anzeigenamen ändern; Zuordnung und Sieger bleiben erhalten. */
export async function vergleichAendern(id: string, entwurf: VergleichEntwurf): Promise<void> {
  await db.vergleiche.update(id, {
    name: entwurf.name.trim(),
    tastingIds: [...entwurf.tastingIds],
    anzeigenamen: { ...entwurf.anzeigenamen },
    geaendertAm: new Date().toISOString(),
  });
}

export async function zuordnungSpeichern(id: string, zuordnung: Record<string, string>): Promise<void> {
  await db.vergleiche.update(id, { zuordnung: { ...zuordnung }, geaendertAm: new Date().toISOString() });
}

export async function siegerSpeichern(id: string, siegerSchluessel: string | undefined): Promise<void> {
  await db.vergleiche.update(id, { siegerSchluessel, geaendertAm: new Date().toISOString() });
}

export async function vergleichLoeschen(id: string): Promise<void> {
  await db.vergleiche.delete(id);
}
