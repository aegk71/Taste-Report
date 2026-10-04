<script lang="ts">
  import { onDestroy } from 'svelte';
  import Bewertungsregler from '../components/Bewertungsregler.svelte';
  import { db, ladeEinstellungen } from '../lib/db';
  import { getraenkLoeschen, getraenkSpeichern, herstellerVorschlaege, letzterHersteller } from '../lib/getraenke';
  import type { Stil, Zustand } from '../lib/model';
  import { de } from '../lib/texte/de';

  let {
    tastingId,
    getraenkId,
    ids,
    onFertig,
    onNavigieren,
  }: {
    tastingId: string;
    getraenkId: string | null;
    ids: string[];
    onFertig: () => void;
    onNavigieren: (getraenkId: string) => void;
  } = $props();

  const t = de.getraenkForm;
  const STILE_KOMPAKT = 8;

  type Status = 'ruhig' | 'unvollstaendig' | 'speichert' | 'gespeichert' | 'fehler';

  let geladen = $state(false);
  // Die Maske wird je Getränk neu aufgebaut ({#key} in App.svelte), der Startwert genügt.
  // svelte-ignore state_referenced_locally
  let id = $state<string | null>(getraenkId);
  let zustand = $state<Zustand>('probiert');
  let herstellerName = $state('');
  let standort = $state('');
  let name = $state('');
  let stilId = $state<string | undefined>();
  let stilNameGespeichert = $state<string | undefined>();
  let bewertung = $state<number | undefined>();
  let notiz = $state('');
  let abvText = $state('');
  let mengeText = $state('');
  let preisText = $state('');
  let mehrOffen = $state(false);
  let alleStile = $state(false);
  let status = $state<Status>('ruhig');
  let kopiert = $state(false);

  let stile = $state<Stil[]>([]);
  let vorschlaege = $state<{ name: string; standort?: string }[]>([]);
  let herstellerFokus = $state(false);

  const normal = (text: string) => text.trim().toLocaleLowerCase('de');
  const aktiveStile = $derived([...stile].filter((s) => s.aktiv).sort((a, b) => a.sortierung - b.sortierung));
  const sichtbareStile = $derived.by(() => {
    const basis = alleStile ? aktiveStile : aktiveStile.slice(0, STILE_KOMPAKT);
    if (stilId && !basis.some((s) => s.id === stilId)) {
      const gewaehlt = stile.find((s) => s.id === stilId) ?? { id: stilId, name: stilNameGespeichert ?? '?', aktiv: false, sortierung: 0 };
      return [...basis, gewaehlt];
    }
    return basis;
  });
  const treffer = $derived(
    herstellerFokus && herstellerName.trim() !== ''
      ? vorschlaege
          .filter((v) => normal(v.name).includes(normal(herstellerName)) && normal(v.name) !== normal(herstellerName))
          .slice(0, 5)
      : [],
  );
  const position = $derived(id ? ids.indexOf(id) : -1);
  const vorheriges = $derived(position > 0 ? ids[position - 1] : undefined);
  const naechstes = $derived(position >= 0 && position < ids.length - 1 ? ids[position + 1] : undefined);

  const zahl = (text: string): number | undefined => {
    const wert = parseFloat(text.replace(',', '.'));
    return Number.isFinite(wert) ? wert : undefined;
  };

  async function laden() {
    const einstellungen = await ladeEinstellungen();
    stile = einstellungen.stile;
    vorschlaege = await herstellerVorschlaege();

    if (getraenkId) {
      const g = await db.getraenke.get(getraenkId);
      if (g) {
        const h = await db.hersteller.get(g.herstellerId);
        zustand = g.zustand;
        herstellerName = h?.name ?? '';
        standort = h?.standort ?? '';
        name = g.name;
        stilId = g.stilId;
        stilNameGespeichert = g.stilName;
        bewertung = g.bewertung;
        notiz = g.notiz ?? '';
        abvText = g.abv !== undefined ? String(g.abv).replace('.', ',') : '';
        preisText = g.preis !== undefined ? g.preis.toFixed(2).replace('.', ',') : '';
        mengeText = g.menge !== undefined ? String(g.menge).replace('.', ',') : '';
        mehrOffen = g.abv !== undefined || g.menge !== undefined || g.preis !== undefined;
      }
    } else {
      const h = await letzterHersteller(tastingId);
      if (h) {
        herstellerName = h.name;
        standort = h.standort ?? '';
      }
    }
    geladen = true;
  }

  laden();

  // ---------- Autosave ----------
  let timer: ReturnType<typeof setTimeout> | undefined;
  let kette: Promise<void> = Promise.resolve();
  let schmutzig = false;

  const vollstaendig = () => herstellerName.trim() !== '' && name.trim() !== '';

  function geaendert() {
    if (!geladen) return;
    schmutzig = true;
    // erst nach dem Binding lesen, sonst fehlt das zuletzt getippte Zeichen
    queueMicrotask(() => {
      clearTimeout(timer);
      status = vollstaendig() ? 'speichert' : 'unvollstaendig';
      timer = setTimeout(speichernJetzt, 400);
    });
  }

  function speichernJetzt(): Promise<void> {
    clearTimeout(timer);
    if (!schmutzig) return kette;
    if (!vollstaendig()) {
      status = 'unvollstaendig';
      return kette;
    }
    schmutzig = false;
    const eingabe = {
      tastingId,
      herstellerName,
      herstellerStandort: standort,
      name,
      zustand,
      stilId,
      bewertung,
      notiz,
      abv: zahl(abvText),
      menge: zahl(mengeText),
      preis: zahl(preisText),
    };
    const aktuelleStile = $state.snapshot(stile);
    kette = kette.then(async () => {
      try {
        status = 'speichert';
        id = await getraenkSpeichern(eingabe, id, aktuelleStile);
        if (!schmutzig) status = 'gespeichert';
      } catch (fehler) {
        console.error('Getränk speichern fehlgeschlagen', fehler);
        schmutzig = true;
        status = 'fehler';
      }
    });
    return kette;
  }

  async function verlassen(): Promise<boolean> {
    if (schmutzig && !vollstaendig() && !confirm(t.unvollstaendig)) return false;
    await speichernJetzt();
    await kette;
    return status !== 'fehler';
  }

  async function zurueck() {
    if (await verlassen()) onFertig();
  }

  async function springen(ziel: string | undefined) {
    if (ziel && (await verlassen())) onNavigieren(ziel);
  }

  async function loeschen() {
    if (!id || !confirm(t.loeschenFrage(name))) return;
    schmutzig = false;
    clearTimeout(timer);
    await kette;
    await getraenkLoeschen(id);
    onFertig();
  }

  function sichtbarkeitGeaendert() {
    if (document.visibilityState === 'hidden') speichernJetzt();
  }

  document.addEventListener('visibilitychange', sichtbarkeitGeaendert);
  onDestroy(() => {
    document.removeEventListener('visibilitychange', sichtbarkeitGeaendert);
    speichernJetzt();
  });

  // ---------- Bedienung ----------
  function zustandSetzen(neu: Zustand) {
    zustand = neu;
    geaendert();
  }

  function stilWaehlen(neu: string) {
    stilId = stilId === neu ? undefined : neu;
    geaendert();
  }

  function herstellerWaehlen(v: { name: string; standort?: string }) {
    herstellerName = v.name;
    if (v.standort) standort = v.standort;
    herstellerFokus = false;
    geaendert();
  }

  function herstellerVerlassen() {
    herstellerFokus = false;
    if (standort.trim() === '') {
      const bekannt = vorschlaege.find((v) => normal(v.name) === normal(herstellerName));
      if (bekannt?.standort) {
        standort = bekannt.standort;
        geaendert();
      }
    }
  }

  async function notizKopieren() {
    try {
      await navigator.clipboard.writeText(notiz);
      kopiert = true;
      setTimeout(() => (kopiert = false), 1500);
    } catch (fehler) {
      console.error('Kopieren fehlgeschlagen', fehler);
    }
  }
