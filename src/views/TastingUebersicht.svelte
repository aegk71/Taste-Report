<script lang="ts">
  import { liveQuery } from 'dexie';
  import Dolde from '../components/Dolde.svelte';
  import { db } from '../lib/db';
  import { formatZeitraum } from '../lib/datum';
  import type { Tasting } from '../lib/model';
  import { de } from '../lib/texte/de';

  let {
    tastingId,
    onZurueck,
    onBearbeiten,
  }: { tastingId: string; onZurueck: () => void; onBearbeiten: (tastingId: string) => void } = $props();

  const t = de.uebersicht;

  let tasting = $state<Tasting | null | undefined>(undefined);

  $effect(() => {
    const abo = liveQuery(() => db.tastings.get(tastingId)).subscribe({
      next: (wert) => (tasting = wert ?? null),
      error: (fehler) => console.error('Tasting laden fehlgeschlagen', fehler),
    });
    return () => abo.unsubscribe();
  });
</script>

<div class="seite">
  <div class="kopf">
    <button class="ib" onclick={onZurueck} aria-label={de.allgemein.zurueck}>‹</button>
    <span style="flex: 1"></span>
    <button class="ib" onclick={() => onBearbeiten(tastingId)} aria-label={de.allgemein.bearbeiten}>✎</button>
  </div>

  {#if tasting}
    <div class="hero">
      <span class="dolde"><Dolde hoehe={72} /></span>
      <div class="titelblock">
        <h1>{tasting.name}</h1>
        {#if tasting.untertitel}<p>{tasting.untertitel}</p>{/if}
        <p>
          {formatZeitraum(tasting.datumVon, tasting.datumBis)}{tasting.ort ? ` · ${tasting.ort}` : ''} · {tasting.verkoster}
        </p>
      </div>
    </div>

    <div class="karte platzhalter">
      <p class="hinweis">{t.platzhalter}</p>
    </div>
  {:else if tasting === null}
    <p class="hinweis">Tasting nicht gefunden.</p>
  {/if}
</div>

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
  .platzhalter {
    margin-top: 18px;
    text-align: center;
  }
</style>
