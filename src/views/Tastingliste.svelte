<script lang="ts">
  import { liveQuery } from 'dexie';
  import Bewertung from '../components/Bewertung.svelte';
  import Dolde from '../components/Dolde.svelte';
  import FotoBild from '../components/FotoBild.svelte';
  import Wortmarke from '../components/Wortmarke.svelte';
  import { db, ladeEinstellungen, tastingKennzahlen, type TastingKennzahlen } from '../lib/db';
  import { formatZeitpunkt, formatZeitraum } from '../lib/datum';
  import type { Tasting } from '../lib/model';
  import { de } from '../lib/texte/de';

  let {
    onNeu,
    onOeffnen,
    onEinstellungen,
  }: { onNeu: () => void; onOeffnen: (tastingId: string) => void; onEinstellungen: () => void } = $props();

  const t = de.liste;

  interface Eintrag {
    tasting: Tasting;
    kennzahlen: TastingKennzahlen;
  }

  let eintraege = $state<Eintrag[] | null>(null);
  let startHinweis = $state(false);

  // Einstellungen anlegen (beim allerersten Start inkl. Antrag auf dauerhaften Speicher) und Start-Hinweis prüfen
  ladeEinstellungen()
    .then((e) => (startHinweis = !e.startHinweisGesehen))
    .catch((fehler) => console.error('Einstellungen laden fehlgeschlagen', fehler));

  async function startHinweisSchliessen() {
    startHinweis = false;
    await db.einstellungen.update('global', { startHinweisGesehen: true });
  }

  $effect(() => {
    const abo = liveQuery(async () => {
      const tastings = await db.tastings.orderBy('datumVon').reverse().toArray();
      return Promise.all(tastings.map(async (tasting) => ({ tasting, kennzahlen: await tastingKennzahlen(tasting.id) })));
    }).subscribe({
      next: (werte) => (eintraege = werte),
      error: (fehler) => console.error('Tastings laden fehlgeschlagen', fehler),
    });
    return () => abo.unsubscribe();
  });
</script>

<div class="seite">
  <div class="kopf">
    <Wortmarke hoehe={36} />
    <h1 class="titel">{de.app.name}</h1>
    <button class="ib" onclick={onEinstellungen} aria-label={de.allgemein.einstellungen}>⚙</button>
  </div>

  {#if startHinweis}
    <div class="karte starthinweis" role="note">
      <b>{de.backup.startTitel}</b>
      <p>{de.backup.startText}</p>
      <button class="knopf sekundaer" onclick={startHinweisSchliessen}>{de.backup.startOk}</button>
    </div>
  {/if}

  <h2 class="abschnitt">{t.titel}</h2>

  {#if eintraege === null}
    <p class="hinweis">…</p>
  {:else if eintraege.length === 0}
    <div class="karte leer">
      <div class="platzhalter"><Dolde hoehe={64} /></div>
      <h3>{t.leerTitel}</h3>
      <p class="hinweis">{t.leerText}</p>
    </div>
  {:else}
    <ul>
      {#each eintraege as { tasting, kennzahlen } (tasting.id)}
        <li>
          <button class="karte tasting" onclick={() => onOeffnen(tasting.id)}>
            <span class="cover">
              <FotoBild art="cover" bezugId={tasting.id} klasse="coverbild">
                {#snippet platzhalter()}<Dolde hoehe={46} />{/snippet}
              </FotoBild>
            </span>
            <span class="text">
              <strong>{tasting.name}</strong>
              <span class="meta">
                {formatZeitraum(tasting.datumVon, tasting.datumBis)}{tasting.ort ? ` · ${tasting.ort}` : ''}
              </span>
              <span class="meta">
                {t.verkoster}: {tasting.verkoster} · {t.biere(kennzahlen.probiert)}{kennzahlen.vorgemerkt > 0
                  ? ` · ${t.vorgemerkt(kennzahlen.vorgemerkt)}`
                  : ''}
              </span>
              <span class="meta">
                {tasting.letzteSicherung ? de.backup.zuletzt(formatZeitpunkt(tasting.letzteSicherung)) : de.backup.nochNie}
              </span>
              {#if kennzahlen.durchschnitt !== undefined}
                <Bewertung wert={kennzahlen.durchschnitt} />
              {/if}
            </span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<div class="unterzeile">
  <button class="knopf" onclick={onNeu}>{t.neu}</button>
</div>

<style>
  .starthinweis {
    display: grid;
    gap: 8px;
    justify-items: start;
    margin-bottom: 8px;
    background: var(--hop-soft);
  }
  .starthinweis p {
    font-size: 15px;
    line-height: 1.35;
  }
  .titel {
    text-align: right;
    font-size: 17px;
  }
  .kopf :global(svg) {
    color: var(--ink);
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 14px;
  }
  .tasting {
    display: flex;
    gap: 12px;
    align-items: center;
    width: 100%;
    text-align: left;
    font: inherit;
    color: var(--ink);
  }
  .cover {
    display: grid;
    place-items: center;
    flex: none;
    width: 68px;
    height: 68px;
    border-radius: 10px;
    border: 2px solid var(--ink);
    background: var(--ocker);
    color: color-mix(in srgb, var(--ink) 25%, transparent);
    overflow: hidden;
  }
  .cover :global(.coverbild) {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .text {
    display: grid;
    gap: 2px;
    min-width: 0;
  }
  .text strong {
    font-family: var(--font-titel);
    font-weight: 400;
    font-size: 18px;
    line-height: 1.15;
  }
  .meta {
    color: var(--muted);
    font-size: 14px;
    line-height: 1.3;
  }
  .leer {
    text-align: center;
    display: grid;
    gap: 8px;
    justify-items: center;
    padding: 28px 16px;
  }
  .platzhalter {
    color: var(--ocker);
  }
</style>
