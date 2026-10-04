<script lang="ts">
  import { liveQuery } from 'dexie';
  import Bewertung from '../components/Bewertung.svelte';
  import Dolde from '../components/Dolde.svelte';
  import FotoBild from '../components/FotoBild.svelte';
  import { db } from '../lib/db';
  import { formatZeitraum } from '../lib/datum';
  import { gruppiere, navigationsIds } from '../lib/getraenke';
  import { holeEingeklappt, MERKLISTE, setzeEingeklappt } from '../lib/klappZustand';
  import type { Getraenk, Hersteller, Tasting } from '../lib/model';
  import { de } from '../lib/texte/de';

  let {
    tastingId,
    onZurueck,
    onBearbeiten,
    onNeuesBier,
    onBierOeffnen,
  }: {
    tastingId: string;
    onZurueck: () => void;
    onBearbeiten: (tastingId: string) => void;
    onNeuesBier: (tastingId: string, ids: string[]) => void;
    onBierOeffnen: (tastingId: string, getraenkId: string, ids: string[]) => void;
  } = $props();

  const t = de.uebersicht;

  interface Daten {
    tasting: Tasting | undefined;
    hersteller: Hersteller[];
    getraenke: Getraenk[];
  }

  let daten = $state<Daten | null>(null);
  // svelte-ignore state_referenced_locally
  let eingeklappt = $state(holeEingeklappt(tastingId));
  let reiter = $state<'getraenke' | 'auswertung'>('getraenke');
  let hatCover = $state(false);

  $effect(() => {
    const abo = liveQuery(async () => ({
      tasting: await db.tastings.get(tastingId),
      hersteller: await db.hersteller.where('tastingId').equals(tastingId).toArray(),
      getraenke: await db.getraenke.where('tastingId').equals(tastingId).toArray(),
    })).subscribe({
      next: (werte) => (daten = werte),
      error: (fehler) => console.error('Tasting laden fehlgeschlagen', fehler),
    });
    return () => abo.unsubscribe();
  });

  const tasting = $derived(daten?.tasting);
  const aufgebaut = $derived(daten ? gruppiere(daten.hersteller, daten.getraenke) : { merkliste: [], gruppen: [] });
  const ids = $derived(daten ? navigationsIds(daten.hersteller, daten.getraenke) : []);
  const herstellerNamen = $derived(new Map((daten?.hersteller ?? []).map((h) => [h.id, h.name])));
  const merklisteOffen = $derived(!eingeklappt.has(MERKLISTE));
  const alleZu = $derived(aufgebaut.gruppen.length > 0 && aufgebaut.gruppen.every((g) => eingeklappt.has(g.hersteller.id)));

  function umschalten(schluessel: string) {
    const neu = new Set(eingeklappt);
    if (neu.has(schluessel)) neu.delete(schluessel);
    else neu.add(schluessel);
    eingeklappt = neu;
    setzeEingeklappt(tastingId, neu);
  }

  function alleUmschalten() {
    const neu = new Set(eingeklappt);
    for (const g of aufgebaut.gruppen) {
      if (alleZu) neu.delete(g.hersteller.id);
      else neu.add(g.hersteller.id);
    }
    eingeklappt = neu;
    setzeEingeklappt(tastingId, neu);
  }

  function detail(g: Getraenk): string {
    return [g.stilName, g.abv !== undefined ? `${String(g.abv).replace('.', ',')} % Vol.` : undefined].filter(Boolean).join(' · ');
  }
</script>

