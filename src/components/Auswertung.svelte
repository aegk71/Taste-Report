<script lang="ts">
  import { onDestroy } from 'svelte';
  import { herstellerWertungen, kennzahlen, rangliste, sieger as siegerVon } from '../lib/auswertung';
  import { formatBewertung } from '../lib/bewertung';
  import { db } from '../lib/db';
  import type { Getraenk, Hersteller, Tasting } from '../lib/model';
  import { de } from '../lib/texte/de';
  import Bewertung from './Bewertung.svelte';
  import Dolde from './Dolde.svelte';
  import FotoBild from './FotoBild.svelte';

  let {
    tasting,
    hersteller,
    getraenke,
    onBierOeffnen,
  }: {
    tasting: Tasting;
    hersteller: Hersteller[];
    getraenke: Getraenk[];
    onBierOeffnen: (getraenkId: string) => void;
  } = $props();

  const t = de.auswertung;

  const platzierungen = $derived(rangliste(getraenke));
  const gewinner = $derived(siegerVon(tasting, getraenke));
  const herstellerListe = $derived(herstellerWertungen(hersteller, getraenke));
  const zahlen = $derived(kennzahlen(getraenke));
  const herstellerNamen = $derived(new Map(hersteller.map((h) => [h.id, h.name])));

  let waehlen = $state(false);

  async function siegerSetzen(siegerId: string | undefined) {
    const aktuell = await db.tastings.get(tasting.id);
    if (!aktuell) return;
    await db.tastings.put({ ...aktuell, siegerId, geaendertAm: new Date().toISOString() });
    waehlen = false;
  }

  // ---------- Fazit (Autosave) ----------
  // Der Startwert genügt: die Ansicht wird beim Tasting-Wechsel ohnehin neu aufgebaut.
  // svelte-ignore state_referenced_locally
  let fazit = $state(tasting.fazit ?? '');
  let status = $state<'ruhig' | 'speichert' | 'gespeichert' | 'fehler'>('ruhig');
  let timer: ReturnType<typeof setTimeout> | undefined;
  let schmutzig = false;
  let kette: Promise<void> = Promise.resolve();

  function fazitGeaendert() {
    schmutzig = true;
    status = 'speichert';
    clearTimeout(timer);
    timer = setTimeout(fazitSpeichern, 500);
  }

  function fazitSpeichern(): Promise<void> {
    clearTimeout(timer);
    if (!schmutzig) return kette;
    schmutzig = false;
    const text = fazit.trim();
    const id = tasting.id;
    kette = kette.then(async () => {
      try {
        const aktuell = await db.tastings.get(id);
        if (!aktuell) return;
        await db.tastings.put({ ...aktuell, fazit: text === '' ? undefined : text, geaendertAm: new Date().toISOString() });
        if (!schmutzig) status = 'gespeichert';
      } catch (fehler) {
        console.error('Fazit speichern fehlgeschlagen', fehler);
        schmutzig = true;
        status = 'fehler';
      }
    });
    return kette;
  }

  const sichtbarkeit = () => {
    if (document.visibilityState === 'hidden') fazitSpeichern();
  };
  document.addEventListener('visibilitychange', sichtbarkeit);
  onDestroy(() => {
    document.removeEventListener('visibilitychange', sichtbarkeit);
    fazitSpeichern();
  });
</script>

<div class="zahlen">
  <div class="karte"><b>{zahlen.biere}</b><span>{t.biere}</span></div>
  <div class="karte"><b>{zahlen.hersteller}</b><span>{t.hersteller}</span></div>
  <div class="karte"><b>{zahlen.durchschnitt === undefined ? '–' : formatBewertung(zahlen.durchschnitt)}</b><span>{t.durchschnitt}</span></div>
</div>

