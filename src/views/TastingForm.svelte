<script lang="ts">
  import { db, ladeEinstellungen, tastingHartLoeschen } from '../lib/db';
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
