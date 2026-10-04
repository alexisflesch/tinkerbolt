#!/usr/bin/env python3
"""Build compact UI illustrations for the accepted Bolt poses in C7."""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCES = ROOT / "art" / "assets" / "bolt"
OUTPUT = ROOT / "public" / "assets" / "bolt"
SIZE = (324, 324)  # 3× the largest desktop card used by the UI.


for name in ("bolt-explaining", "bolt-victory"):
    with Image.open(SOURCES / f"{name}.png") as source:
        illustration = source.convert("RGB").resize(SIZE, Image.Resampling.LANCZOS)
    destination = OUTPUT / f"{name}.webp"
    destination.parent.mkdir(parents=True, exist_ok=True)
    illustration.save(destination, "WEBP", quality=88, method=6)
