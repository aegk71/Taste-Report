<script lang="ts">
  import { liveQuery } from 'dexie';
  import type { Snippet } from 'svelte';
  import { blobSicherLesen } from '../lib/foto';
  import { fotosSortiert } from '../lib/fotos';
  import type { FotoArt } from '../lib/model';

  // Zeigt das Titelbild (Reihenfolge 1) eines Getränks bzw. das Cover eines Tastings.
  // Ohne Foto erscheint der übergebene Platzhalter. gross = Originalbild statt kleiner Vorschau.
  let {
    art,
    bezugId,
    gross = false,
    vorhanden = $bindable(false),
    klasse = '',
    platzhalter,
  }: {
    art: FotoArt;
    bezugId: string;
    gross?: boolean;
    vorhanden?: boolean;
    klasse?: string;
    platzhalter?: Snippet;
  } = $props();

  let url = $state<string | null>(null);

  $effect(() => {
    const artJetzt = art;
    const bezugJetzt = bezugId;
    const grossJetzt = gross;
    let aktuell: string | null = null;
    let aktiv = true;

    const freigeben = () => {
      if (aktuell) URL.revokeObjectURL(aktuell);
      aktuell = null;
    };

    const abo = liveQuery(async () => (await fotosSortiert(artJetzt, bezugJetzt))[0]).subscribe({
      next: async (foto) => {
        if (!foto) {
          freigeben();
          url = null;
          vorhanden = false;
          return;
        }
        try {
          const blob = await blobSicherLesen(grossJetzt ? foto.blob : (foto.vorschau ?? foto.blob));
          if (!aktiv) return;
          freigeben();
          aktuell = URL.createObjectURL(blob);
          url = aktuell;
          vorhanden = true;
        } catch (fehler) {
          console.error('Foto nicht lesbar', fehler);
          freigeben();
          url = null;
          vorhanden = false;
        }
      },
      error: (fehler) => console.error('Foto laden fehlgeschlagen', fehler),
    });

    return () => {
      aktiv = false;
      abo.unsubscribe();
      freigeben();
    };
  });
</script>

{#if url}
  <img class={klasse} src={url} alt="" />
{:else}
  {@render platzhalter?.()}
{/if}
