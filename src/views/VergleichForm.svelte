<script lang="ts">
  import { db, tastingKennzahlen } from '../lib/db';
  import { formatZeitraum } from '../lib/datum';
  import type { Tasting } from '../lib/model';
  import { de } from '../lib/texte/de';
  import { namenVorschlag } from '../lib/vergleich';
  import { vergleichAendern, vergleichAnlegen, vergleichLoeschen } from '../lib/vergleichDaten';

  let {
    vergleichId,
    onGespeichert,
    onGeloescht,
    onAbbrechen,
  }: {
    vergleichId: string | null;
    onGespeichert: (vergleichId: string) => void;
    onGeloescht: () => void;
    onAbbrechen: () => void;
  } = $props();

  const t = de.vergleich.form;

  interface Zeile {
    tasting: Tasting;
    biere: number;
  }

  let zeilen = $state<Zeile[] | null>(null);
  let name = $state('');
  let nameGeaendert = false;
  let gewaehlt = $state<string[]>([]);
  let namen = $state<Record<string, string>>({});
  const eigene = new Set<string>();
  let fehlerName = $state(false);
  let fehlerAnzahl = $state(false);
  let fehlerSpeichern = $state(false);
  let arbeitet = $state(false);
  let bestehend = $state<boolean>(false);

  const cache = new Map<string, Tasting>();
  const tastingVonAlle = (id: string) => cache.get(id);

  // Startwerte laden (beim Bearbeiten: der gespeicherte Vergleich; fehlende Tastings fallen heraus)
  // svelte-ignore state_referenced_locally
  const startId = vergleichId;
  (async () => {
    const alle = (await db.tastings.orderBy('datumVon').reverse().toArray());
    const liste: Zeile[] = [];
    for (const tasting of alle) {
      liste.push({ tasting, biere: (await tastingKennzahlen(tasting.id)).probiert });
      cache.set(tasting.id, tasting);
    }
    if (startId) {
      const v = await db.vergleiche.get(startId);
      if (v) {
        bestehend = true;
        name = v.name;
        nameGeaendert = true;
        const vorhanden = new Set(alle.map((x) => x.id));
        gewaehlt = v.tastingIds.filter((id) => vorhanden.has(id));
        for (const [id, n] of Object.entries(v.anzeigenamen)) {
          if (gewaehlt.includes(id)) {
            namen[id] = n;
            eigene.add(id);
          }
        }
        vorschlagen();
      }
    }
    zeilen = liste;
  })().catch((fehler) => console.error('Vergleich laden fehlgeschlagen', fehler));

  /** Namensvorschläge für alle gewählten Tastings, ohne die von Hand geänderten zu überschreiben. */
  function vorschlagen() {
    const gewaehltTastings = gewaehlt.map(tastingVonAlle).filter((x): x is Tasting => !!x);
    const vorschlag = namenVorschlag(gewaehltTastings);
    const neu: Record<string, string> = {};
    for (const id of gewaehlt) neu[id] = eigene.has(id) && namen[id] !== undefined ? namen[id] : (vorschlag[id] ?? '');
    namen = neu;
    if (!nameGeaendert && gewaehltTastings.length > 0) name = `${gewaehltTastings[0].name} · Gruppe`;
  }

  function umschalten(id: string) {
    gewaehlt = gewaehlt.includes(id) ? gewaehlt.filter((x) => x !== id) : [...gewaehlt, id];
    if (!gewaehlt.includes(id)) eigene.delete(id);
    vorschlagen();
    fehlerAnzahl = false;
  }

  async function speichern() {
    fehlerName = name.trim() === '';
    fehlerAnzahl = gewaehlt.length < 2;
    fehlerSpeichern = false;
    if (fehlerName || fehlerAnzahl) return;
    arbeitet = true;
    try {
      const entwurf = {
        name,
        tastingIds: [...gewaehlt],
        anzeigenamen: Object.fromEntries(gewaehlt.map((id) => [id, (namen[id] ?? '').trim() || tastingVonAlle(id)?.verkoster.trim() || 'Verkoster'])),
      };
      const id = startId && bestehend ? startId : await vergleichAnlegen(entwurf);
      if (startId && bestehend) await vergleichAendern(startId, entwurf);
      onGespeichert(id);
    } catch (fehler) {
      console.error('Vergleich speichern fehlgeschlagen', fehler);
      fehlerSpeichern = true;
      arbeitet = false;
    }
  }

  async function loeschen() {
    if (!startId || !bestehend) return;
    if (!confirm(t.loeschenFrage(name))) return;
    await vergleichLoeschen(startId);
    onGeloescht();
  }
</script>

