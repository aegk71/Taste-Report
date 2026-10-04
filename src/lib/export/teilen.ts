/** true, wenn die Datei geteilt bzw. heruntergeladen wurde; false, wenn der Teilen-Dialog abgebrochen wurde. */
export async function dateiBereitstellen(blob: Blob, dateiname: string, mimeTyp: string): Promise<boolean> {
  const datei = new File([blob], dateiname, { type: mimeTyp });

  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (nav.canShare && nav.canShare({ files: [datei] })) {
    try {
      await navigator.share({ files: [datei] });
      return true;
    } catch (fehler) {
      if (fehler instanceof Error && fehler.name === 'AbortError') return false;
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = dateiname;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return true;
}
