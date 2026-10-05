import { fehlerCode, fehlerDetail, KiFehler } from './kiFehler';

/** Modell für den Magazin-Bericht (versteht Fotos, schreibt gutes Deutsch). Bewusst eine Konstante. */
export const KI_MODELL = 'claude-sonnet-5-5';

const API_URL = 'https://api.anthropic.com/v1/messages';
const ZEITLIMIT_MS = 20_000;

/** Anfrage an die Anthropic-API direkt aus dem Browser (kein eigener Server). Wirft KiFehler. */
export async function anfrage(schluessel: string, koerper: object, zeitlimitMs = ZEITLIMIT_MS): Promise<unknown> {
  let antwort: Response;
  try {
    antwort = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': schluessel,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
        'content-type': 'application/json',
      },
      body: JSON.stringify(koerper),
      signal: AbortSignal.timeout(zeitlimitMs),
    });
  } catch {
    throw new KiFehler('netz');
  }
  if (!antwort.ok) {
    let text = '';
    try {
      text = await antwort.text();
    } catch {
      // Antworttext nicht lesbar: der Statuscode genügt
    }
    throw new KiFehler(fehlerCode(antwort.status, text), fehlerDetail(antwort.status, text));
  }
  try {
    return await antwort.json();
  } catch {
    throw new KiFehler('unbekannt');
  }
}

/** Kleinste mögliche Anfrage (wenige Token): prüft Schlüssel, Guthaben und Modellzugang. */
export async function verbindungTesten(schluessel: string): Promise<void> {
  await anfrage(schluessel, {
    model: KI_MODELL,
    max_tokens: 8,
    messages: [{ role: 'user', content: 'Antworte nur mit: OK' }],
  });
}
