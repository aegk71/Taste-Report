<script lang="ts">
  import { onDestroy } from 'svelte';
  import { db, ladeEinstellungen, tastingHartLoeschen } from '../lib/db';
  import { blobSicherLesen, verarbeiteFoto, type FotoEntwurf } from '../lib/foto';
  import { coverSetzen, fotosSortiert } from '../lib/fotos';
  import { heuteIso } from '../lib/datum';
  import type { Tasting } from '../lib/model';
  import { de } from '../lib/texte/de';

  let {
    tastingId,
    onGespeichert,
    onGeloescht,
    onAbbrechen,
  }: {
    tastingId: string | null;
    onGespeichert: (tastingId: string) => void;
    onGeloescht: () => void;
    onAbbrechen: () => void;
  } = $props();

  const t = de.tastingForm;

  let geladen = $state(false);
  let name = $state('');
  let untertitel = $state('');
  let datumVon = $state(heuteIso());
  let datumBis = $state('');
  let ort = $state('');
  let verkoster = $state('');
  let versucht = $state(false);
  let bestehend = $state<Tasting | undefined>();

  // Cover-Bild: Änderungen werden erst mit "Speichern" übernommen, "Abbrechen" verwirft sie.
  let coverUrl = $state<string | null>(null);
  let coverEntwurf: FotoEntwurf | null = null;
  let coverEntfernt = false;
  let coverBeschaeftigt = $state(false);
  let coverFehler = $state('');

  function coverUrlSetzen(blob: Blob | null) {
    if (coverUrl) URL.revokeObjectURL(coverUrl);
    coverUrl = blob ? URL.createObjectURL(blob) : null;
  }

  onDestroy(() => coverUrlSetzen(null));

  async function coverGewaehlt(e: Event & { currentTarget: HTMLInputElement }) {
    const datei = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!datei) return;
    coverBeschaeftigt = true;
    coverFehler = '';
    try {
      coverEntwurf = await verarbeiteFoto(datei);
      coverEntfernt = false;
      coverUrlSetzen(coverEntwurf.vorschau);
    } catch (fehler) {
      console.error('Cover verarbeiten fehlgeschlagen', fehler);
      coverFehler = de.fotos.fehler;
    } finally {
      coverBeschaeftigt = false;
    }
  }

  function coverEntfernen() {
    coverEntwurf = null;
    coverEntfernt = true;
    coverUrlSetzen(null);
  }

  async function laden() {
    if (tastingId) {
      bestehend = await db.tastings.get(tastingId);
      if (bestehend) {
        name = bestehend.name;
        untertitel = bestehend.untertitel ?? '';
        datumVon = bestehend.datumVon;
        datumBis = bestehend.datumBis ?? '';
        ort = bestehend.ort ?? '';
        verkoster = bestehend.verkoster;
        const cover = (await fotosSortiert('cover', bestehend.id))[0];
        if (cover) {
          try {
            coverUrlSetzen(await blobSicherLesen(cover.vorschau ?? cover.blob));
          } catch (fehler) {
            console.error('Cover nicht lesbar', fehler);
          }
        }
      }
    } else {
      verkoster = (await ladeEinstellungen()).verkoster;
    }
    geladen = true;
  }

  laden();

  const fehlerName = $derived(versucht && name.trim() === '');
  const fehlerDatumVon = $derived(versucht && datumVon === '');
  const fehlerVerkoster = $derived(versucht && verkoster.trim() === '');
  const fehlerDatumBis = $derived(datumBis !== '' && datumVon !== '' && datumBis < datumVon);

  async function speichern() {
    versucht = true;
    if (name.trim() === '' || datumVon === '' || verkoster.trim() === '' || fehlerDatumBis) return;

    const jetzt = new Date().toISOString();
    const tasting: Tasting = {
      ...(bestehend ? $state.snapshot(bestehend) : { id: crypto.randomUUID(), erstelltAm: jetzt }),
      name: name.trim(),
      untertitel: untertitel.trim() || undefined,
      datumVon,
      datumBis: datumBis || undefined,
      ort: ort.trim() || undefined,
      verkoster: verkoster.trim(),
      geaendertAm: jetzt,
    };
    await db.tastings.put(tasting);
    if (coverEntwurf) await coverSetzen(tasting.id, coverEntwurf);
    else if (coverEntfernt) await coverSetzen(tasting.id, null);
    onGespeichert(tasting.id);
  }

  async function loeschen() {
    if (!bestehend) return;
    if (!confirm(t.loeschenFrage(bestehend.name))) return;
    await tastingHartLoeschen(bestehend.id);
    onGeloescht();
  }
