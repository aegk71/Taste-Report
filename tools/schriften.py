"""Erzeugt die TTF-Schriften für das PDF aus den @fontsource-Paketen (woff2 -> ttf, Source Sans 3 als statische Instanzen).

Aufruf:  python tools/schriften.py   (benötigt: pip install fonttools brotli, vorher npm install)
jsPDF kann nur TTF einbetten, keine woff2 und keine variablen Schriften.
"""
import pathlib

from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "fonts"
MODULE = ROOT / "node_modules"

alfa = TTFont(MODULE / "@fontsource/alfa-slab-one/files/alfa-slab-one-latin-400-normal.woff2")
alfa.flavor = None
alfa.save(OUT / "AlfaSlabOne-Regular.ttf")

variabel = MODULE / "@fontsource-variable/source-sans-3/files/source-sans-3-latin-wght-normal.woff2"
for gewicht, name in [(400, "Regular"), (700, "Bold")]:
    font = TTFont(variabel)
    font.flavor = None
    instancer.instantiateVariableFont(font, {"wght": gewicht}).save(OUT / f"SourceSans3-{name}.ttf")

print("TTF-Schriften geschrieben nach", OUT)
