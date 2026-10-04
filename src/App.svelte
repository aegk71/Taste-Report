<script lang="ts">
  import { registerSW } from 'virtual:pwa-register';
  import Dolde from './components/Dolde.svelte';
  import Wortmarke from './components/Wortmarke.svelte';
  import { de } from './lib/texte/de';

  const t = de.start;
  const iconCPfad = `${import.meta.env.BASE_URL}icon-c.html#ansicht`;
  const iconCAdresse = new URL(iconCPfad, location.href).href;
  const installiert =
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    matchMedia('(display-mode: standalone)').matches;

  let online = $state(navigator.onLine);
  let offlineBereit = $state(false);
  let kopiert = $state(false);

  async function adresseKopieren() {
    try {
      await navigator.clipboard.writeText(iconCAdresse);
      kopiert = true;
    } catch {
      kopiert = false;
    }
  }

  registerSW({
    immediate: true,
    onOfflineReady() {
      offlineBereit = true;
    },
  });

  $effect(() => {
    const an = () => (online = true);
    const aus = () => (online = false);
    window.addEventListener('online', an);
    window.addEventListener('offline', aus);
    // Service Worker schon aktiv (spätere Starts): sofort als bereit anzeigen
    navigator.serviceWorker?.ready.then(() => (offlineBereit = true));
    return () => {
      window.removeEventListener('online', an);
      window.removeEventListener('offline', aus);
    };
  });

  const build = new Date(__BUILD_ZEIT__).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
</script>

<main>
  <header>
    <Wortmarke hoehe={48} />
    <h1>{de.app.name}</h1>
    <p class="untertitel">{de.app.untertitel}</p>
  </header>

  <section class="karte">
    <h2>{t.phase}</h2>
    <p>{t.hinweis}</p>
    <div class="dolden" aria-hidden="true">
      <Dolde hoehe={34} fuellung={1} />
      <Dolde hoehe={34} fuellung={1} />
      <Dolde hoehe={34} fuellung={1} />
      <Dolde hoehe={34} fuellung={0.75} />
      <Dolde hoehe={34} fuellung={0} />
    </div>
  </section>

  <section class="karte">
    <h2>{t.status}</h2>
    <ul>
      <li>{installiert ? t.installiert : t.imBrowser}</li>
      <li>{online ? t.online : t.offline}</li>
      <li>{offlineBereit ? t.offlineBereit : t.offlineLaedt}</li>
      <li>{t.version}: {build}</li>
    </ul>
    <p class="klein">{t.farben}</p>
  </section>

  <section class="karte">
    <h2>{t.iconTitel}</h2>
    {#if installiert}
      <p>{t.iconInstalliert}</p>
      <p class="adresse">{iconCAdresse}</p>
      <p class="aktion">
        <button class="knopf" onclick={adresseKopieren}>{kopiert ? t.adresseKopiert : t.adresseKopieren}</button>
      </p>
    {:else}
      <p>{t.iconText}</p>
      <p class="aktion"><a class="knopf" href={iconCPfad}>{t.iconLink}</a></p>
    {/if}
  </section>
</main>

<style>
  main {
    max-width: 520px;
    margin: 0 auto;
    padding: 24px 16px 40px;
    display: grid;
    gap: 18px;
  }
  header {
    text-align: center;
    display: grid;
    justify-items: center;
    gap: 6px;
    padding-top: 8px;
  }
  header :global(svg) {
    color: var(--ink);
  }
  h1 {
    font-size: 32px;
    color: var(--red);
    line-height: 1.1;
  }
  .untertitel {
    color: var(--muted);
  }
  h2 {
    font-size: 19px;
    margin-bottom: 6px;
  }
  .dolden {
    display: flex;
    gap: 8px;
    color: var(--hop);
    margin-top: 12px;
  }
  ul {
    margin: 0;
    padding-left: 20px;
  }
  .klein {
    color: var(--muted);
    font-size: 14px;
    margin-top: 8px;
  }
  .aktion {
    margin-top: 12px;
  }
  .adresse {
    margin-top: 8px;
    font-size: 14px;
    word-break: break-all;
    color: var(--muted);
  }
</style>
