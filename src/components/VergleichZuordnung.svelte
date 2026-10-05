<script lang="ts">
  import { de } from '../lib/texte/de';
  import { einzelneBiere, zielBiere, type VergleichsBier } from '../lib/vergleich';

  let {
    biere,
    anzahlTastings,
    onZusammenfuehren,
    onZurueck,
  }: {
    biere: VergleichsBier[];
    anzahlTastings: number;
    onZusammenfuehren: (bier: VergleichsBier, ziel: VergleichsBier) => Promise<void>;
    onZurueck: () => void;
  } = $props();

  const t = de.vergleich.zuordnung;

  const einzelne = $derived(einzelneBiere(biere, anzahlTastings));

  let offen = $state<string | null>(null);
  let zielSchluessel = $state('');
  let arbeitet = $state(false);
  let fehler = $state(false);
  let erfolg = $state(false);

  const gewaehlt = $derived(einzelne.find((b) => b.schluessel === offen));
  const ziele = $derived(gewaehlt ? zielBiere(gewaehlt, biere) : []);

  function oeffnen(bier: VergleichsBier) {
    offen = offen === bier.schluessel ? null : bier.schluessel;
    zielSchluessel = '';
    fehler = false;
    erfolg = false;
  }

  async function zusammenfuehren() {
    const ziel = ziele.find((z) => z.schluessel === zielSchluessel);
    if (!gewaehlt || !ziel) return;
    arbeitet = true;
    fehler = false;
    try {
      await onZusammenfuehren(gewaehlt, ziel);
      offen = null;
      erfolg = true;
    } catch (f) {
      console.error('Zuordnung speichern fehlgeschlagen', f);
      fehler = true;
    }
    arbeitet = false;
  }

  const wer = (b: VergleichsBier) => `${b.herstellerName} · ${b.eintraege[0].verkoster}`;
</script>

<div class="seite">
  <div class="kopf">
    <button class="ib" onclick={onZurueck} aria-label={de.allgemein.zurueck}>‹</button>
    <h1>{t.titel}</h1>
  </div>

  <p class="hinweis einleitung">{t.einleitung}</p>
  {#if erfolg}<p class="ok" role="status">{t.gespeichert}</p>{/if}

  {#if einzelne.length === 0}
    <div class="karte leer"><p class="hinweis">{t.alleZugeordnet}</p></div>
  {:else}
    <ul>
      {#each einzelne as bier (bier.schluessel)}
        <li class="karte">
          <button class="kopfzeile" aria-expanded={offen === bier.schluessel} onclick={() => oeffnen(bier)}>
            <span class="text"><b>{bier.name}</b><small>{wer(bier)}</small></span>
            <span class="tag">{t.einzeln}</span>
          </button>
          {#if offen === bier.schluessel}
            <div class="auswahl">
              {#if ziele.length === 0}
                <p class="hinweis">{t.keineZiele}</p>
              {:else}
                <label class="feld">
                  <span>{t.gehoertZu}</span>
                  <select class="eingabe" bind:value={zielSchluessel}>
                    <option value="">–</option>
                    {#each ziele as z (z.schluessel)}
                      <option value={z.schluessel}>{z.name} · {z.herstellerName} · {z.eintraege.map((e) => e.verkoster).join(', ')}</option>
                    {/each}
                  </select>
                </label>
                {#if fehler}<p class="fehler" role="alert">{t.fehler}</p>{/if}
                <button class="knopf block" disabled={zielSchluessel === '' || arbeitet} onclick={zusammenfuehren}>{t.zusammenfuehren}</button>
              {/if}
              <button class="knopf sekundaer block" onclick={() => (offen = null)}>{t.abbrechen}</button>
            </div>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
  <p class="hinweis fuss">{t.hinweis}</p>
</div>

<style>
  .einleitung {
    margin: 10px 0;
  }
  .ok {
    color: var(--hop);
    font-weight: 700;
    margin-bottom: 8px;
  }
  .leer {
    text-align: center;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 12px;
  }
  li.karte {
    padding: 10px 12px;
  }
  .kopfzeile {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    min-height: 48px;
    text-align: left;
  }
  .text {
    flex: 1;
    min-width: 0;
    display: grid;
    line-height: 1.25;
  }
  small {
    color: var(--muted);
    font-size: 13px;
  }
  .tag {
    flex: none;
    padding: 1px 9px;
    border-radius: 99px;
    border: 1.5px solid var(--ink);
    background: var(--ocker);
    color: #2b1d14;
    font-size: 12px;
    font-weight: 700;
  }
  .auswahl {
    display: grid;
    gap: 10px;
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1.5px dashed var(--line);
  }
  .auswahl .feld {
    margin-top: 0;
  }
  select {
    appearance: auto;
  }
  .fuss {
    margin-top: 16px;
  }
</style>
