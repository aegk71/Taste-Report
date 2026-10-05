<script lang="ts">
  import { liveQuery } from 'dexie';
  import BackupImport from '../components/BackupImport.svelte';
  import BackupKarte from '../components/BackupKarte.svelte';
  import KiEinstellungen from '../components/KiEinstellungen.svelte';
  import { formatZeitpunkt } from '../lib/datum';
  import { db, ladeEinstellungen } from '../lib/db';
  import type { Einstellungen, Stil } from '../lib/model';
  import { de } from '../lib/texte/de';
  import { offlineStatus } from '../lib/offline.svelte';

  let { onZurueck }: { onZurueck: () => void } = $props();

  const t = de.einstellungen;

  let einstellungen = $state<Einstellungen | null>(null);
  let neuerStil = $state('');

  let persistiert = $state<boolean | null>(null);
  let verwendetMb = $state<number | null>(null);
  let verfuegbarMb = $state<number | null>(null);

  const installiert =
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    matchMedia('(display-mode: standalone)').matches;
  const build = new Date(__BUILD_ZEIT__).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });

  async function laden() {
    einstellungen = await ladeEinstellungen();
    if (navigator.storage?.persisted) persistiert = await navigator.storage.persisted();
    if (navigator.storage?.estimate) {
      const schaetzung = await navigator.storage.estimate();
      verwendetMb = (schaetzung.usage ?? 0) / (1024 * 1024);
      verfuegbarMb = (schaetzung.quota ?? 0) / (1024 * 1024);
    }
  }

  laden();

  let gesamtSicherung = $state<string | undefined>(undefined);
  $effect(() => {
    const abo = liveQuery(() => db.einstellungen.get('global')).subscribe({
      next: (e) => (gesamtSicherung = e?.letzteGesamtsicherung),
      error: (fehler) => console.error('Einstellungen laden fehlgeschlagen', fehler),
    });
    return () => abo.unsubscribe();
  });

  async function speichern() {
    if (!einstellungen) return;
    await db.einstellungen.put($state.snapshot(einstellungen));
  }

  const sortierteStile = $derived(
    einstellungen ? [...einstellungen.stile].sort((a, b) => a.sortierung - b.sortierung) : [],
  );

  function verkosterGeaendert(wert: string) {
    if (!einstellungen) return;
    einstellungen.verkoster = wert;
    speichern();
  }

  function umbenennen(stil: Stil, name: string) {
    stil.name = name;
    speichern();
  }

  function aktivUmschalten(stil: Stil) {
    stil.aktiv = !stil.aktiv;
    speichern();
  }

  function verschieben(stil: Stil, richtung: -1 | 1) {
    const liste = sortierteStile;
    const index = liste.findIndex((s) => s.id === stil.id);
    const ziel = liste[index + richtung];
    if (!ziel) return;
    [stil.sortierung, ziel.sortierung] = [ziel.sortierung, stil.sortierung];
    speichern();
  }

  function hinzufuegen() {
    const name = neuerStil.trim();
    if (!einstellungen || name === '') return;
    const maxSortierung = einstellungen.stile.reduce((max, s) => Math.max(max, s.sortierung), -1);
    einstellungen.stile.push({ id: crypto.randomUUID(), name, aktiv: true, sortierung: maxSortierung + 1 });
    neuerStil = '';
    speichern();
  }
</script>

<div class="seite">
  <div class="kopf">
    <button class="ib" onclick={onZurueck} aria-label={de.allgemein.zurueck}>‹</button>
    <h1>{t.titel}</h1>
  </div>

  {#if einstellungen}
    <label class="feld">
      <span>{t.verkoster}</span>
      <input
        class="eingabe"
        type="text"
        value={einstellungen.verkoster}
        oninput={(e) => verkosterGeaendert(e.currentTarget.value)}
        autocomplete="off"
      />
      <span class="hinweis nur-text">{t.verkosterHinweis}</span>
    </label>

    <h2 class="abschnitt">{t.sicherungTitel}</h2>
    <div class="sicherung">
      <p class="hinweis">
        {gesamtSicherung ? `${de.backup.gesamtZuletzt}: ${formatZeitpunkt(gesamtSicherung)}` : de.backup.nochNie}
      </p>
      <BackupKarte umfang="alle" name={de.app.name} />
      <BackupImport />
    </div>

    <h2 class="abschnitt">{de.ki.titel}</h2>
    <KiEinstellungen />

    <h2 class="abschnitt">{t.stile}</h2>
    <ul class="stile">
      {#each sortierteStile as stil (stil.id)}
        <li class="karte zeile" class:inaktiv={!stil.aktiv}>
          <input
            class="eingabe name"
            type="text"
            value={stil.name}
            oninput={(e) => umbenennen(stil, e.currentTarget.value)}
            aria-label={t.stile}
          />
          <button class="ib" onclick={() => verschieben(stil, -1)} aria-label={t.nachOben}>↑</button>
          <button class="ib" onclick={() => verschieben(stil, 1)} aria-label={t.nachUnten}>↓</button>
          <button
            class="schalter"
            role="switch"
            aria-checked={stil.aktiv}
            aria-label={stil.aktiv ? t.aktiv : t.inaktiv}
            onclick={() => aktivUmschalten(stil)}
          ></button>
        </li>
      {/each}
    </ul>

    <div class="neu">
      <input class="eingabe" type="text" placeholder={t.stilNeu} bind:value={neuerStil} autocomplete="off" />
      <button class="knopf" onclick={hinzufuegen}>{t.hinzufuegen}</button>
    </div>
    <p class="hinweis" style="margin-top: 8px">{t.stileHinweis}</p>

    <h2 class="abschnitt">{t.datenTitel}</h2>
    <div class="karte status">
      {#if persistiert !== null}
        <p class:ok={persistiert} class="fett">
          {persistiert ? t.speicherPersistiertJa : t.speicherPersistiertNein}
        </p>
      {/if}
      {#if verwendetMb !== null && verfuegbarMb !== null}
        <p class="hinweis">{t.speicherVerwendet(verwendetMb.toFixed(1), verfuegbarMb.toFixed(0))}</p>
      {/if}
      <p class="hinweis">{t.speicherHinweis}</p>
      <ul class="infos">
        <li>{installiert ? t.installiert : t.imBrowser}</li>
        <li>{offlineStatus.online ? t.online : t.offline}</li>
        <li>{offlineStatus.bereit ? t.offlineBereit : t.offlineLaedt}</li>
        <li>{t.version}: {build}</li>
      </ul>
    </div>
  {/if}
</div>

<style>
  .sicherung {
    display: grid;
    gap: 12px;
    margin-bottom: 4px;
  }
  .stile {
    list-style: none;
    margin: 0 0 12px;
    padding: 0;
    display: grid;
    gap: 10px;
  }
  .zeile {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
  }
  .zeile.inaktiv .name {
    opacity: 0.55;
    text-decoration: line-through;
  }
  .name {
    flex: 1;
    min-width: 0;
    font-weight: 600;
  }
  .neu {
    display: flex;
    gap: 10px;
  }
  .neu .eingabe {
    flex: 1;
    min-width: 0;
  }
  .nur-text {
    text-transform: none;
    letter-spacing: 0;
    font-weight: 400;
  }
  .status {
    display: grid;
    gap: 8px;
  }
  .fett {
    font-weight: 700;
    color: var(--red);
  }
  .fett.ok {
    color: var(--hop);
  }
  .infos {
    margin: 4px 0 0;
    padding-left: 20px;
    font-size: 15px;
  }
</style>
