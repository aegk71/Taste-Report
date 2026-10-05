<script lang="ts">
  import { formatBewertung } from '../lib/bewertung';
  import { de } from '../lib/texte/de';
  import type { Quelle, VergleichsBier } from '../lib/vergleich';
  import Bewertung from './Bewertung.svelte';
  import Dolde from './Dolde.svelte';
  import VergleichFoto from './VergleichFoto.svelte';

  let {
    bier,
    platz,
    quellen,
    onLoesen,
    onZurueck,
  }: {
    bier: VergleichsBier;
    platz?: number;
    quellen: Quelle[];
    onLoesen: (getraenkId: string) => void;
    onZurueck: () => void;
  } = $props();

  const t = de.vergleich.detail;
  const a = de.vergleich.ansicht;

  // Jeder Verkoster des Vergleichs, auch wenn er das Bier nicht probiert hat
  const zeilen = $derived(quellen.map((q) => ({ verkoster: q.verkoster, tastingId: q.tastingId, eintrag: bier.eintraege.find((e) => e.tastingId === q.tastingId) })));
</script>

<div class="seite">
  <div class="kopf">
    <button class="ib" onclick={onZurueck} aria-label={de.allgemein.zurueck}>‹</button>
    <h1>{bier.name}</h1>
  </div>

  <div class="karte kopfkarte">
    <span class="bild">
      <VergleichFoto ids={bier.eintraege.map((e) => e.getraenk.id)} klasse="detailbild">
        {#snippet platzhalter()}<Dolde hoehe={40} />{/snippet}
      </VergleichFoto>
    </span>
    <span class="info">
      <b>{bier.name}</b>
      <small>{[bier.herstellerName, bier.standort, bier.stil].filter(Boolean).join(' · ')}</small>
      {#if bier.durchschnitt !== undefined}
        <span class="gruppe">
          <Bewertung wert={bier.durchschnitt} hoehe={20} />
          <small>{a.durchschnitt} · {a.von(bier.anzahl, quellen.length)}{platz ? ` · ${a.platz(platz)}` : ''}</small>
        </span>
      {:else}
        <small>{a.ohneBewertung}</small>
      {/if}
    </span>
  </div>

  {#each zeilen as { verkoster, tastingId, eintrag } (tastingId)}
    <div class="karte verkoster">
      <div class="kopfzeile">
        <b>{verkoster}</b>
        {#if eintrag}
          <Bewertung wert={eintrag.bewertung} />
        {/if}
      </div>
      {#if !eintrag}
        <p class="hinweis">{t.nichtProbiert}</p>
      {:else}
        {#if eintrag.bewertung === undefined}<p class="hinweis">{t.nichtBewertet}</p>{/if}
        {#if eintrag.getraenk.notiz?.trim()}
          <p class="notiz">{eintrag.getraenk.notiz}</p>
        {:else}
          <p class="hinweis">{t.keineNotiz}</p>
        {/if}
      {/if}
    </div>
  {/each}

  {#if bier.eintraege.length > 1}
    <h2 class="abschnitt">{t.zuordnung}</h2>
    <div class="karte">
      <p class="hinweis">{t.loesenInfo}</p>
      {#each bier.eintraege as e (e.getraenk.id)}
        <div class="loesen">
          <span>{e.verkoster}: <b>{e.getraenk.name}</b> <small>({e.herstellerName})</small></span>
          <button class="textknopf" onclick={() => onLoesen(e.getraenk.id)} aria-label="{t.loesen}: {e.verkoster}">{t.loesenKurz}</button>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .kopfzeile {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .kopfzeile b {
    font-family: var(--font-titel);
    font-weight: 400;
    font-size: 18px;
  }
  .kopfkarte {
    display: flex;
    gap: 14px;
    align-items: center;
    margin-top: 6px;
  }
  .bild {
    flex: none;
    display: grid;
    place-items: center;
    width: 84px;
    height: 112px;
    border: 2px solid var(--ink);
    border-radius: 10px;
    background: var(--ocker);
    color: rgb(43 29 20 / 0.3);
    overflow: hidden;
  }
  .bild :global(.detailbild) {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  .info {
    display: grid;
    gap: 4px;
    min-width: 0;
    line-height: 1.25;
  }
  .info b {
    font-family: var(--font-titel);
    font-weight: 400;
    font-size: 19px;
  }
  .gruppe {
    display: grid;
    gap: 2px;
  }
  small {
    color: var(--muted);
    font-size: 13px;
  }
  .verkoster {
    margin-top: 12px;
    display: grid;
    gap: 6px;
  }
  .notiz {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    line-height: 1.4;
  }
  .loesen {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    border-top: 1.5px dashed var(--line);
    padding: 6px 0;
    font-size: 15px;
  }
  .loesen .textknopf {
    flex: none;
    font-size: 14px;
  }
</style>