</script>

<div class="seite">
  <div class="kopf">
    <button class="ib" onclick={onAbbrechen} aria-label={de.allgemein.zurueck}>‹</button>
    <h1>{tastingId ? t.titelBearbeiten : t.titelNeu}</h1>
  </div>

  {#if geladen}
    <form
      onsubmit={(e) => {
        e.preventDefault();
        speichern();
      }}
    >
      <label class="feld">
        <span>{t.name}</span>
        <input class="eingabe" type="text" bind:value={name} placeholder={t.namePlatzhalter} autocomplete="off" />
        {#if fehlerName}<span class="fehler">{de.allgemein.pflichtfeld}</span>{/if}
      </label>

      <label class="feld">
        <span>{t.untertitel}</span>
        <input class="eingabe" type="text" bind:value={untertitel} autocomplete="off" />
      </label>

      <label class="feld">
        <span>{t.datumVon}</span>
        <input class="eingabe" type="date" bind:value={datumVon} />
        {#if fehlerDatumVon}<span class="fehler">{de.allgemein.pflichtfeld}</span>{/if}
      </label>

      <label class="feld">
        <span>{t.datumBis}</span>
        <input class="eingabe" type="date" bind:value={datumBis} min={datumVon || undefined} />
        {#if fehlerDatumBis}<span class="fehler">{t.fehlerDatumBis}</span>{/if}
      </label>

      <label class="feld">
        <span>{t.ort}</span>
        <input class="eingabe" type="text" bind:value={ort} autocomplete="off" />
      </label>

      <label class="feld">
        <span>{t.verkoster}</span>
        <input class="eingabe" type="text" bind:value={verkoster} autocomplete="off" />
        {#if fehlerVerkoster}<span class="fehler">{de.allgemein.pflichtfeld}</span>{/if}
      </label>

      <div class="feld">
        <span>{de.fotos.cover}</span>
        {#if coverUrl}
          <img class="cover" src={coverUrl} alt="" />
          <div class="coveraktionen">
            <label class="textknopf">
              {de.fotos.coverAendern}
              <input type="file" accept="image/*" hidden disabled={coverBeschaeftigt} onchange={coverGewaehlt} />
            </label>
            <button type="button" class="textknopf" onclick={coverEntfernen}>{de.fotos.coverEntfernen}</button>
          </div>
        {:else}
          <label class="coverleer">
            <input type="file" accept="image/*" hidden disabled={coverBeschaeftigt} onchange={coverGewaehlt} />
            {coverBeschaeftigt ? de.fotos.verarbeiten : `＋ ${de.fotos.coverWaehlen}`}
          </label>
        {/if}
        {#if coverFehler}<span class="fehler">{coverFehler}</span>{/if}
      </div>

      {#if bestehend}
        <p><button type="button" class="textknopf" onclick={loeschen}>{t.loeschenTitel}</button></p>
      {/if}

      <div class="unterzeile">
        <button type="button" class="knopf sekundaer" onclick={onAbbrechen}>{de.allgemein.abbrechen}</button>
        <button type="submit" class="knopf">{de.allgemein.speichern}</button>
      </div>
    </form>
  {/if}
</div>

<style>
  .cover {
    width: 100%;
    aspect-ratio: 16 / 9;
    object-fit: cover;
    border: 2px solid var(--ink);
    border-radius: 12px;
  }
  .coverleer {
    display: grid;
    place-items: center;
    min-height: 96px;
    border: 2px dashed var(--ink);
    border-radius: 12px;
    background: var(--card);
    color: var(--muted);
    font-weight: 600;
    text-transform: none;
    letter-spacing: 0;
    font-size: 16px;
    cursor: pointer;
  }
  .coveraktionen {
    display: flex;
    justify-content: space-between;
    text-transform: none;
    letter-spacing: 0;
    font-size: 16px;
  }
  .coveraktionen .textknopf {
    display: inline-flex;
    align-items: center;
    cursor: pointer;
    text-transform: none;
    letter-spacing: 0;
    font-size: 16px;
  }
</style>
