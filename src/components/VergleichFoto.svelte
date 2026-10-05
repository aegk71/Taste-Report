<script lang="ts">
  import { liveQuery } from 'dexie';
  import type { Snippet } from 'svelte';
  import { db } from '../lib/db';
  import FotoBild from './FotoBild.svelte';

  // Zeigt das Titelbild des ersten Biers aus `ids`, das ein Foto hat (Reihenfolge = Reihenfolge der Tastings im Vergleich).
  let { ids, klasse = '', platzhalter }: { ids: string[]; klasse?: string; platzhalter?: Snippet } = $props();

  let gewaehlt = $state<string | null>(null);

  $effect(() => {
    const liste = [...ids];
    const abo = liveQuery(async () => {
      const fotos = await db.fotos.where('bezugId').anyOf(liste).toArray();
      const mit = new Set(fotos.filter((f) => f.art === 'getraenk').map((f) => f.bezugId));
      return liste.find((id) => mit.has(id)) ?? null;
    }).subscribe({
      next: (id) => (gewaehlt = id),
      error: (fehler) => console.error('Foto suchen fehlgeschlagen', fehler),
    });
    return () => abo.unsubscribe();
  });
</script>

{#if gewaehlt}
  <FotoBild art="getraenk" bezugId={gewaehlt} {klasse} {platzhalter} />
{:else}
  {@render platzhalter?.()}
{/if}
