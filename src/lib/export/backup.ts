import type JSZip from 'jszip';
import {
  alsKopie,
  backupPruefen,
  BackupFehler,
  reihenfolgeNeu,
  SCHEMA_VERSION,
  stileAbgleichen,
  type BackupDatei,
  type BackupTasting,
} from '../backupFormat';
import { db, ladeEinstellungen, tastingHartLoeschen } from '../db';
import { blobSicherLesen, vorschauAusBlob } from '../foto';
import type { Foto } from '../model';
import { de } from '../texte/de';

export const ZIP_MIME = 'application/zip';

export type BackupUmfang = { tastingId: string } | 'alle';

export interface BackupErgebnis {
  blob: Blob;
  zeitpunkt: string;
  tastings: number;
  biere: number;
  fotos: number;
  /** Fotos, die sich nicht lesen ließen (iOS-Blob-Fehler) und deshalb fehlen */
  fotosFehlen: number;
}

export async function backupErstellen(umfang: BackupUmfang, onFortschritt?: (fertig: number, gesamt: number) => void): Promise<BackupErgebnis> {
  // Der Zeitpunkt gilt ab Beginn: alles, was während des Sicherns geändert wird, bleibt "ungesichert".
  const zeitpunkt = new Date().toISOString();
  const tastings = umfang === 'alle' ? await db.tastings.toArray() : [await db.tastings.get(umfang.tastingId)].filter((t) => !!t);
  if (tastings.length === 0) throw new Error('Tasting nicht gefunden');

  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();

  const eintraege: BackupTasting[] = [];
  const fotoListe: { zipName: string; foto: Foto }[] = [];
  let biere = 0;
  for (const tasting of tastings) {
    const hersteller = await db.hersteller.where('tastingId').equals(tasting.id).toArray();
    const getraenke = await db.getraenke.where('tastingId').equals(tasting.id).toArray();
    const bezugIds = [tasting.id, ...getraenke.map((g) => g.id)];
    const fotos = await db.fotos.where('bezugId').anyOf(bezugIds).toArray();
    biere += getraenke.length;
    eintraege.push({ tasting, hersteller, getraenke, fotos: [] });
    for (const foto of fotos) fotoListe.push({ zipName: `fotos/${foto.id}.jpg`, foto });
  }

  let fertig = 0;
  let fotosFehlen = 0;
  const gesichert = new Set<string>();
  for (const { zipName, foto } of fotoListe) {
    try {
      // JPEGs sind schon komprimiert: ohne weitere Kompression ablegen (schneller auf dem Handy)
      zip.file(zipName, await blobSicherLesen(foto.blob), { compression: 'STORE' });
      gesichert.add(foto.id);
    } catch {
      fotosFehlen++;
    }
    onFortschritt?.(++fertig, fotoListe.length);
  }
  for (const eintrag of eintraege) {
    const bezugIds = new Set([eintrag.tasting.id, ...eintrag.getraenke.map((g) => g.id)]);
    eintrag.fotos = fotoListe
      .filter(({ foto }) => gesichert.has(foto.id) && bezugIds.has(foto.bezugId))
      .map(({ foto }) => {
        const { blob: _blob, vorschau: _vorschau, ...meta } = foto;
        return meta;
      });
  }

  const einstellungen = await ladeEinstellungen();
  const alleStile = einstellungen.stile;
  const genutzt = new Set(eintraege.flatMap((e) => e.getraenke.map((g) => g.stilId).filter((id): id is string => !!id)));
  const inhalt: BackupDatei = {
    schemaVersion: SCHEMA_VERSION,
    app: 'taste-report',
    art: umfang === 'alle' ? 'alle' : 'tasting',
    erstelltAm: zeitpunkt,
    einstellungen: umfang === 'alle' ? { verkoster: einstellungen.verkoster } : undefined,
    stile: umfang === 'alle' ? alleStile : alleStile.filter((s) => genutzt.has(s.id)),
    tastings: eintraege,
  };
  zip.file('backup.json', JSON.stringify(inhalt, null, 2));

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  return { blob, zeitpunkt, tastings: tastings.length, biere, fotos: gesichert.size, fotosFehlen };
}

/** Nach erfolgreichem Teilen/Speichern: Zeitpunkt der Sicherung vermerken (ohne geaendertAm zu ändern). */
export async function sicherungVermerken(umfang: BackupUmfang, zeitpunkt: string): Promise<void> {
  if (umfang === 'alle') {
    await ladeEinstellungen();
    await db.einstellungen.update('global', { letzteGesamtsicherung: zeitpunkt });
    for (const id of await db.tastings.toCollection().primaryKeys()) await db.tastings.update(id, { letzteSicherung: zeitpunkt });
  } else {
    await db.tastings.update(umfang.tastingId, { letzteSicherung: zeitpunkt });
  }
}

// ---------- Import ----------

