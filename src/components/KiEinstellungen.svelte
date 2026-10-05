<script lang="ts">
  import { liveQuery } from 'dexie';
  import { formatZeitpunkt } from '../lib/datum';
  import { db, ladeEinstellungen } from '../lib/db';
  import { KiFehler, schluesselBereinigen, schluesselGueltig, schluesselMaske, type KiFehlerCode } from '../lib/ki/kiFehler';
  import { de } from '../lib/texte/de';

  const t = de.ki;

  let schluessel = $state<string | undefined>(undefined);
  let geprueftAm = $state<string | undefined>(undefined);
  let eingabe = $state('');
  let arbeitet = $state(false);
  let fehler = $state<KiFehlerCode | null>(null);
  let fehlerDetail = $state('');

  $effect(() => {
    const abo = liveQuery(() => db.einstellungen.get('global')).subscribe({
      next: (e) => {
        schluessel = e?.kiSchluessel;
        geprueftAm = e?.kiGeprueftAm;
      },
      error: (f) => console.error('KI-Einstellungen laden fehlgeschlagen', f),
    });
    return () => abo.unsubscribe();
  });

  /** Testet den Schlüssel; bei Erfolg wird der Zeitpunkt vermerkt, sonst der Fehler angezeigt. */
  async function testen(wert: string): Promise<KiFehlerCode | null> {
    const { verbindungTesten } = await import('../lib/ki/anthropic');
    try {
      await verbindungTesten(wert);
      await db.einstellungen.update('global', { kiGeprueftAm: new Date().toISOString() });
      return null;
    } catch (f) {
      if (f instanceof KiFehler) {
        fehlerDetail = f.detail ?? '';
        return f.code;
      }
      console.error('Verbindungstest fehlgeschlagen', f);
      return 'unbekannt';
    }
  }

  async function speichernUndTesten() {
    const wert = schluesselBereinigen(eingabe);
    if (!schluesselGueltig(wert)) {
      fehler = 'format';
      return;
    }
    arbeitet = true;
    fehler = null;
    fehlerDetail = '';
    await ladeEinstellungen();
    // Der Schlüssel wird gespeichert, solange er nicht abgelehnt wird (z. B. leeres Guthaben lässt sich später beheben)
    await db.einstellungen.update('global', { kiSchluessel: wert, kiGeprueftAm: undefined });
    const ergebnis = await testen(wert);
    if (ergebnis === 'schluessel') await db.einstellungen.update('global', { kiSchluessel: undefined });
    else eingabe = '';
    fehler = ergebnis;
    arbeitet = false;
  }

  async function erneutTesten() {
    if (!schluessel) return;
    arbeitet = true;
    fehlerDetail = '';
    fehler = await testen(schluessel);
    arbeitet = false;
  }

  async function entfernen() {
    if (!confirm(t.entfernenFrage)) return;
    await db.einstellungen.update('global', { kiSchluessel: undefined, kiGeprueftAm: undefined });
    fehler = null;
  }
</script>

<div class="ki">
  {#if !schluessel}
    <p class="hinweis">{t.einleitung}</p>
    <div class="karte anleitung">
      <b>{t.anleitungTitel}</b>
      <ol>
        {#each t.schritte as schritt}<li>{schritt}</li>{/each}
      </ol>
      <a class="textknopf" href="https://platform.claude.com" target="_blank" rel="noopener noreferrer">{t.consoleLink}</a>
    </div>
    <label class="feld">
      <span>{t.schluesselLabel}</span>
      <input
        id="ki-schluessel"
        class="eingabe"
        type="password"
        bind:value={eingabe}
        placeholder={t.schluesselPlatzhalter}
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
      />
    </label>
    <button class="knopf block" onclick={speichernUndTesten} disabled={arbeitet || eingabe.trim() === ''}>
      {arbeitet ? t.testet : t.speichern}
    </button>
  {:else}
    <div class="karte status">
      <b>{t.gespeichert(schluesselMaske(schluessel))}</b>
      {#if geprueftAm}
        <span class="ok">{t.getestet(formatZeitpunkt(geprueftAm))}</span>
      {:else}
        <span class="hinweis">{t.nichtGetestet}</span>
      {/if}
    </div>
    <button class="knopf sekundaer block" onclick={erneutTesten} disabled={arbeitet}>{arbeitet ? t.testet : t.testen}</button>
    <button class="knopf sekundaer block entfernen" onclick={entfernen} disabled={arbeitet}>{t.entfernen}</button>
  {/if}

  {#if fehler}
    <p class="fehler" role="alert">{t.fehler[fehler]}</p>
    {#if fehlerDetail}<p class="hinweis detail">{t.technisch}: {fehlerDetail}</p>{/if}
  {/if}

  <p class="hinweis">{t.hinweisLokal}</p>
  <p class="hinweis">{t.hinweisDaten}</p>
  {#if schluessel}<p class="hinweis">{t.hinweisVerloren}</p>{/if}
</div>

<style>
  .ki {
    display: grid;
    gap: 12px;
  }
  .anleitung {
    display: grid;
    gap: 6px;
    font-size: 15px;
  }
  .anleitung ol {
    margin: 0;
    padding-left: 20px;
    display: grid;
    gap: 3px;
  }
  .anleitung a {
    justify-self: start;
    display: inline-flex;
    align-items: center;
    text-decoration: underline;
  }
  .status {
    display: grid;
    gap: 4px;
    word-break: break-word;
  }
  .ok {
    font-weight: 700;
    color: var(--hop);
  }
  .detail {
    font-size: 12px;
    word-break: break-word;
  }
  .entfernen {
    color: var(--red);
  }
</style>
