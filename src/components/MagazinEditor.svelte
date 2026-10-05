<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { db } from '../lib/db';
  import { artikelSpeichern } from '../lib/ki/erzeugen';
  import type { Artikel, Tasting } from '../lib/model';
  import { de } from '../lib/texte/de';

  let { tasting, onSchliessen }: { tasting: Tasting; onSchliessen: () => void } = $props();

  const t = de.magazin;

  // Der Editor lädt den Text frisch aus der Datenbank (nicht aus der Eigenschaft, die nach dem Erzeugen kurz veraltet sein kann),
  // arbeitet auf einer eigenen Kopie und speichert selbst (Autosave).
  let artikel = $state<Artikel | null>(null);
  let biere = $state<Record<string, string>>({});
  let status = $state<'ruhig' | 'speichert' | 'gespeichert' | 'fehler'>('ruhig');
  let timer: ReturnType<typeof setTimeout> | undefined;
  let schmutzig = false;
  let kette: Promise<void> = Promise.resolve();

  onMount(async () => {
    artikel = (await db.tastings.get(tasting.id))?.artikel ?? null;
    const liste = await db.getraenke.where('tastingId').equals(tasting.id).toArray();
    const hersteller = new Map((await db.hersteller.where('tastingId').equals(tasting.id).toArray()).map((h) => [h.id, h.name]));
    biere = Object.fromEntries(liste.map((g) => [g.id, `${hersteller.get(g.herstellerId) ?? ''} · ${g.name}`]));
  });

  function geaendert() {
    schmutzig = true;
    status = 'speichert';
    clearTimeout(timer);
    timer = setTimeout(speichern, 500);
  }

  function speichern(): Promise<void> {
    clearTimeout(timer);
    if (!schmutzig || !artikel) return kette;
    schmutzig = false;
    const kopie = $state.snapshot(artikel) as Artikel;
    kette = kette.then(async () => {
      try {
        await artikelSpeichern(tasting.id, kopie, false);
        if (!schmutzig) status = 'gespeichert';
      } catch (fehler) {
        console.error('Magazin-Text speichern fehlgeschlagen', fehler);
        schmutzig = true;
        status = 'fehler';
      }
    });
    return kette;
  }

  async function schliessen() {
    await speichern();
    onSchliessen();
  }

  const sichtbarkeit = () => {
    if (document.visibilityState === 'hidden') speichern();
  };
  onMount(() => {
    document.addEventListener('visibilitychange', sichtbarkeit);
    return () => document.removeEventListener('visibilitychange', sichtbarkeit);
  });
  onDestroy(() => {
    speichern();
  });

  function abschnittEntfernen(i: number) {
    artikel?.abschnitte.splice(i, 1);
    geaendert();
  }
  function abschnittNeu() {
    artikel?.abschnitte.push({ ueberschrift: '', text: '' });
    geaendert();
  }
  function zitatEntfernen(i: number) {
    artikel?.zitate.splice(i, 1);
    geaendert();
  }
</script>

<div class="vollbild" role="dialog" aria-modal="true" aria-label={t.editorTitel}>
  <div class="leiste">
    <button class="ib" onclick={schliessen} aria-label={t.schliessen}>✕</button>
    <h3>{t.editorTitel}</h3>
    <span class="status" class:fehler={status === 'fehler'} aria-live="polite">
      {status === 'speichert' ? t.speichert : status === 'gespeichert' ? t.gespeichert : status === 'fehler' ? t.speichernFehler : ''}
    </span>
  </div>

  <div class="inhalt">
    {#if artikel}
    <p class="hinweis">{t.ohneZahlenHinweis}</p>

    <label class="feld">
      <span>{t.schlagzeile}</span>
      <input id="mag-schlagzeile" class="eingabe" type="text" bind:value={artikel.schlagzeile} oninput={geaendert} />
    </label>

    <label class="feld">
      <span>{t.vorspann}</span>
      <textarea id="mag-vorspann" class="eingabe" rows="3" bind:value={artikel.vorspann} oninput={geaendert}></textarea>
    </label>

    {#each artikel.abschnitte as abschnitt, i (i)}
      <div class="karte absatz">
        <div class="kopfzeile">
          <b>{t.abschnitt(i + 1)}</b>
          <button class="textknopf" onclick={() => abschnittEntfernen(i)}>{t.abschnittEntfernen}</button>
        </div>
        <label class="feld">
          <span>{t.ueberschrift}</span>
          <input id="mag-ueberschrift-{i}" class="eingabe" type="text" bind:value={abschnitt.ueberschrift} oninput={geaendert} />
        </label>
        <label class="feld">
          <span>{t.abschnittText}</span>
          <textarea id="mag-text-{i}" class="eingabe" rows="7" bind:value={abschnitt.text} oninput={geaendert}></textarea>
        </label>
      </div>
    {/each}
    <button class="knopf sekundaer" onclick={abschnittNeu}>{t.abschnittNeu}</button>

    {#if artikel.zitate.length > 0}
      <h4 class="abschnitt">{t.zitate}</h4>
      {#each artikel.zitate as zitat, i (i)}
        <div class="karte">
          <label class="feld">
            <span>{t.zitatVon(biere[zitat.bier] ?? '…')}</span>
            <textarea id="mag-zitat-{i}" class="eingabe" rows="2" bind:value={zitat.text} oninput={geaendert}></textarea>
          </label>
          <button class="textknopf" onclick={() => zitatEntfernen(i)}>{t.zitatEntfernen}</button>
        </div>
      {/each}
    {/if}

    {#if Object.keys(artikel.bildunterschriften).length > 0}
      <h4 class="abschnitt">{t.bildunterschriften}</h4>
      {#each Object.keys(artikel.bildunterschriften) as id (id)}
        <label class="feld">
          <span>{biere[id] ?? '…'}</span>
          <input id="mag-bu-{id}" class="eingabe" type="text" bind:value={artikel.bildunterschriften[id]} oninput={geaendert} />
        </label>
      {/each}
    {/if}

    <label class="feld">
      <span>{t.schlusswort}</span>
      <textarea id="mag-schlusswort" class="eingabe" rows="3" bind:value={artikel.schlusswort} oninput={geaendert}></textarea>
    </label>
    {/if}
  </div>
</div>

<style>
  .vollbild {
    position: fixed;
    inset: 0;
    z-index: 60;
    display: flex;
    flex-direction: column;
    background: var(--bg);
  }
  .leiste {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: calc(8px + env(safe-area-inset-top)) 12px 8px;
    border-bottom: 2px solid var(--ink);
  }
  .leiste h3 {
    font-size: 17px;
    flex: 1;
  }
  .status {
    font-size: 13px;
    font-weight: 700;
    color: var(--hop);
  }
  .status.fehler {
    color: var(--red);
  }
  .inhalt {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: grid;
    align-content: start;
    gap: 14px;
    padding: 14px 16px calc(24px + env(safe-area-inset-bottom));
    width: 100%;
    max-width: 560px;
    margin: 0 auto;
  }
  .karte {
    display: grid;
    gap: 10px;
  }
  .kopfzeile {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  textarea.eingabe {
    resize: vertical;
    line-height: 1.4;
  }
  .karte :global(.textknopf) {
    justify-self: start;
  }
</style>
