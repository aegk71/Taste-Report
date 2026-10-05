import { kennzahlen, rangliste, sieger as siegerVon } from '../auswertung';
import { formatBewertung } from '../bewertung';
import { formatZeitraum } from '../datum';
import { db } from '../db';
import { fotosSortiert } from '../fotos';
import { artikelBereinigen } from '../ki/artikel';
import type { Getraenk, Tasting } from '../model';
import { de } from '../texte/de';
import { seiteAufteilen } from './magazinSatz';
import type { BerichtErgebnis } from './pdfBericht';
import { bildFuerPdf, type PdfBild } from './pdfBild';
import { SCHRIFT_TEXT, SCHRIFT_TITEL, schriftenRegistrieren } from './pdfSchriften';
import { bereinigeText } from './pdfText';
import { INHALT_OBEN, INHALT_UNTEN, INNEN, PT, pdfWerkzeug, RAND, SEITE_B } from './pdfWerkzeug';
import { doldeZeichnen, doldenReihe, doldenReiheBreite, FARBE, wortmarkeHoehe, wortmarkeZeichnen } from './pdfZeichnen';

const SPALTE_GAP = 6;
const SPALTE_B = (INNEN - SPALTE_GAP) / 2;
const ZEILE = 4.9;
const LUECKE = 2.6;
const TEXT_PT = 10.2;
const INITIAL_PT = 34;
const STRECKE_SPALTEN = 3;
const STRECKE_GAP = 5;
const STRECKE_B = (INNEN - (STRECKE_SPALTEN - 1) * STRECKE_GAP) / STRECKE_SPALTEN;
const STRECKE_MAX_H = 62;
const STRECKE_MAX = 12;

/** Eine Zeile (oder Absatzlücke, t = '') im Spaltensatz. x = Einzug für die Initiale. */
interface Posten {
  t: string;
  h: number;
  x: number;
  initial?: string;
}

interface StreckeBild {
  g: Getraenk;
  bild: PdfBild;
}

