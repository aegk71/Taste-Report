export function dateinameTeil(text: string): string {
  return text
    .trim()
    .replace(/[\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '_');
}

/** z. B. Bierfestival_Bremen_2026_Bericht_2026-09-14.pdf */
export function exportDateiname(tastingName: string, typ: string, heuteIso: string, endung: string): string {
  return `${dateinameTeil(tastingName) || 'Tasting'}_${typ}_${heuteIso}.${endung}`;
}
