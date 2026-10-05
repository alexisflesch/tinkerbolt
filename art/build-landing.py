#!/usr/bin/env python3
"""Build the home page artwork (identité visuelle) from the sources in art/landing."""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCES = ROOT / "art" / "landing"
OUTPUT = ROOT / "public" / "assets" / "home"
ALPHA_THRESHOLD = 24  # Ignores the faint halo left around the cut-outs.

# Name -> exported width in pixels, about 2× the largest size drawn by the UI.
CUTOUTS = {
    "bolt": 520,
    "cadre": 1434,
    "etabli": 2172,
    "tournevis": 560,
    "plans": 660,
    "equerre": 460,
    "boulons": 170,
    "logo": 420,
}
PAPER_SIZE = 640


def save(image: Image.Image, name: str) -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    image.save(OUTPUT / f"{name}.webp", "WEBP", quality=86, method=6)


for name, width in CUTOUTS.items():
    with Image.open(SOURCES / f"{name}.png") as source:
        cutout = source.convert("RGBA")
    opaque = cutout.getchannel("A").point(lambda value: 255 if value > ALPHA_THRESHOLD else 0)
    cutout = cutout.crop(opaque.getbbox())
    if cutout.width > width:
        height = round(cutout.height * width / cutout.width)
        cutout = cutout.resize((width, height), Image.Resampling.LANCZOS)
    save(cutout, name)

with Image.open(SOURCES / "papier.png") as source:
    save(source.convert("RGB").resize((PAPER_SIZE, PAPER_SIZE), Image.Resampling.LANCZOS), "papier")
