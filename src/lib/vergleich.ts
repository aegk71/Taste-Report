// Gruppen-Vergleich: Biere verschiedener Verkoster zuordnen und auswerten. Reine Funktionen ohne Datenbankzugriff (testbar mit Node).
// Es zählen nur Getränke mit zustand = 'probiert'; "nicht bewertet" (undefined) ist nicht 0 und zählt in keinem Durchschnitt.
import type { Getraenk, Hersteller, Vergleich } from './model';

export interface Quelle {
  tastingId: string;
  /** Anzeigename des Verkosters im Vergleich */
  verkoster: string;
  hersteller: Hersteller[];
  getraenke: Getraenk[];
}

export interface BierEintrag {
  tastingId: string;
  verkoster: string;
  getraenk: Getraenk;
  /** Name und Standort des Herstellers im Tasting dieses Verkosters */
  herstellerName: string;
  standort?: string;
  bewertung?: number;
}

export interface VergleichsBier {
  /** Gruppenschlüssel: normalisierter Hersteller|Name, bei Einzelbieren "e:" + Getraenk.id */
  schluessel: string;
  name: string;
  herstellerName: string;
  standort?: string;
  stil?: string;
  /** Reihenfolge der Tastings im Vergleich */
  eintraege: BierEintrag[];
  /** Mittel der vorhandenen Bewertungen */
  durchschnitt?: number;
  /** Anzahl der Verkoster, die das Bier bewertet haben */
  anzahl: number;
}

export function mittel(werte: (number | undefined)[]): number | undefined {
  const zahlen = werte.filter((w): w is number => w !== undefined);
  return zahlen.length > 0 ? zahlen.reduce((summe, w) => summe + w, 0) / zahlen.length : undefined;
}

