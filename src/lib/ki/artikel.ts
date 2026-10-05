// Anfrage an die KI bauen und Antwort prüfen. Reine Funktionen ohne Laufzeit-Importe (testbar mit Node).
// Grundsatz: Die KI schreibt nur Text. Zahlen, Namen und Zitate werden geprüft, damit nichts erfunden wird.
import type { Artikel, KiLaenge, KiTon } from '../model';

export const WERKZEUG = 'artikel_abliefern';

export interface BierFuerKi {
  kurzId: string;
  id: string;
  hersteller: string;
  standort?: string;
  name: string;
  stil?: string;
  bewertung?: number;
  abv?: number;
  notiz?: string;
  platz?: number;
}

export interface BildFuerKi {
  /** 'cover' oder die Kurz-ID eines Biers */
  fuer: string;
  beschriftung: string;
  base64: string;
}

export interface AnfrageEingabe {
  modell: string;
  tasting: { name: string; untertitel?: string; datumVon: string; datumBis?: string; ort?: string; verkoster: string; fazit?: string };
  biere: BierFuerKi[];
  siegerKurzId?: string;
  herstellerAnzahl: number;
  ton: KiTon;
  laenge: KiLaenge;
  bilder: BildFuerKi[];
}

const TON_TEXT: Record<KiTon, string> = {
  locker: 'locker und humorvoll, mit Augenzwinkern, aber nie albern. Der Biergenuss steht im Mittelpunkt.',
  sachlich: 'sachlich-genussvoll: klare, warme Sprache, fundiert und ohne Übertreibung.',
  feuilleton: 'Magazin-Feuilleton: elegant, bildhaft, gepflegte Sprache mit Liebe zum Detail.',
};

const LAENGE_TEXT: Record<KiLaenge, string> = {
  kurz: 'etwa 250 bis 350 Wörter insgesamt, 2 Abschnitte, höchstens 2 Zitate',
  normal: 'etwa 600 bis 800 Wörter insgesamt, 4 bis 5 Abschnitte, 2 bis 4 Zitate',
};

const MAX_TOKENS: Record<KiLaenge, number> = { kurz: 2500, normal: 5000 };

export function systemPrompt(verkoster: string, ton: KiTon, laenge: KiLaenge): string {
  return [
    `Du schreibst für das private Bier-Magazin „Brau Kru“ den Artikel zu einem Bierfestival. Der Artikel ist der Erlebnisbericht von ${verkoster} in der Ich-Form, geschrieben aus den Verkostungsnotizen und Fotos, die du bekommst.`,
    '',
    `Ton: ${TON_TEXT[ton]}`,
    `Länge: ${LAENGE_TEXT[laenge]}. Bei wenigen Bieren entsprechend kürzer.`,
    '',
    'Regeln:',
    '- Nutze ausschließlich die gelieferten Daten und Fotos. Erfinde keine Biere, Brauereien, Orte, Personen, Gespräche oder Ereignisse. Was nicht in den Daten steht, schreibst du nicht.',
    '- Nenne keine Bewertungszahlen, Punkte, Platzierungsnummern, Preise, Mengen oder Alkoholwerte. Zahlen setzt die Anwendung selbst ein. Rangordnungen darfst du in Worten andeuten („ganz vorn“, „Schlusslicht“). Die Anzahl der Biere und Hersteller darfst du nennen.',
    '- Nenne Biere und Hersteller genau so, wie sie in den Daten stehen.',
    '- Zitate müssen unveränderte, wörtliche Ausschnitte aus der Notiz des jeweiligen Biers sein (ein bis zwei Sätze, mit der Schreibweise der Notiz). Gib dazu die Bier-ID an. Nutze nur Biere, zu denen eine Notiz vorliegt.',
    '- Bildunterschriften sind kurz (höchstens 10 Wörter), ohne Zahlen und nur für Biere, zu denen ein Foto geliefert wurde.',
    '- Auf den Fotos darfst du beschreiben, was zu sehen ist (Etikett, Farbe des Biers, Glas). Dichte nichts hinzu.',
    '- Schreibe auf Deutsch, ohne Markdown, ohne Aufzählungen und ohne Sternchen.',
    '- Gliederung: Schlagzeile, Vorspann (ein bis zwei Sätze), Abschnitte mit Zwischenüberschrift, Schlusswort (ein bis zwei Sätze). Rufe zur Antwort genau einmal das Werkzeug ' + WERKZEUG + ' auf und schreibe keinen Text außerhalb des Werkzeugs.',
  ].join('\n');
}

