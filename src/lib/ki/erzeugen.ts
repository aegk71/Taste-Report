import { kennzahlen, rangliste, sieger as siegerVon } from '../auswertung';
import { db } from '../db';
import { bildFuerPdf } from '../export/pdfBild';
import { fotosSortiert } from '../fotos';
import type { Artikel, Foto, Getraenk, KiLaenge, KiTon, Tasting } from '../model';
import { anfrage, KI_MODELL } from './anthropic';
import { anfrageBauen, artikelAusAntwort, type BierFuerKi } from './artikel';
import { KiFehler } from './kiFehler';

/** Höchstens so viele Fotos gehen an die KI (Cover + Titelbilder der am besten bewerteten Biere). */
export const MAX_KI_FOTOS = 30;
const FOTO_KANTE = 512;
const ZEITLIMIT_MS = 150_000;

export interface ErzeugenOptionen {
  ton: KiTon;
  laenge: KiLaenge;
  fotos: boolean;
}

export interface SendeUebersicht {
  biere: number;
  notizen: number;
  fotos: number;
}

interface Plan {
  biere: BierFuerKi[];
  siegerKurzId?: string;
  herstellerAnzahl: number;
  fotoPlan: { fuer: string; beschriftung: string; foto: Foto }[];
  tasting: Tasting;
}

async function planen(tastingId: string, fotos: boolean): Promise<Plan> {
  const tasting = await db.tastings.get(tastingId);
  if (!tasting) throw new Error('Tasting nicht gefunden');
  const hersteller = await db.hersteller.where('tastingId').equals(tastingId).toArray();
  const alle = await db.getraenke.where('tastingId').equals(tastingId).toArray();
  const probiert = alle.filter((g) => g.zustand === 'probiert');
  const herstellerVon = new Map(hersteller.map((h) => [h.id, h]));

  const platz = new Map(rangliste(alle).map((p) => [p.getraenk.id, p.platz]));
  const geordnet: Getraenk[] = [
    ...rangliste(alle).map((p) => p.getraenk),
    ...probiert
      .filter((g) => !platz.has(g.id))
      .sort((a, b) => (a.probiertAm ?? a.erstelltAm).localeCompare(b.probiertAm ?? b.erstelltAm)),
  ];
  const biere: BierFuerKi[] = geordnet.map((g, i) => ({
    kurzId: `B${i + 1}`,
    id: g.id,
    hersteller: herstellerVon.get(g.herstellerId)?.name ?? '',
    standort: herstellerVon.get(g.herstellerId)?.standort,
    name: g.name,
    stil: g.stilName,
    bewertung: g.bewertung,
    abv: g.abv,
    notiz: g.notiz?.trim() || undefined,
    platz: platz.get(g.id),
  }));
  const gewinner = siegerVon(tasting, alle);
  const siegerKurzId = gewinner ? biere.find((b) => b.id === gewinner.getraenk.id)?.kurzId : undefined;

  const fotoPlan: Plan['fotoPlan'] = [];
  if (fotos) {
    const cover = (await fotosSortiert('cover', tastingId))[0];
    if (cover) fotoPlan.push({ fuer: 'cover', beschriftung: 'Titelfoto des Tastings (Cover):', foto: cover });
    for (const b of biere) {
      if (fotoPlan.length >= MAX_KI_FOTOS) break;
      if (b.bewertung === undefined) continue;
      const titel = (await fotosSortiert('getraenk', b.id))[0];
      if (titel) fotoPlan.push({ fuer: b.kurzId, beschriftung: `Foto zu ${b.kurzId}: ${b.hersteller} – ${b.name}`, foto: titel });
    }
  }
  return { biere, siegerKurzId, herstellerAnzahl: kennzahlen(alle).hersteller, fotoPlan, tasting };
}

/** Was würde gesendet? Für die Anzeige vor dem Erzeugen. */
export async function sendeUebersicht(tastingId: string, fotos: boolean): Promise<SendeUebersicht> {
  const plan = await planen(tastingId, fotos);
  return { biere: plan.biere.length, notizen: plan.biere.filter((b) => b.notiz).length, fotos: plan.fotoPlan.length };
}

/** Text von der KI schreiben lassen. Speichert nichts. Wirft KiFehler. */
export async function artikelErzeugen(tastingId: string, optionen: ErzeugenOptionen, schluessel: string): Promise<Artikel> {
  const plan = await planen(tastingId, optionen.fotos);
  const bilder = [];
  for (const eintrag of plan.fotoPlan) {
    const bild = await bildFuerPdf(eintrag.foto.blob, FOTO_KANTE);
    if (bild) bilder.push({ fuer: eintrag.fuer, beschriftung: eintrag.beschriftung, base64: bild.dataUrl.split(',')[1] });
  }
  const { body, idMap } = anfrageBauen({
    modell: KI_MODELL,
    tasting: plan.tasting,
    biere: plan.biere,
    siegerKurzId: plan.siegerKurzId,
    herstellerAnzahl: plan.herstellerAnzahl,
    ton: optionen.ton,
    laenge: optionen.laenge,
    bilder,
  });
  const antwort = await anfrage(schluessel, body, ZEITLIMIT_MS);
  const notizen = new Map(plan.biere.filter((b) => b.notiz).map((b) => [b.id, b.notiz as string]));
  const artikel = artikelAusAntwort(antwort, idMap, notizen, optionen.ton, optionen.laenge);
  if (!artikel) throw new KiFehler('antwort');
  return artikel;
}

/** Text im Tasting speichern. neu = true setzt den Erzeugungszeitpunkt (nicht bei Bearbeitungen). */
export async function artikelSpeichern(tastingId: string, artikel: Artikel, neu: boolean): Promise<void> {
  const jetzt = new Date().toISOString();
  await db.tastings.update(tastingId, {
    artikel: structuredClone(artikel),
    ...(neu ? { artikelErstelltAm: jetzt } : {}),
    geaendertAm: jetzt,
  });
}
