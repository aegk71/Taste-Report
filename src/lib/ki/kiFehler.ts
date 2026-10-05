// Fehlerbehandlung für den KI-Zugang. Reine Funktionen ohne Laufzeit-Importe (testbar mit Node).

export type KiFehlerCode = 'format' | 'schluessel' | 'guthaben' | 'limit' | 'ueberlastet' | 'netz' | 'modell' | 'antwort' | 'unbekannt';

export class KiFehler extends Error {
  code: KiFehlerCode;
  /** Technische Angabe der API (Status und Meldung), nur zur Anzeige für die Fehlersuche */
  detail?: string;
  constructor(code: KiFehlerCode, detail?: string) {
    super(code);
    this.code = code;
    this.detail = detail;
  }
}

/** "400: tool_choice: …" aus Status und Antworttext der API (kurz gehalten). */
export function fehlerDetail(status: number, antwortText: string): string {
  let meldung = antwortText;
  try {
    const json = JSON.parse(antwortText) as { error?: { message?: unknown } };
    if (typeof json.error?.message === 'string') meldung = json.error.message;
  } catch {
    // kein JSON: der Rohtext genügt
  }
  return `${status}: ${meldung.replace(/\s+/g, ' ').trim().slice(0, 240)}`;
}

/** Anthropic-Schlüssel beginnen immer mit "sk-ant-". Leerzeichen und Zeilenumbrüche vom Einfügen werden entfernt. */
export function schluesselBereinigen(text: string): string {
  return text.replace(/\s+/g, '');
}

export function schluesselGueltig(schluessel: string): boolean {
  return /^sk-ant-[A-Za-z0-9_-]{20,}$/.test(schluessel);
}

/** "sk-ant-…a7Q2": nur die letzten vier Zeichen zeigen. */
export function schluesselMaske(schluessel: string): string {
  return `sk-ant-…${schluessel.slice(-4)}`;
}

/** HTTP-Status und Antworttext der Anthropic-API in einen Fehlercode übersetzen. */
export function fehlerCode(status: number, antwortText: string): KiFehlerCode {
  const text = antwortText.toLowerCase();
  if (status === 400 && text.includes('credit balance')) return 'guthaben';
  if (status === 401 || status === 403) return 'schluessel';
  if (status === 402) return 'guthaben';
  if (status === 404) return 'modell';
  if (status === 429) return text.includes('spend') || text.includes('usage limit') ? 'guthaben' : 'limit';
  if (status === 529 || status >= 500) return 'ueberlastet';
  return 'unbekannt';
}
