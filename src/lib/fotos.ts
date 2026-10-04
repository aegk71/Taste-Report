import { db } from './db';
import type { FotoEntwurf } from './foto';
import type { Foto, FotoArt } from './model';

export const MAX_FOTOS = 3;

export async function fotosSortiert(art: FotoArt, bezugId: string): Promise<Foto[]> {
  const liste = await db.fotos.where('[art+bezugId]').equals([art, bezugId]).toArray();
  return liste.sort((a, b) => a.reihenfolge - b.reihenfolge);
}

async function neuNummerieren(fotoIds: string[]): Promise<void> {
  for (let i = 0; i < fotoIds.length; i++) {
    await db.fotos.update(fotoIds[i], { reihenfolge: (i + 1) as 1 | 2 | 3 });
  }
}

/** Foto hinzufügen. false, wenn bereits die maximale Anzahl erreicht ist. */
export async function fotoHinzufuegen(art: 'getraenk', bezugId: string, entwurf: FotoEntwurf): Promise<boolean> {
  return db.transaction('rw', db.fotos, async () => {
    const vorhanden = await fotosSortiert(art, bezugId);
    if (vorhanden.length >= MAX_FOTOS) return false;
    const foto: Foto = {
      id: crypto.randomUUID(),
      art,
      bezugId,
      reihenfolge: (vorhanden.length + 1) as 1 | 2 | 3,
      blob: entwurf.blob,
      vorschau: entwurf.vorschau,
      breite: entwurf.breite,
      hoehe: entwurf.hoehe,
      erstelltAm: new Date().toISOString(),
    };
    await db.fotos.put(foto);
    return true;
  });
}

/** Gewähltes Foto wird Titelbild (Reihenfolge 1), die übrigen rücken in ihrer Reihenfolge nach. */
export async function titelbildSetzen(art: 'getraenk', bezugId: string, fotoId: string): Promise<void> {
  await db.transaction('rw', db.fotos, async () => {
    const liste = await fotosSortiert(art, bezugId);
    const ids = [fotoId, ...liste.map((f) => f.id).filter((id) => id !== fotoId)];
    await neuNummerieren(ids);
  });
}

export async function fotoLoeschen(fotoId: string): Promise<void> {
  await db.transaction('rw', db.fotos, async () => {
    const foto = await db.fotos.get(fotoId);
    if (!foto) return;
    await db.fotos.delete(fotoId);
    const rest = await fotosSortiert(foto.art, foto.bezugId);
    await neuNummerieren(rest.map((f) => f.id));
  });
}

/** Cover-Bild eines Tastings ersetzen oder (entwurf = null) entfernen. */
export async function coverSetzen(tastingId: string, entwurf: FotoEntwurf | null): Promise<void> {
  await db.transaction('rw', db.fotos, async () => {
    await db.fotos.where('[art+bezugId]').equals(['cover', tastingId]).delete();
    if (!entwurf) return;
    await db.fotos.put({
      id: crypto.randomUUID(),
      art: 'cover',
      bezugId: tastingId,
      reihenfolge: 1,
      blob: entwurf.blob,
      vorschau: entwurf.vorschau,
      breite: entwurf.breite,
      hoehe: entwurf.hoehe,
      erstelltAm: new Date().toISOString(),
    });
  });
}

export async function fotosVonLoeschen(bezugId: string): Promise<void> {
  await db.fotos.where('bezugId').equals(bezugId).delete();
}

/** Fotos ohne zugehöriges Getränk bzw. Tasting entfernen (z. B. wenn die App mitten in der Erfassung beendet wurde). */
export async function verwaisteFotosAufraeumen(): Promise<number> {
  return db.transaction('rw', db.fotos, db.getraenke, db.tastings, async () => {
    const getraenkIds = new Set(await db.getraenke.toCollection().primaryKeys());
    const tastingIds = new Set(await db.tastings.toCollection().primaryKeys());
    const verwaist = await db.fotos.filter((f) => !(f.art === 'getraenk' ? getraenkIds : tastingIds).has(f.bezugId)).primaryKeys();
    if (verwaist.length > 0) await db.fotos.bulkDelete(verwaist);
    return verwaist.length;
  });
}
