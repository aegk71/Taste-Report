import type { jsPDF } from 'jspdf';
import { kennzahlen, rangliste, sieger as siegerVon } from '../auswertung';
import { formatBewertung } from '../bewertung';
import { db } from '../db';
import { formatZeitraum } from '../datum';
import { fotosSortiert } from '../fotos';
import { gruppiere } from '../getraenke';
import type { Getraenk, Hersteller, Tasting } from '../model';
import { de } from '../texte/de';
import { bildFuerPdf, type PdfBild } from './pdfBild';
import { SCHRIFT_TEXT, SCHRIFT_TITEL, schriftenRegistrieren } from './pdfSchriften';
import { bereinigeText, metaZeile } from './pdfText';
import {
  doldeZeichnen,
  doldenReihe,
  doldenReiheBreite,
  FARBE,
  wortmarkeHoehe,
  wortmarkeZeichnen,
  type Farbe,
} from './pdfZeichnen';

export interface BerichtOptionen {
  /** Fotos der Biere einbeziehen (das Cover-Bild bleibt immer Teil des Layouts) */
  fotos: boolean;
  /** Nur Biere mit Bewertung auf den Herstellerseiten */
  nurBewertete: boolean;
}

export interface BerichtErgebnis {
  blob: Blob;
  seiten: number;
}

const SEITE_B = 210;
const SEITE_H = 297;
const RAND = 15;
const INNEN = SEITE_B - 2 * RAND;
const INHALT_OBEN = 27;
const INHALT_UNTEN = 278;
const PT = 0.3528; // 1 pt in mm

const FOTO = 40; // Breite des Hauptfotos auf der Karte
const FOTO_MAX_H = 56; // höchstens so hoch (Hochformat)
const EXTRA = 19; // Breite der weiteren Fotos
const EXTRA_MAX_H = 26;
const PAD = 4;
const KARTE_ABSTAND = 4;
const HERSTELLER_KOPF = 13;
const NOTIZ_ZEILE = 4.5;

interface Karte {
  g: Getraenk;
  bilder: PdfBild[];
  nameZeilen: string[];
  meta: string;
  notizZeilen: string[];
  hoehe: number;
}

