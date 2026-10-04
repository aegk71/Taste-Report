import { registerSW } from 'virtual:pwa-register';

// Gemeinsamer Zustand für Online/Offline und den Offline-Speicher (Service Worker).
export const offlineStatus = $state({ online: navigator.onLine, bereit: false });

export function offlineStatusStarten(): void {
  registerSW({
    immediate: true,
    onOfflineReady() {
      offlineStatus.bereit = true;
    },
  });
  window.addEventListener('online', () => (offlineStatus.online = true));
  window.addEventListener('offline', () => (offlineStatus.online = false));
  // Service Worker war schon aktiv (spätere Starts): sofort als bereit anzeigen
  navigator.serviceWorker?.ready.then(() => (offlineStatus.bereit = true));
}
