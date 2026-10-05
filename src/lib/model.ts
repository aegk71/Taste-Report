export type Zustand = 'vorgemerkt' | 'probiert';
export type FotoArt = 'getraenk' | 'cover';

export interface Stil {
  id: string;
  name: string;
  aktiv: boolean;
  sortierung: number;
}

export interface Einstellungen {
  id: 'global';
  verkoster: string;
  stile: Stil[];
  letzteGesamtsicherung?: string;
  /** Hinweis "Daten liegen nur auf diesem Gerät" wurde weggetippt */
  startHinweisGesehen?: boolean;
  /** Eigener Anthropic-API-Schlüssel für den Magazin-Bericht. Nur auf diesem Gerät, nie im Backup. */
  kiSchluessel?: string;
  /** Zeitpunkt der letzten erfolgreichen Verbindungsprüfung */
  kiGeprueftAm?: string;
}

export type KiTon = 'locker' | 'sachlich' | 'feuilleton';
export type KiLaenge = 'kurz' | 'normal';

/** Von der KI geschriebener und von Hand bearbeitbarer Magazin-Text (Zitate/Bildunterschriften verweisen auf Getraenk.id). */
export interface Artikel {
  schlagzeile: string;
  vorspann: string;
  abschnitte: { ueberschrift: string; text: string }[];
  zitate: { bier: string; text: string }[];
  bildunterschriften: Record<string, string>;
  schlusswort: string;
  ton: KiTon;
  laenge: KiLaenge;
}

export interface Tasting {
  id: string;
  name: string;
  untertitel?: string;
  datumVon: string;
  datumBis?: string;
  ort?: string;
  verkoster: string;
  fazit?: string;
  siegerId?: string;
  /** Magazin-Text (Phase 10), im Backup enthalten */
  artikel?: Artikel;
  artikelErstelltAm?: string;
  letzteSicherung?: string;
  hinweisAm?: string;
  erstelltAm: string;
  geaendertAm: string;
}

export interface Hersteller {
  id: string;
  tastingId: string;
  name: string;
  standort?: string;
}

export interface Getraenk {
  id: string;
  tastingId: string;
  herstellerId: string;
  name: string;
  zustand: Zustand;
  stilId?: string;
  stilName?: string;
  /** 0..5 in 0,25er-Schritten; undefined = nicht bewertet (ungleich 0) */
  bewertung?: number;
  notiz?: string;
  /** Alkoholgehalt in % Vol. */
  abv?: number;
  /** Menge in Litern (z. B. 0,4), auf die sich der Preis bezieht */
  menge?: number;
  /** Preis in Euro für die angegebene Menge */
  preis?: number;
  probiertAm?: string;
  erstelltAm: string;
  geaendertAm: string;
}

export interface Foto {
  id: string;
  art: FotoArt;
  bezugId: string;
  reihenfolge: 1 | 2 | 3;
  /** komprimiertes JPEG, lange Kante max. 1600 px */
  blob: Blob;
  /** kleine Vorschau (lange Kante 320 px) für Listen */
  vorschau?: Blob;
  breite: number;
  hoehe: number;
  erstelltAm: string;
}

export const STANDARD_STILE: readonly string[] = [
  'Pils',
  'Helles',
  'Weizen',
  'Kölsch',
  'Altbier',
  'Märzen',
  'Dunkel',
  'Bock',
  'IPA',
  'Pale Ale',
  'Stout',
  'Porter',
  'Sauer/Gose',
  'Belgian Blonde',
  'Tripel',
  'Fruchtbier',
  'Alkoholfrei',
  'Sonstiges',
];
