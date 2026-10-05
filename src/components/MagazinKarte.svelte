<script lang="ts">
  import { liveQuery } from 'dexie';
  import { formatZeitpunkt } from '../lib/datum';
  import { db } from '../lib/db';
  import type { SendeUebersicht } from '../lib/ki/erzeugen';
  import { KiFehler, type KiFehlerCode } from '../lib/ki/kiFehler';
  import type { KiLaenge, KiTon, Tasting } from '../lib/model';
  import { de } from '../lib/texte/de';
  import MagazinEditor from './MagazinEditor.svelte';

  let {
    tasting,
    gesperrt = $bindable(false),
  }: {
    tasting: Tasting;
    /** meldet nach außen, dass gerade gearbeitet wird (Dialog nicht schließen) */
    gesperrt?: boolean;
  } = $props();

  const t = de.magazin;

  const TONE: { wert: KiTon; text: string }[] = [
    { wert: 'locker', text: t.tonLocker },
    { wert: 'sachlich', text: t.tonSachlich },
    { wert: 'feuilleton', text: t.tonFeuilleton },
  ];

  let schluessel = $state<string | undefined>(undefined);
  // Vorbelegung aus dem letzten Text, sonst locker/normal
  // svelte-ignore state_referenced_locally
  let ton = $state<KiTon>(tasting.artikel?.ton ?? 'locker');
  // svelte-ignore state_referenced_locally
  let laenge = $state<KiLaenge>(tasting.artikel?.laenge ?? 'normal');
  let fotos = $state(true);
  let uebersicht = $state<SendeUebersicht | null>(null);
  let arbeitet = $state(false);
  let fehler = $state<KiFehlerCode | null>(null);
  let fehlerDetail = $state('');
  let editorOffen = $state(false);
  let neuBestaetigen = $state(false);

  $effect(() => {
    gesperrt = arbeitet;
  });

  $effect(() => {
    const abo = liveQuery(() => db.einstellungen.get('global')).subscribe({
      next: (e) => (schluessel = e?.kiSchluessel),
      error: (f) => console.error('KI-Schlüssel laden fehlgeschlagen', f),
    });
    return () => abo.unsubscribe();
  });

  // "Wird gesendet": Zahlen für die Anzeige, folgt dem Schalter für die Fotos
  $effect(() => {
    const mitFotos = fotos;
    const id = tasting.id;
    import('../lib/ki/erzeugen')
      .then((m) => m.sendeUebersicht(id, mitFotos))
      .then((u) => (uebersicht = u))
      .catch((f) => console.error('Sende-Übersicht fehlgeschlagen', f));
  });

  async function erzeugen() {
    if (!schluessel) return;
    arbeitet = true;
    fehler = null;
    fehlerDetail = '';
    try {
      const { artikelErzeugen, artikelSpeichern } = await import('../lib/ki/erzeugen');
      const artikel = await artikelErzeugen(tasting.id, { ton, laenge, fotos }, schluessel);
      await artikelSpeichern(tasting.id, artikel, true);
      neuBestaetigen = false;
      editorOffen = true;
    } catch (f) {
      fehler = f instanceof KiFehler ? f.code : 'unbekannt';
      fehlerDetail = f instanceof KiFehler ? (f.detail ?? '') : String(f);
      if (!(f instanceof KiFehler)) console.error('Text erzeugen fehlgeschlagen', f);
    }
    arbeitet = false;
  }

  function neuErzeugen() {
    if (!confirm(t.neuFrage)) return;
    neuBestaetigen = true;
  }
</script>

<div class="karte option">
  <span class="ico">📰</span>
  <span class="text"><b>{t.titel}</b><small>{t.text}</small></span>
</div>

