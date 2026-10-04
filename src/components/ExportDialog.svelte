<script lang="ts">
  import { onDestroy } from 'svelte';
  import { heuteIso } from '../lib/datum';
  import { exportDateiname } from '../lib/export/dateiname';
  import { dateiBereitstellen } from '../lib/export/teilen';
  import type { BerichtErgebnis } from '../lib/export/pdfBericht';
  import type { Tasting } from '../lib/model';
  import { de } from '../lib/texte/de';

  let { tasting, onSchliessen }: { tasting: Tasting; onSchliessen: () => void } = $props();

  const t = de.export;

  type Phase = 'optionen' | 'arbeitet' | 'fertig' | 'fehler';
  let phase = $state<Phase>('optionen');
  let fotos = $state(true);
  let nurBewertete = $state(true);
  let fortschritt = $state({ fertig: 0, gesamt: 0 });
  let ergebnis = $state<BerichtErgebnis | null>(null);
  let seitenBilder = $state<string[]>([]);
  let vorschauFertig = $state(false);
  let abgebrochen = false;
  let excelStatus = $state<'leer' | 'arbeitet' | 'fehler'>('leer');

  onDestroy(() => (abgebrochen = true));

  async function erstellen() {
    phase = 'arbeitet';
    seitenBilder = [];
    vorschauFertig = false;
    fortschritt = { fertig: 0, gesamt: 0 };
    try {
      // jsPDF und pdfjs sind groß und werden erst hier geladen
      const { berichtErstellen } = await import('../lib/export/pdfBericht');
      const e = await berichtErstellen(tasting.id, { fotos, nurBewertete }, (fertig, gesamt) => (fortschritt = { fertig, gesamt }));
      if (abgebrochen) return;
      ergebnis = e;
      phase = 'fertig';
      const { pdfSeitenRendern } = await import('../lib/export/pdfVorschau');
      await pdfSeitenRendern(e.blob, (bild) => {
        if (!abgebrochen) seitenBilder = [...seitenBilder, bild];
      });
      vorschauFertig = true;
    } catch (fehler) {
      console.error('Bericht erstellen fehlgeschlagen', fehler);
      if (!abgebrochen) phase = ergebnis ? 'fertig' : 'fehler';
    }
  }

  async function excelTeilen() {
    excelStatus = 'arbeitet';
    try {
      const { tastingAlsExcel, EXCEL_MIME } = await import('../lib/export/excel');
      const blob = await tastingAlsExcel(tasting.id);
      if (abgebrochen) return;
      excelStatus = 'leer';
      await dateiBereitstellen(blob, exportDateiname(tasting.name, 'Daten', heuteIso(), 'xlsx'), EXCEL_MIME);
    } catch (fehler) {
      console.error('Excel erstellen fehlgeschlagen', fehler);
      if (!abgebrochen) excelStatus = 'fehler';
    }
  }

  async function teilen() {
    if (!ergebnis) return;
    await dateiBereitstellen(ergebnis.blob, exportDateiname(tasting.name, 'Bericht', heuteIso(), 'pdf'), 'application/pdf');
  }
</script>

