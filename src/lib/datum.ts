export function heuteIso(): string {
  const jetzt = new Date();
  const tzOffsetMs = jetzt.getTimezoneOffset() * 60_000;
  return new Date(jetzt.getTime() - tzOffsetMs).toISOString().slice(0, 10);
}

export function formatDeutsch(isoDatum: string): string {
  const [jahr, monat, tag] = isoDatum.split('-');
  if (!jahr || !monat || !tag) return isoDatum;
  return `${tag}.${monat}.${jahr}`;
}

const MONATE_KURZ = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

/** "12.–14. Sep 2026", "30. Sep – 2. Okt 2026", "12. Sep 2026" */
export function formatZeitraum(von: string, bis?: string): string {
  const [jv, mv, tv] = von.split('-').map(Number);
  if (!jv || !mv || !tv) return von;
  if (!bis || bis === von) return `${tv}. ${MONATE_KURZ[mv - 1]} ${jv}`;
  const [jb, mb, tb] = bis.split('-').map(Number);
  if (!jb || !mb || !tb) return `${tv}. ${MONATE_KURZ[mv - 1]} ${jv}`;
  if (jv === jb && mv === mb) return `${tv}.–${tb}. ${MONATE_KURZ[mv - 1]} ${jv}`;
  if (jv === jb) return `${tv}. ${MONATE_KURZ[mv - 1]} – ${tb}. ${MONATE_KURZ[mb - 1]} ${jv}`;
  return `${tv}. ${MONATE_KURZ[mv - 1]} ${jv} – ${tb}. ${MONATE_KURZ[mb - 1]} ${jb}`;
}

/** "04.10.2026, 14:30" aus einem ISO-Zeitpunkt */
export function formatZeitpunkt(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
}
