# CLAUDE.md – Taste Report (BrauKru)

Projektspezifikation und Arbeitsregeln. Phasen 1–8 sind umgesetzt und abgenommen; Erweiterungen siehe Abschnitt 11.
Optik-Soll: `schema/schema.html` (freigegeben, auch als Artefakt: https://claude.ai/artifact/Xf6DsCJ4PmBT1YeNnaqXnd).

## 1. Zweck

Mobile Web-App (PWA) zur Erfassung von Bierverkostungen auf einem Festival. Pro Festival entsteht **ein Tasting**, darin
**Hersteller** (Brauerei) mit **Getränken** (einzelnes Bier). Je Getränk: Stil, Gesamtbewertung 0–5, Notiz, Fotos.
Ergebnis: **gestalteter PDF-Bericht** (Cover, Fazit, Top 5, Herstellerseiten), schlanke **Excel-Datenliste**, **ZIP-Backup**.

- Einzelnutzer je Gerät, primäres Gerät **iPhone (Safari, als PWA auf dem Home-Bildschirm)**. Mehrgeräte-Sync ist eine spätere
  Ausbaustufe, das Backup-Format und das Feld `verkoster` halten sie offen.
- Kein Backend, keine Cloud. Alle Daten lokal (IndexedDB). Muss vollständig offline funktionieren (Festival, schlechtes Netz).
- Bedienung mit einer Hand, oft klebrige Finger: große Touch-Ziele (min. 44 × 44 px), wenig Tippen.
- UI- und Berichtssprache: **Deutsch**. Alle Texte zentral in `src/lib/texte/de.ts`. Zahlen mit Komma.
- Kein Zeitdruck. Phasen werden der Reihe nach abgearbeitet.

## 2. Arbeitsweise für Claude Code

- Strikt in den Phasen aus Abschnitt 10. Jede Phase: umsetzen → selbst testen → auf GitHub Pages deployen → auf mein
  „getestet, funktioniert“ warten. Die echte Abnahme erfolgt auf meinem iPhone.
- Keine Funktionen über den Phasenumfang hinaus. Bei Unklarheit oder nötiger Abweichung **vorher fragen**.
- Ein Commit pro abgeschlossenem Arbeitsschritt, Commit-Messages auf Deutsch. **`git commit` und `git push` immer als zwei
  getrennte Aufrufe.** Repo anlegen (`aegk71/Taste-Report`, öffentlich) erst nach meiner Rückfrage-Bestätigung.
- Antworten kurz und auf Deutsch.
- Vorlage ist die fertige App „Punkterfassung an Bord (LETHE)“ unter `C:\Users\a.kruse\Desktop\CLAUDE.WORKFILE\Mobile PWA`
  (nur lesen, nicht ändern). Bewährte Teile dort übernehmen: `src/lib/export/bild.ts` (`blobSicherLesen`),
  `export/pdfVorschau.ts`, `export/zip.ts`, `export/teilen.ts`, `foto.ts`, `anlagenKlappZustand.ts`, Deploy-Workflow, PWA-Konfig.

## 3. Tech-Stack

Wie Vorlage: Vite + TypeScript, Svelte 5 (Runes), Dexie/IndexedDB, vite-plugin-pwa, ExcelJS, jsPDF, pdfjs-dist, JSZip.
Hosting GitHub Pages über GitHub Actions, `base: '/Taste-Report/'`. Zusätzlich mit Freigabe dieser Spezifikation:
Schriften lokal einbetten (`@fontsource/alfa-slab-one`, `@fontsource-variable/source-sans-3`, beide OFL), damit offline alles
gleich aussieht. Sonst keine weiteren Laufzeit-Abhängigkeiten ohne Rückfrage.

## 4. Optik

- **Farben, Schriften, Komponenten wie `schema/schema.html`.** Design-Tokens als CSS-Variablen (Hell + Dunkel), Dunkelmodus
  automatisch nach System (kein Schalter). Titel/Zahlen **Alfa Slab One**, Text **Source Sans 3**.
- **Dolde** aus dem Logo (`schema/logo_paths.json`, Pfade `cone`) als Svelte-Komponente `Dolde.svelte`: einfarbig
  (`currentColor`), mit Teilfüllung (0–100 % von links) für die Bewertung, auch als Pfad für das PDF nutzbar.
- **Platzhalter** ohne Foto: blasse Dolde auf Ocker (Getränk, Tasting, Bericht).
- **Icon:** Variante **C** (Ocker-Dolde auf Dunkelbraun) ist gewählt und erzeugt (`npm run icons`). Größen: Apple-Touch 180,
  PWA 192/512, Maskable 512 (Dolde in der inneren 80 %-Zone), Favicon. In kleinen Größen die Blattzwischenräume leicht verbreitern.
- Bewertung in Listen: **eine Dolde + Zahl** (nicht bewertet: graue Dolde + „–“). Im Regler: fünf Dolden mit Viertelfüllung.
  Zahlenformat: ganze/halbe Werte mit einer Nachkommastelle (`4,5`, `3,0`), Viertel mit zwei (`4,25`).

## 5. Datenmodell

```ts
type Zustand = 'vorgemerkt' | 'probiert';

interface Einstellungen {
  id: 'global';
  verkoster: string;                 // Standard, Vorgabe für neue Tastings
  stile: Stil[];                     // global für alle Tastings
  letzteGesamtsicherung?: string;
  startHinweisGesehen?: boolean;
  kiSchluessel?: string;              // eigener Anthropic-Schlüssel, nur lokal, nie im Backup
  kiGeprueftAm?: string;
}
interface Stil { id: string; name: string; aktiv: boolean; sortierung: number }
// Standardstile: Pils, Helles, Weizen, Kölsch, Altbier, Märzen, Dunkel, Bock, IPA, Pale Ale, Stout, Porter,
// Sauer/Gose, Belgian Blonde, Tripel, Fruchtbier, Alkoholfrei, Sonstiges

interface Tasting {
  id: string;
  name: string;                      // Pflicht, z. B. "Bierfestival Bremen 2026"
  untertitel?: string;
  datumVon: string;                  // Pflicht, ISO-Datum, Vorgabe heute
  datumBis?: string;
  ort?: string;
  verkoster: string;                 // Pflicht, Vorgabe aus Einstellungen
  fazit?: string;                    // Freitext
  siegerId?: string;                 // manuell gewähltes "Bier des Festivals"; sonst automatisch das beste
  letzteSicherung?: string;
  hinweisAm?: string;                // letzter Backup-Hinweis (Datum)
  erstelltAm: string;
  geaendertAm: string;
}

interface Hersteller {
  id: string;
  tastingId: string;
  name: string;                      // Pflicht, Freitext mit Autovervollständigung
  standort?: string;                 // Standnummer/Halle
}

interface Getraenk {
  id: string;
  tastingId: string;
  herstellerId: string;
  name: string;                      // Pflicht
  zustand: Zustand;                  // Vorgabe 'probiert'
  stilId?: string;
  stilName?: string;                 // Snapshot
  bewertung?: number;                // 0..5 in 0,25er-Schritten; undefined = nicht bewertet (≠ 0)
  notiz?: string;
  abv?: number;                      // Alkoholgehalt in % Vol.
  menge?: number;                    // Menge in Litern (z. B. 0,4), Bezug des Preises
  preis?: number;                    // in Euro, für die angegebene Menge
  probiertAm?: string;               // gesetzt beim Wechsel auf 'probiert'
  erstelltAm: string;
  geaendertAm: string;
}

interface Foto {
  id: string;
  art: 'getraenk' | 'cover';
  bezugId: string;                   // Getraenk.id bzw. Tasting.id
  reihenfolge: 1 | 2 | 3;            // 1 = Titelbild, Cover hat immer 1
  blob: Blob;                        // komprimiertes JPEG
  breite: number; hoehe: number;
  erstelltAm: string;
}
```

Dexie-DB `taste-report`: `einstellungen: 'id'`, `tastings: 'id, datumVon, geaendertAm'`, `hersteller: 'id, tastingId, name'`,
`getraenke: 'id, tastingId, herstellerId, zustand'`, `fotos: 'id, bezugId, [art+bezugId]'`.

### Regeln

- **Bewertung:** Werte immer auf 0,25 runden/klemmen (`bewertungNormalisieren`). `undefined` heißt „nicht bewertet“ und zählt in
  keiner Auswertung. Der Regler startet im Zustand „nicht bewertet“ und setzt erst bei Berührung einen Wert; −/+ aus
  „nicht bewertet“ springt auf 2,5; „Zurücksetzen“ entfernt den Wert wieder.
- **Vorgemerkt:** Daten bleiben erhalten, Regler/Notiz/Fotos sind in der Maske ausgeblendet, das Getränk steht in der Merkliste,
  nicht in den Herstellergruppen und in keiner Auswertung. Wechsel auf „probiert“ setzt `probiertAm`.
- **Auswertung:** Es zählen nur Getränke mit `zustand='probiert'` und gesetzter Bewertung. Rangliste absteigend,
  Gleichstand = gleicher Platz (1, 1, 3), dann nach `probiertAm`. Durchschnitt je Hersteller und je Tasting = Mittel der
  bewerteten Getränke, Anzeige auf 2 Stellen gerundet. „Bier des Festivals“ = `siegerId` oder automatisch das beste
  (bei Gleichstand das zuerst probierte).
- **Hersteller** gehören zu einem Tasting. Autovervollständigung aus allen bisher erfassten Herstellernamen (alle Tastings,
  ohne Groß-/Kleinschreibung), Standort wird vom letzten gleichnamigen Hersteller vorgeschlagen. Neues Getränk übernimmt den
  Hersteller des zuletzt erfassten Getränks. Ein Hersteller ohne Getränke wird automatisch entfernt.
- **Sortierung:** Hersteller alphabetisch (natürliche Sortierung), Getränke in Erfassungsreihenfolge.
- **Löschen:** Getränk löschen = hart, mit einfacher Rückfrage (inkl. Fotos). Tasting löschen = hart, nur nach Bestätigung und mit
  Hinweis auf das ZIP-Backup. Kein Papierkorb, keine Soft-Deletes.
- **Stile:** Entfernen = `aktiv: false`; bestehende Getränke behalten `stilName`. Der Stil ist am Getränk optional.

## 6. Screens und Ablauf (Optik: siehe Schema)

1. **Tasting-Liste** – Karten mit Cover (oder Dolde), Name, Datum, Ort, Verkoster, Anzahl Biere, Ø-Wert. Aktionen: Neues Tasting,
   Öffnen, Einstellungen, Backup-Hinweis/Status.
2. **Tasting anlegen/bearbeiten** – Name, Datum von/bis, Ort, Verkoster, Untertitel, Cover-Bild. Pflicht: Name, Datum von, Verkoster.
3. **Tasting-Übersicht** – Kopf mit Cover, Reiter Getränke | Auswertung. Getränke: Merkliste (einklappbar), dann Hersteller
   alphabetisch als auf-/zuklappbare Gruppen (Name, Standort, Anzahl, Ø-Wert) mit Getränkezeilen (Titelbild, Name, Stil, Wert).
   „Alle auf-/zuklappen“. Der Zustand der Gruppen bleibt beim Zurückspringen erhalten. Unten fixiert: **„+ Bier“**. Export oben rechts.
4. **Getränk erfassen/bearbeiten** – **ein Bildschirm, Autosave, kein Speichern-Knopf.** Reihenfolge: Zustand (Vorgemerkt|Probiert),
   Hersteller (Autovervollständigung, Standort optional), Name, Stil (Chips: die ersten 8 aktiven Stile in der Reihenfolge der Einstellungen, „alle …“ zeigt den Rest), Bewertung (Regler), Fotos (bis 3), Notiz (mit
   Kopier-Icon), eingeklappt „Mehr Angaben“ (Alkohol in % Vol., Menge in L, Preis in €), „Getränk löschen“. Kopf: ‹ zurück, „Bier x von y“, ↑ ↓ zum vorherigen/
   nächsten Getränk (Reihenfolge wie in der Übersicht).
   Autosave: ein neues Getränk wird erst angelegt, wenn Hersteller und Name gefüllt sind; danach speichert jede Änderung
   (entprellt, ca. 400 ms und beim Verlassen). Anzeige „✓ Automatisch gespeichert“, bei Fehler eine sichtbare Meldung.
5. **Auswertung** – „Bier des Festivals“ (änderbar), Rangliste, Durchschnitt je Hersteller, Fazit (Freitext, wird gespeichert),
   Export-Schaltfläche.
6. **Einstellungen** – Verkoster-Standard, Stile pflegen (hinzufügen, umbenennen, sortieren per ↑ ↓, aktiv/inaktiv), Datensicherung:
   Speicherstatus (`navigator.storage.persisted()`/`estimate()`), letzte Sicherung, „Backup erstellen (ZIP)“ (alle Tastings),
   „Backup einspielen…“.
7. **Export-Dialog** (unterer Dialog) – PDF-Bericht mit Vorschau (Schalter „Fotos einbeziehen“, „Nur bewertete Biere“),
   Excel-Datenliste, Backup (ZIP) dieses Tastings.

### Foto-Verhalten

- Ein Datei-Feld `<input type="file" accept="image/*" multiple>` **ohne** `capture`: iOS bietet dann „Foto aufnehmen“, „Fotomediathek“ und „Dateien“ an (wie in der Vorlage). Mehrfachauswahl füllt die freien Plätze.
- Sofort komprimieren (lange Kante max. 1600 px, JPEG 0,8, Ausrichtung über `createImageBitmap(file, { imageOrientation: 'from-image' })`).
- Zusätzlich je Foto eine kleine Vorschau (lange Kante 320 px) für Listen, damit die Übersicht nicht zig große Bilder dekodiert.
- Fotos sind schon vor Hersteller/Name möglich; ohne gespeichertes Bier werden sie beim Verlassen verworfen, verwaiste Fotos räumt der App-Start auf.
- Bis zu 3 Fotos je Getränk. Das erste ist das **Titelbild**, per Antippen änderbar (Reihenfolge tauschen). Je Tasting ein Cover-Bild.

## 7. Export

Dateinamen: `{Tastingname}_{Typ}_{JJJJ-MM-TT}.pdf|.xlsx|.zip` (Sonderzeichen bereinigt). Bereitstellung über
`navigator.share({ files })`, sonst Download.

### PDF (jsPDF, A4 hoch, immer hell/Papier, Etiketten-Look)

- **Seite 1 Cover:** Rahmen mit Wortmarke BRAU KRU, Cover-Bild (oder Dolde), Tastingname groß (Alfa Slab One, Rot), Datum/Ort,
  Untertitel, „Verkostungsbericht von {Verkoster}“, Ø-Dolden.
- **Seite 2 Fazit:** Kennzahlen (Anzahl Biere, Hersteller, Ø-Wert), Bier des Festivals, Top 5, Fazit-Text (bei Länge Umbruch auf
  Folgeseite). Ohne Bewertungen entfallen Sieger und Top 5.
- **Herstellerseiten:** Kopf (Hersteller · Standort · Ø-Wert), je Getränk eine Karte: Titelbild (oder Dolde), Name, Stil-Tag,
  Dolden + Zahl, % Vol./Menge/Preis, Notiz, weitere Fotos klein. Karten nicht über Seitenumbrüche teilen.
- Vorgemerkte Getränke erscheinen nicht im Bericht. Fußzeile „Taste Report · Seite x von y“.
- Schriften als TTF einbetten (Alfa Slab One, Source Sans 3; `public/fonts/*.ttf`, erzeugt mit `tools/schriften.py`). Dolden und Wortmarke als Vektorpfad zeichnen. Zeichen außerhalb der Schriften (Emoji u. ä.) werden entfernt, Akzentbuchstaben auf den Grundbuchstaben zurückgeführt.
- Fotos im Bericht **ungeschnitten** (Hoch- und Querformat bleiben erhalten): Hauptfoto 40 mm breit, höchstens 56 mm hoch, weitere Fotos 19 mm breit, höchstens 26 mm hoch; Cover-Bild bis 130 × 110 mm; Platzhalter-Dolde quadratisch. Für das PDF auf ca. 900 px verkleinert.
- Vorschau in der App mit **pdfjs auf Canvas/Bilder** (nicht per `<iframe>`, iOS-PWA zeigt sonst nur Seite 1).

### Excel (ExcelJS, schlank)

Kopfbereich (Tasting, Untertitel, Datum, Ort, Verkoster; leere Felder entfallen), ein Blatt „Getränke“, eine Tabelle (alle Getränke, auch vorgemerkte; Hersteller alphabetisch, darin Erfassungsreihenfolge): Hersteller | Standort | Getränk | Stil | Bewertung (Zahl) |
Alkohol (% Vol.) | Menge (L) | Preis (€) | Notiz | Zustand | probiert am. Autofilter, fixierte Kopfzeile, Datumsformat TT.MM.JJJJ (echte Datumszellen), Bewertung/Alkohol/Menge/Preis als Zahlen (leer = nicht angegeben, 0 bleibt 0), Texte nie als Formel. Keine Bilder. Erzeugung und Teilen direkt aus dem Export-Dialog (`ExportDialog.svelte`).

### ZIP-Backup und Import

- Inhalt: `backup.json` (`schemaVersion`, ein oder mehrere Tastings mit Hersteller, Getränken, Foto-Metadaten; bei
  „Alles sichern“ zusätzlich Einstellungen) und `fotos/{fotoId}.jpg`.
- Import: bestehende `id` → Rückfrage (ersetzen / als Kopie mit neuen IDs). Importiert alles ohne Datenverlust.
- Beim Sichern `letzteSicherung` (Tasting) bzw. `letzteGesamtsicherung` setzen, **erst nachdem** die Datei geteilt/gespeichert wurde (Abbruch im Teilen-Menü = nicht gesichert). `geaendertAm` bleibt dabei unverändert. „Alles sichern“ vermerkt auch bei jedem Tasting `letzteSicherung`.
- Zwei Schritte im UI (`BackupKarte.svelte`): erst „Backup erstellen“, dann „Teilen / Speichern“ (Safari erlaubt das Teilen-Menü nur kurz nach einer Berührung, das Packen vieler Fotos kann länger dauern). Fotos werden ohne weitere Kompression (STORE) abgelegt. Nicht lesbare Fotos werden übersprungen und gemeldet.
- `backup.json` enthält zusätzlich `stile` (bei „Alles“ alle, sonst die genutzten), `art` (`tasting`|`alle`), `erstelltAm`; Vorschaubilder werden nicht gesichert, sondern beim Import neu erzeugt.
- Import (Einstellungen → „Backup einspielen …“, `BackupImport.svelte`): Datei wird geprüft (Format, Version, Verweise); nur bei bereits vorhandener Tasting-ID kommt die Rückfrage **Als Kopie (Vorgabe) / Vorhandene ersetzen**, alle anderen werden unverändert übernommen. Kopie: neue IDs, Name + „ (Kopie)“. Alles in einer Transaktion, bei Fehler bleibt der Bestand unverändert. Stile werden über den Namen abgeglichen (fehlende ergänzt, Stil-IDs der Biere umgeschrieben); der Standard-Verkoster wird nur übernommen, wenn lokal leer.

## 8. Datensicherheit auf dem iPhone

- Beim ersten Start `navigator.storage.persist()` anfordern, Ergebnis in den Einstellungen anzeigen. Kurzer Hinweis beim ersten Start.
- Hinweis in der App: Daten liegen nur auf diesem Gerät, Icon löschen/neu anlegen oder Website-Daten löschen = Daten weg.
- **Backup-Hinweis** (dezent, wegtippbar): wenn seit der letzten Sicherung mindestens 10 Getränke neu oder geändert wurden (neue Fotos zählen mit)
  oder ein Fazit eingetragen, aber nicht gesichert ist. Höchstens einmal pro Tasting und Tag (`hinweisAm`), Entscheidung beim Öffnen der Tasting-Übersicht
  (Regel: `hinweisNoetig` in `src/lib/backupFormat.ts`, getestet). „Jetzt sichern“ öffnet den Export-Dialog nur mit der Backup-Karte.
- Start-Hinweis „Daten liegen nur auf diesem Gerät“ in der Tasting-Liste, wegtippbar (`Einstellungen.startHinweisGesehen`). Der dauerhafte Speicher wird bei jedem Start erneut angefragt, solange er nicht gewährt ist.
- In Einstellungen und Tasting-Liste: „Zuletzt gesichert: …“.

## 9. Leitplanken aus der Vorlage

- **Svelte-5-`$state`-Objekte nie direkt in `db.*.put()`**, vorher `$state.snapshot()`. Fehler trat in der Vorlage dreimal
  unbemerkt auf (kein Typecheck-Fehler, Speichern scheitert still). Bei jeder neuen Schreibstelle prüfen und testen.
- **iOS/WebKit-Blobs aus IndexedDB sind unzuverlässig** („error occured reading the Blob“, „object can not be found here“).
  Fotos nie mit einem einzigen Lesezugriff verarbeiten: Retry mit Backoff (`blobSicherLesen`) und pro Foto überspringen,
  statt den Export abzubrechen.
- Installierte iOS-PWA läuft in WKWebView: PDF-Vorschau nur über pdfjs (siehe oben).
- Diktierfunktion braucht keinen Code (iOS-Tastaturdiktat in den Textfeldern).
- Daten, die direkt in IndexedDB gehen (z. B. Import), nicht in `$state` halten, sondern `$state.raw` (Proxys lassen sich nicht speichern: DataCloneError).
- Auswertungslogik (`src/lib/auswertung.ts`) ist rein und mit `npm test` (Node, `tests/`) geprüft; Regeln dort ändern nur zusammen mit den Tests.
- Testen: lokaler Vite-Server per Browser-Tools bedienen, Testdaten direkt in IndexedDB anlegen, erzeugte xlsx/pdf **parsen**
  statt Screenshots auszuwerten. Testbilder: `belgian ale.jpg`, `white easter 1.jpg`, `WhatsApp Image … .jpeg`.
- Die Bilddateien und `schema/` gehören **nicht** ins öffentliche Repo (`.gitignore`). Ins Repo kommen nur die erzeugten
  Icons, Schriften und die Dolden-Pfade.

## 10. Phasen

**Phase 1 – Grundgerüst, Optik & Deployment**
Vite/Svelte/TS, PWA (Name „Taste Report“, Manifest, Service Worker), Design-Tokens Hell/Dunkel, Schriften, `Dolde.svelte`,
Icons (B und C zum Vergleich, **C gewählt**). GitHub-Actions-Deploy. Platzhalter-Startseite mit Logo.
*Abnahme:* URL auf dem iPhone öffnen, zum Homescreen hinzufügen (B und C), im Flugmodus starten, Hell/Dunkel stimmt.

**Phase 2 – Datenmodell, Einstellungen, Tastings**
Dexie-Schema, Einstellungen (Verkoster, Stile mit Standardwerten, Sortierung, aktiv/inaktiv), Tasting-Liste, Tasting anlegen/bearbeiten/löschen.
*Abnahme:* Tasting anlegen, App schließen, neu öffnen, Daten vorhanden. Stile ändern, Verkoster-Vorgabe wird übernommen.

**Phase 3 – Hersteller & Getränke erfassen (inkl. Regler)**
Getränk-Maske mit Autosave, Hersteller-Autovervollständigung, Stil-Chips, **Bewertungsregler** (Zustand „nicht bewertet“), Vorgemerkt/Probiert,
Merkliste, Tasting-Übersicht mit auf-/zuklappbaren Gruppen (Zustand bleibt, „Alle auf-/zuklappen“), ↑ ↓ zwischen Getränken,
Kopier-Icon an der Notiz, ABV/Preis, Löschen mit Rückfrage.
*Abnahme:* 10 Biere über 3 Hersteller erfassen, eines vormerken und später auf „probiert“ stellen, eines löschen. Neustart: alles da, Bewertung exakt.

**Phase 4 – Fotos**
Kamera und Mediathek, Komprimierung, bis zu 3 je Getränk, Titelbild wählen, Cover-Bild je Tasting, Platzhalter-Dolde.
*Abnahme:* Hoch- und Querformat korrekt ausgerichtet, Titelbild-Wechsel bleibt nach Neustart.

**Phase 5 – Auswertung**
Reiter Auswertung: Bier des Festivals (änderbar), Rangliste (Gleichstand-Regel), Hersteller-Durchschnitt, Fazit-Feld.
*Abnahme:* Rangliste und Durchschnitte stimmen mit einer von mir nachgerechneten Beispielreihe überein, Gleichstand und „nicht bewertet“ sauber.

**Phase 6 – PDF-Bericht**
Cover, Fazit/Top 5, Herstellerseiten, Vorschau (pdfjs), Teilen. *Abnahme:* Layout wie im Schema, keine zerteilten Karten, Fotos/Platzhalter, Dunkelmodus ändert das PDF nicht.

**Phase 7 – Excel-Datenliste** *Abnahme:* Datei über Teilen-Menü sichern, in Excel öffnen, Bewertung sortier-/filterbar.

**Phase 8 – ZIP-Backup/-Import & Datensicherheit**
Backup je Tasting und gesamt, Import (ersetzen/Kopie), Persistenz-Hinweis, Backup-Hinweis-Logik.
*Abnahme:* Tasting sichern, löschen, per Import vollständig (inkl. Fotos) wiederherstellen.

## 11. Später (nicht ohne Auftrag)

Bewusst ausgeklammert: Berichtssprache Englisch und weitere Bewertungskategorien (private Nutzung).


- Zusammenführen mehrerer Verkoster (vom Nutzer gewünscht, vorher im Detail abstimmen) (Gemeinschafts-Rangliste über Datei-Import)
- Zweite Berichtsvariante im Zeitungsstil: jetzt Abschnitt 12 (Phasen 9–11)
- Mehrgeräte-Sync

## 12. Magazin-Bericht (Erweiterung, Phasen 9–11)

Optik-Soll: `schema/magazin.html` (freigegeben, auch als Artefakt: https://claude.ai/artifact/RMeXfH8TyhEQEwL8Vih2ji).
Zweite Berichtsvariante im Zeitungs-/Magazinstil: ein Artikel über das Festival, den Claude (Anthropic) aus Notizen und Fotos schreibt,
gesetzt im Etiketten-Look. Der Text entsteht in der App mit dem **eigenen API-Schlüssel** des Nutzers (Direktaufruf der API, kein Server).

### Entscheidungen

- **Textquelle:** nur direkter API-Aufruf (Weg B). Kein Prompt-Kopieren, keine Ersatzvariante ohne KI. Ohne Schlüssel oder Internet nur der Hinweis „Schlüssel einrichten“.
- **Schlüssel:** in `Einstellungen.kiSchluessel` (IndexedDB, nur auf dem Gerät), **nie** im Backup, nie im Code. Format `sk-ant-…`, Anzeige maskiert (`sk-ant-…a7Q2`).
  `kiGeprueftAm` = letzte erfolgreiche Verbindungsprüfung. Anleitung für Nutzer steht in den Einstellungen („KI-Bericht“): Konto auf platform.claude.com
  (getrennt vom Claude-Abo), Guthaben und Monatslimit unter Billing, Schlüssel unter API keys, einfügen, testen.
- **Aufruf:** `POST https://api.anthropic.com/v1/messages` mit `x-api-key`, `anthropic-version: 2023-06-01`, `anthropic-dangerous-direct-browser-access: true`
  (`src/lib/ki/anthropic.ts`). Modell als Konstante `KI_MODELL = 'claude-sonnet-5-5'`. Zeitlimit 20 s für den Test.
- **Fehler:** `src/lib/ki/kiFehler.ts` übersetzt Status/Antwort in Codes (`schluessel`, `guthaben`, `limit`, `ueberlastet`, `netz`, `modell`, `format`, `unbekannt`) mit deutschen Meldungen in `de.ki.fehler`.
  Beim Speichern bleibt der Schlüssel erhalten, solange er nicht abgelehnt (401/403) wird (z. B. leeres Guthaben lässt sich später beheben).
- **Ton/Länge:** Auswahl im Dialog: locker-humorvoll (Vorgabe), sachlich-genussvoll, Magazin-Feuilleton; Länge kurz/normal. Immer Ich-Form als Erlebnisbericht des Verkosters.
- **Gesendet wird:** Tastingdaten, Biere mit Kurz-IDs (B1…Bn), Notizen, Rangliste, Fazit, Ton/Länge; Fotos = Cover und Titelbild jedes bewerteten Biers, auf 512 px verkleinert, höchstens 30 (Schalter „Fotos an die KI senden“, Vorgabe an). Vor dem Senden zeigt die App, was an Anthropic geht.
- **Keine erfundenen Fakten:** Die KI nennt keine Zahlen frei. Bewertungen, Platzierungen, Bier- und Herstellernamen setzt die App aus den Daten ein. Antwort als festes JSON (`schlagzeile`, `vorspann`, `abschnitte[]`, `zitate[]` mit Bier-ID, `bildunterschriften{ID}`, `schlusswort`), die App prüft es und verwirft unbekannte Bier-IDs.
- **Speichern:** Text im Tasting (`Tasting.artikel`, `artikelErstelltAm`), im Export-Dialog bearbeitbar, im Backup enthalten (`schemaVersion` bleibt 1, additives Feld). Das Magazin lässt sich offline und ohne weitere Kosten neu setzen.
- **Layout (PDF):** A4 hoch, immer helles Papier, Etiketten-Look; 3–5 Seiten: Titel (ungeschnittenes Titelfoto, Schlagzeile, Vorspann), Fließtext zweispaltig mit Initiale, Zwischenüberschriften und Zitaten aus den Notizen, Herstellerabsätze, Fotostrecke mit Bildunterschriften (Fotos ungeschnitten), „Bier des Festivals“, „Die Besten“, Schlusswort. Fußzeile mit Kennzeichnung „Text mit KI-Unterstützung (Claude)“.

### Phasen

**Phase 9 – KI-Zugang** Einstellungen „KI-Bericht“ mit Anleitung, Schlüssel speichern/entfernen, Verbindung testen, Fehlermeldungen.
*Abnahme:* Schlüssel eintragen, „Verbindung getestet“ erscheint (echte Prüfung auf dem iPhone), Schlüssel nach Neustart noch da, im Backup nicht enthalten.
**Phase 10 – Text erzeugen** Export-Karte mit Ton, Länge, Fotos; Anfrage, Antwortprüfung, Text bearbeiten und im Tasting speichern, Backup-Format ergänzen.
**Phase 11 – Magazin-Layout** PDF-Seiten, Vorschau, Teilen; Prüfung mit Hoch-/Quer-/Quadratfotos und sehr langem Text.
