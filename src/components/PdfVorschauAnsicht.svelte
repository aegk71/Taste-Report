<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { dateiBereitstellen } from '../lib/export/teilen';
  import { de } from '../lib/texte/de';

  let {
    blob,
    seiten,
    dateiname,
    titel = de.export.vorschau,
    onSchliessen,
  }: { blob: Blob; seiten: number; dateiname: string; titel?: string; onSchliessen: () => void } = $props();

  const t = de.export;

  let seitenBilder = $state<string[]>([]);
  let fertig = $state(false);
  let abgebrochen = false;

  onDestroy(() => (abgebrochen = true));

  // Die installierte iOS-PWA zeigt PDFs im iframe nur auf Seite 1: darum werden die Seiten als Bilder gerendert.
  onMount(async () => {
    try {
      const { pdfSeitenRendern } = await import('../lib/export/pdfVorschau');
      await pdfSeitenRendern(blob, (bild) => {
        if (!abgebrochen) seitenBilder = [...seitenBilder, bild];
      });
    } catch (fehler) {
      console.error('PDF-Vorschau fehlgeschlagen', fehler);
    }
    fertig = true;
  });

  async function teilen() {
    await dateiBereitstellen(blob, dateiname, 'application/pdf');
  }
</script>

<div class="vollbild" role="dialog" aria-modal="true" aria-label={titel}>
  <div class="leiste">
    <button class="ib" onclick={onSchliessen} aria-label={t.schliessen}>✕</button>
    <h3>{titel} · {t.seiten(seiten)}</h3>
  </div>
  <div class="seiten">
    {#each seitenBilder as bild, i (i)}
      <img src={bild} alt="Seite {i + 1}" />
    {/each}
    {#if !fertig}<p class="hinweis">{t.arbeitet}</p>{/if}
  </div>
  <div class="aktionen">
    <button class="knopf" onclick={teilen}>{t.teilen}</button>
  </div>
</div>

<style>
  .vollbild {
    position: fixed;
    inset: 0;
    z-index: 70;
    display: flex;
    flex-direction: column;
    background: var(--bg);
  }
  .leiste {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: calc(8px + env(safe-area-inset-top)) 12px 8px;
    border-bottom: 2px solid var(--ink);
  }
  .leiste h3 {
    font-size: 17px;
  }
  .seiten {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: grid;
    align-content: start;
    gap: 14px;
    padding: 14px 12px;
    background: color-mix(in srgb, var(--ink) 12%, var(--bg));
  }
  .seiten img {
    width: 100%;
    max-width: 640px;
    margin: 0 auto;
    display: block;
    border: 1px solid var(--ink);
    box-shadow: 0 4px 14px rgb(0 0 0 / 0.25);
    background: #fff;
  }
  .seiten .hinweis {
    text-align: center;
  }
  .aktionen {
    display: flex;
    justify-content: center;
    padding: 12px 16px calc(14px + env(safe-area-inset-bottom));
    border-top: 2px solid var(--ink);
    background: var(--bg);
  }
</style>
