<script lang="ts">
  import pfade from '../assets/dolde-pfade.json';

  // BRAU KRU mit Hopfendolde im U (Logo als Vektor, einfarbig = currentColor)
  let { hoehe = 40, class: klasse = '' }: { hoehe?: number; class?: string } = $props();

  const wort = pfade.word.join(' ');
  const dolde = pfade.cone.join(' ');
</script>

<svg class={klasse} viewBox="0 0 220.446 99.213" height={hoehe} width={(hoehe * 220.446) / 99.213} role="img" aria-label="BRAU KRU">
  <path d={wort} fill="currentColor" />
  <path d={dolde} fill="currentColor" transform="translate(144.8 0)" />
</svg>
