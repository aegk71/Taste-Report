import Dexie, { type Table } from 'dexie';
import type { Einstellungen, Foto, Getraenk, Hersteller, Tasting } from './model';
import { STANDARD_STILE } from './model';

export class AppDatabase extends Dexie {
  einstellungen!: Table<Einstellungen, string>;
  tastings!: Table<Tasting, string>;
  hersteller!: Table<Hersteller, string>;
  getraenke!: Table<Getraenk, string>;
  fotos!: Table<Foto, string>;

  constructor() {
    super('taste-report');
    this.version(1).stores({
      einstellungen: 'id',
      tastings: 'id, datumVon, geaendertAm',
      hersteller: 'id, tastingId, name',
      getraenke: 'id, tastingId, herstellerId, zustand',
      fotos: 'id, bezugId, [art+bezugId]',
    });
  }
}

export const db = new AppDatabase();

export async function ladeEinstellungen(): Promise<Einstellungen> {
  const bestehend = await db.einstellungen.get('global');
  if (bestehend) return bestehend;

  const standard: Einstellungen = {
    id: 'global',
    verkoster: '',
    stile: STANDARD_STILE.map((name, index) => ({
      id: crypto.randomUUID(),
      name,
      aktiv: true,
      sortierung: index,
    })),
  };
  await db.einstellungen.put(standard);

  if (navigator.storage?.persist) {
    navigator.storage.persist();
  }

  return standard;
}

/** Tasting hart löschen: Getränke, Hersteller und alle zugehörigen Fotos (Cover und Getränke) mit. */
export async function tastingHartLoeschen(tastingId: string): Promise<void> {
  await db.transaction('rw', db.tastings, db.hersteller, db.getraenke, db.fotos, async () => {
    const getraenkIds = await db.getraenke.where('tastingId').equals(tastingId).primaryKeys();
    if (getraenkIds.length > 0) {
      await db.fotos.where('bezugId').anyOf(getraenkIds).delete();
    }
    await db.fotos.where('bezugId').equals(tastingId).delete();
    await db.getraenke.where('tastingId').equals(tastingId).delete();
    await db.hersteller.where('tastingId').equals(tastingId).delete();
    await db.tastings.delete(tastingId);
  });
}

export interface TastingKennzahlen {
  /** Anzahl probierter Getränke */
  probiert: number;
  vorgemerkt: number;
  /** Mittel der bewerteten, probierten Getränke; undefined ohne Bewertung */
  durchschnitt?: number;
}

export async function tastingKennzahlen(tastingId: string): Promise<TastingKennzahlen> {
  const getraenke = await db.getraenke.where('tastingId').equals(tastingId).toArray();
  const probiert = getraenke.filter((g) => g.zustand === 'probiert');
  const bewertet = probiert.filter((g) => g.bewertung !== undefined);
  return {
    probiert: probiert.length,
    vorgemerkt: getraenke.length - probiert.length,
    durchschnitt:
      bewertet.length > 0 ? bewertet.reduce((summe, g) => summe + (g.bewertung ?? 0), 0) / bewertet.length : undefined,
  };
}
