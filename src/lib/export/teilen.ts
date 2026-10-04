export async function dateiBereitstellen(blob: Blob, dateiname: string, mimeTyp: string): Promise<void> {
  const datei = new File([blob], dateiname, { type: mimeTyp });

  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (nav.canShare && nav.canShare({ files: [datei] })) {
    try {
      await navigator.share({ files: [datei] });
      return;
    } catch (fehler) {
      if (fehler instanceof Error && fehler.name === 'AbortError') return;
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
}
