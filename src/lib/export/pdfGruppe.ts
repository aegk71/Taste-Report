import { formatBewertung } from '../bewertung';
import { formatZeitraum } from '../datum';
import { fotosSortiert } from '../fotos';
import { de } from '../texte/de';
import { herstellerGruppen, mittel, vergleichsRangliste, vergleichsSieger, type VergleichsBier } from '../vergleich';
import { ladeVergleich } from '../vergleichDaten';
import { bildFuerPdf, type PdfBild } from './pdfBild';
import { coverSeiteZeichnen } from './pdfCover';
import { SCHRIFT_TEXT, SCHRIFT_TITEL, schriftenRegistrieren } from './pdfSchriften';
import { bereinigeText, metaZeile } from './pdfText';
import { INHALT_OBEN, INHALT_UNTEN, INNEN, PT, pdfWerkzeug, RAND, SEITE_B } from './pdfWerkzeug';
import { doldenReihe, doldenReiheBreite, FARBE, wortmarkeZeichnen } from './pdfZeichnen';
import type { BerichtErgebnis } from './pdfBericht';

export interface GruppenberichtOptionen {
  /** Fotos der Biere einbeziehen (das Cover-Bild bleibt immer Teil des Layouts) */
  fotos: boolean;
  /** Nur Biere mit mindestens einer Bewertung auf den Herstellerseiten */
  nurBewertete: boolean;
}

const FOTO = 40;
const FOTO_MAX_H = 56;
const PAD = 4;
const KARTE_ABSTAND = 4;
const HERSTELLER_KOPF = 13;
const VZ_NAME = 5.2; // Zeile mit Verkoster und Wert
const VZ_ZEILE = 4.2; // Zeile der Notiz
const VZ_ABSTAND = 1.8;

interface Block {
  name: string;
  wert?: number;
  zeilen: string[];
}

interface Karte {
  b: VergleichsBier;
  bild?: PdfBild;
  nameZeilen: string[];
  meta: string;
  bloecke: Block[];
  hoehe: number;
}

