<script lang="ts">
  import { liveQuery } from 'dexie';
  import Bewertung from '../components/Bewertung.svelte';
  import Dolde from '../components/Dolde.svelte';
  import VergleichExport from '../components/VergleichExport.svelte';
  import VergleichBierDetail from '../components/VergleichBierDetail.svelte';
  import VergleichFoto from '../components/VergleichFoto.svelte';
  import VergleichZuordnung from '../components/VergleichZuordnung.svelte';
  import { formatBewertung } from '../lib/bewertung';
  import { de } from '../lib/texte/de';
  import {
    einzelneBiere,
    entkoppeln,
    herstellerGruppen,
    verkosterUebersicht,
    vergleichsRangliste,
    vergleichsSieger,
    zusammenfuehren,
    type VergleichsBier,
  } from '../lib/vergleich';
  import { ladeVergleich, siegerSpeichern, zuordnungSpeichern, type VergleichsDaten } from '../lib/vergleichDaten';

  let {
    vergleichId,
    onZurueck,
    onBearbeiten,
  }: { vergleichId: string; onZurueck: () => void; onBearbeiten: (vergleichId: string) => void } = $props();

  const t = de.vergleich.ansicht;
  const tv = de.vergleich.verkoster;

  type Reiter = 'rangliste' | 'biere' | 'verkoster';
  let reiter = $state<Reiter>('rangliste');
  let detail = $state<string | null>(null);
  let zuordnen = $state(false);
  let waehlen = $state(false);
  let exportOffen = $state(false);

  // raw: reine Lesedaten aus IndexedDB, kein Proxy nötig
  let daten = $state.raw<VergleichsDaten | null | undefined>(undefined);

  $effect(() => {
    const id = vergleichId;
    const abo = liveQuery(() => ladeVergleich(id)).subscribe({
      next: (werte) => (daten = werte ?? null),
      error: (fehler) => console.error('Vergleich laden fehlgeschlagen', fehler),
    });
    return () => abo.unsubscribe();
  });

  const anzahl = $derived(daten?.quellen.length ?? 0);
  const rang = $derived(daten ? vergleichsRangliste(daten.biere) : []);
  const gewinner = $derived(daten ? vergleichsSieger(daten.vergleich.siegerSchluessel, daten.biere) : undefined);
  const gruppen = $derived(daten ? herstellerGruppen(daten.biere) : []);
  const verkoster = $derived(daten ? verkosterUebersicht(daten.quellen) : []);
  const offeneBiere = $derived(daten ? einzelneBiere(daten.biere, anzahl).length : 0);
  const detailBier = $derived(detail && daten ? daten.biere.find((b) => b.schluessel === detail) : undefined);
  const platzVon = (b: VergleichsBier) => rang.find((p) => p.bier.schluessel === b.schluessel)?.platz;
  const fotoIds = (b: VergleichsBier) => b.eintraege.map((e) => e.getraenk.id);

  async function zusammenfuehren_(bier: VergleichsBier, ziel: VergleichsBier) {
    if (!daten) return;
    await zuordnungSpeichern(vergleichId, zusammenfuehren(daten.vergleich.zuordnung, bier, ziel));
  }

  async function loesen(bier: VergleichsBier, getraenkId: string) {
    if (!daten) return;
    await zuordnungSpeichern(vergleichId, entkoppeln(daten.vergleich.zuordnung, getraenkId, bier));
  }

  async function siegerWahl(schluessel: string | undefined) {
    await siegerSpeichern(vergleichId, schluessel);
    waehlen = false;
  }
</script>