{#if phase === 'fertig' && ergebnis}
  <div class="vollbild" role="dialog" aria-modal="true" aria-label={t.vorschau}>
    <div class="leiste">
      <button class="ib" onclick={onSchliessen} aria-label={t.schliessen}>✕</button>
      <h3>{t.vorschau} · {t.seiten(ergebnis.seiten)}</h3>
    </div>
    <div class="seiten">
      {#each seitenBilder as bild, i (i)}
        <img src={bild} alt="Seite {i + 1}" />
      {/each}
      {#if !vorschauFertig}<p class="hinweis">{t.arbeitet}</p>{/if}
    </div>
    <div class="aktionen">
      <button class="knopf" onclick={teilen}>{t.teilen}</button>
    </div>
  </div>
{:else}
  <div class="blatt" role="dialog" aria-modal="true" aria-label={t.titel}>
    <button class="hintergrund" onclick={onSchliessen} disabled={phase === 'arbeitet' || excelStatus === 'arbeitet'} aria-label={t.schliessen}></button>
    <div class="inhalt">
      <div class="blattkopf">
        <h3>{t.titel}</h3>
        <button class="ib plain" onclick={onSchliessen} disabled={phase === 'arbeitet' || excelStatus === 'arbeitet'} aria-label={t.schliessen}>✕</button>
      </div>

      {#if phase === 'arbeitet'}
        <div class="karte arbeit" aria-live="polite">
          <b>{t.arbeitet}</b>
          {#if fortschritt.gesamt > 0}<span class="hinweis">{t.fortschritt(fortschritt.fertig, fortschritt.gesamt)}</span>{/if}
          <span class="balken"><i style:width="{fortschritt.gesamt > 0 ? (fortschritt.fertig / fortschritt.gesamt) * 100 : 5}%"></i></span>
        </div>
      {:else}
        <div class="karte option">
          <span class="ico">📄</span>
          <span class="text"><b>{t.pdfTitel}</b><small>{t.pdfText}</small></span>
        </div>
        <div class="zeile">
          <span>{t.fotos}</span>
          <button class="schalter" role="switch" aria-checked={fotos} aria-label={t.fotos} onclick={() => (fotos = !fotos)}></button>
        </div>
        <div class="zeile">
          <span>{t.nurBewertete}</span>
          <button class="schalter" role="switch" aria-checked={nurBewertete} aria-label={t.nurBewertete} onclick={() => (nurBewertete = !nurBewertete)}></button>
        </div>
        {#if phase === 'fehler'}<p class="fehler">{t.fehler}</p>{/if}
        <button class="knopf block" onclick={erstellen} disabled={excelStatus === 'arbeitet'}>{phase === 'fehler' ? t.nochmal : t.erstellen}</button>

        <hr />
        <div class="karte option">
          <span class="ico">📊</span>
          <span class="text"><b>{t.excelTitel}</b><small>{t.excelText}</small></span>
        </div>
        {#if excelStatus === 'fehler'}<p class="fehler">{t.excelFehler}</p>{/if}
        <button class="knopf sekundaer block" onclick={excelTeilen} disabled={excelStatus === 'arbeitet'}>
          {excelStatus === 'arbeitet' ? t.excelArbeitet : excelStatus === 'fehler' ? t.nochmal : t.excelErstellen}
        </button>
      {/if}
    </div>
  </div>
{/if}

<style>
  .blatt {
    position: fixed;
    inset: 0;
    z-index: 40;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
  }
  .hintergrund {
    position: absolute;
    inset: 0;
    background: rgb(0 0 0 / 0.5);
  }
  .inhalt {
    position: relative;
    padding: 14px 16px calc(18px + env(safe-area-inset-bottom));
    border-top: 2px solid var(--ink);
    border-radius: 22px 22px 0 0;
    background: var(--bg);
    display: grid;
    gap: 12px;
    max-width: 560px;
    width: 100%;
    margin: 0 auto;
  }
  .blattkopf {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .blattkopf h3 {
    flex: 1;
    font-size: 20px;
  }
  .option {
    display: flex;
    gap: 12px;
    align-items: center;
  }
  .ico {
    display: grid;
    place-items: center;
    flex: none;
    width: 44px;
    height: 44px;
    border: 2px solid var(--ink);
    border-radius: 12px;
    background: var(--hop-soft);
    font-size: 21px;
  }
  .text {
    display: grid;
    line-height: 1.25;
  }
  .text small {
    color: var(--muted);
    font-size: 13px;
  }
  hr {
    width: 100%;
    margin: 4px 0;
    border: 0;
    border-top: 1.5px dashed var(--line, var(--ink));
    opacity: 0.4;
  }
  .zeile {
    display: flex;
    justify-content: space-between;
    align-items: center;
    min-height: 48px;
    font-weight: 600;
  }
  .arbeit {
    display: grid;
    gap: 6px;
    text-align: center;
  }
  .balken {
    display: block;
    height: 10px;
    border-radius: 99px;
    border: 1.5px solid var(--ink);
    background: var(--surface);
    overflow: hidden;
  }
  .balken i {
    display: block;
    height: 100%;
    background: var(--hop);
    transition: width 0.2s;
  }
  .vollbild {
    position: fixed;
    inset: 0;
    z-index: 50;
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
