<script lang="ts">
  import pfade from '../assets/dolde-pfade.json';

  // Hopfendolde aus dem Logo. fuellung 0..1 füllt von links (Bewertungsanzeige), Rest blass.
  let {
    fuellung = 1,
    hoehe = 24,
    class: klasse = '',
  }: { fuellung?: number; hoehe?: number; class?: string } = $props();

  const uid = $props.id();
  const B = pfade.coneW;
  const H = pfade.coneH;
  const pfad = pfade.cone.join(' ');
  const f = $derived(Math.max(0, Math.min(1, fuellung)));
</script>

<svg class={klasse} viewBox="0 0 {B} {H}" height={hoehe} width={(hoehe * B) / H} aria-hidden="true">
  {#if f < 1}
    <path d={pfad} fill="currentColor" opacity="0.18" />
  {/if}
  {#if f > 0}
    <clipPath id="dolde-{uid}"><rect x="0" y="0" width={B * f} height={H} /></clipPath>
    <path d={pfad} fill="currentColor" clip-path={f < 1 ? `url(#dolde-${uid})` : undefined} />
  {/if}
</svg>