export async function berichtErstellen(
  tastingId: string,
  optionen: BerichtOptionen,
  onFortschritt?: (fertig: number, gesamt: number) => void,
): Promise<BerichtErgebnis> {
  const gefunden = await db.tastings.get(tastingId);
  if (!gefunden) throw new Error('Tasting nicht gefunden');
  const tasting: Tasting = gefunden;
  const hersteller = await db.hersteller.where('tastingId').equals(tastingId).toArray();
  const getraenke = await db.getraenke.where('tastingId').equals(tastingId).toArray();

  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  await schriftenRegistrieren(doc);
  doc.setProperties({ title: bereinigeText(`${tasting.name} – Verkostungsbericht`), author: bereinigeText(tasting.verkoster), creator: 'Taste Report' });

  const zahlen = kennzahlen(getraenke);
  const gewinner = siegerVon(tasting, getraenke);
  const platzierungen = rangliste(getraenke);
  const herstellerName = new Map(hersteller.map((h) => [h.id, h.name]));

  // ---------- Hilfen ----------
  const farbeFuellen = (f: Farbe) => doc.setFillColor(...f);
  const farbeLinie = (f: Farbe) => doc.setDrawColor(...f);
  const farbeText = (f: Farbe) => doc.setTextColor(...f);
  const schrift = (name: string, stil: 'normal' | 'bold', pt: number) => {
    doc.setFont(name, stil);
    doc.setFontSize(pt);
  };
  const text = (s: string, x: number, y: number, ausrichtung: 'left' | 'center' | 'right' = 'left') =>
    doc.text(bereinigeText(s), x, y, { align: ausrichtung });
  const zeilen = (s: string, breite: number): string[] => doc.splitTextToSize(bereinigeText(s), breite) as string[];
  const hintergrund = (f: Farbe) => {
    farbeFuellen(f);
    doc.rect(0, 0, SEITE_B, SEITE_H, 'F');
  };

  /** Größe, mit der ein Bild ohne Zuschnitt in einen Rahmen passt (Hoch- und Querformat bleiben erhalten). */
  const passend = (bild: PdfBild, maxB: number, maxH: number) => {
    const skala = Math.min(maxB / bild.breite, maxH / bild.hoehe);
    return { b: bild.breite * skala, h: bild.hoehe * skala };
  };

  /** Ganzes Bild (object-fit: contain) im Rahmen maxB x maxH: mittig (mittig = true) oder oben links, mit Rundung und Rand. */
  const bildEinpassen = (bild: PdfBild, x: number, y: number, maxB: number, maxH: number, radius: number, mittig = false) => {
    const { b, h } = passend(bild, maxB, maxH);
    const bx = mittig ? x + (maxB - b) / 2 : x;
    const by = mittig ? y + (maxH - h) / 2 : y;
    doc.saveGraphicsState();
    doc.roundedRect(bx, by, b, h, radius, radius, null);
    doc.clip();
    doc.discardPath();
    doc.addImage(bild.dataUrl, 'JPEG', bx, by, b, h);
    doc.restoreGraphicsState();
    farbeLinie(FARBE.ink);
    doc.setLineWidth(0.5);
    doc.roundedRect(bx, by, b, h, radius, radius, 'S');
  };

  const platzhalter = (x: number, y: number, b: number, h: number, radius: number) => {
    farbeFuellen(FARBE.ocker);
    farbeLinie(FARBE.ink);
    doc.setLineWidth(0.5);
    doc.roundedRect(x, y, b, h, radius, radius, 'FD');
    const dh = Math.min(b, h) * 0.62;
    doldeZeichnen(doc, x + (b - (dh * 58.9) / 83.7) / 2, y + (h - dh) / 2, dh, 1, [196, 146, 52]);
  };

  /** Eine Dolde mit Zahl, rechtsbündig an xRechts. */
  const wertRechts = (wert: number | undefined, xRechts: number, yOben: number, doldeH: number, pt: number) => {
    schrift(SCHRIFT_TEXT, 'bold', pt);
    const zahl = wert === undefined ? '–' : formatBewertung(wert);
    farbeText(wert === undefined ? FARBE.muted : FARBE.ink);
    const w = doc.getTextWidth(zahl);
    text(zahl, xRechts, yOben + doldeH * 0.78, 'right');
    const dBreite = (doldeH * 58.9) / 83.7;
    doldeZeichnen(doc, xRechts - w - 1.6 - dBreite, yOben, doldeH, wert === undefined ? 0 : 1, FARBE.hop);
  };

  // ---------- Seite 1: Cover ----------
  const coverFoto = (await fotosSortiert('cover', tasting.id))[0];
  const cover = coverFoto ? await bildFuerPdf(coverFoto.blob, 1100) : undefined;
  coverSeite(doc, tasting, zahlen.durchschnitt, cover);

  function coverSeite(d: jsPDF, t: Tasting, durchschnitt: number | undefined, bild: PdfBild | undefined) {
    hintergrund(FARBE.ocker);
    farbeLinie(FARBE.ink);
    d.setLineWidth(1.4);
    d.roundedRect(12, 12, SEITE_B - 24, SEITE_H - 24, 7, 7, 'S');

    const wb = 64;
    wortmarkeZeichnen(d, (SEITE_B - wb) / 2, 24, wb, FARBE.ink);

    const bx = 50;
    const by = 62;
    const bs = 110;
    // Cover-Bild ungeschnitten: Hochformat bis 110 mm hoch, Querformat bis 130 mm breit
    if (bild) bildEinpassen(bild, (SEITE_B - 130) / 2, by, 130, bs, 5, true);
    else {
      farbeFuellen(FARBE.papier);
      farbeLinie(FARBE.ink);
      d.setLineWidth(0.5);
      d.roundedRect(bx, by, bs, bs, 5, 5, 'FD');
      const dh = 72;
      doldeZeichnen(d, bx + (bs - (dh * 58.9) / 83.7) / 2, by + (bs - dh) / 2, dh, 1, [236, 200, 120]);
    }

    let pt = 30;
    schrift(SCHRIFT_TITEL, 'normal', pt);
    let titel = zeilen(t.name, 164);
    while (titel.length > 3 && pt > 20) {
      pt -= 2;
      schrift(SCHRIFT_TITEL, 'normal', pt);
      titel = zeilen(t.name, 164);
    }
    const lh = pt * PT * 1.12;
    let y = by + bs + 17;
    for (const zeile of titel) {
      farbeText(FARBE.ink);
      text(zeile, SEITE_B / 2 + 0.6, y + 0.6, 'center');
      farbeText(FARBE.rot);
      text(zeile, SEITE_B / 2, y, 'center');
      y += lh;
    }
    farbeText(FARBE.ink);
    if (t.untertitel) {
      schrift(SCHRIFT_TEXT, 'bold', 14);
      for (const zeile of zeilen(t.untertitel, 160)) {
        text(zeile, SEITE_B / 2, y + 1, 'center');
        y += 6.2;
      }
    }
    schrift(SCHRIFT_TEXT, 'bold', 12.5);
    text([formatZeitraum(t.datumVon, t.datumBis), t.ort].filter(Boolean).join(' · '), SEITE_B / 2, y + 2.5, 'center');

    farbeLinie(FARBE.ink);
    d.setLineWidth(0.8);
    d.line(26, 255, SEITE_B - 26, 255);
    schrift(SCHRIFT_TEXT, 'bold', 12);
    text(`${de.pdf.berichtVon} ${t.verkoster}`, SEITE_B / 2, 263, 'center');
    if (durchschnitt !== undefined) {
      const dH = 7.5;
      const gesamt = doldenReiheBreite(dH);
      doldenReihe(d, (SEITE_B - gesamt) / 2, 267, dH, durchschnitt, FARBE.hop, [236, 200, 120]);
    }
  }

  // ---------- Inhaltsseiten ----------
  let y = INHALT_OBEN;

  function inhaltsSeite() {
    doc.addPage();
    hintergrund(FARBE.papier);
    wortmarkeZeichnen(doc, RAND, 9, 22, FARBE.ink);
    schrift(SCHRIFT_TEXT, 'normal', 9);
    farbeText(FARBE.muted);
    text(zeilen(tasting.name, 110)[0] ?? '', SEITE_B - RAND, 16, 'right');
    farbeLinie(FARBE.linie);
    doc.setLineWidth(0.4);
    doc.line(RAND, 21, SEITE_B - RAND, 21);
    y = INHALT_OBEN;
  }

  function ueberschrift(titel: string, pt = 22) {
    schrift(SCHRIFT_TITEL, 'normal', pt);
    farbeText(FARBE.rot);
    text(titel, RAND, y + pt * PT * 0.8);
    y += pt * PT * 0.95 + 1.5;
    farbeLinie(FARBE.ink);
    doc.setLineWidth(0.8);
    doc.line(RAND, y, SEITE_B - RAND, y);
    y += 7;
  }

  // ---------- Seite 2: Fazit ----------
  inhaltsSeite();
  ueberschrift(de.pdf.fazit);

  const kachelB = (INNEN - 8) / 3;
  const kacheln: [string, string][] = [
    [String(zahlen.biere), de.auswertung.biere],
    [String(zahlen.hersteller), de.auswertung.hersteller],
    [zahlen.durchschnitt === undefined ? '–' : formatBewertung(zahlen.durchschnitt), de.auswertung.durchschnitt],
  ];
  kacheln.forEach(([wert, beschriftung], i) => {
    const x = RAND + i * (kachelB + 4);
    farbeFuellen(FARBE.karte);
    farbeLinie(FARBE.ink);
    doc.setLineWidth(0.5);
    doc.roundedRect(x, y, kachelB, 17, 2.5, 2.5, 'FD');
    schrift(SCHRIFT_TITEL, 'normal', 17);
    farbeText(FARBE.ink);
    text(wert, x + kachelB / 2, y + 8.2, 'center');
    schrift(SCHRIFT_TEXT, 'normal', 8.5);
    farbeText(FARBE.muted);
    text(beschriftung, x + kachelB / 2, y + 13.6, 'center');
  });
  y += 17 + 7;

  if (gewinner) {
    const g = gewinner.getraenk;
    const sh = 34;
    farbeFuellen(FARBE.ocker);
    farbeLinie(FARBE.ink);
    doc.setLineWidth(0.7);
    doc.roundedRect(RAND, y, INNEN, sh, 3, 3, 'FD');
    const foto = optionen.fotos ? await titelbild(g.id, 600) : undefined;
    if (foto) bildEinpassen(foto, RAND + 5, y + 5, 24, 24, 2, true);
    else platzhalter(RAND + 5, y + 5, 24, 24, 2);
    const tx = RAND + 34;
    schrift(SCHRIFT_TEXT, 'bold', 8);
    farbeText(FARBE.ink);
    doc.setCharSpace(0.5);
    text(de.pdf.siegerLabel.toUpperCase(), tx, y + 9.5);
    doc.setCharSpace(0);
    schrift(SCHRIFT_TITEL, 'normal', 16);
    const nameZeilen = zeilen(g.name, 92).slice(0, 2);
    nameZeilen.forEach((zeile, i) => text(zeile, tx, y + 17 + i * 6.4));
    schrift(SCHRIFT_TEXT, 'normal', 10);
    text([herstellerName.get(g.herstellerId), g.stilName].filter(Boolean).join(' · '), tx, y + 17 + nameZeilen.length * 6.4 + 1);
    const dH = 7;
    const reiheB = doldenReihe(doc, SEITE_B - RAND - 5 - doldenReiheBreite(dH), y + 7, dH, g.bewertung, FARBE.hop, [236, 200, 120]);
    void reiheB;
    schrift(SCHRIFT_TITEL, 'normal', 20);
    farbeText(FARBE.ink);
    text(formatBewertung(g.bewertung ?? 0), SEITE_B - RAND - 5, y + 27, 'right');
    y += sh + 8;
  }

  if (platzierungen.length > 0) {
    schrift(SCHRIFT_TITEL, 'normal', 13);
    farbeText(FARBE.ink);
    text(de.pdf.top5, RAND, y + 4);
    y += 8;
    for (const { getraenk, platz } of platzierungen.slice(0, 5)) {
      schrift(SCHRIFT_TITEL, 'normal', 12);
      farbeText(FARBE.rot);
      text(String(platz), RAND + 3, y + 5, 'center');
      schrift(SCHRIFT_TEXT, 'bold', 11);
      farbeText(FARBE.ink);
      const zeile = zeilen(getraenk.name, 80)[0] ?? '';
      text(zeile, RAND + 10, y + 5);
      const nameB = doc.getTextWidth(bereinigeText(zeile));
      schrift(SCHRIFT_TEXT, 'normal', 9.5);
      farbeText(FARBE.muted);
      const von = herstellerName.get(getraenk.herstellerId);
      if (von) text(`· ${zeilen(von, 60)[0]}`, RAND + 10 + nameB + 2, y + 5);
      wertRechts(getraenk.bewertung, SEITE_B - RAND, y + 0.3, 5.6, 11);
      farbeLinie(FARBE.linie);
      doc.setLineWidth(0.3);
      doc.line(RAND, y + 8.2, SEITE_B - RAND, y + 8.2);
      y += 9;
    }
    y += 6;
  }

  if (tasting.fazit?.trim()) {
    schrift(SCHRIFT_TEXT, 'normal', 11);
    const lh = 5.2;
    let start = y;
    for (const zeile of zeilen(tasting.fazit, INNEN - 8)) {
      if (y + lh > INHALT_UNTEN) {
        farbeFuellen(FARBE.hop);
        doc.rect(RAND, start - 3.6, 1.2, y - start + 3.6, 'F');
        inhaltsSeite();
        schrift(SCHRIFT_TEXT, 'normal', 11);
        start = y;
      }
      farbeText(FARBE.ink);
      text(zeile, RAND + 6, y);
      y += lh;
    }
    farbeFuellen(FARBE.hop);
    doc.rect(RAND, start - 3.6, 1.2, y - start + 3.6, 'F');
  }

  // ---------- Herstellerseiten ----------
  const { gruppen } = gruppiere(hersteller, getraenke);
  const sichtbar = (g: Getraenk) => g.bewertung !== undefined || !optionen.nurBewertete;
  const zuZeigen = gruppen
    .map((gr) => ({ ...gr, getraenke: gr.getraenke.filter(sichtbar) }))
    .filter((gr) => gr.getraenke.length > 0);
  const gesamt = zuZeigen.reduce((s, gr) => s + gr.getraenke.length, 0);
  let fertig = 0;
  onFortschritt?.(0, gesamt);

  async function titelbild(getraenkId: string, maxKante: number): Promise<PdfBild | undefined> {
    const foto = (await fotosSortiert('getraenk', getraenkId))[0];
    return foto ? bildFuerPdf(foto.blob, maxKante) : undefined;
  }

  const textX = RAND + PAD + (optionen.fotos ? FOTO + 5 : 0);
  const textB = RAND + INNEN - PAD - textX;
  const nameB = textB - 22;

  async function karteVorbereiten(g: Getraenk): Promise<Karte> {
    const bilder: PdfBild[] = [];
    if (optionen.fotos) {
      const fotos = (await fotosSortiert('getraenk', g.id)).slice(0, 3);
      for (const [i, foto] of fotos.entries()) {
        const bild = await bildFuerPdf(foto.blob, i === 0 ? 900 : 500);
        if (bild) bilder.push(bild);
      }
    }
    schrift(SCHRIFT_TEXT, 'bold', 12.5);
    const nameZeilen = zeilen(g.name, nameB).slice(0, 3);
    const meta = metaZeile(g);
    const hatZeile2 = Boolean(g.stilName || meta);
    const kopfH = nameZeilen.length * 5.4 + (hatZeile2 ? 7 : 0);
    const hauptH = bilder[0] ? passend(bilder[0], FOTO, FOTO_MAX_H).h : FOTO;
    const extraH = Math.max(0, ...bilder.slice(1, 3).map((b) => passend(b, EXTRA, EXTRA_MAX_H).h));
    const linkeH = optionen.fotos ? hauptH + (bilder.length > 1 ? 2 + extraH : 0) : 0;
    const maxInnen = INHALT_UNTEN - INHALT_OBEN - HERSTELLER_KOPF - 2 * PAD - 2;
    schrift(SCHRIFT_TEXT, 'normal', 9.8);
    let notizZeilen = g.notiz ? zeilen(g.notiz, textB) : [];
    const maxNotiz = Math.max(0, Math.floor((maxInnen - kopfH - 2) / NOTIZ_ZEILE));
    if (notizZeilen.length > maxNotiz) notizZeilen = [...notizZeilen.slice(0, Math.max(0, maxNotiz - 1)), '…'];
    const textH = kopfH + (notizZeilen.length > 0 ? 2 + notizZeilen.length * NOTIZ_ZEILE : 0);
    const hoehe = 2 * PAD + Math.max(textH, linkeH, 8);
    return { g, bilder, nameZeilen, meta, notizZeilen, hoehe };
  }

  function karteZeichnen(k: Karte) {
    const top = y;
    farbeFuellen(FARBE.karte);
    farbeLinie(FARBE.ink);
    doc.setLineWidth(0.5);
    doc.roundedRect(RAND, top, INNEN, k.hoehe, 2.5, 2.5, 'FD');

    if (optionen.fotos) {
      const fx = RAND + PAD;
      const fy = top + PAD;
      const hauptH = k.bilder[0] ? passend(k.bilder[0], FOTO, FOTO_MAX_H).h : FOTO;
      if (k.bilder[0]) bildEinpassen(k.bilder[0], fx, fy, FOTO, FOTO_MAX_H, 2);
      else platzhalter(fx, fy, FOTO, FOTO, 2);
      k.bilder.slice(1, 3).forEach((bild, i) => bildEinpassen(bild, fx + i * (EXTRA + 2), fy + hauptH + 2, EXTRA, EXTRA_MAX_H, 1.5));
    }

    let ty = top + PAD + 3.8;
    schrift(SCHRIFT_TEXT, 'bold', 12.5);
    farbeText(FARBE.ink);
    for (const zeile of k.nameZeilen) {
      text(zeile, textX, ty);
      ty += 5.4;
    }
    wertRechts(k.g.bewertung, RAND + INNEN - PAD, top + PAD + 0.3, 5.6, 12);

    if (k.g.stilName || k.meta) {
      const zy = ty - 5.4 + 7;
      let x = textX;
      if (k.g.stilName) {
        schrift(SCHRIFT_TEXT, 'bold', 8);
        const w = doc.getTextWidth(bereinigeText(k.g.stilName)) + 4.8;
        farbeFuellen(FARBE.hopSoft);
        farbeLinie(FARBE.hop);
        doc.setLineWidth(0.3);
        doc.roundedRect(x, zy - 3.7, w, 4.9, 2.45, 2.45, 'FD');
        farbeText(FARBE.ink);
        text(k.g.stilName, x + 2.4, zy);
        x += w + 3;
      }
      if (k.meta) {
        schrift(SCHRIFT_TEXT, 'normal', 9);
        farbeText(FARBE.muted);
        text(k.meta, x, zy);
      }
      ty = zy + 2.5;
    }
    if (k.notizZeilen.length > 0) {
      schrift(SCHRIFT_TEXT, 'normal', 9.8);
      farbeText(FARBE.ink);
      ty += 2.4;
      for (const zeile of k.notizZeilen) {
        text(zeile, textX, ty);
        ty += NOTIZ_ZEILE;
      }
    }
  }

  function herstellerKopf(h: Hersteller, anzahl: number, durchschnitt: number | undefined, fortsetzung: boolean) {
    schrift(SCHRIFT_TITEL, 'normal', 15);
    farbeText(FARBE.ink);
    const titel = fortsetzung ? `${h.name} ${de.pdf.fortsetzung}` : h.name;
    text(zeilen(titel, 120)[0] ?? '', RAND, y + 5.2);
    schrift(SCHRIFT_TEXT, 'normal', 9.5);
    farbeText(FARBE.muted);
    text([h.standort, de.liste.biere(anzahl)].filter(Boolean).join(' · '), RAND, y + 10);
    if (durchschnitt !== undefined) wertRechts(durchschnitt, SEITE_B - RAND, y + 0.6, 6.4, 12);
    farbeLinie(FARBE.ink);
    doc.setLineWidth(0.5);
    doc.line(RAND, y + 11.6, SEITE_B - RAND, y + 11.6);
    y += HERSTELLER_KOPF;
  }

  let ersteSeite = true;
  for (const gruppe of zuZeigen) {
    if (ersteSeite) {
      inhaltsSeite();
      ersteSeite = false;
    } else y += 4;

    let ersteKarte = true;
    for (const g of gruppe.getraenke) {
      const karte = await karteVorbereiten(g);
      if (ersteKarte) {
        if (y + HERSTELLER_KOPF + karte.hoehe > INHALT_UNTEN) inhaltsSeite();
        herstellerKopf(gruppe.hersteller, gruppe.getraenke.length, gruppe.durchschnitt, false);
        ersteKarte = false;
      } else if (y + karte.hoehe > INHALT_UNTEN) {
        inhaltsSeite();
        herstellerKopf(gruppe.hersteller, gruppe.getraenke.length, gruppe.durchschnitt, true);
      }
      karteZeichnen(karte);
      y += karte.hoehe + KARTE_ABSTAND;
      onFortschritt?.(++fertig, gesamt);
    }
  }

  // ---------- Fußzeilen ----------
  const seiten = doc.getNumberOfPages();
  for (let i = 2; i <= seiten; i++) {
    doc.setPage(i);
    farbeLinie(FARBE.linie);
    doc.setLineWidth(0.4);
    doc.line(RAND, 284, SEITE_B - RAND, 284);
    schrift(SCHRIFT_TEXT, 'normal', 8.5);
    farbeText(FARBE.muted);
    text(`${de.app.name} · ${tasting.verkoster}`, RAND, 289);
    text(`${de.pdf.seite} ${i} ${de.pdf.von} ${seiten}`, SEITE_B - RAND, 289, 'right');
  }

  return { blob: doc.output('blob'), seiten };
}
