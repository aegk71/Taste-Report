<script lang="ts">
  import { verwaisteFotosAufraeumen } from './lib/fotos';
  import { offlineStatusStarten } from './lib/offline.svelte';
  import Einstellungen from './views/Einstellungen.svelte';
  import GetraenkForm from './views/GetraenkForm.svelte';
  import TastingForm from './views/TastingForm.svelte';
  import Tastingliste from './views/Tastingliste.svelte';
  import TastingUebersicht from './views/TastingUebersicht.svelte';

  type Ruecksprung = { name: 'liste' } | { name: 'tastingUebersicht'; tastingId: string };

  type Ansicht =
    | { name: 'liste' }
    | { name: 'tastingForm'; tastingId: string | null; ruecksprung: Ruecksprung }
    | { name: 'tastingUebersicht'; tastingId: string }
    | { name: 'getraenkForm'; tastingId: string; getraenkId: string | null; ids: string[] }
    | { name: 'einstellungen' };

  let ansicht = $state<Ansicht>({ name: 'liste' });

  offlineStatusStarten();
  // Dauerhaften Speicher bei jedem Start erneut anfragen, solange er nicht gewährt ist (Safari entscheidet selbst)
  navigator.storage?.persisted?.().then((p) => (p ? undefined : navigator.storage.persist?.())).catch(() => undefined);
  verwaisteFotosAufraeumen().catch((fehler) => console.error('Foto-Aufräumen fehlgeschlagen', fehler));
</script>

{#if ansicht.name === 'liste'}
  <Tastingliste
    onNeu={() => (ansicht = { name: 'tastingForm', tastingId: null, ruecksprung: { name: 'liste' } })}
    onOeffnen={(tastingId) => (ansicht = { name: 'tastingUebersicht', tastingId })}
    onEinstellungen={() => (ansicht = { name: 'einstellungen' })}
  />
{:else if ansicht.name === 'tastingForm'}
  {@const ruecksprung = ansicht.ruecksprung}
  <TastingForm
    tastingId={ansicht.tastingId}
    onGespeichert={(tastingId) => (ansicht = { name: 'tastingUebersicht', tastingId })}
    onGeloescht={() => (ansicht = { name: 'liste' })}
    onAbbrechen={() => (ansicht = ruecksprung)}
  />
{:else if ansicht.name === 'tastingUebersicht'}
  <TastingUebersicht
    tastingId={ansicht.tastingId}
    onZurueck={() => (ansicht = { name: 'liste' })}
    onBearbeiten={(tastingId) =>
      (ansicht = { name: 'tastingForm', tastingId, ruecksprung: { name: 'tastingUebersicht', tastingId } })}
    onNeuesBier={(tastingId, ids) => (ansicht = { name: 'getraenkForm', tastingId, getraenkId: null, ids })}
    onBierOeffnen={(tastingId, getraenkId, ids) => (ansicht = { name: 'getraenkForm', tastingId, getraenkId, ids })}
  />
{:else if ansicht.name === 'getraenkForm'}
  {@const tastingIdAktuell = ansicht.tastingId}
  {@const idsAktuell = ansicht.ids}
  {#key ansicht.getraenkId}
    <GetraenkForm
      tastingId={tastingIdAktuell}
      getraenkId={ansicht.getraenkId}
      ids={idsAktuell}
      onFertig={() => (ansicht = { name: 'tastingUebersicht', tastingId: tastingIdAktuell })}
      onNavigieren={(getraenkId) =>
        (ansicht = { name: 'getraenkForm', tastingId: tastingIdAktuell, getraenkId, ids: idsAktuell })}
    />
  {/key}
{:else if ansicht.name === 'einstellungen'}
  <Einstellungen onZurueck={() => (ansicht = { name: 'liste' })} />
{/if}
