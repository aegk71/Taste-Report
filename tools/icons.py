"""Erzeugt die App-Icons aus der Hopfendolde des Logos (src/assets/dolde-pfade.json).

Aufruf:  npm run icons   (benötigt: pip install pymupdf)
Varianten: B = grüne Dolde mit dunkler Kontur auf Ocker (Homescreen-Icon der App)
           C = Ocker-Dolde auf Dunkelbraun (Vergleichsvariante, siehe public/icon-c.html)
"""
import json
import pathlib

import pymupdf

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "icons"
OUT.mkdir(parents=True, exist_ok=True)
DOLDE = json.loads((ROOT / "src" / "assets" / "dolde-pfade.json").read_text(encoding="utf-8"))["cone"]

INK = "#2B1D14"
OCKER = "#E4AE45"
GREENS = ["#6E8B2E", "#7FA03A", "#5A7621", "#8DAE45", "#4F6B1C",
          "#6E8B2E", "#7FA03A", "#5A7621", "#8DAE45", "#6E8B2E"]

# Dolde: 58,9 x 83,7 Einheiten, auf 72 % skaliert und mittig platziert (Maskable-sicher)
SCALE = 0.72
TX, TY = 28.8, 19.9


def svg(variante: str, gap: float) -> str:
    """gap = zusätzliche Strichstärke (Dolden-Einheiten), macht die Blattzwischenräume bei kleinen Größen sichtbar."""
    if variante == "B":
        bg = OCKER
        paths = "".join(
            f'<path d="{d}" fill="{g}" stroke="{INK}" stroke-width="{1.2 + gap * 0.8:.2f}" stroke-linejoin="round"/>'
            for g, d in zip(GREENS, DOLDE)
        )
    else:
        bg = INK
        paths = "".join(
            f'<path d="{d}" fill="{OCKER}" stroke="{bg}" stroke-width="{gap:.2f}" stroke-linejoin="round"/>'
            for d in DOLDE
        )
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" width="{S}" height="{S}" viewBox="0 0 100 100">'
        f'<rect width="100" height="100" fill="{bg}"/>'
        f'<g transform="translate({TX} {TY}) scale({SCALE})">{paths}</g></svg>'
    )


def png(variante: str, groesse: int, name: str, gap: float = 0.0) -> None:
    doc = pymupdf.open(stream=svg(variante, gap).replace("{S}", str(groesse)).encode("utf-8"), filetype="svg")
    page = doc[0]
    zoom = groesse / page.rect.width
    page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), alpha=False).save(OUT / name)
    print("geschrieben:", name, groesse)


png("B", 180, "apple-touch-icon.png")
png("B", 192, "icon-192.png")
png("B", 512, "icon-512.png")
png("B", 512, "icon-maskable-512.png")
png("B", 32, "favicon-32.png", gap=2.4)
png("C", 180, "apple-touch-icon-c.png")
png("C", 192, "icon-c-192.png")
png("C", 512, "icon-c-512.png")

# Vektor-Favicon (Variante B)
(OUT / "favicon.svg").write_text(svg("B", 1.0).replace("{S}", "64"), encoding="utf-8")
print("geschrieben: favicon.svg")
