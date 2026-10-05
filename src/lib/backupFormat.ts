// Backup-Format und reine Hilfen (ohne Datenbank, testbar mit Node): Prüfung, Kopie mit neuen IDs,
// Stil-Abgleich und die Regel für den Backup-Hinweis. Texte kommen von außen (Fehlercodes).
import type { Artikel, Foto, Getraenk, Hersteller, Stil, Tasting, Vergleich } from './model';

export const SCHEMA_VERSION = 1;

export type FotoMeta = Omit<Foto, 'blob' | 'vorschau'>;

export interface BackupTasting {
  tasting: Tasting;
  hersteller: Hersteller[];
  getraenke: Getraenk[];
  fotos: FotoMeta[];
}

export interface BackupDatei {
  schemaVersion: number;
  app: 'taste-report';
  art: 'tasting' | 'alle';
  /** Zeitpunkt der Sicherung (ISO), wird beim Import zu Tasting.letzteSicherung */
  erstelltAm: string;
  /** nur bei „Alles sichern“ */
  einstellungen?: { verkoster: string };
  /** alle Stile (Alles sichern) bzw. die von den Bieren genutzten Stile */
  stile: Stil[];
  tastings: BackupTasting[];
  /** Gruppen-Vergleiche (nur bei „Alles sichern“, additives Feld) */
  vergleiche: Vergleich[];
}

export type BackupFehlerCode = 'format' | 'version' | 'leer';

export class BackupFehler extends Error {
  code: BackupFehlerCode;
  constructor(code: BackupFehlerCode) {
    super(code);
    this.code = code;
  }
}

const istText = (x: unknown): x is string => typeof x === 'string' && x !== '';
const istObjekt = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

/** Prüft die Struktur einer eingelesenen backup.json. Wirft BackupFehler. */
export function backupPruefen(roh: unknown): BackupDatei {
  if (!istObjekt(roh) || typeof roh.schemaVersion !== 'number' || !Array.isArray(roh.tastings)) throw new BackupFehler('format');
  if (roh.schemaVersion > SCHEMA_VERSION) throw new BackupFehler('version');
  if (roh.tastings.length === 0) throw new BackupFehler('leer');

  for (const eintrag of roh.tastings) {
    if (!istObjekt(eintrag) || !istObjekt(eintrag.tasting)) throw new BackupFehler('format');
    const { tasting, hersteller, getraenke, fotos } = eintrag;
    if (!istText(tasting.id) || !istText(tasting.name) || !istText(tasting.datumVon)) throw new BackupFehler('format');
    if (!Array.isArray(hersteller) || !Array.isArray(getraenke) || !Array.isArray(fotos)) throw new BackupFehler('format');
    const herstellerIds = new Set<string>();
    for (const h of hersteller) {
      if (!istObjekt(h) || !istText(h.id) || !istText(h.name)) throw new BackupFehler('format');
      herstellerIds.add(h.id);
    }
    const getraenkIds = new Set<string>();
    for (const g of getraenke) {
      if (!istObjekt(g) || !istText(g.id) || !istText(g.name) || !istText(g.herstellerId) || !herstellerIds.has(g.herstellerId)) throw new BackupFehler('format');
      if (g.zustand !== 'probiert' && g.zustand !== 'vorgemerkt') throw new BackupFehler('format');
      getraenkIds.add(g.id);
    }
    for (const f of fotos) {
      if (!istObjekt(f) || !istText(f.id) || (f.art !== 'getraenk' && f.art !== 'cover')) throw new BackupFehler('format');
      if (f.bezugId !== (f.art === 'cover' ? tasting.id : f.bezugId) || (f.art === 'getraenk' && !getraenkIds.has(f.bezugId as string))) throw new BackupFehler('format');
    }
  }
  return {
    schemaVersion: roh.schemaVersion,
    app: 'taste-report',
    art: roh.art === 'alle' ? 'alle' : 'tasting',
    erstelltAm: typeof roh.erstelltAm === 'string' ? roh.erstelltAm : new Date().toISOString(),
    einstellungen: istObjekt(roh.einstellungen) && typeof roh.einstellungen.verkoster === 'string' ? { verkoster: roh.einstellungen.verkoster } : undefined,
    stile: Array.isArray(roh.stile) ? (roh.stile as Stil[]).filter((s) => istObjekt(s) && istText(s.id) && istText(s.name)) : [],
    tastings: roh.tastings as BackupTasting[],
    vergleiche: Array.isArray(roh.vergleiche) ? roh.vergleiche.map(vergleichPruefen).filter((v): v is Vergleich => v !== null) : [],
  };
}

