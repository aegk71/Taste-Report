<script lang="ts">
  import { BackupFehler } from '../lib/backupFormat';
  import type { ImportErgebnis, ImportModus, ImportVorschau } from '../lib/export/backup';
  import { de } from '../lib/texte/de';

  const t = de.import;

  type Phase = 'zu' | 'liest' | 'frage' | 'arbeitet' | 'fertig' | 'fehler';
  let phase = $state<Phase>('zu');
  // raw: kein Svelte-Proxy, die Daten gehen direkt in IndexedDB (Proxys lassen sich dort nicht speichern)
  let vorschau = $state.raw<ImportVorschau | null>(null);
  let ergebnis = $state.raw<ImportErgebnis | null>(null);
  let fehlerText = $state('');
  let modus = $state<ImportModus>('kopie');
  let dateiFeld: HTMLInputElement | undefined = $state();

  const kollisionen = $derived(vorschau ? vorschau.tastings.filter((x) => x.kollision).length : 0);
  const vergleichKollisionen = $derived(vorschau ? vorschau.vergleichKollisionen : 0);

  function fehlerFuer(fehler: unknown): string {
    if (fehler instanceof BackupFehler) {
      return fehler.code === 'version' ? t.fehlerVersion : fehler.code === 'leer' ? t.fehlerLeer : t.fehlerFormat;
    }
    return t.fehlerAllgemein;
  }

  async function dateiGewaehlt(e: Event & { currentTarget: HTMLInputElement }) {
    const datei = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!datei) return;
    phase = 'liest';
    try {
      const { backupVorabPruefen } = await import('../lib/export/backup');
      vorschau = await backupVorabPruefen(datei);
      phase = 'frage';
    } catch (fehler) {
      console.error('Backup prüfen fehlgeschlagen', fehler);
      fehlerText = fehlerFuer(fehler);
      phase = 'fehler';
    }
  }

  async function einspielen() {
    if (!vorschau) return;
    phase = 'arbeitet';
    try {
      const { backupImportieren } = await import('../lib/export/backup');
      ergebnis = await backupImportieren(vorschau, modus);
      phase = 'fertig';
    } catch (fehler) {
      console.error('Backup einspielen fehlgeschlagen', fehler);
      fehlerText = fehlerFuer(fehler);
      phase = 'fehler';
    }
  }

  function schliessen() {
    if (phase === 'arbeitet') return;
    phase = 'zu';
    vorschau = null;
    ergebnis = null;
  }
</script>

<input bind:this={dateiFeld} type="file" accept=".zip,application/zip" hidden onchange={dateiGewaehlt} />
<button class="knopf sekundaer block" onclick={() => dateiFeld?.click()}>{t.knopf}</button>

{#if phase !== 'zu'}
  <div class="blatt" role="dialog" aria-modal="true" aria-label={t.titel}>
    <button class="hintergrund" onclick={schliessen} disabled={phase === 'arbeitet'} aria-label={t.schliessen}></button>
    <div class="inhalt">
      <div class="blattkopf">
        <h3>{t.titel}</h3>
        <button class="ib plain" onclick={schliessen} disabled={phase === 'arbeitet'} aria-label={t.schliessen}>✕</button>
      </div>

      {#if phase === 'liest'}
        <p class="hinweis">{t.lesen}</p>
      {:else if phase === 'arbeitet'}
        <p class="hinweis" aria-live="polite">{t.arbeitet}</p>
      {:else if phase === 'frage' && vorschau}
        <div class="karte">
          <p>{t.inhalt(vorschau.tastings.length, vorschau.biere, vorschau.fotos)}</p>
          <ul class="liste">
            {#each vorschau.tastings as x (x.id)}
              <li>{x.name}{x.kollision ? ' ⚠' : ''}</li>
            {/each}
          </ul>
          {#if vorschau.vergleiche > 0}<p class="hinweis">{t.vergleicheInhalt(vorschau.vergleiche)}</p>{/if}
        </div>
        {#if kollisionen > 0 || vergleichKollisionen > 0}
          {#if kollisionen > 0}<p><b>{t.kollision(kollisionen)}</b></p>{/if}
          {#if vergleichKollisionen > 0}<p><b>{t.kollisionVergleiche(vergleichKollisionen)}</b></p>{/if}
          <div class="wahl" role="radiogroup">
            <button class="wahlknopf" role="radio" aria-checked={modus === 'kopie'} class:an={modus === 'kopie'} onclick={() => (modus = 'kopie')}>{t.kopie}</button>
            <button class="wahlknopf" role="radio" aria-checked={modus === 'ersetzen'} class:an={modus === 'ersetzen'} onclick={() => (modus = 'ersetzen')}>{t.ersetzen}</button>
          </div>
          <p class="hinweis">{t.kollisionHinweis}</p>
        {/if}
        <button class="knopf block" onclick={einspielen}>{t.einspielen}</button>
        <button class="knopf sekundaer block" onclick={schliessen}>{t.abbrechen}</button>
      {:else if phase === 'fertig' && ergebnis}
        <p class="ok">{t.fertig(ergebnis.tastings, ergebnis.biere, ergebnis.fotos)}</p>
        {#if ergebnis.vergleiche > 0}<p class="hinweis">{t.vergleiche(ergebnis.vergleiche)}</p>{/if}
        {#if ergebnis.neueStile > 0}<p class="hinweis">{t.neueStile(ergebnis.neueStile)}</p>{/if}
        {#if ergebnis.fotosFehlen > 0}<p class="fehler">{de.backup.fotosFehlen(ergebnis.fotosFehlen)}</p>{/if}
        <button class="knopf block" onclick={schliessen}>{t.schliessen}</button>
      {:else if phase === 'fehler'}
        <p class="fehler">{fehlerText}</p>
        <button class="knopf block" onclick={schliessen}>{t.schliessen}</button>
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
  .liste {
    margin: 8px 0 0;
    padding-left: 20px;
    max-height: 30dvh;
    overflow-y: auto;
  }
  .wahl {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .wahlknopf {
    min-height: 48px;
    padding: 6px 10px;
    border: 2px solid var(--ink);
    border-radius: 14px;
    background: var(--card);
    font-weight: 700;
    line-height: 1.2;
  }
  .wahlknopf.an {
    background: var(--ink);
    color: var(--bg);
  }
  .ok {
    font-weight: 700;
    color: var(--hop);
  }
</style>
