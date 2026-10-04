<script lang="ts">
  import { formatBewertung } from '../lib/bewertung';
  import Dolde from './Dolde.svelte';

  // Anzeige in Listen: eine Dolde plus Zahl. Ohne Wert: graue Dolde und Strich ("nicht bewertet").
  let { wert, hoehe = 22 }: { wert?: number; hoehe?: number } = $props();
</script>

{#if wert === undefined}
  <span class="bewertung leer" title="nicht bewertet"><Dolde {hoehe} fuellung={0} /><b>–</b></span>
{:else}
  <span class="bewertung"><Dolde {hoehe} /><b>{formatBewertung(wert)}</b></span>
{/if}

<style>
  .bewertung {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--hop);
    font-variant-numeric: tabular-nums;
  }
  .bewertung b {
    color: var(--ink);
    font-size: 17px;
  }
  .leer b {
    color: var(--muted);
  }
</style>
