<script lang="ts">
  import { bewertungNormalisieren, formatBewertung } from '../lib/bewertung';
  import { de } from '../lib/texte/de';
  import Dolde from './Dolde.svelte';

  // Gesamtbewertung 0 bis 5 in Viertelschritten. undefined = "nicht bewertet" (ungleich 0).
  // Erst die Berührung des Reglers (oder +/−) setzt einen Wert.
  let {
    wert = $bindable(),
    onAenderung,
  }: { wert?: number; onAenderung?: () => void } = $props();

  const t = de.regler;
  const gesetzt = $derived(wert !== undefined);
  const prozent = $derived(((wert ?? 0) / 5) * 100);

  function setze(neu: number | undefined) {
    wert = neu === undefined ? undefined : bewertungNormalisieren(neu);
    onAenderung?.();
  }

  function schritt(richtung: -1 | 1) {
    setze(wert === undefined ? 2.5 : wert + richtung * 0.25);
  }
</script>

<div class="regler" class:leer={!gesetzt}>
  <div class="oben">
    <span class="dolden" aria-hidden="true">
      {#each [0, 1, 2, 3, 4] as i (i)}
        <Dolde hoehe={32} fuellung={Math.max(0, Math.min(1, (wert ?? 0) - i))} />
      {/each}
    </span>
    <span class="zahl" aria-live="polite">{gesetzt ? formatBewertung(wert!) : '–'}</span>
  </div>

  <div class="reihe">
    <button type="button" class="schritt" onclick={() => schritt(-1)} aria-label={t.weniger}>−</button>
    <input
      type="range"
      min="0"
      max="5"
      step="0.25"
      value={wert ?? 0}
      style:--p="{prozent}%"
      aria-label={t.titel}
      aria-valuetext={gesetzt ? formatBewertung(wert!) : t.nichtBewertet}
      onpointerdown={(e) => {
        if (wert === undefined) setze(Number(e.currentTarget.value));
      }}
      oninput={(e) => setze(Number(e.currentTarget.value))}
    />
    <button type="button" class="schritt" onclick={() => schritt(1)} aria-label={t.mehr}>+</button>
  </div>
  <div class="skala" aria-hidden="true"><span>0</span><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span></div>

  <div class="fuss">
    <span>{gesetzt ? t.hinweis : t.nichtBewertet}</span>
    <button type="button" class="reset" onclick={() => setze(undefined)} disabled={!gesetzt}>{t.zuruecksetzen}</button>
  </div>
</div>

<style>
  .regler {
    background: var(--card);
    border: 2px solid var(--ink);
    border-radius: var(--radius);
    box-shadow: 0 3px 0 var(--ink);
    padding: 14px;
  }
  .oben {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .dolden {
    display: inline-flex;
    gap: 4px;
    color: var(--hop);
  }
  .zahl {
    font-family: var(--font-titel);
    font-size: 38px;
    line-height: 1;
    min-width: 84px;
    text-align: right;
  }
  .leer .zahl {
    color: var(--muted);
  }
  .reihe {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 10px;
  }
  .schritt {
    flex: none;
    width: 46px;
    height: 46px;
    border-radius: 50%;
    border: 2px solid var(--ink);
    background: var(--surface);
    font-size: 26px;
    font-weight: 700;
    line-height: 1;
  }
  input[type='range'] {
    -webkit-appearance: none;
    appearance: none;
    flex: 1;
    min-width: 0;
    height: 46px;
    margin: 0;
    background: transparent;
    touch-action: pan-y;
  }
  input[type='range']::-webkit-slider-runnable-track {
    height: 14px;
    border-radius: 99px;
    border: 2px solid var(--ink);
    background: linear-gradient(90deg, var(--hop) var(--p), var(--surface) var(--p));
  }
  input[type='range']::-moz-range-track {
    height: 10px;
    border-radius: 99px;
    border: 2px solid var(--ink);
    background: linear-gradient(90deg, var(--hop) var(--p), var(--surface) var(--p));
  }
  input[type='range']::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 40px;
    height: 40px;
    margin-top: -15px;
    border-radius: 50%;
    background: var(--ocker);
    border: 3px solid var(--ink);
    box-shadow: 0 2px 0 var(--ink);
  }
  input[type='range']::-moz-range-thumb {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    background: var(--ocker);
    border: 3px solid var(--ink);
  }
  .leer input[type='range']::-webkit-slider-thumb {
    background: var(--line);
  }
  .leer input[type='range']::-moz-range-thumb {
    background: var(--line);
  }
  .skala {
    display: flex;
    justify-content: space-between;
    padding: 0 68px;
    margin-top: -8px;
    font-size: 12px;
    color: var(--muted);
  }
  .fuss {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 6px;
    font-size: 13px;
    color: var(--muted);
  }
  .reset {
    min-height: 40px;
    padding: 0 4px;
    font-weight: 600;
    font-size: 14px;
    color: var(--red);
  }
  .reset:disabled {
    color: var(--muted);
    opacity: 0.6;
    cursor: default;
  }
</style>