const textFeld = { type: 'string' } as const;
const bierText = { type: 'object', properties: { bier: textFeld, text: textFeld }, required: ['bier', 'text'] } as const;

const WERKZEUG_DEFINITION = {
  name: WERKZEUG,
  description: 'Liefert den fertigen Magazin-Artikel ab.',
  input_schema: {
    type: 'object',
    properties: {
      schlagzeile: textFeld,
      vorspann: textFeld,
      abschnitte: {
        type: 'array',
        items: { type: 'object', properties: { ueberschrift: textFeld, text: textFeld }, required: ['ueberschrift', 'text'] },
      },
      zitate: { type: 'array', items: bierText },
      bildunterschriften: { type: 'array', items: bierText },
      schlusswort: textFeld,
    },
    required: ['schlagzeile', 'vorspann', 'abschnitte', 'schlusswort'],
  },
} as const;

const NOTIZ_MAX = 800;

export function anfrageBauen(e: AnfrageEingabe): { body: object; idMap: Map<string, string> } {
  const idMap = new Map(e.biere.map((b) => [b.kurzId, b.id]));
  const daten = {
    tasting: {
      name: e.tasting.name,
      untertitel: e.tasting.untertitel,
      datumVon: e.tasting.datumVon,
      datumBis: e.tasting.datumBis,
      ort: e.tasting.ort,
      verkoster: e.tasting.verkoster,
      fazitDesVerkosters: e.tasting.fazit,
    },
    anzahlBiere: e.biere.length,
    anzahlHersteller: e.herstellerAnzahl,
    bierDesFestivals: e.siegerKurzId,
    biere: e.biere.map((b) => ({
      id: b.kurzId,
      hersteller: b.hersteller,
      standort: b.standort,
      name: b.name,
      stil: b.stil,
      bewertung: b.bewertung,
      platz: b.platz,
      alkohol: b.abv,
      notiz: b.notiz ? b.notiz.slice(0, NOTIZ_MAX) : undefined,
    })),
  };
  const inhalt: object[] = [
    {
      type: 'text',
      text:
        'Hier sind die Daten des Tastings als JSON. Die Bewertungen (0 bis 5) und Plätze dienen nur deinem Verständnis, nenne sie nicht im Text.\n\n' +
        JSON.stringify(daten, null, 1) +
        (e.bilder.length > 0 ? '\n\nEs folgen Fotos. Vor jedem Foto steht, zu welchem Bier es gehört.' : '\n\nEs gibt keine Fotos.'),
    },
  ];
  for (const bild of e.bilder) {
    inhalt.push({ type: 'text', text: bild.beschriftung });
    inhalt.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: bild.base64 } });
  }
  return {
    idMap,
    body: {
      model: e.modell,
      max_tokens: MAX_TOKENS[e.laenge],
      system: systemPrompt(e.tasting.verkoster, e.ton, e.laenge),
      tools: [WERKZEUG_DEFINITION],
      // Claude Sonnet 5.5 kennt keinen erzwungenen Werkzeugaufruf (tool_choice "tool"/"any" ergibt 400): Der Prompt verlangt den Aufruf.
      // between_tools schaltet das Nachdenken vorab aus (spart Zeit und Token, die sonst auf max_tokens angerechnet werden).
      thinking: { type: 'between_tools' },
      messages: [{ role: 'user', content: inhalt }],
    },
  };
}