{#if !gewinner}
  <div class="karte leer"><p class="hinweis">{t.keineBewertung}</p></div>
{:else}
  <div class="sieger">
    <button class="siegerinhalt" onclick={() => onBierOeffnen(gewinner.getraenk.id)}>
      <span class="bild">
        <FotoBild art="getraenk" bezugId={gewinner.getraenk.id} klasse="siegerbild">
          {#snippet platzhalter()}<Dolde hoehe={34} />{/snippet}
        </FotoBild>
      </span>
      <span class="siegertext">
        <small>{t.sieger}</small>
        <strong>{gewinner.getraenk.name}</strong>
        <span>{[herstellerNamen.get(gewinner.getraenk.herstellerId), gewinner.getraenk.stilName].filter(Boolean).join(' · ')}</span>
      </span>
      <Bewertung wert={gewinner.getraenk.bewertung} hoehe={24} />
    </button>
    <div class="siegerfuss">
      <span>{gewinner.gewaehlt ? t.siegerGewaehlt : t.siegerAutomatisch}</span>
      <button class="textknopf klein" onclick={() => (waehlen = true)}>{t.aendern}</button>
    </div>
  </div>

  <h2 class="abschnitt">{t.rangliste}</h2>
  <ol class="rang">
    {#each platzierungen as { getraenk, platz } (getraenk.id)}
      <li>
        <button onclick={() => onBierOeffnen(getraenk.id)}>
          <span class="nr">{platz}</span>
          <span class="mitte">
            <b>{getraenk.name}</b>
            <span class="balken"><i style:width="{((getraenk.bewertung ?? 0) / 5) * 100}%"></i></span>
          </span>
          <span class="wert">{formatBewertung(getraenk.bewertung ?? 0)}</span>
        </button>
      </li>
    {/each}
  </ol>

  {#if herstellerListe.length > 0}
    <h2 class="abschnitt">{t.herstellerDurchschnitt}</h2>
    <ul class="rang">
      {#each herstellerListe as w (w.hersteller.id)}
        <li class="statisch">
          <span class="mitte">
            <b>{w.hersteller.name}</b>
            <span class="balken"><i style:width="{(w.durchschnitt / 5) * 100}%"></i></span>
            <small>{t.bewerteteBiere(w.anzahl)}</small>
          </span>
          <span class="wert">{formatBewertung(w.durchschnitt)}</span>
        </li>
      {/each}
    </ul>
  {/if}
{/if}

<h2 class="abschnitt">{t.fazit}</h2>
<textarea class="eingabe fazit" rows="6" placeholder={t.fazitPlatzhalter} bind:value={fazit} oninput={fazitGeaendert}></textarea>
<p class="status" class:fehler={status === 'fehler'} aria-live="polite">
  {#if status === 'gespeichert'}{t.gespeichert}{:else if status === 'speichert'}{de.getraenkForm.speichert}{:else if status === 'fehler'}{de.getraenkForm.fehler}{/if}
</p>

{#if waehlen}
  <div class="blatt" role="dialog" aria-modal="true" aria-label={t.siegerWaehlen}>
    <button class="hintergrund" onclick={() => (waehlen = false)} aria-label={t.schliessen}></button>
    <div class="inhalt">
      <div class="blattkopf">
        <h3>{t.siegerWaehlen}</h3>
        <button class="ib plain" onclick={() => (waehlen = false)} aria-label={t.schliessen}>✕</button>
      </div>
      <ul>
        <li>
          <button class="option" class:an={!gewinner?.gewaehlt} onclick={() => siegerSetzen(undefined)}>
            <span class="punkt"></span><span>{t.automatisch}</span>
          </button>
        </li>
        {#each platzierungen as { getraenk, platz } (getraenk.id)}
          <li>
            <button class="option" class:an={gewinner?.gewaehlt && gewinner.getraenk.id === getraenk.id} onclick={() => siegerSetzen(getraenk.id)}>
              <span class="punkt"></span>
              <span class="optiontext"><b>{getraenk.name}</b><small>{herstellerNamen.get(getraenk.herstellerId)} · {platz}. Platz</small></span>
              <b>{formatBewertung(getraenk.bewertung ?? 0)}</b>
            </button>
          </li>
        {/each}
      </ul>
    </div>
  </div>
{/if}

<style>
  .zahlen {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    margin-top: 14px;
  }
  .zahlen .karte {
    display: grid;
    justify-items: center;
    gap: 2px;
    padding: 10px 6px;
    text-align: center;
  }
  .zahlen b {
    font-family: var(--font-titel);
    font-weight: 400;
    font-size: 22px;
    line-height: 1.1;
  }
  .zahlen span {
    font-size: 13px;
    color: var(--muted);
  }
  .leer {
    margin-top: 14px;
    text-align: center;
  }
  .sieger {
    margin-top: 14px;
    border: 2px solid var(--ink);
    border-radius: var(--radius);
    background: var(--ocker);
    color: #2b1d14;
    box-shadow: 0 3px 0 var(--ink);
    overflow: hidden;
  }
  .siegerinhalt {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 12px;
    text-align: left;
  }
  .bild {
    flex: none;
    display: grid;
    place-items: center;
    width: 62px;
    height: 62px;
    border: 2px solid var(--ink);
    border-radius: 10px;
    background: rgb(255 249 232 / 0.55);
    color: rgb(43 29 20 / 0.35);
    overflow: hidden;
  }
  .bild :global(.siegerbild) {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .siegertext {
    flex: 1;
    min-width: 0;
    display: grid;
    line-height: 1.2;
  }
  .siegertext small {
    font-size: 11.5px;
    font-weight: 700;
    letter-spacing: 0.07em;
    text-transform: uppercase;
  }
  .siegertext strong {
    font-family: var(--font-titel);
    font-weight: 400;
    font-size: 20px;
  }
  .sieger :global(.bewertung b) {
    color: #2b1d14;
  }
  .sieger :global(.bewertung) {
    color: #3d5a14;
  }
  .siegerfuss {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 12px 4px;
    font-size: 13px;
  }
  .siegerfuss .textknopf {
    color: #7a1f10;
    min-height: 40px;
  }
  .rang {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .rang li button,
  .rang li.statisch {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    min-height: 52px;
    padding: 6px 0;
    text-align: left;
  }
  .nr {
    width: 26px;
    text-align: center;
    font-family: var(--font-titel);
    font-size: 17px;
    color: var(--red);
  }
  .mitte {
    flex: 1;
    min-width: 0;
    display: grid;
    gap: 3px;
  }
  .mitte b {
    font-size: 15.5px;
    line-height: 1.2;
  }
  .mitte small {
    color: var(--muted);
    font-size: 13px;
  }
  .balken {
    display: block;
    height: 9px;
    border-radius: 99px;
    border: 1.5px solid var(--ink);
    background: var(--surface);
    overflow: hidden;
  }
  .balken i {
    display: block;
    height: 100%;
    background: var(--hop);
  }
  .wert {
    min-width: 46px;
    text-align: right;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .fazit {
    min-height: 140px;
    line-height: 1.45;
    resize: vertical;
  }
  .status {
    margin-top: 8px;
    min-height: 1.5em;
    text-align: center;
    font-size: 14px;
    font-weight: 600;
    color: var(--hop);
  }
  .status.fehler {
    color: var(--red);
  }
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
    max-height: 80dvh;
    overflow-y: auto;
    padding: 14px 14px calc(18px + env(safe-area-inset-bottom));
    border-top: 2px solid var(--ink);
    border-radius: 22px 22px 0 0;
    background: var(--bg);
  }
  .blattkopf {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .blattkopf h3 {
    flex: 1;
    font-size: 19px;
  }
  .inhalt ul {
    list-style: none;
    margin: 8px 0 0;
    padding: 0;
  }
  .option {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    min-height: 56px;
    padding: 8px 4px;
    text-align: left;
    border-top: 1.5px dashed var(--line);
  }
  .optiontext {
    flex: 1;
    min-width: 0;
    display: grid;
    line-height: 1.2;
  }
  .optiontext small {
    color: var(--muted);
    font-size: 13px;
  }
  .punkt {
    flex: none;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: 2px solid var(--ink);
    background: var(--card);
  }
  .option.an .punkt {
    background: var(--hop);
    box-shadow: inset 0 0 0 4px var(--card);
  }
</style>
