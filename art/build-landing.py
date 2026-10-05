#!/usr/bin/env python3
"""Build the home page artwork (identité visuelle) from the sources in art/landing."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

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

# Bolt's victory pose has no transparency: its plain background is flooded away
# from the edges, then the light, unsaturated leftovers low in the picture (the
# ground shadow, the gap between the legs). The dark outline stops the flood.
KEY = (255, 0, 255)
with Image.open(ROOT / "art" / "assets" / "bolt" / "bolt-victory.png") as source:
    pose = source.convert("RGB")
width, height = pose.size
flooded = pose.copy()
for seed in [
    (2, 2),
    (width - 3, 2),
    (2, height - 3),
    (width - 3, height - 3),
    (width // 2, 2),
    (2, height // 2),
    (width - 3, height // 2),
    (width // 2, height - 3),
]:
    ImageDraw.floodfill(flooded, seed, KEY, thresh=22)
pixels = flooded.load()
for y in range(int(height * 0.62), height - 2, 8):
    for x in range(2, width - 2, 8):
        red, green, blue = pixels[x, y]
        is_plain = min(red, green, blue) > 178 and max(red, green, blue) - min(red, green, blue) < 16
        if (red, green, blue) != KEY and is_plain:
            ImageDraw.floodfill(flooded, (x, y), KEY, thresh=14)
mask = Image.new("L", pose.size, 255)
mask.putdata([0 if pixel == KEY else 255 for pixel in flooded.getdata()])
mask = mask.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.2))
victory = pose.convert("RGBA")
victory.putalpha(mask)
victory = victory.crop(mask.point(lambda value: 255 if value > ALPHA_THRESHOLD else 0).getbbox())
victory = victory.resize((420, round(victory.height * 420 / victory.width)), Image.Resampling.LANCZOS)
save(victory, "bolt-victoire")