</script>

<div class="seite">
  <div class="kopf">
    <button class="ib" onclick={zurueck} aria-label={de.allgemein.zurueck}>‹</button>
    <h1 class="mitte">{position >= 0 ? t.nr(position + 1, ids.length) : t.titelNeu}</h1>
    <button class="ib" onclick={() => springen(vorheriges)} disabled={!vorheriges} aria-label={t.vorheriges}>↑</button>
    <button class="ib" onclick={() => springen(naechstes)} disabled={!naechstes} aria-label={t.naechstes}>↓</button>
  </div>

  {#if geladen}
    <div class="zustand" role="group">
      <button type="button" class:an={zustand === 'vorgemerkt'} onclick={() => zustandSetzen('vorgemerkt')}>{t.vorgemerkt}</button>
      <button type="button" class:an={zustand === 'probiert'} onclick={() => zustandSetzen('probiert')}>{t.probiert}</button>
    </div>

    <div class="feld">
      <label for="hersteller">{t.hersteller}</label>
      <input
        id="hersteller"
        class="eingabe"
        type="text"
        autocomplete="off"
        autocapitalize="words"
        placeholder={t.herstellerPlatzhalter}
        bind:value={herstellerName}
        onfocus={() => (herstellerFokus = true)}
        onblur={herstellerVerlassen}
        oninput={geaendert}
      />
      {#if treffer.length > 0}
        <ul class="vorschlaege">
          {#each treffer as v (v.name)}
            <li>
              <button type="button" onmousedown={(e) => e.preventDefault()} onclick={() => herstellerWaehlen(v)}>
                {v.name}{#if v.standort}<small> · {v.standort}</small>{/if}
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </div>

    <div class="feld">
      <label for="standort">{t.standort}</label>
      <input id="standort" class="eingabe" type="text" autocomplete="off" bind:value={standort} oninput={geaendert} />
    </div>

    <div class="feld">
      <label for="name">{t.name}</label>
      <input id="name" class="eingabe" type="text" autocomplete="off" autocapitalize="words" bind:value={name} oninput={geaendert} />
    </div>

    <div class="feld">
      <span>{t.stil}</span>
      <div class="chips">
        {#each sichtbareStile as s (s.id)}
          <button type="button" class="chip" class:an={stilId === s.id} aria-pressed={stilId === s.id} onclick={() => stilWaehlen(s.id)}>{s.name}</button>
        {/each}
        {#if aktiveStile.length > STILE_KOMPAKT}
          <button type="button" class="chip mehr" onclick={() => (alleStile = !alleStile)}>
            {alleStile ? t.weniger : t.alleStile}
          </button>
        {/if}
      </div>
    </div>

    {#if zustand === 'probiert'}
      <div class="feld">
        <span>{t.bewertung}</span>
        <Bewertungsregler bind:wert={bewertung} onAenderung={geaendert} />
      </div>

      <div class="feld">
        <div class="notizkopf">
          <label for="notiz">{t.notiz}</label>
          <button type="button" class="kopieren" onclick={notizKopieren} disabled={notiz.trim() === ''}>
            ⧉ {kopiert ? t.kopiert : t.kopieren}
          </button>
        </div>
        <textarea id="notiz" class="eingabe notiz" rows="4" placeholder={t.notizPlatzhalter} bind:value={notiz} oninput={geaendert}></textarea>
      </div>

      <button type="button" class="mehrzeile" aria-expanded={mehrOffen} onclick={() => (mehrOffen = !mehrOffen)}>
        <span>{t.mehr}</span><span>{mehrOffen ? '⌃' : '›'}</span>
      </button>
      {#if mehrOffen}
        <div class="zwei">
          <div class="feld">
            <label for="abv">{t.abv}</label>
            <input id="abv" class="eingabe" type="text" inputmode="decimal" bind:value={abvText} oninput={geaendert} />
          </div>
          <div class="feld">
            <label for="menge">{t.menge}</label>
            <input id="menge" class="eingabe" type="text" inputmode="decimal" placeholder="0,4" bind:value={mengeText} oninput={geaendert} />
          </div>
          <div class="feld">
            <label for="preis">{t.preis}</label>
            <input id="preis" class="eingabe" type="text" inputmode="decimal" bind:value={preisText} oninput={geaendert} />
            <span class="hinweis nur-text">{t.preisHinweis}</span>
          </div>
        </div>
      {/if}
    {/if}

    <p class="status" class:fehler={status === 'fehler'} aria-live="polite">
      {#if status === 'gespeichert'}{t.gespeichert}
      {:else if status === 'speichert'}{t.speichert}
      {:else if status === 'fehler'}{t.fehler}
      {:else if status === 'unvollstaendig'}{t.unvollstaendig}{/if}
    </p>

    {#if id}
      <p class="loeschen"><button type="button" class="textknopf" onclick={loeschen}>{t.loeschen}</button></p>
    {/if}
  {/if}
</div>

<style>
  .mitte {
    text-align: center;
    font-size: 17px;
  }
  .ib:disabled {
    opacity: 0.35;
    cursor: default;
  }
  .zustand {
    display: flex;
    border: 2px solid var(--ink);
    border-radius: 99px;
    overflow: hidden;
    margin-top: 6px;
  }
  .zustand button {
    flex: 1;
    min-height: 46px;
    font-weight: 700;
  }
  .zustand button.an {
    background: var(--hop);
    color: var(--on-hop);
  }
  .vorschlaege {
    list-style: none;
    margin: 0;
    padding: 0;
    border: 2px solid var(--ink);
    border-radius: 12px;
    background: var(--card);
    box-shadow: 0 3px 0 var(--ink);
    overflow: hidden;
  }
  .vorschlaege li + li {
    border-top: 1.5px dashed var(--line);
  }
  .vorschlaege button {
    display: block;
    width: 100%;
    min-height: 46px;
    padding: 8px 12px;
    text-align: left;
    font-size: 16px;
  }
  .vorschlaege small {
    color: var(--muted);
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .chip {
    min-height: 42px;
    padding: 0 14px;
    border: 2px solid var(--ink);
    border-radius: 99px;
    background: var(--card);
    font-weight: 600;
    font-size: 15px;
    text-transform: none;
    letter-spacing: 0;
  }
  .chip.an {
    background: var(--hop);
    color: var(--on-hop);
  }
  .chip.mehr {
    border-style: dashed;
    color: var(--muted);
  }
  .notizkopf {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .notizkopf label {
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .kopieren {
    min-height: 40px;
    padding: 0 6px;
    font-size: 14px;
    font-weight: 600;
    color: var(--red);
  }
  .kopieren:disabled {
    color: var(--muted);
    opacity: 0.6;
    cursor: default;
  }
  .notiz {
    min-height: 100px;
    resize: vertical;
    line-height: 1.4;
  }
  .mehrzeile {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    min-height: 52px;
    margin-top: 12px;
    padding: 0 4px;
    border-top: 1.5px dashed var(--line);
    font-weight: 600;
  }
  .nur-text {
    text-transform: none;
    letter-spacing: 0;
    font-weight: 400;
    font-size: 13px;
  }
  .zwei {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  .status {
    margin-top: 16px;
    text-align: center;
    font-size: 14px;
    font-weight: 600;
    color: var(--hop);
    min-height: 1.5em;
  }
  .status.fehler {
    color: var(--red);
  }
  .loeschen {
    text-align: center;
    margin-top: 4px;
  }
</style>
