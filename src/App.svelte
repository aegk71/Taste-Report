<script lang="ts">
  import { offlineStatusStarten } from './lib/offline.svelte';
  import Einstellungen from './views/Einstellungen.svelte';
  import TastingForm from './views/TastingForm.svelte';
  import Tastingliste from './views/Tastingliste.svelte';
  import TastingUebersicht from './views/TastingUebersicht.svelte';

  type Ruecksprung = { name: 'liste' } | { name: 'tastingUebersicht'; tastingId: string };

  type Ansicht =
    | { name: 'liste' }
    | { name: 'tastingForm'; tastingId: string | null; ruecksprung: Ruecksprung }
    | { name: 'tastingUebersicht'; tastingId: string }
    | { name: 'einstellungen' };

  let ansicht = $state<Ansicht>({ name: 'liste' });

  offlineStatusStarten();
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
  />
{:else if ansicht.name === 'einstellungen'}
  <Einstellungen onZurueck={() => (ansicht = { name: 'liste' })} />
{/if}