/** Gruppenbericht als PDF: Cover, Fazit, Top 5 und je Hersteller eine Seite mit Wert und Notiz jedes Verkosters. */
export async function gruppenberichtErstellen(
  vergleichId: string,
  optionen: GruppenberichtOptionen,
  onFortschritt?: (fertig: number, gesamt: number) => void,
): Promise<BerichtErgebnis> {
  const daten = await ladeVergleich(vergleichId);
  if (!daten || daten.tastings.length === 0) throw new Error('Vergleich nicht gefunden');
  const { vergleich, tastings, quellen, biere } = daten;
  const erstes = tastings[0];
  const verkoster = quellen.map((q) => q.verkoster);
  const t = de.gruppeExport.pdf;

  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  await schriftenRegistrieren(doc);
  doc.setProperties({ title: bereinigeText(`${vergleich.name} – Gruppenbericht`), author: bereinigeText(verkoster.join(', ')), creator: 'Taste Report' });

  const rangliste = vergleichsRangliste(biere);
  const gewinner = vergleichsSieger(vergleich.siegerSchluessel, biere);
  const gruppen = herstellerGruppen(biere);
  const gesamtSchnitt = mittel(biere.map((b) => b.durchschnitt));

  const werkzeug = pdfWerkzeug(doc);
  const { farbeFuellen, farbeLinie, farbeText, schrift, text, zeilen, hintergrund, passend, bildEinpassen, platzhalter, wertRechts } = werkzeug;

  async function titelbild(b: VergleichsBier, maxKante: number): Promise<PdfBild | undefined> {
    for (const e of b.eintraege) {
      const foto = (await fotosSortiert('getraenk', e.getraenk.id))[0];
      if (foto) return bildFuerPdf(foto.blob, maxKante);
    }
    return undefined;
  }

  // ---------- Seite 1: Cover (Cover-Bild des ersten Tastings, sonst das erste vorhandene) ----------
  let cover: PdfBild | undefined;
  for (const tasting of tastings) {
    const foto = (await fotosSortiert('cover', tasting.id))[0];
    if (foto) {
      cover = await bildFuerPdf(foto.blob, 1100);
      break;
    }
  }
  const namen = verkoster.length > 1 ? `${verkoster.slice(0, -1).join(', ')} ${t.und} ${verkoster[verkoster.length - 1]}` : (verkoster[0] ?? '');
  coverSeiteZeichnen(doc, werkzeug, {
    titel: vergleich.name,
    untertitel: t.untertitel,
    zeile: [formatZeitraum(erstes.datumVon, erstes.datumBis), erstes.ort].filter(Boolean).join(' · '),
    byline: namen.length <= 70 ? t.byline(namen) : t.bylineViele(verkoster.length),
    durchschnitt: gesamtSchnitt,
    bild: cover,
  });

  // ---------- Inhaltsseiten ----------
  let y = INHALT_OBEN;

  function inhaltsSeite() {
    doc.addPage();
    hintergrund(FARBE.papier);
    wortmarkeZeichnen(doc, RAND, 9, 22, FARBE.ink);
    schrift(SCHRIFT_TEXT, 'normal', 9);
    farbeText(FARBE.muted);
    text(zeilen(vergleich.name, 110)[0] ?? '', SEITE_B - RAND, 16, 'right');
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
    [String(biere.length), de.auswertung.biere],
    [String(quellen.length), t.verkoster],
    [gesamtSchnitt === undefined ? '–' : formatBewertung(gesamtSchnitt), de.auswertung.durchschnitt],
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
    const b = gewinner.bier;
    const sh = 34;
    farbeFuellen(FARBE.ocker);
    farbeLinie(FARBE.ink);
    doc.setLineWidth(0.7);
    doc.roundedRect(RAND, y, INNEN, sh, 3, 3, 'FD');
    const foto = optionen.fotos ? await titelbild(b, 600) : undefined;
    if (foto) bildEinpassen(foto, RAND + 5, y + 5, 24, 24, 2, true);
    else platzhalter(RAND + 5, y + 5, 24, 24, 2);
    const tx = RAND + 34;
    schrift(SCHRIFT_TEXT, 'bold', 8);
    farbeText(FARBE.ink);
    doc.setCharSpace(0.5);
    text(de.pdf.siegerLabel.toUpperCase(), tx, y + 9.5);
    doc.setCharSpace(0);
    schrift(SCHRIFT_TITEL, 'normal', 16);
    const nameZeilen = zeilen(b.name, 92).slice(0, 2);
    nameZeilen.forEach((zeile, i) => text(zeile, tx, y + 17 + i * 6.4));
    schrift(SCHRIFT_TEXT, 'normal', 10);
    text([b.herstellerName, b.stil, t.siegerInfo(b.anzahl, quellen.length)].filter(Boolean).join(' · '), tx, y + 17 + nameZeilen.length * 6.4 + 1);
    const dH = 7;
    doldenReihe(doc, SEITE_B - RAND - 5 - doldenReiheBreite(dH), y + 7, dH, b.durchschnitt, FARBE.hop, [236, 200, 120]);
    schrift(SCHRIFT_TITEL, 'normal', 20);
    farbeText(FARBE.ink);
    text(formatBewertung(b.durchschnitt ?? 0), SEITE_B - RAND - 5, y + 27, 'right');
    y += sh + 8;
  }

  if (rangliste.length > 0) {
    schrift(SCHRIFT_TITEL, 'normal', 13);
    farbeText(FARBE.ink);
    text(de.pdf.top5, RAND, y + 4);
    y += 8;
    for (const { bier, platz } of rangliste.slice(0, 5)) {
      schrift(SCHRIFT_TITEL, 'normal', 12);
      farbeText(FARBE.rot);
      text(String(platz), RAND + 3, y + 5, 'center');
      schrift(SCHRIFT_TEXT, 'bold', 11);
      farbeText(FARBE.ink);
      const zeile = zeilen(bier.name, 70)[0] ?? '';
      text(zeile, RAND + 10, y + 5);
      const nameB = doc.getTextWidth(bereinigeText(zeile));
      schrift(SCHRIFT_TEXT, 'normal', 9.5);
      farbeText(FARBE.muted);
      const zusatz = [bier.herstellerName ? zeilen(bier.herstellerName, 50)[0] : undefined, t.von(bier.anzahl, quellen.length)].filter(Boolean).join(' · ');
      text(`· ${zusatz}`, RAND + 10 + nameB + 2, y + 5);
      wertRechts(bier.durchschnitt, SEITE_B - RAND, y + 0.3, 5.6, 11);
      farbeLinie(FARBE.linie);
      doc.setLineWidth(0.3);
      doc.line(RAND, y + 8.2, SEITE_B - RAND, y + 8.2);
      y += 9;
    }
    y += 6;
  }

  if (erstes.fazit?.trim()) {
    schrift(SCHRIFT_TEXT, 'bold', 9);
    farbeText(FARBE.muted);
    text(t.fazitVon(verkoster[0] ?? erstes.verkoster), RAND + 6, y);
    y += 6;
    schrift(SCHRIFT_TEXT, 'normal', 11);
    const lh = 5.2;
    let start = y;
    for (const zeile of zeilen(erstes.fazit, INNEN - 8)) {
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
  const zuZeigen = gruppen
    .map((g) => ({ ...g, biere: g.biere.filter((b) => b.durchschnitt !== undefined || !optionen.nurBewertete) }))
    .filter((g) => g.biere.length > 0);
  const gesamt = zuZeigen.reduce((s, g) => s + g.biere.length, 0);
  let fertig = 0;
  onFortschritt?.(0, gesamt);

  const textX = RAND + PAD + (optionen.fotos ? FOTO + 5 : 0);
  const textB = RAND + INNEN - PAD - textX;
  const nameB = textB - 22;

  async function karteVorbereiten(b: VergleichsBier): Promise<Karte> {
    const bild = optionen.fotos ? await titelbild(b, 900) : undefined;
    schrift(SCHRIFT_TEXT, 'bold', 12.5);
    const nameZeilen = zeilen(b.name, nameB).slice(0, 3);
    const meta = metaZeile(b.eintraege.map((e) => e.getraenk).find((g) => metaZeile(g) !== '') ?? {});
    const kopfH = nameZeilen.length * 5.4 + 7;

    schrift(SCHRIFT_TEXT, 'normal', 9.3);
    const bloecke: Block[] = b.eintraege.map((e) => ({ name: e.verkoster, wert: e.bewertung, zeilen: e.getraenk.notiz?.trim() ? zeilen(e.getraenk.notiz.trim(), textB) : [] }));
    const maxInnen = INHALT_UNTEN - INHALT_OBEN - HERSTELLER_KOPF - 2 * PAD - 2;
    const hoeheFuer = (limit: number) => bloecke.reduce((s, bl) => s + VZ_NAME + Math.min(bl.zeilen.length, limit) * VZ_ZEILE + VZ_ABSTAND, 0);
    // Notizen so weit kürzen, dass die Karte auf eine Seite passt
    let limit = Math.max(1, ...bloecke.map((bl) => bl.zeilen.length));
    while (limit > 1 && kopfH + 2 + hoeheFuer(limit) > maxInnen) limit--;
    for (const bl of bloecke) if (bl.zeilen.length > limit) bl.zeilen = [...bl.zeilen.slice(0, Math.max(0, limit - 1)), '…'];
    const textH = kopfH + 2 + hoeheFuer(limit);
    const hauptH = optionen.fotos ? (bild ? passend(bild, FOTO, FOTO_MAX_H).h : FOTO) : 0;
    return { b, bild, nameZeilen, meta, bloecke, hoehe: 2 * PAD + Math.max(textH, hauptH) };
  }

  function karteZeichnen(k: Karte) {
    const top = y;
    farbeFuellen(FARBE.karte);
    farbeLinie(FARBE.ink);
    doc.setLineWidth(0.5);
    doc.roundedRect(RAND, top, INNEN, k.hoehe, 2.5, 2.5, 'FD');

    if (optionen.fotos) {
      if (k.bild) bildEinpassen(k.bild, RAND + PAD, top + PAD, FOTO, FOTO_MAX_H, 2);
      else platzhalter(RAND + PAD, top + PAD, FOTO, FOTO, 2);
    }

    let ty = top + PAD + 3.8;
    schrift(SCHRIFT_TEXT, 'bold', 12.5);
    farbeText(FARBE.ink);
    for (const zeile of k.nameZeilen) {
      text(zeile, textX, ty);
      ty += 5.4;
    }
    wertRechts(k.b.durchschnitt, RAND + INNEN - PAD, top + PAD + 0.3, 5.6, 12);

    const zy = ty - 5.4 + 7;
    let x = textX;
    if (k.b.stil) {
      schrift(SCHRIFT_TEXT, 'bold', 8);
      const w = doc.getTextWidth(bereinigeText(k.b.stil)) + 4.8;
      farbeFuellen(FARBE.hopSoft);
      farbeLinie(FARBE.hop);
      doc.setLineWidth(0.3);
      doc.roundedRect(x, zy - 3.7, w, 4.9, 2.45, 2.45, 'FD');
      farbeText(FARBE.ink);
      text(k.b.stil, x + 2.4, zy);
      x += w + 3;
    }
    schrift(SCHRIFT_TEXT, 'normal', 9);
    farbeText(FARBE.muted);
    if (k.meta) text(k.meta, x, zy);
    text(t.von(k.b.anzahl, quellen.length), RAND + INNEN - PAD, zy, 'right');
    ty = zy + 2.5 + 2;

    for (const bl of k.bloecke) {
      ty += VZ_NAME - 1;
      schrift(SCHRIFT_TEXT, 'bold', 9.8);
      farbeText(FARBE.ink);
      text(zeilen(bl.name, textB - 22)[0] ?? '', textX, ty);
      wertRechts(bl.wert, RAND + INNEN - PAD, ty - 3.6, 4.6, 10);
      ty += 1;
      schrift(SCHRIFT_TEXT, 'normal', 9.3);
      farbeText(FARBE.ink);
      for (const zeile of bl.zeilen) {
        ty += VZ_ZEILE;
        text(zeile, textX, ty - 0.8);
      }
      ty += VZ_ABSTAND - 1 + (bl.zeilen.length === 0 ? 0 : 0);
    }
  }

  function herstellerKopf(name: string, standort: string | undefined, anzahl: number, durchschnitt: number | undefined, fortsetzung: boolean) {
    schrift(SCHRIFT_TITEL, 'normal', 15);
    farbeText(FARBE.ink);
    const titel = fortsetzung ? `${name} ${de.pdf.fortsetzung}` : name;
    text(zeilen(titel, 120)[0] ?? '', RAND, y + 5.2);
    schrift(SCHRIFT_TEXT, 'normal', 9.5);
    farbeText(FARBE.muted);
    text([standort, de.liste.biere(anzahl)].filter(Boolean).join(' · '), RAND, y + 10);
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

    const schnitt = mittel(gruppe.biere.map((b) => b.durchschnitt));
    let ersteKarte = true;
    for (const bier of gruppe.biere) {
      const karte = await karteVorbereiten(bier);
      if (ersteKarte) {
        if (y + HERSTELLER_KOPF + karte.hoehe > INHALT_UNTEN) inhaltsSeite();
        herstellerKopf(gruppe.name, gruppe.standort, gruppe.biere.length, schnitt, false);
        ersteKarte = false;
      } else if (y + karte.hoehe > INHALT_UNTEN) {
        inhaltsSeite();
        herstellerKopf(gruppe.name, gruppe.standort, gruppe.biere.length, schnitt, true);
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
    text(`${de.app.name} · ${t.fuss}`, RAND, 289);
    text(`${de.pdf.seite} ${i} ${de.pdf.von} ${seiten}`, SEITE_B - RAND, 289, 'right');
  }

  return { blob: doc.output('blob'), seiten };
}