// ---------- Antwort prüfen ----------

/** Markdown-Reste (Sternchen, Rauten, Unterstriche als Betonung) entfernen und Leerraum glätten. */
export function ohneMarkdown(text: string): string {
  return text
    .replace(/\*\*|__/g, '')
    .replace(/(^|\n)#{1,6}\s+/g, '$1')
    .replace(/(^|\s)\*(\S[^*\n]*)\*(?=\s|$|[.,;:!?])/g, '$1$2')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const normal = (text: string) =>
  text
    .toLocaleLowerCase('de')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

/** Ein Zitat gilt nur, wenn es (ohne Satzzeichen und Groß-/Kleinschreibung) in der Notiz des Biers steht. */
export function zitatPasst(zitat: string, notiz: string | undefined): boolean {
  if (!notiz) return false;
  const z = normal(zitat);
  return z.length >= 3 && normal(notiz).includes(z);
}

const istObjekt = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const text = (x: unknown, max: number): string => (typeof x === 'string' ? ohneMarkdown(x).slice(0, max) : '');

/**
 * Antwort der API in einen Artikel übersetzen. null = unvollständig oder nicht lesbar.
 * Unbekannte Bier-IDs und erfundene Zitate werden stillschweigend verworfen.
 */
export function artikelAusAntwort(
  antwort: unknown,
  idMap: Map<string, string>,
  notizen: Map<string, string>,
  ton: KiTon,
  laenge: KiLaenge,
): Artikel | null {
  if (!istObjekt(antwort) || antwort.stop_reason === 'max_tokens' || !Array.isArray(antwort.content)) return null;
  const block = antwort.content.find((b) => istObjekt(b) && b.type === 'tool_use' && b.name === WERKZEUG);
  if (!istObjekt(block) || !istObjekt(block.input)) return null;
  const roh = block.input;

  const abschnitte = (Array.isArray(roh.abschnitte) ? roh.abschnitte : [])
    .filter(istObjekt)
    .map((a) => ({ ueberschrift: text(a.ueberschrift, 120), text: text(a.text, 3000) }))
    .filter((a) => a.text !== '')
    .slice(0, 8);
  const schlagzeile = text(roh.schlagzeile, 140);
  if (schlagzeile === '' || abschnitte.length === 0) return null;

  const zitate = (Array.isArray(roh.zitate) ? roh.zitate : [])
    .filter(istObjekt)
    .map((z) => ({ bier: idMap.get(String(z.bier)), text: text(z.text, 400) }))
    .filter((z): z is { bier: string; text: string } => !!z.bier && z.text !== '' && zitatPasst(z.text, notizen.get(z.bier)))
    .slice(0, 6);

  const bildunterschriften: Record<string, string> = {};
  for (const b of (Array.isArray(roh.bildunterschriften) ? roh.bildunterschriften : []).filter(istObjekt)) {
    const id = idMap.get(String(b.bier));
    const t = text(b.text, 120);
    if (id && t !== '') bildunterschriften[id] = t;
  }

  return {
    schlagzeile,
    vorspann: text(roh.vorspann, 500),
    abschnitte,
    zitate,
    bildunterschriften,
    schlusswort: text(roh.schlusswort, 500),
    ton,
    laenge,
  };
}

/** Verweise auf nicht mehr vorhandene Biere entfernen (z. B. nach dem Löschen eines Biers). */
export function artikelBereinigen(artikel: Artikel, gueltigeIds: Set<string>): Artikel {
  return {
    ...artikel,
    zitate: artikel.zitate.filter((z) => gueltigeIds.has(z.bier)),
    bildunterschriften: Object.fromEntries(Object.entries(artikel.bildunterschriften).filter(([id]) => gueltigeIds.has(id))),
  };
}