<div class="seite">
  <div class="kopf">
    <button class="ib" onclick={onAbbrechen} aria-label={de.allgemein.zurueck}>‹</button>
    <h1>{bestehend ? t.titelBearbeiten : t.titelNeu}</h1>
  </div>

  {#if zeilen === null}
    <p class="hinweis">…</p>
  {:else if zeilen.length < 2}
    <div class="karte leer"><p class="hinweis">{t.keineTastings}</p></div>
  {:else}
    <form
      onsubmit={(e) => {
        e.preventDefault();
        speichern();
      }}
    >
      <label class="feld">
        <span>{t.name}</span>
        <input
          class="eingabe"
          type="text"
          bind:value={name}
          oninput={() => {
            nameGeaendert = true;
            fehlerName = false;
          }}
          placeholder={t.namePlatzhalter}
          autocomplete="off"
        />
        {#if fehlerName}<span class="fehler">{t.fehlerName}</span>{/if}
      </label>

      <h2 class="abschnitt">{t.tastings}</h2>
      <ul class="auswahl">
        {#each zeilen as { tasting, biere } (tasting.id)}
          {@const an = gewaehlt.includes(tasting.id)}
          <li>
            <button type="button" class="zeile" role="checkbox" aria-checked={an} onclick={() => umschalten(tasting.id)}>
              <span class="haken" class:an>{an ? '✓' : ''}</span>
              <span class="text">
                <b>{tasting.name}</b>
                <small>
                  {formatZeitraum(tasting.datumVon, tasting.datumBis)} · {tasting.verkoster} · {t.biere(biere)}
                  {#if an && gewaehlt[0] === tasting.id}<i class="mein">{t.mein}</i>{/if}
                </small>
              </span>
            </button>
          </li>
        {/each}
      </ul>
      {#if fehlerAnzahl}<p class="fehler">{t.fehlerAnzahl}</p>{/if}

      {#if gewaehlt.length > 0}
        <h2 class="abschnitt">{t.anzeigenamen}</h2>
        <div class="namen">
          {#each gewaehlt as id (id)}
            {@const tasting = tastingVonAlle(id)}
            <label class="namenzeile">
              <span>{tasting?.verkoster || t.verkoster}</span>
              <input
                class="eingabe"
                type="text"
                value={namen[id] ?? ''}
                oninput={(e) => {
                  namen[id] = e.currentTarget.value;
                  eigene.add(id);
                }}
                autocomplete="off"
                aria-label="{t.anzeigenamen}: {tasting?.verkoster}"
              />
            </label>
          {/each}
        </div>
        <p class="hinweis">{t.anzeigenHinweis}</p>
      {/if}

      {#if fehlerSpeichern}<p class="fehler" role="alert">{t.fehlerSpeichern}</p>{/if}

      {#if bestehend}
        <p><button type="button" class="textknopf" onclick={loeschen}>{t.loeschen}</button></p>
      {/if}

      <div class="unterzeile">
        <button type="button" class="knopf sekundaer" onclick={onAbbrechen}>{de.allgemein.abbrechen}</button>
        <button type="submit" class="knopf" disabled={arbeitet}>{bestehend ? t.speichern : t.anlegen}</button>
      </div>
    </form>
  {/if}
</div>

<style>
  .leer {
    margin-top: 16px;
    text-align: center;
  }
  .auswahl {
    list-style: none;
    margin: 0;
    padding: 0;
    border: 2px solid var(--ink);
    border-radius: var(--radius);
    background: var(--card);
    overflow: hidden;
  }
  .auswahl li + li {
    border-top: 1.5px dashed var(--line);
  }
  .zeile {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    min-height: 60px;
    padding: 8px 12px;
    text-align: left;
  }
  .haken {
    flex: none;
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border: 2px solid var(--ink);
    border-radius: 8px;
    background: var(--card);
    font-weight: 700;
  }
  .haken.an {
    background: var(--hop);
    color: var(--on-hop);
  }
  .text {
    display: grid;
    min-width: 0;
    line-height: 1.25;
  }
  .text b {
    font-size: 16px;
  }
  small {
    color: var(--muted);
    font-size: 13px;
  }
  .mein {
    font-style: normal;
    font-weight: 700;
    color: var(--hop);
  }
  .namen {
    display: grid;
    gap: 8px;
    margin-bottom: 6px;
  }
  .namenzeile {
    display: grid;
    grid-template-columns: 96px 1fr;
    align-items: center;
    gap: 10px;
    font-size: 14px;
    color: var(--muted);
    font-weight: 600;
  }
  .namenzeile span {
    overflow-wrap: anywhere;
  }
</style>