{#if !schluessel}
  <p class="hinweis">{t.keinSchluessel}</p>
{:else if arbeitet}
  <div class="karte arbeit" aria-live="polite">
    <b>{t.schreibt}</b>
    <span class="hinweis">{t.schreibtHinweis}</span>
    <span class="balken"><i></i></span>
  </div>
{:else}
  {#if tasting.artikel && !neuBestaetigen}
    <div class="karte vorhanden">
      <b>{t.vorhanden(tasting.artikelErstelltAm ? formatZeitpunkt(tasting.artikelErstelltAm) : '')}</b>
      <span class="hinweis">{tasting.artikel.schlagzeile}</span>
    </div>
    <button class="knopf block" onclick={() => (editorOffen = true)}>{t.bearbeiten}</button>
    <button class="knopf sekundaer block" onclick={neuErzeugen}>{t.neuErzeugen}</button>
  {:else}
    {#if uebersicht && uebersicht.biere === 0}
      <p class="hinweis">{t.keineBiere}</p>
    {:else}
      <div class="feld">
        <span class="beschriftung">{t.ton}</span>
        <div class="chips" role="radiogroup" aria-label={t.ton}>
          {#each TONE as eintrag (eintrag.wert)}
            <button class="chip" role="radio" aria-checked={ton === eintrag.wert} class:an={ton === eintrag.wert} onclick={() => (ton = eintrag.wert)}>{eintrag.text}</button>
          {/each}
        </div>
      </div>
      <div class="feld">
        <span class="beschriftung">{t.laenge}</span>
        <div class="chips" role="radiogroup" aria-label={t.laenge}>
          <button class="chip" role="radio" aria-checked={laenge === 'kurz'} class:an={laenge === 'kurz'} onclick={() => (laenge = 'kurz')}>{t.laengeKurz}</button>
          <button class="chip" role="radio" aria-checked={laenge === 'normal'} class:an={laenge === 'normal'} onclick={() => (laenge = 'normal')}>{t.laengeNormal}</button>
        </div>
      </div>
      <div class="zeile">
        <span>{t.fotosSenden}</span>
        <button class="schalter" role="switch" aria-checked={fotos} aria-label={t.fotosSenden} onclick={() => (fotos = !fotos)}></button>
      </div>
      {#if uebersicht}
        <div class="karte info">
          <b>{t.wirdGesendet}</b>
          <span class="hinweis">{t.sendeInfo(uebersicht.biere, uebersicht.notizen, uebersicht.fotos)}</span>
        </div>
      {/if}
      {#if fehler}
        <p class="fehler" role="alert">{de.ki.fehler[fehler]}</p>
        {#if fehlerDetail}<p class="hinweis detail">{de.ki.technisch}: {fehlerDetail}</p>{/if}
      {/if}
      <button class="knopf block" onclick={erzeugen}>{fehler ? t.nochmal : t.erzeugen}</button>
      {#if tasting.artikel}
        <button class="knopf sekundaer block" onclick={() => ((neuBestaetigen = false), (fehler = null))}>{de.allgemein.abbrechen}</button>
      {/if}
    {/if}
  {/if}
{/if}

{#if editorOffen}
  <MagazinEditor {tasting} onSchliessen={() => (editorOffen = false)} />
{/if}

<style>
  .option {
    display: flex;
    gap: 12px;
    align-items: center;
  }
  .ico {
    display: grid;
    place-items: center;
    flex: none;
    width: 44px;
    height: 44px;
    border: 2px solid var(--ink);
    border-radius: 12px;
    background: var(--hop-soft);
    font-size: 21px;
  }
  .text {
    display: grid;
    line-height: 1.25;
  }
  .text small {
    color: var(--muted);
    font-size: 13px;
  }
  .beschriftung {
    display: block;
    margin-bottom: 6px;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .chip {
    min-height: 44px;
    padding: 6px 14px;
    border: 2px solid var(--ink);
    border-radius: 99px;
    background: var(--card);
    font-weight: 600;
  }
  .chip.an {
    background: var(--ink);
    color: var(--bg);
  }
  .zeile {
    display: flex;
    justify-content: space-between;
    align-items: center;
    min-height: 48px;
    font-weight: 600;
  }
  .detail {
    font-size: 12px;
    word-break: break-word;
  }
  .info,
  .vorhanden,
  .arbeit {
    display: grid;
    gap: 6px;
  }
  .arbeit {
    text-align: center;
  }
  .balken {
    display: block;
    height: 10px;
    border-radius: 99px;
    border: 1.5px solid var(--ink);
    background: var(--surface);
    overflow: hidden;
  }
  .balken i {
    display: block;
    width: 40%;
    height: 100%;
    background: var(--hop);
    animation: lauf 1.4s ease-in-out infinite alternate;
  }
  @keyframes lauf {
    from {
      transform: translateX(0);
    }
    to {
      transform: translateX(150%);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .balken i {
      animation: none;
    }
  }
</style>