<div class="seite">
  <div class="kopf">
    <button class="ib" onclick={onZurueck} aria-label={de.allgemein.zurueck}>‹</button>
    <span style="flex: 1"></span>
    <button class="ib" onclick={() => onBearbeiten(tastingId)} aria-label={de.allgemein.bearbeiten}>✎</button>
  </div>

  {#if tasting}
    <div class="hero" class:mitBild={hatCover}>
      <span class="herobild">
        <FotoBild art="cover" bezugId={tastingId} gross klasse="coverbild" bind:vorhanden={hatCover} />
      </span>
      {#if !hatCover}<span class="dolde"><Dolde hoehe={72} /></span>{/if}
      <div class="titelblock">
        <h1>{tasting.name}</h1>
        {#if tasting.untertitel}<p>{tasting.untertitel}</p>{/if}
        <p>
          {formatZeitraum(tasting.datumVon, tasting.datumBis)}{tasting.ort ? ` · ${tasting.ort}` : ''} · {tasting.verkoster}
        </p>
      </div>
    </div>

    <div class="reiter" role="tablist">
      <button role="tab" aria-selected={reiter === 'getraenke'} class:an={reiter === 'getraenke'} onclick={() => (reiter = 'getraenke')}>{t.getraenke}</button>
      <button role="tab" aria-selected={reiter === 'auswertung'} class:an={reiter === 'auswertung'} onclick={() => (reiter = 'auswertung')}>{t.auswertung}</button>
    </div>

    {#if reiter === 'auswertung'}
      <div class="karte leer"><p class="hinweis">{t.auswertungFolgt}</p></div>
    {:else if daten && daten.getraenke.length === 0}
      <div class="karte leer">
        <span class="platzhalter"><Dolde hoehe={56} /></span>
        <h3>{t.leerTitel}</h3>
        <p class="hinweis">{t.leerText}</p>
      </div>
    {:else}
      {#if aufgebaut.merkliste.length > 0}
        <section class="gruppe">
          <button class="kopfzeile" aria-expanded={merklisteOffen} onclick={() => umschalten(MERKLISTE)}>
            <span class="symbol">📌</span>
            <span class="name"><strong>{t.merkliste}</strong><small>{t.merklisteInfo(aufgebaut.merkliste.length)}</small></span>
            <i class="pfeil" class:offen={merklisteOffen}></i>
          </button>
          {#if merklisteOffen}
            {#each aufgebaut.merkliste as g (g.id)}
              <button class="zeile" onclick={() => onBierOeffnen(tastingId, g.id, ids)}>
                <span class="name">
                  <strong>{g.name}</strong>
                  <small>{[herstellerNamen.get(g.herstellerId), g.stilName].filter(Boolean).join(' · ')}</small>
                </span>
                <span class="tag">{t.vorgemerkt}</span>
              </button>
            {/each}
          {/if}
        </section>
      {/if}

      {#if aufgebaut.gruppen.length > 0}
        <div class="werkzeuge">
          <span>{t.nachHersteller}</span>
          <button class="textknopf klein" onclick={alleUmschalten}>{alleZu ? t.alleAufklappen : t.alleZuklappen}</button>
        </div>
      {/if}

      {#each aufgebaut.gruppen as gruppe (gruppe.hersteller.id)}
        {@const offen = !eingeklappt.has(gruppe.hersteller.id)}
        <section class="gruppe">
          <button class="kopfzeile" aria-expanded={offen} onclick={() => umschalten(gruppe.hersteller.id)}>
            <span class="name">
              <strong>{gruppe.hersteller.name}</strong>
              <small>{[gruppe.hersteller.standort, de.liste.biere(gruppe.getraenke.length)].filter(Boolean).join(' · ')}</small>
            </span>
            {#if gruppe.durchschnitt !== undefined}<Bewertung wert={gruppe.durchschnitt} hoehe={20} />{/if}
            <i class="pfeil" class:offen></i>
          </button>
          {#if offen}
            {#each gruppe.getraenke as g (g.id)}
              <button class="zeile" onclick={() => onBierOeffnen(tastingId, g.id, ids)}>
                <span class="mini">
                  <FotoBild art="getraenk" bezugId={g.id} klasse="minibild">
                    {#snippet platzhalter()}<Dolde hoehe={26} />{/snippet}
                  </FotoBild>
                </span>
                <span class="name">
                  <strong>{g.name}</strong>
                  <small>{detail(g) || (g.bewertung === undefined ? t.nichtBewertet : '')}</small>
                </span>
                <Bewertung wert={g.bewertung} />
              </button>
            {/each}
          {/if}
        </section>
      {/each}
    {/if}
  {:else if daten && !tasting}
    <p class="hinweis">Tasting nicht gefunden.</p>
  {/if}
</div>

{#if tasting && reiter === 'getraenke'}
  <div class="unterzeile">
    <button class="knopf" onclick={() => onNeuesBier(tastingId, ids)}>{t.neuesBier}</button>
  </div>
{/if}

<style>
  .hero {
    display: flex;
    gap: 14px;
    align-items: center;
    padding: 16px;
    border: 2px solid var(--ink);
    border-radius: var(--radius);
    background: var(--ocker);
    color: #2b1d14;
    box-shadow: 0 3px 0 var(--ink);
  }
  .hero {
    position: relative;
    overflow: hidden;
  }
  .hero.mitBild {
    min-height: 168px;
    align-items: flex-end;
    color: #fff6e0;
  }
  .herobild {
    position: absolute;
    inset: 0;
  }
  .herobild :global(.coverbild) {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .hero.mitBild::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(transparent 30%, rgb(29 21 14 / 0.85));
  }
  .dolde,
  .titelblock {
    position: relative;
    z-index: 1;
  }
  .dolde {
    flex: none;
    color: rgb(43 29 20 / 0.28);
  }
  h1 {
    font-size: 22px;
    line-height: 1.12;
  }
  .titelblock p {
    font-size: 14px;
    margin-top: 2px;
  }
  .reiter {
    display: flex;
    gap: 8px;
    margin: 16px 0 4px;
  }
  .reiter button {
    flex: 1;
    min-height: 44px;
    border: 2px solid var(--ink);
    border-radius: 99px;
    background: var(--card);
    font-weight: 700;
  }
  .reiter button.an {
    background: var(--ink);
    color: var(--bg);
  }
  .leer {
    margin-top: 16px;
    text-align: center;
    display: grid;
    gap: 8px;
    justify-items: center;
    padding: 24px 16px;
  }
  .platzhalter {
    color: var(--ocker);
  }
  .werkzeuge {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 14px;
    font-size: 14px;
    color: var(--muted);
  }
  .klein {
    font-size: 14px;
    min-height: 40px;
  }
  .gruppe {
    margin-top: 12px;
    background: var(--card);
    border: 2px solid var(--ink);
    border-radius: var(--radius);
    overflow: hidden;
  }
  .kopfzeile,
  .zeile {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    text-align: left;
  }
  .kopfzeile {
    padding: 10px 12px;
    min-height: 58px;
  }
  .zeile {
    padding: 9px 12px;
    min-height: 56px;
    border-top: 1.5px dashed var(--line);
  }
  .symbol {
    font-size: 20px;
  }
  .name {
    flex: 1;
    min-width: 0;
    display: grid;
    line-height: 1.25;
  }
  .kopfzeile .name strong {
    font-family: var(--font-titel);
    font-weight: 400;
    font-size: 17px;
  }
  .zeile .name strong {
    font-size: 16px;
  }
  small {
    color: var(--muted);
    font-size: 13px;
  }
  .mini {
    flex: none;
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border-radius: 10px;
    border: 2px solid var(--ink);
    background: var(--ocker);
    color: rgb(43 29 20 / 0.3);
    overflow: hidden;
  }
  .mini :global(.minibild) {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .tag {
    flex: none;
    padding: 1px 9px;
    border-radius: 99px;
    border: 1.5px solid var(--muted);
    color: var(--muted);
    font-size: 12px;
    font-weight: 700;
  }
  .pfeil {
    flex: none;
    width: 11px;
    height: 11px;
    margin: 0 6px 4px 4px;
    border-right: 3px solid var(--ink);
    border-bottom: 3px solid var(--ink);
    transform: rotate(45deg);
    transition: transform 0.15s;
  }
  .pfeil.offen {
    transform: rotate(225deg);
    margin: 4px 6px 0 4px;
  }
</style>
