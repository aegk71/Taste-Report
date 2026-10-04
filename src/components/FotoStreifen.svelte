<script lang="ts">
  import { liveQuery } from 'dexie';
  import { onDestroy } from 'svelte';
  import { blobSicherLesen, verarbeiteFoto } from '../lib/foto';
  import { fotoHinzufuegen, fotoLoeschen, fotosSortiert, MAX_FOTOS, titelbildSetzen } from '../lib/fotos';
  import type { Foto } from '../lib/model';
  import { de } from '../lib/texte/de';

  // Bis zu 3 Fotos eines Getränks: hinzufügen (Kamera oder Mediathek), ansehen, Titelbild wählen, löschen.
  let { bezugId }: { bezugId: string } = $props();

  const t = de.fotos;

  interface Kachel {
    foto: Foto;
    url: string | null;
  }

  let kacheln = $state<Kachel[]>([]);
  let beschaeftigt = $state(false);
  let fehler = $state('');
  let vollbild = $state<{ foto: Foto; url: string } | null>(null);

  let urls: string[] = [];
  const freigeben = () => {
    for (const u of urls) URL.revokeObjectURL(u);
    urls = [];
  };

  $effect(() => {
    const id = bezugId;
    let aktiv = true;
    const abo = liveQuery(() => fotosSortiert('getraenk', id)).subscribe({
      next: async (fotos) => {
        const neu: Kachel[] = [];
        const neueUrls: string[] = [];
        for (const foto of fotos) {
          try {
            const blob = await blobSicherLesen(foto.vorschau ?? foto.blob);
            const url = URL.createObjectURL(blob);
            neueUrls.push(url);
            neu.push({ foto, url });
          } catch (e) {
            console.error('Foto nicht lesbar', e);
            neu.push({ foto, url: null });
          }
        }
        if (!aktiv) {
          for (const u of neueUrls) URL.revokeObjectURL(u);
          return;
        }
        freigeben();
        urls = neueUrls;
        kacheln = neu;
      },
      error: (e) => console.error('Fotos laden fehlgeschlagen', e),
    });
    return () => {
      aktiv = false;
      abo.unsubscribe();
    };
  });

  onDestroy(() => {
    freigeben();
    if (vollbild) URL.revokeObjectURL(vollbild.url);
  });

  async function gewaehlt(e: Event & { currentTarget: HTMLInputElement }) {
    const dateien = Array.from(e.currentTarget.files ?? []);
    e.currentTarget.value = '';
    if (dateien.length === 0) return;
    beschaeftigt = true;
    fehler = '';
    try {
      for (const datei of dateien) {
        const entwurf = await verarbeiteFoto(datei);
        if (!(await fotoHinzufuegen('getraenk', bezugId, entwurf))) break;
      }
    } catch (e2) {
      console.error('Foto verarbeiten fehlgeschlagen', e2);
      fehler = t.fehler;
    } finally {
      beschaeftigt = false;
    }
  }

  async function oeffnen(foto: Foto) {
    try {
      const blob = await blobSicherLesen(foto.blob);
      vollbild = { foto, url: URL.createObjectURL(blob) };
    } catch (e) {
      console.error('Foto nicht lesbar', e);
      fehler = t.nichtLesbar;
    }
  }

  function schliessen() {
    if (vollbild) URL.revokeObjectURL(vollbild.url);
    vollbild = null;
  }

  async function alsTitelbild() {
    if (!vollbild) return;
    await titelbildSetzen('getraenk', bezugId, vollbild.foto.id);
    schliessen();
  }

  async function loeschen() {
    if (!vollbild || !confirm(t.loeschenFrage)) return;
    const id = vollbild.foto.id;
    schliessen();
    await fotoLoeschen(id);
  }
</script>

<div class="streifen">
  {#each kacheln as { foto, url } (foto.id)}
    <button type="button" class="kachel" onclick={() => oeffnen(foto)} aria-label={t.titel}>
      {#if url}<img src={url} alt="" />{:else}<span class="defekt">!</span>{/if}
      {#if foto.reihenfolge === 1}<span class="titel">{t.titelbild}</span>{/if}
    </button>
  {/each}
  {#if kacheln.length < MAX_FOTOS}
    <label class="kachel neu" class:beschaeftigt aria-label={t.hinzufuegen}>
      <input type="file" accept="image/*" multiple disabled={beschaeftigt} onchange={gewaehlt} />
      <span>＋</span>
    </label>
  {/if}
</div>
{#if beschaeftigt}<p class="hinweis">{t.verarbeiten}</p>{/if}
{#if fehler}<p class="fehler">{fehler}</p>{/if}

{#if vollbild}
  <div class="vollbild" role="dialog" aria-modal="true" aria-label={t.titel}>
    <button type="button" class="bildflaeche" onclick={schliessen} aria-label={t.schliessen}>
      <img src={vollbild.url} alt="" />
    </button>
    <div class="aktionen">
      <button type="button" class="knopf sekundaer" onclick={schliessen}>{t.schliessen}</button>
      {#if vollbild.foto.reihenfolge !== 1}
        <button type="button" class="knopf sekundaer" onclick={alsTitelbild}>{t.alsTitelbild}</button>
      {/if}
      <button type="button" class="knopf" onclick={loeschen}>{t.loeschen}</button>
    </div>
  </div>
{/if}

<style>
  .streifen {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }
  .kachel {
    position: relative;
    display: grid;
    place-items: center;
    aspect-ratio: 1;
    overflow: hidden;
    border: 2px solid var(--ink);
    border-radius: 12px;
    background: var(--card);
    color: var(--muted);
    font-size: 28px;
    cursor: pointer;
  }
  .kachel img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .kachel.neu {
    border-style: dashed;
  }
  .kachel.beschaeftigt {
    opacity: 0.5;
  }
  .kachel input {
    position: absolute;
    inset: 0;
    opacity: 0;
    width: 100%;
    height: 100%;
    cursor: pointer;
  }
  .titel {
    position: absolute;
    left: 5px;
    top: 5px;
    padding: 0 7px;
    border: 2px solid var(--ink);
    border-radius: 99px;
    background: var(--ocker);
    color: #2b1d14;
    font-size: 11.5px;
    font-weight: 700;
    line-height: 1.5;
  }
  .defekt {
    color: var(--red);
    font-weight: 700;
  }
  .vollbild {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: flex;
    flex-direction: column;
    background: rgb(20 14 9 / 0.96);
  }
  .bildflaeche {
    flex: 1;
    min-height: 0;
    display: grid;
    place-items: center;
    padding: 12px;
  }
  .bildflaeche img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    border-radius: 8px;
  }
  .aktionen {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 10px;
    padding: 12px 16px calc(14px + env(safe-area-inset-bottom));
  }
</style>