const textMap = (x: unknown): Record<string, string> =>
  istObjekt(x) ? Object.fromEntries(Object.entries(x).filter((e): e is [string, string] => typeof e[1] === 'string')) : {};

/** Ein Vergleich aus dem Backup; ungültige Einträge werden verworfen (der Rest des Backups bleibt nutzbar). */
export function vergleichPruefen(roh: unknown): Vergleich | null {
  if (!istObjekt(roh) || !istText(roh.id) || !istText(roh.name) || !Array.isArray(roh.tastingIds)) return null;
  const tastingIds = roh.tastingIds.filter(istText);
  if (tastingIds.length === 0) return null;
  const jetzt = new Date().toISOString();
  return {
    id: roh.id,
    name: roh.name,
    tastingIds,
    anzeigenamen: textMap(roh.anzeigenamen),
    zuordnung: textMap(roh.zuordnung),
    siegerSchluessel: typeof roh.siegerSchluessel === 'string' && roh.siegerSchluessel !== '' ? roh.siegerSchluessel : undefined,
    erstelltAm: typeof roh.erstelltAm === 'string' ? roh.erstelltAm : jetzt,
    geaendertAm: typeof roh.geaendertAm === 'string' ? roh.geaendertAm : jetzt,
  };
}

/**
 * Verweise eines Vergleichs auf die neuen IDs umstellen (Tastings und Biere, die beim Import als Kopie angelegt wurden;
 * alles andere bleibt). Mit `neueId` wird der Vergleich selbst zur Kopie.
 */
export function vergleichUmschreiben(
  v: Vergleich,
  tastingIds: Map<string, string>,
  getraenkIds: Map<string, string>,
  kopie?: { neueId: () => string; suffix: string },
): Vergleich {
  const t = (id: string) => tastingIds.get(id) ?? id;
  const g = (id: string) => getraenkIds.get(id) ?? id;
  return {
    ...v,
    id: kopie ? kopie.neueId() : v.id,
    name: kopie ? `${v.name}${kopie.suffix}` : v.name,
    tastingIds: v.tastingIds.map(t),
    anzeigenamen: Object.fromEntries(Object.entries(v.anzeigenamen).map(([id, name]) => [t(id), name])),
    zuordnung: Object.fromEntries(Object.entries(v.zuordnung).map(([id, anker]) => [g(id), g(anker)])),
    siegerSchluessel: v.siegerSchluessel === undefined ? undefined : umschreibenSchluessel(v.siegerSchluessel, g),
  };
}

/** Einzelbier-Schlüssel ("e:" + Getraenk.id) folgen der neuen ID; Namensschlüssel bleiben. */
function umschreibenSchluessel(schluessel: string, g: (id: string) => string): string {
  return schluessel.startsWith('e:') ? `e:${g(schluessel.slice(2))}` : schluessel;
}

/** Fotos je Bezug lückenlos nummerieren (1, 2, 3), falls ein Bild beim Sichern nicht lesbar war. */
export function reihenfolgeNeu<T extends { bezugId: string; reihenfolge: 1 | 2 | 3 }>(fotos: T[]): T[] {
  const gruppen = new Map<string, T[]>();
  for (const f of fotos) gruppen.set(f.bezugId, [...(gruppen.get(f.bezugId) ?? []), f]);
  return [...gruppen.values()].flatMap((liste) =>
    [...liste].sort((a, b) => a.reihenfolge - b.reihenfolge).map((f, i) => ({ ...f, reihenfolge: (i + 1) as 1 | 2 | 3 })),
  );
}

/** Bier-IDs in Zitaten und Bildunterschriften des Magazin-Texts auf die neuen IDs umstellen. */
function artikelUmschreiben(artikel: Artikel, ids: Map<string, string>): Artikel {
  return {
    ...artikel,
    zitate: artikel.zitate.filter((z) => ids.has(z.bier)).map((z) => ({ ...z, bier: ids.get(z.bier)! })),
    bildunterschriften: Object.fromEntries(
      Object.entries(artikel.bildunterschriften)
        .filter(([id]) => ids.has(id))
        .map(([id, text]) => [ids.get(id)!, text]),
    ),
  };
}