export interface ImportVorschau {
  zip: JSZip;
  inhalt: BackupDatei;
  tastings: { id: string; name: string; biere: number; kollision: boolean }[];
  biere: number;
  fotos: number;
}

export type ImportModus = 'ersetzen' | 'kopie';

export interface ImportErgebnis {
  tastings: number;
  biere: number;
  fotos: number;
  fotosFehlen: number;
  neueStile: number;
}

export async function backupVorabPruefen(datei: Blob): Promise<ImportVorschau> {
  const { default: JSZip } = await import('jszip');
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(datei);
  } catch {
    throw new BackupFehler('format');
  }
  const json = zip.file('backup.json');
  if (!json) throw new BackupFehler('format');
  let roh: unknown;
  try {
    roh = JSON.parse(await json.async('string'));
  } catch {
    throw new BackupFehler('format');
  }
  const inhalt = backupPruefen(roh);
  const vorhanden = new Set(await db.tastings.toCollection().primaryKeys());
  return {
    zip,
    inhalt,
    tastings: inhalt.tastings.map((e) => ({ id: e.tasting.id, name: e.tasting.name, biere: e.getraenke.length, kollision: vorhanden.has(e.tasting.id) })),
    biere: inhalt.tastings.reduce((n, e) => n + e.getraenke.length, 0),
    fotos: inhalt.tastings.reduce((n, e) => n + e.fotos.length, 0),
  };
}

/**
 * Backup einspielen. Tastings mit bereits vorhandener ID werden je nach Modus ersetzt oder als Kopie
 * (neue IDs) angelegt, alle anderen unverändert übernommen. Alles in einer Transaktion.
 */
export async function backupImportieren(vorschau: ImportVorschau, modus: ImportModus): Promise<ImportErgebnis> {
  const { zip, inhalt } = vorschau;
  const vorhanden = new Set(await db.tastings.toCollection().primaryKeys());
  const einstellungen = await ladeEinstellungen();
  const abgleich = stileAbgleichen(einstellungen.stile, inhalt.stile, () => crypto.randomUUID());

  // quelle = Eintrag im ZIP (dort heißen die Bilddateien nach der ursprünglichen Foto-ID), eintrag = was gespeichert wird
  const eintraege: { eintrag: BackupTasting; quelle: BackupTasting }[] = [];
  const ersetzen: string[] = [];
  for (const e of inhalt.tastings) {
    const kollision = vorhanden.has(e.tasting.id);
    if (kollision && modus === 'kopie') eintraege.push({ eintrag: alsKopie(e, () => crypto.randomUUID(), de.backup.kopieSuffix), quelle: e });
    else {
      eintraege.push({ eintrag: e, quelle: e });
      if (kollision) ersetzen.push(e.tasting.id);
    }
  }

  // Bilder vorbereiten (außerhalb der Transaktion, das Dekodieren ist asynchron)
  const fotos: Foto[] = [];
  let fotosFehlen = 0;
  for (const { eintrag, quelle } of eintraege) {
    for (let i = 0; i < eintrag.fotos.length; i++) {
      const datei = zip.file(`fotos/${quelle.fotos[i].id}.jpg`);
      if (!datei) {
        fotosFehlen++;
        continue;
      }
      const blob = new Blob([await datei.async('arraybuffer')], { type: 'image/jpeg' });
      fotos.push({ ...eintrag.fotos[i], blob, vorschau: await vorschauAusBlob(blob) });
    }
  }
  const fotosNeuNummeriert = reihenfolgeNeu(fotos);

  const stileUmrechnen = (stilId: string | undefined) => (stilId ? abgleich.idMap.get(stilId) : undefined);

  await db.transaction('rw', db.einstellungen, db.tastings, db.hersteller, db.getraenke, db.fotos, async () => {
    for (const id of ersetzen) await tastingHartLoeschen(id);
    await db.tastings.bulkPut(eintraege.map(({ eintrag: e }) => ({ ...e.tasting, letzteSicherung: inhalt.erstelltAm })));
    await db.hersteller.bulkPut(eintraege.flatMap(({ eintrag: e }) => e.hersteller));
    await db.getraenke.bulkPut(eintraege.flatMap(({ eintrag: e }) => e.getraenke.map((g) => ({ ...g, stilId: stileUmrechnen(g.stilId) }))));
    await db.fotos.bulkPut(fotosNeuNummeriert);
    const aktuell = (await db.einstellungen.get('global')) ?? einstellungen;
    const verkoster = aktuell.verkoster.trim() === '' && inhalt.einstellungen?.verkoster ? inhalt.einstellungen.verkoster : aktuell.verkoster;
    await db.einstellungen.put({ ...aktuell, stile: abgleich.stile, verkoster });
  });

  return {
    tastings: eintraege.length,
    biere: eintraege.reduce((n, { eintrag: e }) => n + e.getraenke.length, 0),
    fotos: fotosNeuNummeriert.length,
    fotosFehlen,
    neueStile: abgleich.neu,
  };
}
