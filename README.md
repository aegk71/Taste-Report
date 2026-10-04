# Taste Report

Mobile Offline-PWA (Svelte 5, Vite, TypeScript) zum Erfassen und Auswerten von Bierverkostungen auf Festivals.
Alle Daten bleiben lokal im Gerät (IndexedDB), kein Backend.

Live: https://aegk71.github.io/Taste-Report/

```bash
npm install
npm run dev      # lokaler Entwicklungsserver
npm run check    # Typprüfung
npm test         # Unit-Tests der Auswertung (Node)
npm run build    # Produktions-Build nach dist/
npm run icons    # Icons neu erzeugen (benötigt Python + pymupdf)
python tools/schriften.py   # TTF-Schriften fürs PDF neu erzeugen (Python + fonttools, brotli)
```

Projektregeln, Datenmodell und Phasenplan stehen in [CLAUDE.md](CLAUDE.md).
