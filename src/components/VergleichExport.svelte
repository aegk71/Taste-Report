<script lang="ts">
  import { onDestroy } from 'svelte';
  import { heuteIso } from '../lib/datum';
  import { exportDateiname } from '../lib/export/dateiname';
  import type { BerichtErgebnis } from '../lib/export/pdfBericht';
  import { dateiBereitstellen } from '../lib/export/teilen';
  import { de } from '../lib/texte/de';
  import PdfVorschauAnsicht from './PdfVorschauAnsicht.svelte';

  let { vergleichId, name, onSchliessen }: { vergleichId: string; name: string; onSchliessen: () => void } = $props();

  const t = de.export;
  const tg = de.gruppeExport;

  type Phase = 'optionen' | 'arbeitet' | 'fertig' | 'fehler';
  let phase = $state<Phase>('optionen');
  let fotos = $state(true);
  let nurBewertete = $state(true);
  let fortschritt = $state({ fertig: 0, gesamt: 0 });
  let ergebnis = $state.raw<BerichtErgebnis | null>(null);
  let abgebrochen = false;
  let excelStatus = $state<'leer' | 'arbeitet' | 'fehler'>('leer');
  const beschaeftigt = $derived(phase === 'arbeitet' || excelStatus === 'arbeitet');

  onDestroy(() => (abgebrochen = true));

  async function erstellen() {
    phase = 'arbeitet';
    fortschritt = { fertig: 0, gesamt: 0 };
    try {
      const { gruppenberichtErstellen } = await import('../lib/export/pdfGruppe');
      const e = await gruppenberichtErstellen(vergleichId, { fotos, nurBewertete }, (fertig, gesamt) => (fortschritt = { fertig, gesamt }));
      if (abgebrochen) return;
      ergebnis = e;
      phase = 'fertig';
    } catch (fehler) {
      console.error('Gruppenbericht erstellen fehlgeschlagen', fehler);
      if (!abgebrochen) phase = ergebnis ? 'fertig' : 'fehler';
    }
  }

  async function excelTeilen() {
    excelStatus = 'arbeitet';
    try {
      const { vergleichAlsExcel, EXCEL_MIME } = await import('../lib/export/excelGruppe');
      const blob = await vergleichAlsExcel(vergleichId);
      if (abgebrochen) return;
      excelStatus = 'leer';
      await dateiBereitstellen(blob, exportDateiname(name, 'Gruppendaten', heuteIso(), 'xlsx'), EXCEL_MIME);
    } catch (fehler) {
      console.error('Excel erstellen fehlgeschlagen', fehler);
      if (!abgebrochen) excelStatus = 'fehler';
    }
  }
</script>

{#if phase === 'fertig' && ergebnis}
  <PdfVorschauAnsicht
    blob={ergebnis.blob}
    seiten={ergebnis.seiten}
    dateiname={exportDateiname(name, 'Gruppenbericht', heuteIso(), 'pdf')}
    titel={tg.vorschau}
    onSchliessen={onSchliessen}
  />
{:else}
  <div class="blatt" role="dialog" aria-modal="true" aria-label={tg.titel}>
    <button class="hintergrund" onclick={onSchliessen} disabled={beschaeftigt} aria-label={t.schliessen}></button>
    <div class="inhalt">
      <div class="blattkopf">
        <h3>{tg.titel}</h3>
        <button class="ib plain" onclick={onSchliessen} disabled={beschaeftigt} aria-label={t.schliessen}>✕</button>
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
          <span class="text"><b>{tg.pdfTitel}</b><small>{tg.pdfText}</small></span>
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
        <button class="knopf block" onclick={erstellen} disabled={beschaeftigt}>{phase === 'fehler' ? t.nochmal : t.erstellen}</button>

        <hr />
        <div class="karte option">
          <span class="ico">📊</span>
          <span class="text"><b>{t.excelTitel}</b><small>{tg.excelText}</small></span>
        </div>
        {#if excelStatus === 'fehler'}<p class="fehler">{t.excelFehler}</p>{/if}
        <button class="knopf sekundaer block" onclick={excelTeilen} disabled={beschaeftigt}>
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
    max-height: 92dvh;
    overflow-y: auto;
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
</style>