/** Tasting mit lauter neuen IDs („als Kopie“). Alle Verweise werden mit umgeschrieben. */
export function alsKopie(eintrag: BackupTasting, neueId: () => string, kopieSuffix: string): BackupTasting {
  const tastingId = neueId();
  const herstellerIds = new Map(eintrag.hersteller.map((h) => [h.id, neueId()]));
  const getraenkIds = new Map(eintrag.getraenke.map((g) => [g.id, neueId()]));
  return {
    tasting: {
      ...eintrag.tasting,
      id: tastingId,
      name: `${eintrag.tasting.name}${kopieSuffix}`,
      siegerId: eintrag.tasting.siegerId ? getraenkIds.get(eintrag.tasting.siegerId) : undefined,
      artikel: eintrag.tasting.artikel ? artikelUmschreiben(eintrag.tasting.artikel, getraenkIds) : undefined,
      hinweisAm: undefined,
    },
    hersteller: eintrag.hersteller.map((h) => ({ ...h, id: herstellerIds.get(h.id)!, tastingId })),
    getraenke: eintrag.getraenke.map((g) => ({
      ...g,
      id: getraenkIds.get(g.id)!,
      tastingId,
      herstellerId: herstellerIds.get(g.herstellerId)!,
    })),
    fotos: eintrag.fotos.map((f) => ({
      ...f,
      id: neueId(),
      bezugId: f.art === 'cover' ? tastingId : getraenkIds.get(f.bezugId)!,
    })),
  };
}

const normal = (text: string) => text.trim().toLocaleLowerCase('de');

/**
 * Stile des Backups mit den lokalen abgleichen (über den Namen). Fehlende werden hinten angehängt.
 * Ergebnis: die neue lokale Liste und die Umrechnung Backup-Stil-ID → lokale Stil-ID.
 */
export function stileAbgleichen(lokal: Stil[], backup: Stil[], neueId: () => string): { stile: Stil[]; idMap: Map<string, string>; neu: number } {
  const stile = [...lokal];
  const idMap = new Map<string, string>();
  let naechste = lokal.reduce((max, s) => Math.max(max, s.sortierung), -1) + 1;
  let neu = 0;
  for (const b of [...backup].sort((x, y) => x.sortierung - y.sortierung)) {
    const gefunden = stile.find((s) => normal(s.name) === normal(b.name));
    if (gefunden) {
      idMap.set(b.id, gefunden.id);
      continue;
    }
    const id = stile.some((s) => s.id === b.id) ? neueId() : b.id;
    stile.push({ id, name: b.name, aktiv: b.aktiv !== false, sortierung: naechste++ });
    idMap.set(b.id, id);
    neu++;
  }
  return { stile, idMap, neu };
}

export const HINWEIS_AB_BIEREN = 10;

/**
 * Backup-Hinweis: seit der letzten Sicherung mindestens 10 Biere neu/geändert (auch neue Fotos zählen)
 * oder ein Fazit ohne Sicherung. Höchstens einmal pro Tasting und Tag.
 */
export function hinweisNoetig(
  tasting: Pick<Tasting, 'letzteSicherung' | 'hinweisAm' | 'fazit' | 'geaendertAm'>,
  getraenke: Pick<Getraenk, 'id' | 'geaendertAm'>[],
  fotos: Pick<Foto, 'art' | 'bezugId' | 'erstelltAm'>[],
  heute: string,
): boolean {
  if (tasting.hinweisAm === heute) return false;
  const seit = tasting.letzteSicherung;
  const neuer = (zeit: string) => !seit || zeit > seit;
  const geaendert = new Set<string>();
  for (const g of getraenke) if (neuer(g.geaendertAm)) geaendert.add(g.id);
  const ids = new Set(getraenke.map((g) => g.id));
  for (const f of fotos) if (f.art === 'getraenk' && ids.has(f.bezugId) && neuer(f.erstelltAm)) geaendert.add(f.bezugId);
  const fazitOffen = !!tasting.fazit?.trim() && neuer(tasting.geaendertAm);
  return geaendert.size >= HINWEIS_AB_BIEREN || fazitOffen;
}