/** Magazin-Bericht (zweite Berichtsvariante) aus dem gespeicherten KI-Text. Offline, ohne weitere Kosten. */
export async function magazinErstellen(tastingId: string, onFortschritt?: (fertig: number, gesamt: number) => void): Promise<BerichtErgebnis> {
  const gefunden = await db.tastings.get(tastingId);
  if (!gefunden?.artikel) throw new Error('Kein Magazin-Text vorhanden');
  const tasting: Tasting = gefunden;
  const hersteller = await db.hersteller.where('tastingId').equals(tastingId).toArray();
  const getraenke = await db.getraenke.where('tastingId').equals(tastingId).toArray();
  const probiert = getraenke.filter((g) => g.zustand === 'probiert');
  // Verweise auf gelöschte oder inzwischen nur vorgemerkte Biere fallen weg
  const artikel = artikelBereinigen(gefunden.artikel, new Set(probiert.map((g) => g.id)));
  const bierVon = new Map(getraenke.map((g) => [g.id, g]));
  const herstellerName = new Map(hersteller.map((h) => [h.id, h.name]));

  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  await schriftenRegistrieren(doc);
  doc.setProperties({ title: bereinigeText(`${tasting.name} – Magazin`), author: bereinigeText(tasting.verkoster), creator: 'Taste Report' });
  const { farbeFuellen, farbeLinie, farbeText, schrift, text, zeilen, hintergrund, passend, bildEinpassen, platzhalter, wertRechts } = pdfWerkzeug(doc);

  const zahlen = kennzahlen(getraenke);
  const gewinner = siegerVon(tasting, getraenke);
  const platzierungen = rangliste(getraenke);

  // ---------- Bilder vorbereiten ----------
  const bewertete = platzierungen.map((p) => p.getraenk);
  const mitUnterschrift = bewertete.filter((g) => artikel.bildunterschriften[g.id]);
  const streckeBiere = (mitUnterschrift.length > 0 ? mitUnterschrift : bewertete.slice(0, 6)).slice(0, STRECKE_MAX);
  const coverFoto = (await fotosSortiert('cover', tasting.id))[0];
  const gesamt = streckeBiere.length + 1 + (gewinner ? 1 : 0);
  let fertig = 0;
  onFortschritt?.(0, gesamt);
  const fortschritt = () => onFortschritt?.(++fertig, gesamt);
  const titelfoto = async (id: string, kante: number): Promise<PdfBild | undefined> => {
    const foto = (await fotosSortiert('getraenk', id))[0];
    return foto ? bildFuerPdf(foto.blob, kante) : undefined;
  };
  const cover = coverFoto ? await bildFuerPdf(coverFoto.blob, 1100) : undefined;
  fortschritt();
  const strecke: StreckeBild[] = [];
  for (const g of streckeBiere) {
    const bild = await titelfoto(g.id, 600);
    if (bild) strecke.push({ g, bild });
    fortschritt();
  }
  const siegerBild = gewinner ? await titelfoto(gewinner.getraenk.id, 600) : undefined;
  if (gewinner) fortschritt();

  // ---------- Seite 1: Titel ----------
  hintergrund(FARBE.ocker);
  farbeLinie(FARBE.ink);
  doc.setLineWidth(1.4);
  doc.roundedRect(12, 12, 186, 273, 7, 7, 'S');
  const wb = 64;
  wortmarkeZeichnen(doc, (SEITE_B - wb) / 2, 22, wb, FARBE.ink);
  schrift(SCHRIFT_TEXT, 'bold', 9.5);
  farbeText(FARBE.ink);
  doc.setCharSpace(2.6);
  text(de.magazinPdf.kicker, SEITE_B / 2 + 1.3, 22 + wortmarkeHoehe(wb) + 5.5, 'center');
  doc.setCharSpace(0);
  const by = 62;
  const bs = 98;
  if (cover) bildEinpassen(cover, (SEITE_B - 130) / 2, by, 130, bs, 5, true);
  else {
    farbeFuellen(FARBE.papier);
    farbeLinie(FARBE.ink);
    doc.setLineWidth(0.5);
    doc.roundedRect((SEITE_B - bs) / 2, by, bs, bs, 5, 5, 'FD');
    const dh = 64;
    doldeZeichnen(doc, (SEITE_B - (dh * 58.9) / 83.7) / 2, by + (bs - dh) / 2, dh, 1, [236, 200, 120]);
  }
  let pt = 30;
  schrift(SCHRIFT_TITEL, 'normal', pt);
  let titel = zeilen(artikel.schlagzeile, 164);
  while (titel.length > 3 && pt > 18) {
    pt -= 2;
    schrift(SCHRIFT_TITEL, 'normal', pt);
    titel = zeilen(artikel.schlagzeile, 164);
  }
  const lh = pt * PT * 1.12;
  let ty = by + bs + 16;
  for (const zeile of titel) {
    farbeText(FARBE.ink);
    text(zeile, SEITE_B / 2 + 0.6, ty + 0.6, 'center');
    farbeText(FARBE.rot);
    text(zeile, SEITE_B / 2, ty, 'center');
    ty += lh;
  }
  farbeText(FARBE.ink);
  if (artikel.vorspann) {
    schrift(SCHRIFT_TEXT, 'bold', 12);
    for (const zeile of zeilen(artikel.vorspann, 150).slice(0, 4)) {
      text(zeile, SEITE_B / 2, ty + 1, 'center');
      ty += 5.6;
    }
  }
  farbeLinie(FARBE.ink);
  doc.setLineWidth(0.8);
  doc.line(26, 255, SEITE_B - 26, 255);
  schrift(SCHRIFT_TEXT, 'bold', 11.5);
  text(`${de.pdf.berichtVon} ${tasting.verkoster} · ${formatZeitraum(tasting.datumVon, tasting.datumBis)}${tasting.ort ? ` · ${tasting.ort}` : ''}`, SEITE_B / 2, 263, 'center');
  if (zahlen.durchschnitt !== undefined) {
    const dH = 7;
    doldenReihe(doc, (SEITE_B - doldenReiheBreite(dH)) / 2, 267, dH, zahlen.durchschnitt, FARBE.hop, [236, 200, 120]);
  }

  // ---------- Inhaltsseiten ----------
  let y = INHALT_OBEN;
  function neueSeite() {
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
  /** Platz für Höhe h sichern, sonst neue Seite. */
  const platz = (h: number) => {
    if (y + h > INHALT_UNTEN && y > INHALT_OBEN + 0.1) neueSeite();
  };

  function zwischenueberschrift(t: string) {
    if (!t.trim()) return;
    platz(9 + 4 * ZEILE);
    schrift(SCHRIFT_TITEL, 'normal', 14);
    farbeText(FARBE.rot);
    for (const zeile of zeilen(t, INNEN).slice(0, 2)) {
      text(zeile, RAND, y + 5);
      y += 6.4;
    }
    y += 2;
  }

  /** Absätze in Zeilen zerlegen; die erste Zeile des ersten Absatzes bekommt eine Initiale (2 Zeilen hoch). */
  function absatzPosten(inhalt: string, mitInitiale: boolean): Posten[] {
    const absaetze = bereinigeText(inhalt).split(/\n+/).map((a) => a.trim()).filter(Boolean);
    const posten: Posten[] = [];
    absaetze.forEach((absatz, i) => {
      if (i > 0) posten.push({ t: '', h: LUECKE, x: 0 });
      if (i === 0 && mitInitiale && absatz.length > 1) {
        const buchstabe = absatz[0];
        schrift(SCHRIFT_TITEL, 'normal', INITIAL_PT);
        const einzug = doc.getTextWidth(buchstabe) + 1.8;
        schrift(SCHRIFT_TEXT, 'normal', TEXT_PT);
        const erste = zeilen(absatz.slice(1).trimStart(), SPALTE_B - einzug);
        erste.slice(0, 2).forEach((z, j) => posten.push({ t: z, h: ZEILE, x: einzug, initial: j === 0 ? buchstabe : undefined }));
        const uebrig = erste.slice(2).join(' ');
        if (uebrig) for (const z of zeilen(uebrig, SPALTE_B)) posten.push({ t: z, h: ZEILE, x: 0 });
      } else {
        schrift(SCHRIFT_TEXT, 'normal', TEXT_PT);
        for (const z of zeilen(absatz, SPALTE_B)) posten.push({ t: z, h: ZEILE, x: 0 });
      }
    });
    return posten;
  }

  /** Zweispaltiger Fließtext: füllt die Seite, Spalten ausgeglichen, setzt auf der nächsten Seite fort. */
  function spaltenSatz(posten: Posten[]) {
    let rest = posten;
    while (rest.length > 0) {
      const frei = INHALT_UNTEN - y;
      const frischeSeite = y <= INHALT_OBEN + 0.1;
      if (frei < 3 * ZEILE + 2 && !frischeSeite) {
        neueSeite();
        continue;
      }
      let auf = seiteAufteilen(rest.map((p) => p.h), INHALT_UNTEN - y);
      if (auf.anzahl === 0) {
        if (!frischeSeite) {
          neueSeite();
          continue;
        }
        auf = { anzahl: 1, links: 1 };
      }
      const stueck = rest.slice(0, auf.anzahl);
      rest = rest.slice(auf.anzahl);
      const spalten = [stueck.slice(0, auf.links), stueck.slice(auf.links)].map((s) => {
        let i = 0;
        while (i < s.length && s[i].t === '') i++; // Absatzlücke am Spaltenanfang entfällt
        return s.slice(i);
      });
      let hoechste = 0;
      spalten.forEach((spalte, nr) => {
        const x0 = RAND + nr * (SPALTE_B + SPALTE_GAP);
        let yy = y;
        for (const p of spalte) {
          if (p.t !== '') {
            if (p.initial) {
              schrift(SCHRIFT_TITEL, 'normal', INITIAL_PT);
              farbeText(FARBE.rot);
              text(p.initial, x0, yy + ZEILE + 3.7);
            }
            schrift(SCHRIFT_TEXT, 'normal', TEXT_PT);
            farbeText(FARBE.ink);
            text(p.t, x0 + p.x, yy + 3.7);
          }
          yy += p.h;
        }
        hoechste = Math.max(hoechste, yy - y);
      });
      y += hoechste + 3;
      if (rest.length > 0) neueSeite();
    }
  }

  /** Zitat aus einer Notiz über die ganze Breite, mit grünem Balken und Namensangabe. */
  function zitatBlock(z: { bier: string; text: string }) {
    const g = bierVon.get(z.bier);
    schrift(SCHRIFT_TITEL, 'normal', 13);
    const ls = zeilen(`„${z.text}“`, INNEN - 10).slice(0, 6);
    const zl = 6.2;
    const h = ls.length * zl + 8;
    platz(h + 4);
    y += 2;
    farbeFuellen(FARBE.hop);
    doc.rect(RAND, y, 1.3, h - 1, 'F');
    farbeText(FARBE.ink);
    schrift(SCHRIFT_TITEL, 'normal', 13);
    ls.forEach((zeile, i) => text(zeile, RAND + 6, y + 4.6 + i * zl));
    if (g) {
      schrift(SCHRIFT_TEXT, 'normal', 8.5);
      farbeText(FARBE.muted);
      text(de.magazinPdf.ueber(tasting.verkoster, g.name), RAND + 6, y + ls.length * zl + 5.4);
    }
    y += h + 3;
  }

  /** Fotostrecke: je Zeile drei Fotos ohne Zuschnitt, darunter Unterschrift, Bier und Wert. */
  function fotostrecke() {
    if (strecke.length === 0) return;
    schrift(SCHRIFT_TEXT, 'bold', 9);
    const kacheln = strecke.map((s) => {
      const groesse = passend(s.bild, STRECKE_B, STRECKE_MAX_H);
      schrift(SCHRIFT_TEXT, 'bold', 9);
      const unterschrift = artikel.bildunterschriften[s.g.id] ? zeilen(artikel.bildunterschriften[s.g.id], STRECKE_B).slice(0, 3) : [];
      schrift(SCHRIFT_TEXT, 'normal', 8.5);
      const bierZeilen = zeilen([s.g.name, herstellerName.get(s.g.herstellerId)].filter(Boolean).join(' · '), STRECKE_B).slice(0, 2);
      return { ...s, unterschrift, bierZeilen, bildH: groesse.h };
    });
    for (let i = 0; i < kacheln.length; i += STRECKE_SPALTEN) {
      const reihe = kacheln.slice(i, i + STRECKE_SPALTEN);
      const reiheH = Math.max(...reihe.map((k) => k.bildH)) + 2.5 + Math.max(...reihe.map((k) => k.unterschrift.length * 4 + k.bierZeilen.length * 3.7)) + 6.5;
      platz((i === 0 ? 9 : 0) + reiheH + STRECKE_GAP);
      if (i === 0) {
        schrift(SCHRIFT_TITEL, 'normal', 14);
        farbeText(FARBE.rot);
        text(de.magazinPdf.imBild, RAND, y + 5);
        y += 9;
      }
      // Unterschriften einer Reihe stehen auf gleicher Höhe, unter dem höchsten Foto
      const bildH = Math.max(...reihe.map((k) => passend(k.bild, STRECKE_B, STRECKE_MAX_H).h));
      reihe.forEach((k, j) => {
        const x = RAND + j * (STRECKE_B + STRECKE_GAP);
        bildEinpassen(k.bild, x, y, STRECKE_B, STRECKE_MAX_H, 2);
        let yy = y + bildH + 2.5;
        schrift(SCHRIFT_TEXT, 'bold', 9);
        farbeText(FARBE.ink);
        for (const z of k.unterschrift) {
          text(z, x, yy + 3);
          yy += 4;
        }
        schrift(SCHRIFT_TEXT, 'normal', 8.5);
        farbeText(FARBE.muted);
        for (const z of k.bierZeilen) {
          text(z, x, yy + 2.8);
          yy += 3.7;
        }
        wertRechts(k.g.bewertung, x + STRECKE_B, yy + 0.8, 4.2, 9);
      });
      y += reiheH + STRECKE_GAP;
    }
  }

  // ---------- Text ----------
  neueSeite();
  artikel.abschnitte.forEach((abschnitt, i) => {
    zwischenueberschrift(abschnitt.ueberschrift);
    spaltenSatz(absatzPosten(abschnitt.text, i === 0));
    if (artikel.zitate[i]) zitatBlock(artikel.zitate[i]);
  });
  for (const z of artikel.zitate.slice(artikel.abschnitte.length)) zitatBlock(z);
  fotostrecke();

  // ---------- Bier des Festivals, Die Besten, Schlusswort ----------
  if (gewinner) {
    const g = gewinner.getraenk;
    const sh = 34;
    platz(sh + 8);
    farbeFuellen(FARBE.ocker);
    farbeLinie(FARBE.ink);
    doc.setLineWidth(0.7);
    doc.roundedRect(RAND, y, INNEN, sh, 3, 3, 'FD');
    if (siegerBild) bildEinpassen(siegerBild, RAND + 5, y + 5, 24, 24, 2, true);
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
    doldenReihe(doc, SEITE_B - RAND - 5 - doldenReiheBreite(dH), y + 7, dH, g.bewertung, FARBE.hop, [236, 200, 120]);
    schrift(SCHRIFT_TITEL, 'normal', 20);
    farbeText(FARBE.ink);
    text(formatBewertung(g.bewertung ?? 0), SEITE_B - RAND - 5, y + 27, 'right');
    y += sh + 8;
  }

  if (platzierungen.length > 0) {
    const eintraege = platzierungen.slice(0, 5);
    platz(9 + eintraege.length * 9 + 6);
    schrift(SCHRIFT_TITEL, 'normal', 13);
    farbeText(FARBE.rot);
    text(de.magazinPdf.diebesten, RAND, y + 4);
    y += 8;
    for (const { getraenk, platz: nr } of eintraege) {
      schrift(SCHRIFT_TITEL, 'normal', 12);
      farbeText(FARBE.rot);
      text(String(nr), RAND + 3, y + 5, 'center');
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

  if (artikel.schlusswort.trim()) {
    platz(8 + 3 * 5.2);
    schrift(SCHRIFT_TITEL, 'normal', 13);
    farbeText(FARBE.rot);
    text(de.magazinPdf.schlusswort, RAND, y + 4);
    y += 9;
    schrift(SCHRIFT_TEXT, 'normal', 11);
    farbeText(FARBE.ink);
    for (const zeile of zeilen(artikel.schlusswort, INNEN)) {
      platz(5.2);
      text(zeile, RAND, y + 3.8);
      y += 5.2;
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
    text(i === seiten ? de.magazinPdf.ki(tasting.verkoster) : `${de.app.name} · ${tasting.verkoster}`, RAND, 289);
    text(`${de.pdf.seite} ${i} ${de.pdf.von} ${seiten}`, SEITE_B - RAND, 289, 'right');
  }

  return { blob: doc.output('blob'), seiten };
}

