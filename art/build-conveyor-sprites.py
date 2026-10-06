#!/usr/bin/env python3
"""Export ciblé du convoyeur v2 validé, sans régénérer les autres familles.

Usage depuis la racine : python3 art/build-conveyor-sprites.py
Dépendances artistiques hors dépôt : Pillow, numpy, pngquant.
Cadre commun source (26,172)..(2146,548), largeur monde 3, 128 px/unité.
Les sources restent intactes ; seuls les sprites compilés sont écrits.
"""
from pathlib import Path
import subprocess

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / 'art/assets/conveyor/v2'
OUT = ROOT / 'public/assets/sprites'
SCALE = 3 / 2120
FRAME = (26, 172, 2146, 548)
SIZE = (384, round(376 * SCALE * 128))
WINDOW = (361, 278, 1813, 432)
WHEEL_DIAMETER = 250.8
HUBS = ((207, 358), (1967.5, 358.5))


def load(name):
    image = Image.open(ART / f'conveyor-{name}.png').convert('RGBA')
    data = np.array(image)
    data[data[:, :, 3] <= 8] = 0
    return Image.fromarray(data)


def save(image, name):
    path = OUT / name
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path)
    subprocess.run(['pngquant', '--force', '--skip-if-larger', '--quality=70-95',
                    '--output', str(path), str(path)], check=False)
    if path.stat().st_size > 60 * 1024:
        raise ValueError(f'{path}: sprite hors budget de 60 Ko')


def export_conveyor():
    frame = load('frame')
    loop = load('loop').resize((2172, 724), Image.Resampling.LANCZOS)
    wheel = load('wheel')
    arrows = load('arrows').crop((434, 297, 841, 433))
    period = round(407 * SCALE * 128)
    window_width = 264  # ceil(1452 * SCALE * 128), not a stretched pattern.
    window_height = round(154 * SCALE * 128)
    tile = arrows.resize((period, window_height), Image.Resampling.LANCZOS)
    strip = Image.new('RGBA', (window_width + period, window_height))
    for x in range(0, strip.width, period):
        strip.alpha_composite(tile, (x, 0))
    save(strip, 'conveyor-belt@2x.png')
    save(strip.transpose(Image.Transpose.FLIP_LEFT_RIGHT), 'conveyor-belt-left@2x.png')
    for name, image in [('frame', frame), ('loop', loop)]:
        save(image.crop(FRAME).resize(SIZE, Image.Resampling.LANCZOS), f'conveyor-{name}@2x.png')
    diameter = round(WHEEL_DIAMETER * SCALE * 128)
    save(wheel.resize((diameter, diameter), Image.Resampling.LANCZOS), 'conveyor-wheel@2x.png')

    # Thumbnail assembled in the exact same source coordinate system as preview.html.
    thumbnail = Image.new('RGBA', frame.size)
    arrow_window = Image.new('RGBA', (1452, 154))
    source_tile = arrows.resize((407, 154), Image.Resampling.LANCZOS)
    for x in range(0, arrow_window.width, 407):
        arrow_window.alpha_composite(source_tile, (x, 0))
    mask = Image.new('L', arrow_window.size)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, 1451, 153), radius=20, fill=255)
    arrow_window.putalpha(Image.fromarray(np.minimum(np.array(arrow_window.getchannel('A')), np.array(mask))))
    thumbnail.alpha_composite(arrow_window, WINDOW[:2])
    rotor = wheel.resize((round(WHEEL_DIAMETER), round(WHEEL_DIAMETER)), Image.Resampling.LANCZOS)
    for x, y in HUBS:
        thumbnail.alpha_composite(rotor, (round(x - WHEEL_DIAMETER / 2), round(y - WHEEL_DIAMETER / 2)))
    thumbnail.alpha_composite(frame)
    thumbnail.alpha_composite(loop)
    save(thumbnail.crop(FRAME).resize(SIZE, Image.Resampling.LANCZOS), 'thumbs/conveyor.png')
    print(f'Convoyeur v2 : {SIZE}, période {period}px, roues {diameter}px ; exports ciblés terminés.')


if __name__ == '__main__':
    export_conveyor()