{#if zuordnen && daten}
  <VergleichZuordnung biere={daten.biere} anzahlTastings={anzahl} onZusammenfuehren={zusammenfuehren_} onZurueck={() => (zuordnen = false)} />
{:else if detailBier && daten}
  <VergleichBierDetail
    bier={detailBier}
    platz={platzVon(detailBier)}
    quellen={daten.quellen}
    onLoesen={(id) => loesen(detailBier, id)}
    onZurueck={() => (detail = null)}
  />
{:else}
  <div class="seite">
    <div class="kopf">
      <button class="ib" onclick={onZurueck} aria-label={de.allgemein.zurueck}>‹</button>
      <h1>{daten?.vergleich.name ?? '…'}</h1>
      {#if daten && anzahl >= 2}<button class="ib" onclick={() => (exportOffen = true)} aria-label={de.gruppeExport.knopf}>⇪</button>{/if}
      {#if daten}<button class="ib" onclick={() => onBearbeiten(vergleichId)} aria-label={t.bearbeiten}>✎</button>{/if}
    </div>

    {#if daten === null}
      <p class="hinweis">{t.nichtGefunden}</p>
    {:else if daten}
      {#if daten.fehlend > 0}<p class="warnung" role="note">{t.fehlend(daten.fehlend)}</p>{/if}
      {#if anzahl < 2}
        <div class="karte leer"><p class="hinweis">{t.zuWenig}</p></div>
      {:else}
        <div class="reiter" role="tablist">
          <button role="tab" aria-selected={reiter === 'rangliste'} class:an={reiter === 'rangliste'} onclick={() => (reiter = 'rangliste')}>{de.vergleich.reiter.rangliste}</button>
          <button role="tab" aria-selected={reiter === 'biere'} class:an={reiter === 'biere'} onclick={() => (reiter = 'biere')}>{de.vergleich.reiter.biere}</button>
          <button role="tab" aria-selected={reiter === 'verkoster'} class:an={reiter === 'verkoster'} onclick={() => (reiter = 'verkoster')}>{de.vergleich.reiter.verkoster}</button>
        </div>

        {#if offeneBiere > 0 && reiter !== 'verkoster'}
          <div class="warn" role="note">
            <span>{t.nichtZugeordnet(offeneBiere)}</span>
            <button class="textknopf pruefen" onclick={() => (zuordnen = true)}>{t.pruefen}</button>
          </div>
        {/if}

        {#if reiter === 'rangliste'}
          {#if !gewinner}
            <div class="karte leer"><p class="hinweis">{t.keineBewertung}</p></div>
          {:else}
            <div class="sieger">
              <button class="siegerinhalt" onclick={() => (detail = gewinner.bier.schluessel)}>
                <span class="bild">
                  <VergleichFoto ids={fotoIds(gewinner.bier)} klasse="siegerbild">
                    {#snippet platzhalter()}<Dolde hoehe={34} />{/snippet}
                  </VergleichFoto>
                </span>
                <span class="siegertext">
                  <small>{t.sieger}</small>
                  <strong>{gewinner.bier.name}</strong>
                  <span>{[gewinner.bier.herstellerName, gewinner.bier.stil].filter(Boolean).join(' · ')}</span>
                  <span>{t.durchschnitt} · {t.von(gewinner.bier.anzahl, anzahl)}</span>
                </span>
                <Bewertung wert={gewinner.bier.durchschnitt} hoehe={24} />
              </button>
              <div class="siegerfuss">
                <span>{gewinner.gewaehlt ? t.siegerGewaehlt : t.siegerAutomatisch}</span>
                <button class="textknopf klein" onclick={() => (waehlen = true)}>{t.aendern}</button>
              </div>
            </div>

            <h2 class="abschnitt">{t.rangliste}</h2>
            <ol class="rang">
              {#each rang as { bier, platz } (bier.schluessel)}
                <li>
                  <button onclick={() => (detail = bier.schluessel)}>
                    <span class="nr">{platz}</span>
                    <span class="mitte">
                      <b>{bier.name}</b>
                      <small>{bier.herstellerName}</small>
                      <span class="balken"><i style:width="{((bier.durchschnitt ?? 0) / 5) * 100}%"></i></span>
                    </span>
                    <span class="wert">
                      <b>{formatBewertung(bier.durchschnitt ?? 0)}</b>
                      <small>{t.von(bier.anzahl, anzahl)}</small>
                    </span>
                  </button>
                </li>
              {/each}
            </ol>
            <p class="hinweis fuss">{t.hinweisRangliste}</p>
          {/if}
        {:else if reiter === 'biere'}
          {#if daten.biere.length === 0}
            <div class="karte leer"><p class="hinweis">{t.keineBiere}</p></div>
          {:else}
            {#each gruppen as gruppe (gruppe.name)}
              <section class="gruppe">
                <div class="kopfzeile">
                  <span class="name">
                    <strong>{gruppe.name}</strong>
                    <small>{[gruppe.standort, de.liste.biere(gruppe.biere.length)].filter(Boolean).join(' · ')}</small>
                  </span>
                  {#if gruppe.durchschnitt !== undefined}<Bewertung wert={gruppe.durchschnitt} hoehe={20} />{/if}
                </div>
                {#each gruppe.biere as bier (bier.schluessel)}
                  <button class="zeile" onclick={() => (detail = bier.schluessel)}>
                    <span class="name">
                      <strong>{bier.name}</strong>
                      <small>
                        {#each bier.eintraege as e, i (e.getraenk.id)}{i > 0 ? ' · ' : ''}{e.verkoster} {e.bewertung === undefined ? '–' : formatBewertung(e.bewertung)}{/each}
                      </small>
                    </span>
                    <Bewertung wert={bier.durchschnitt} />
                  </button>
                {/each}
              </section>
            {/each}
          {/if}
        {:else}
          <div class="verkosterliste">
            {#each verkoster as v (v.tastingId)}
              <div class="karte vk">
                <b class="vname">{v.verkoster}</b>
                <small>{tv.biere(v.biere)} · {tv.bewertet(v.bewertet)}</small>
                <div class="vzeile"><span>{tv.durchschnitt}</span><Bewertung wert={v.durchschnitt} /></div>
                {#if v.bestes}
                  <div class="vzeile"><span>{tv.bestes}</span><span class="bestes">{v.bestes.name} <b>{formatBewertung(v.bestes.bewertung ?? 0)}</b></span></div>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      {/if}
    {/if}
  </div>

  {#if exportOffen && daten}
    <VergleichExport {vergleichId} name={daten.vergleich.name} onSchliessen={() => (exportOffen = false)} />
  {/if}

  {#if waehlen && daten}
    <div class="blatt" role="dialog" aria-modal="true" aria-label={t.siegerWaehlen}>
      <button class="hintergrund" onclick={() => (waehlen = false)} aria-label={de.vergleich.schliessen}></button>
      <div class="inhalt">
        <div class="blattkopf">
          <h3>{t.siegerWaehlen}</h3>
          <button class="ib plain" onclick={() => (waehlen = false)} aria-label={de.vergleich.schliessen}>✕</button>
        </div>
        <ul>
          <li>
            <button class="option" class:an={!gewinner?.gewaehlt} onclick={() => siegerWahl(undefined)}>
              <span class="punkt"></span><span>{t.automatisch}</span>
            </button>
          </li>
          {#each rang as { bier, platz } (bier.schluessel)}
            <li>
              <button class="option" class:an={gewinner?.gewaehlt && gewinner.bier.schluessel === bier.schluessel} onclick={() => siegerWahl(bier.schluessel)}>
                <span class="punkt"></span>
                <span class="optiontext"><b>{bier.name}</b><small>{bier.herstellerName} · {t.platz(platz)}</small></span>
                <b>{formatBewertung(bier.durchschnitt ?? 0)}</b>
              </button>
            </li>
          {/each}
        </ul>
      </div>
    </div>
  {/if}
{/if}

<style>
  .warnung {
    margin: 10px 0 0;
    padding: 8px 12px;
    border: 2px solid var(--ink);
    border-radius: 12px;
    background: var(--ocker);
    color: #2b1d14;
    font-size: 14px;
    font-weight: 600;
  }
  .warn {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin: 12px 0 0;
    padding: 2px 6px 2px 12px;
    border: 2px solid var(--ink);
    border-radius: 12px;
    background: var(--ocker);
    color: #2b1d14;
    font-size: 14px;
    font-weight: 600;
  }
  .pruefen {
    color: #7a1f10;
    min-height: 44px;
  }
  .leer {
    margin-top: 16px;
    text-align: center;
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
    font-size: 15px;
  }
  .reiter button.an {
    background: var(--ink);
    color: var(--bg);
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
    font-size: 14px;
  }
  .siegertext small {
    font-size: 11.5px;
    font-weight: 700;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: #2b1d14;
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
  .rang li button {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    min-height: 56px;
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
    gap: 2px;
  }
  .mitte b {
    font-size: 15.5px;
    line-height: 1.2;
  }
  small {
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
    min-width: 62px;
    display: grid;
    justify-items: end;
    font-variant-numeric: tabular-nums;
  }
  .wert b {
    font-weight: 700;
  }
  .fuss {
    margin-top: 10px;
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
  .verkosterliste {
    display: grid;
    gap: 12px;
    margin-top: 14px;
  }
  .vk {
    display: grid;
    gap: 4px;
  }
  .vname {
    font-family: var(--font-titel);
    font-weight: 400;
    font-size: 19px;
  }
  .vzeile {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    font-size: 15px;
    border-top: 1.5px dashed var(--line);
    padding-top: 6px;
    margin-top: 4px;
  }
  .bestes {
    text-align: right;
    overflow-wrap: anywhere;
  }
  .klein {
    font-size: 14px;
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
