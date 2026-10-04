// Auf-/Zuklapp-Zustand der Hersteller-Gruppen und der Merkliste je Tasting.
// Bleibt beim Zurückspringen aus der Getränke-Maske erhalten (nur im Arbeitsspeicher).
export const MERKLISTE = 'merkliste';

const eingeklapptProTasting = new Map<string, Set<string>>();

export function holeEingeklappt(tastingId: string): Set<string> {
  return new Set(eingeklapptProTasting.get(tastingId) ?? []);
}

export function setzeEingeklappt(tastingId: string, eingeklappt: Set<string>): void {
  eingeklapptProTasting.set(tastingId, new Set(eingeklappt));
}
