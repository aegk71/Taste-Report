<script lang="ts">
  import { heuteIso } from '../lib/datum';
  import { exportDateiname } from '../lib/export/dateiname';
  import { dateiBereitstellen } from '../lib/export/teilen';
  import { BackupFehler } from '../lib/backupFormat';
  import type { BackupErgebnis, BackupUmfang } from '../lib/export/backup';
  import { de } from '../lib/texte/de';

  let {
    umfang,
    name,
    gesperrt = $bindable(false),
  }: {
    umfang: BackupUmfang;
    /** Dateiname-Teil: Tastingname bzw. App-Name */
    name: string;
    /** meldet nach außen, dass gerade gearbeitet wird (Dialog nicht schließen) */
    gesperrt?: boolean;
  } = $props();

  const t = de.backup;

  type Phase = 'leer' | 'arbeitet' | 'bereit' | 'gesichert' | 'fehler';
  let phase = $state<Phase>('leer');
  let fortschritt = $state({ fertig: 0, gesamt: 0 });
  let ergebnis = $state.raw<BackupErgebnis | null>(null);
  let leer = $state(false);

  $effect(() => {
    gesperrt = phase === 'arbeitet';
  });

  async function erstellen() {
    phase = 'arbeitet';
    leer = false;
    fortschritt = { fertig: 0, gesamt: 0 };
    try {
      const { backupErstellen } = await import('../lib/export/backup');
      ergebnis = await backupErstellen(umfang, (fertig, gesamt) => (fortschritt = { fertig, gesamt }));
      phase = 'bereit';
    } catch (fehler) {
      leer = fehler instanceof BackupFehler && fehler.code === 'leer';
      if (!leer) console.error('Backup erstellen fehlgeschlagen', fehler);
      phase = 'fehler';
    }
  }

  // Zwei Schritte (erst erstellen, dann teilen): Safari lässt das Teilen-Menü nur kurz nach einer Berührung zu,
  // und das Zusammenpacken vieler Fotos kann länger dauern.
  async function teilen() {
    if (!ergebnis) return;
    const { ZIP_MIME, sicherungVermerken } = await import('../lib/export/backup');
    const typ = umfang === 'alle' ? 'Gesamtbackup' : 'Backup';
    const geteilt = await dateiBereitstellen(ergebnis.blob, exportDateiname(name, typ, heuteIso(), 'zip'), ZIP_MIME);
    if (!geteilt) return;
    try {
      await sicherungVermerken(umfang, ergebnis.zeitpunkt);
      phase = 'gesichert';
    } catch (fehler) {
      console.error('Sicherung vermerken fehlgeschlagen', fehler);
    }
  }

  const mb = $derived(ergebnis ? (ergebnis.blob.size / (1024 * 1024)).toFixed(1).replace('.', ',') : '');
</script>

<div class="karte option">
  <span class="ico">🗜️</span>
  <span class="text"><b>{t.titel}</b><small>{umfang === 'alle' ? t.textAlle : t.text}</small></span>
</div>

{#if phase === 'arbeitet'}
  <div class="karte arbeit" aria-live="polite">
    <b>{t.arbeitet}</b>
    {#if fortschritt.gesamt > 0}<span class="hinweis">{t.fortschritt(fortschritt.fertig, fortschritt.gesamt)}</span>{/if}
    <span class="balken"><i style:width="{fortschritt.gesamt > 0 ? (fortschritt.fertig / fortschritt.gesamt) * 100 : 5}%"></i></span>
  </div>
{:else if (phase === 'bereit' || phase === 'gesichert') && ergebnis}
  <p class="hinweis">{t.fertig(ergebnis.tastings, ergebnis.biere, ergebnis.fotos, mb)}</p>
  {#if ergebnis.vergleiche > 0}<p class="hinweis">{t.vergleiche(ergebnis.vergleiche)}</p>{/if}
  {#if ergebnis.fotosFehlen > 0}<p class="fehler">{t.fotosFehlen(ergebnis.fotosFehlen)}</p>{/if}
  {#if phase === 'gesichert'}
    <p class="ok">{t.gesichert}</p>
  {:else}
    <p class="hinweis">{t.teilenHinweis}</p>
  {/if}
  <button class="knopf block" class:sekundaer={phase === 'gesichert'} onclick={teilen}>{phase === 'gesichert' ? t.nochmal : t.teilen}</button>
{:else}
  {#if phase === 'fehler'}<p class="fehler">{leer ? t.leer : t.fehler}</p>{/if}
  <button class="knopf sekundaer block" onclick={erstellen}>{phase === 'fehler' ? de.export.nochmal : t.erstellen}</button>
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
  .arbeit {
    display: grid;
    gap: 6px;
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
    height: 100%;
    background: var(--hop);
    transition: width 0.2s;
  }
  .ok {
    font-weight: 700;
    color: var(--hop);
  }
</style>