/** Klein, ohne Akzente, Satzzeichen und Leerzeichen ("Alpenbräu – Weizen Alp" ≈ "alpenbrau weizen alp"). */
export function normalisiere(text: string): string {
  return text
    .toLocaleLowerCase('de')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

export function bierSchluessel(herstellerName: string, name: string): string {
  const h = normalisiere(herstellerName);
  const n = normalisiere(name);
  return h === '' && n === '' ? '' : `${h}|${n}`;
}

const fruehestensZuerst = (a: Getraenk, b: Getraenk) =>
  (a.probiertAm ?? a.erstelltAm).localeCompare(b.probiertAm ?? b.erstelltAm) || a.erstelltAm.localeCompare(b.erstelltAm);

/**
 * Biere der Tastings zusammenführen. Automatik: gleicher Hersteller + Biername (siehe normalisiere). Zwei Biere desselben
 * Tastings werden nie automatisch vereinigt. Handkorrekturen (zuordnung: Getraenk.id → Anker-Getraenk.id, oder auf sich
 * selbst = einzeln) gehen vor der Automatik. Verweise auf nicht mehr vorhandene Biere werden ignoriert.
 */
export function biereZuordnen(quellen: Quelle[], zuordnung: Record<string, string> = {}): VergleichsBier[] {
  const eintraege: BierEintrag[] = [];
  quellen.forEach((q) => {
    const hersteller = new Map(q.hersteller.map((h) => [h.id, h]));
    [...q.getraenke]
      .filter((g) => g.zustand === 'probiert')
      .sort((a, b) => a.erstelltAm.localeCompare(b.erstelltAm) || a.name.localeCompare(b.name, 'de'))
      .forEach((g) => {
        const h = hersteller.get(g.herstellerId);
        eintraege.push({ tastingId: q.tastingId, verkoster: q.verkoster, getraenk: g, herstellerName: h?.name ?? '', standort: h?.standort, bewertung: g.bewertung });
      });
  });
  const nachId = new Map(eintraege.map((e) => [e.getraenk.id, e]));

  const schluessel = new Map<string, string>();
  const belegt = new Map<string, Set<string>>();
  const belegen = (key: string, e: BierEintrag) => {
    if (!belegt.has(key)) belegt.set(key, new Set());
    belegt.get(key)!.add(e.tastingId);
  };
  const keyVon = (e: BierEintrag, besucht: Set<string> = new Set()): string => {
    const vorhanden = schluessel.get(e.getraenk.id);
    if (vorhanden !== undefined) return vorhanden;
    const ziel = zuordnung[e.getraenk.id];
    let key: string | undefined;
    if (ziel === e.getraenk.id) key = `e:${e.getraenk.id}`;
    else if (ziel && nachId.has(ziel) && !besucht.has(ziel)) {
      besucht.add(e.getraenk.id);
      key = keyVon(nachId.get(ziel)!, besucht);
    }
    if (key === undefined) {
      const auto = bierSchluessel(e.herstellerName, e.getraenk.name);
      key = auto === '' || belegt.get(auto)?.has(e.tastingId) ? `e:${e.getraenk.id}` : auto;
    }
    belegen(key, e);
    schluessel.set(e.getraenk.id, key);
    return key;
  };

  const gruppen = new Map<string, BierEintrag[]>();
  for (const e of eintraege) {
    const key = keyVon(e);
    gruppen.set(key, [...(gruppen.get(key) ?? []), e]);
  }

  const reihenfolge = new Map(quellen.map((q, i) => [q.tastingId, i]));
  return [...gruppen.entries()].map(([key, liste]) => {
    const sortiert = [...liste].sort((a, b) => (reihenfolge.get(a.tastingId) ?? 0) - (reihenfolge.get(b.tastingId) ?? 0));
    const erster = sortiert[0];
    const bewertungen = sortiert.map((e) => e.bewertung).filter((w): w is number => w !== undefined);
    return {
      schluessel: key,
      name: erster.getraenk.name,
      herstellerName: erster.herstellerName,
      standort: sortiert.find((e) => e.standort)?.standort,
      stil: sortiert.find((e) => e.getraenk.stilName)?.getraenk.stilName,
      eintraege: sortiert,
      durchschnitt: mittel(bewertungen),
      anzahl: bewertungen.length,
    };
  });
}

export interface VergleichsPlatz {
  bier: VergleichsBier;
  /** Gleichstand = gleicher Platz (1, 1, 3) */
  platz: number;
}

const gerundet = (x: number) => Math.round(x * 1_000_000);
const fruehesteszeit = (b: VergleichsBier) =>
  b.eintraege
    .map((e) => e.getraenk.probiertAm ?? e.getraenk.erstelltAm)
    .sort()[0] ?? '';

/** Rangliste absteigend nach Gruppen-Durchschnitt; bei Gleichstand zuerst probiert. Nur Biere mit mindestens einer Bewertung. */
export function vergleichsRangliste(biere: VergleichsBier[]): VergleichsPlatz[] {
  const sortiert = biere
    .filter((b) => b.durchschnitt !== undefined)
    .sort(
      (a, b) =>
        gerundet(b.durchschnitt!) - gerundet(a.durchschnitt!) || fruehesteszeit(a).localeCompare(fruehesteszeit(b)) || a.name.localeCompare(b.name, 'de'),
    );
  return sortiert.map((bier) => ({ bier, platz: sortiert.findIndex((b) => gerundet(b.durchschnitt!) === gerundet(bier.durchschnitt!)) + 1 }));
}

/** „Bier des Festivals“: von Hand gewählt (falls noch bewertet), sonst das beste. */
export function vergleichsSieger(siegerSchluessel: string | undefined, biere: VergleichsBier[]): { bier: VergleichsBier; gewaehlt: boolean } | undefined {
  const liste = vergleichsRangliste(biere);
  if (liste.length === 0) return undefined;
  const gewaehlt = siegerSchluessel ? liste.find((p) => p.bier.schluessel === siegerSchluessel) : undefined;
  return gewaehlt ? { bier: gewaehlt.bier, gewaehlt: true } : { bier: liste[0].bier, gewaehlt: false };
}

export interface HerstellerGruppe {
  name: string;
  standort?: string;
  biere: VergleichsBier[];
  /** Mittel der Gruppen-Durchschnitte der Biere */
  durchschnitt?: number;
}

/** Biere nach Hersteller gruppiert (alphabetisch, natürliche Sortierung). */
export function herstellerGruppen(biere: VergleichsBier[]): HerstellerGruppe[] {
  const gruppen = new Map<string, HerstellerGruppe>();
  for (const b of biere) {
    const key = normalisiere(b.herstellerName) || b.schluessel;
    const g = gruppen.get(key) ?? { name: b.herstellerName, standort: b.standort, biere: [] };
    if (!g.standort && b.standort) g.standort = b.standort;
    g.biere.push(b);
    gruppen.set(key, g);
  }
  return [...gruppen.values()]
    .map((g) => ({ ...g, durchschnitt: mittel(g.biere.map((b) => b.durchschnitt)) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'de', { numeric: true, sensitivity: 'base' }));
}

export interface VerkosterUebersicht {
  tastingId: string;
  verkoster: string;
  /** probierte Biere */
  biere: number;
  /** davon bewertet */
  bewertet: number;
  durchschnitt?: number;
  /** höchste Bewertung (bei Gleichstand das zuerst probierte) */
  bestes?: Getraenk;
}

export function verkosterUebersicht(quellen: Quelle[]): VerkosterUebersicht[] {
  return quellen.map((q) => {
    const probiert = q.getraenke.filter((g) => g.zustand === 'probiert');
    const bewertet = probiert.filter((g) => g.bewertung !== undefined);
    const bestes = [...bewertet].sort((a, b) => (b.bewertung ?? 0) - (a.bewertung ?? 0) || fruehestensZuerst(a, b))[0];
    return {
      tastingId: q.tastingId,
      verkoster: q.verkoster,
      biere: probiert.length,
      bewertet: bewertet.length,
      durchschnitt: mittel(bewertet.map((g) => g.bewertung)),
      bestes,
    };
  });
}

/** Biere, die nur ein Verkoster hat (Kandidaten zum Zusammenführen); erst ab zwei Tastings sinnvoll. */
export function einzelneBiere(biere: VergleichsBier[], anzahlTastings: number): VergleichsBier[] {
  return anzahlTastings < 2 ? [] : biere.filter((b) => b.eintraege.length === 1);
}

/** Biere, in die sich ein Bier einordnen lässt: keine Eintragung desselben Tastings, nicht es selbst. */
export function zielBiere(bier: VergleichsBier, biere: VergleichsBier[]): VergleichsBier[] {
  const tastings = new Set(bier.eintraege.map((e) => e.tastingId));
  return biere.filter((b) => b.schluessel !== bier.schluessel && !b.eintraege.some((e) => tastings.has(e.tastingId)));
}

/** Alle Einträge von `bier` dem Anker von `ziel` zuordnen. Gibt die neue Zuordnung zurück. */
export function zusammenfuehren(zuordnung: Record<string, string>, bier: VergleichsBier, ziel: VergleichsBier): Record<string, string> {
  const anker = ziel.eintraege[0].getraenk.id;
  const neu = { ...zuordnung };
  for (const e of bier.eintraege) neu[e.getraenk.id] = anker;
  return neu;
}

/**
 * Ein Bier aus seiner Gruppe lösen (wird einzeln). Andere Mitglieder, die auf dieses Bier als Anker verwiesen,
 * hängen sich an ein verbleibendes Mitglied; bleibt keines übrig, werden sie ebenfalls einzeln.
 */
export function entkoppeln(zuordnung: Record<string, string>, getraenkId: string, bier: VergleichsBier): Record<string, string> {
  const neu = { ...zuordnung, [getraenkId]: getraenkId };
  const rest = bier.eintraege.map((e) => e.getraenk.id).filter((id) => id !== getraenkId);
  for (const id of rest) {
    if (neu[id] !== getraenkId) continue;
    const anker = rest.find((r) => r !== id && neu[r] !== getraenkId);
    neu[id] = anker ?? id;
  }
  return neu;
}

/** Namensvorschlag je Tasting: der Verkoster, bei Doppelungen mit Datum ("Alex (12.09.)"), notfalls mit Zähler. */
export function namenVorschlag(tastings: { id: string; verkoster: string; datumVon: string }[]): Record<string, string> {
  const basis = (t: { verkoster: string }) => t.verkoster.trim() || 'Verkoster';
  const anzahl = new Map<string, number>();
  for (const t of tastings) anzahl.set(basis(t).toLocaleLowerCase('de'), (anzahl.get(basis(t).toLocaleLowerCase('de')) ?? 0) + 1);
  const ergebnis: Record<string, string> = {};
  const benutzt = new Map<string, number>();
  for (const t of tastings) {
    let name = basis(t);
    if ((anzahl.get(name.toLocaleLowerCase('de')) ?? 0) > 1) {
      const [, monat, tag] = t.datumVon.split('-');
      name = monat && tag ? `${name} (${tag}.${monat}.)` : name;
    }
    const n = (benutzt.get(name.toLocaleLowerCase('de')) ?? 0) + 1;
    benutzt.set(name.toLocaleLowerCase('de'), n);
    ergebnis[t.id] = n > 1 ? `${name} ${n}` : name;
  }
  return ergebnis;
}

/** Anzeigename eines Tastings im Vergleich: gewählter Name, sonst Verkoster des Tastings. */
export function anzeigename(vergleich: Pick<Vergleich, 'anzeigenamen'>, tasting: { id: string; verkoster: string }): string {
  return vergleich.anzeigenamen[tasting.id]?.trim() || tasting.verkoster.trim() || 'Verkoster';
}
