#!/usr/bin/env python3
"""Exporte les sprites du plateau depuis les sources de `art/assets/`.

Convention (ADR 0007 § Convention de sprite) : 128 px par unité monde à @2x,
fond transparent, cadre d'un calque = empreinte monde qu'il déclare dans
`src/domain/family-geometry.ts`. Les calques d'une même famille sont recadrés
sur un cadre commun mesuré dans les sources, pour rester alignés.

Dépendances hors dépôt : Python 3, Pillow, numpy, pngquant.
Usage : python3 art/build-sprites.py   (depuis la racine du dépôt)

Le script affiche aussi les géométries mesurées (polygones, fenêtres, pivot),
reportées à la main dans `family-geometry.ts`. Il n'est pas lancé par la gate :
les PNG produits sont commités, et `sprite-assets.test.ts` vérifie leurs
dimensions contre la géométrie du domaine.
"""

from __future__ import annotations

import json
import math
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / "art" / "assets"
OUT = ROOT / "public" / "assets" / "sprites"
THUMBS = OUT / "thumbs"
PX_PER_UNIT = 128
ALPHA_NOISE = 8  # alpha résiduel des sources générées, effacé avant recadrage


def load(relative: str) -> Image.Image:
    image = Image.open(ART / relative).convert("RGBA")
    data = np.array(image)
    data[data[:, :, 3] <= ALPHA_NOISE] = 0
    return Image.fromarray(data)


def px(world: float) -> int:
    return max(1, round(world * PX_PER_UNIT))


def export(image: Image.Image, box: tuple[float, float, float, float], world_w: float, world_h: float, name: str) -> Image.Image:
    cropped = image.crop(tuple(round(v) for v in box))
    sprite = cropped.resize((px(world_w), px(world_h)), Image.LANCZOS)
    save(sprite, OUT / f"{name}@2x.png")
    return sprite


def save(sprite: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    sprite.save(path)
    subprocess.run(
        ["pngquant", "--force", "--skip-if-larger", "--quality=70-95", "--output", str(path), str(path)],
        check=False,
    )


def hull(points: list[tuple[int, int]], max_vertices: int = 8) -> list[tuple[int, int]]:
    """Enveloppe convexe réduite à `max_vertices` sommets (limite Box2D/Planck)."""
    pts = sorted(set(points))

    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

    lower: list[tuple[int, int]] = []
    upper: list[tuple[int, int]] = []
    for p in pts:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0:
            lower.pop()
        lower.append(p)
    for p in reversed(pts):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0:
            upper.pop()
        upper.append(p)
    result = lower[:-1] + upper[:-1]
    while len(result) > max_vertices:
        def lost(i: int) -> float:
            a, b, c = result[i - 1], result[i], result[(i + 1) % len(result)]
            return abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]))
        result.pop(min(range(len(result)), key=lost))
    return result


def outline(image: Image.Image) -> list[tuple[int, int]]:
    alpha = np.array(image)[:, :, 3] > 64
    points = []
    for y in range(alpha.shape[0]):
        xs = np.nonzero(alpha[y])[0]
        if len(xs):
            points += [(int(xs.min()), y), (int(xs.max()), y)]
    return points


def opaque_box(image: Image.Image) -> tuple[int, int, int, int]:
    """Cadre des pixels franchement opaques : `getbbox` retient des pixels isolés presque transparents."""
    alpha = np.array(image)[:, :, 3] > 64
    ys, xs = np.nonzero(alpha)
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def to_world(points, origin, scale) -> list[list[float]]:
    return [[round((x - origin[0]) * scale, 4), round((y - origin[1]) * scale, 4)] for x, y in points]


def composite(layers: list[tuple[Image.Image, tuple[int, int]]], size: tuple[int, int]) -> Image.Image:
    canvas = Image.new("RGBA", size, (0, 0, 0, 0))
    for layer, offset in layers:
        canvas.alpha_composite(layer, offset)
    return canvas


geometry: dict[str, object] = {}

# Balles : trois calques sur le cadre carré du disque de base. La balle rouge
# est celle de l'objectif ; toute autre balle est dessinée en bleu, avec des
# sources de même cadre.
ball_frame = (41, 38, 1211, 1208)
from PIL import ImageDraw  # noqa: E402

for folder, prefix in (("ball", "ball"), ("second-ball", "second-ball")):
    base = load(f"{folder}/{prefix}-base.png")
    spin = load(f"{folder}/{prefix}-spin-pattern.png")
    # Le motif tourne avec le corps : il est masqué au disque pour ne jamais en déborder.
    mask = Image.new("L", spin.size, 0)
    ImageDraw.Draw(mask).ellipse(ball_frame, fill=255)
    spin.putalpha(Image.fromarray(np.minimum(np.array(spin)[:, :, 3], np.array(mask))))
    ball_layers = [
        export(base, ball_frame, 0.6, 0.6, f"{prefix}-base"),
        export(spin, ball_frame, 0.6, 0.6, f"{prefix}-spin"),
        export(load(f"{folder}/{prefix}-highlight.png"), ball_frame, 0.6, 0.6, f"{prefix}-highlight"),
    ]
    # Deux vignettes : la balle rouge (objectif, catalogue de l'auteur) et la
    # bleue, la seule qu'un joueur pose depuis son inventaire.
    save(composite([(layer, (0, 0)) for layer in ball_layers], ball_layers[0].size), THUMBS / f"{prefix}.png")

# Panier : arrière et lèvre avant sur le même cadre, empreinte figée 1,5 × 1,1.
basket_frame = (106, 278, 1148, 1029)
basket_layers = [
    export(load("basket/basket-back.png"), basket_frame, 1.5, 1.1, "basket-back"),
    export(load("basket/basket-front.png"), basket_frame, 1.5, 1.1, "basket-front"),
]
save(composite([(layer, (0, 0)) for layer in basket_layers], basket_layers[0].size), THUMBS / "basket.png")

# Poutre : trois dessins, un par longueur (U12), chacun recadré sur ses pixels
# opaques et exporté à l'empreinte monde de sa longueur (2, 4 ou 6 × 0,25) :
# aucun n'est un autre étiré. Les sources n'ont pas le même rapport que
# l'empreinte (la grande est coupée par les bords de son image) ; ce qui est
# déformé à l'export est signalé à l'auteur dans le journal de la feuille de route.
BEAM_THICKNESS = 0.25
beam_sprites = {}
for beam_name, beam_source, beam_length in (("short", "beam-short", 2), ("medium", "beam-medium", 4), ("long", "beam-big", 6)):
    beam_image = load(f"beam/{beam_source}.png")
    beam_sprites[beam_name] = export(beam_image, opaque_box(beam_image), beam_length, BEAM_THICKNESS, f"beam-{beam_name}")
# La vignette du catalogue montre la poutre longue, comme avant.
save(beam_sprites["long"], THUMBS / "beam.png")

# Bascule : tablier 3 × 0,24 centré sur le pivot, pied posé sous le tablier.
fulcrum = load("seesaw/seesaw_fulcrum.png")
fulcrum_box = fulcrum.getbbox()
fulcrum_scale = 0.58 / (fulcrum_box[3] - fulcrum_box[1])
fulcrum_w = (fulcrum_box[2] - fulcrum_box[0]) * fulcrum_scale
seesaw_beam = export(load("seesaw/seesaw_beam.png"), load("seesaw/seesaw_beam.png").getbbox(), 3, 0.24, "seesaw-beam")
seesaw_fulcrum = export(fulcrum, fulcrum_box, fulcrum_w, 0.58, "seesaw-fulcrum")
fulcrum_center_x = (fulcrum_box[0] + fulcrum_box[2]) / 2
geometry["seesawFulcrum"] = {
    "width": round(fulcrum_w, 4),
    "polygon": [[x, round(y + 0.12, 4)] for x, y in to_world(hull(outline(fulcrum)), (fulcrum_center_x, fulcrum_box[1]), fulcrum_scale)],
}
beam_top = round(0.12 * PX_PER_UNIT)
save(
    composite(
        [(seesaw_fulcrum, ((seesaw_beam.width - seesaw_fulcrum.width) // 2, beam_top + seesaw_beam.height // 2)), (seesaw_beam, (0, 0))],
        (seesaw_beam.width, beam_top + seesaw_beam.height // 2 + seesaw_fulcrum.height),
    ),
    THUMBS / "seesaw.png",
)

# Masse : un calque, polygone de collision mesuré sur la silhouette.
mass = load("mass/mass-10kgs.png")
mass_box = opaque_box(mass)
mass_scale = 0.8 / (mass_box[2] - mass_box[0])
mass_h = (mass_box[3] - mass_box[1]) * mass_scale
mass_sprite = export(mass, mass_box, 0.8, mass_h, "mass-10kg")
save(mass_sprite, THUMBS / "mass.png")
# C9a: gameplay dimensions are chosen independently of image dimensions.
# Crop alpha, then export both materials to the same 0.8-unit square frame.
for material, source in (("wood", "wooden-box"), ("metal", "metallic-box")):
    box_image = load(f"boxes/{source}.png")
    box_sprite = export(box_image, opaque_box(box_image), 0.8, 0.8, f"box-{material}")
    save(box_sprite, THUMBS / f"box-{material}.png")

# Le collider sépare le corps trapézoïdal de l'anneau de levage, un cercle :
# une seule enveloppe convexe en ferait une pointe.
mass_origin = ((mass_box[0] + mass_box[2]) / 2, (mass_box[1] + mass_box[3]) / 2)
mass_alpha = np.array(mass)[:, :, 3] > 64
mass_widths = mass_alpha.sum(axis=1)
mass_shoulder = int(np.nonzero(mass_widths > 0.4 * (mass_box[2] - mass_box[0]))[0][0])
mass_body = Image.fromarray(np.where(np.arange(mass.height)[:, None, None] >= mass_shoulder, np.array(mass), 0).astype(np.uint8))
ring_ys, ring_xs = np.nonzero(mass_alpha[:mass_shoulder])
ring_radius = (ring_xs.max() + 1 - ring_xs.min()) / 2
ring_center = ((ring_xs.min() + ring_xs.max() + 1) / 2, ring_ys.min() + ring_radius)
geometry["mass"] = {
    "height": round(mass_h, 4),
    "polygon": to_world(hull(outline(mass_body)), mass_origin, mass_scale),
    "ring": {"center": to_world([ring_center], mass_origin, mass_scale)[0], "radius": round(ring_radius * mass_scale, 4)},
}

# Levier : origine au pivot. Le socle est symétrique autour du dôme ; la
# poignée est redressée à la verticale autour de son anneau puis recentrée
# sur le dôme, pour que gauche et droite soient deux états symétriques.
lever_base = load("lever/lever-base.png")
base_box = lever_base.getbbox()
lever_scale = 0.8 / (base_box[2] - base_box[0])
dome_x = (base_box[0] + base_box[2]) / 2
ring = (562.0, 869.0)
knob = (969.5, 458.5)
tilt = math.degrees(math.atan2(knob[0] - ring[0], ring[1] - knob[1]))
handle = load("lever/lever-handle.png").rotate(tilt, resample=Image.BICUBIC, center=ring)
handle = handle.transform(handle.size, Image.AFFINE, (1, 0, ring[0] - dome_x, 0, 1, 0), resample=Image.BICUBIC)
pivot = (dome_x, ring[1])
handle_box = handle.getbbox()
half = max(pivot[0] - handle_box[0], handle_box[2] - pivot[0])
handle_frame = (pivot[0] - half, handle_box[1], pivot[0] + half, handle_box[3])
lever_base_sprite = export(lever_base, base_box, 0.8, (base_box[3] - base_box[1]) * lever_scale, "lever-base")
lever_handle_sprite = export(
    handle, handle_frame, 2 * half * lever_scale, (handle_frame[3] - handle_frame[1]) * lever_scale, "lever-handle"
)
knob_distance = math.dist(ring, knob)
geometry["lever"] = {
    "artTiltDegrees": round(tilt, 2),
    "base": to_world([base_box[:2], base_box[2:]], pivot, lever_scale),
    "basePolygon": to_world(hull(outline(lever_base)), pivot, lever_scale),
    "handle": to_world([handle_frame[:2], handle_frame[2:]], pivot, lever_scale),
    "knobCenterY": round(-knob_distance * lever_scale, 4),
    "knobRadius": round(126 * lever_scale, 4),
    "ringRadius": round(97 * lever_scale, 4),
}
lever_px = lambda v: round(v * lever_scale * PX_PER_UNIT)  # noqa: E731
top = min(base_box[1], handle_frame[1])
save(
    composite(
        [
            (lever_base_sprite, (0, lever_px(base_box[1] - top))),
            (lever_handle_sprite, ((lever_base_sprite.width - lever_handle_sprite.width) // 2, lever_px(handle_frame[1] - top))),
        ],
        (lever_base_sprite.width, lever_px(max(base_box[3], handle_frame[3]) - top)),
    ),
    THUMBS / "lever.png",
)

# Convoyeur : cadre 3 unités de long. La bande défile derrière la fenêtre du
# cadre ; son sprite est une bande de la hauteur de la fenêtre, plus longue
# que la fenêtre d'exactement une période du motif, pour que le renderer n'ait
# qu'à décaler sa source.
frame = load("conveyor/conveyor-fixed-part.png")
frame_box = frame.getbbox()
conveyor_scale = 3 / (frame_box[2] - frame_box[0])
frame_center = ((frame_box[0] + frame_box[2]) / 2, (frame_box[1] + frame_box[3]) / 2)
conveyor_frame = export(frame, frame_box, 3, (frame_box[3] - frame_box[1]) * conveyor_scale, "conveyor-frame")
window = (434, 297, 1738, 433)
period = 407
belt_k = 77 / period
belt = load("conveyor/conveyor-moving-part.png")
window_px = math.ceil((window[2] - window[0]) * belt_k)
strip = belt.crop((0, window[1], math.ceil((window_px + 77) / belt_k), window[3]))
strip = strip.resize((window_px + 77, round((window[3] - window[1]) * belt_k)), Image.LANCZOS)
save(strip, OUT / "conveyor-belt@2x.png")
save(strip.transpose(Image.FLIP_LEFT_RIGHT), OUT / "conveyor-belt-left@2x.png")
geometry["conveyor"] = {
    "height": round((frame_box[3] - frame_box[1]) * conveyor_scale, 4),
    "window": to_world([window[:2], window[2:]], frame_center, conveyor_scale),
    "beltPeriod": round(period * conveyor_scale, 4),
    "beltSprite": {"width": strip.width, "height": strip.height, "windowWidth": window_px, "periodPx": 77},
}
window_offset = (round((window[0] - frame_box[0]) * conveyor_scale * PX_PER_UNIT), round((window[1] - frame_box[1]) * conveyor_scale * PX_PER_UNIT))
save(composite([(strip.crop((0, 0, window_px, strip.height)), window_offset), (conveyor_frame, (0, 0))], conveyor_frame.size), THUMBS / "conveyor.png")

# Les familles suivantes sont composées dans le repère en pixels d'une pièce
# de référence ; `rect` convertit un cadre de ce repère en rectangle monde
# relatif à l'origine de la famille.


def rect(box, origin, scale) -> dict[str, float]:
    return {
        "x": round((box[0] - origin[0]) * scale, 4),
        "y": round((box[1] - origin[1]) * scale, 4),
        "width": round((box[2] - box[0]) * scale, 4),
        "height": round((box[3] - box[1]) * scale, 4),
    }


def world_px(value: float) -> int:
    return round(value * PX_PER_UNIT)


# Bouton : socle fixe, capuchon rouge qui s'enfonce quand un objet pèse
# dessus. Repère : pixels du socle ; le capuchon est posé sur la douille grise.
button_base = load("button/button-base.png")
button_base_box = opaque_box(button_base)
button_scale = 0.8 / (button_base_box[2] - button_base_box[0])
button_cap = load("button/button-push-button.png")
button_cap_box = opaque_box(button_cap)
BUTTON_CAP_WIDTH = 420
BUTTON_CAP_TOP = 357
BUTTON_CAP_BODY_BOTTOM = 800  # sous cette ligne de la source, la tige s'enfonce dans la douille
button_cap_k = BUTTON_CAP_WIDTH / (button_cap_box[2] - button_cap_box[0])
button_cx = (button_base_box[0] + button_base_box[2]) / 2
button_cap_frame = (
    button_cx - BUTTON_CAP_WIDTH / 2,
    BUTTON_CAP_TOP,
    button_cx + BUTTON_CAP_WIDTH / 2,
    BUTTON_CAP_TOP + (button_cap_box[3] - button_cap_box[1]) * button_cap_k,
)
button_frame = (button_base_box[0], min(BUTTON_CAP_TOP, button_base_box[1]), button_base_box[2], button_base_box[3])
button_origin = ((button_frame[0] + button_frame[2]) / 2, (button_frame[1] + button_frame[3]) / 2)
button_base_sprite = export(
    button_base, button_base_box, 0.8, (button_base_box[3] - button_base_box[1]) * button_scale, "button-base"
)
button_cap_sprite = export(
    button_cap,
    button_cap_box,
    (button_cap_frame[2] - button_cap_frame[0]) * button_scale,
    (button_cap_frame[3] - button_cap_frame[1]) * button_scale,
    "button-cap",
)
geometry["button"] = {
    "footprint": rect(button_frame, button_origin, button_scale),
    "base": rect(button_base_box, button_origin, button_scale),
    "basePolygon": to_world(hull(outline(button_base)), button_origin, button_scale),
    "cap": rect(button_cap_frame, button_origin, button_scale),
    "capBody": rect(
        (
            button_cap_frame[0],
            button_cap_frame[1],
            button_cap_frame[2],
            BUTTON_CAP_TOP + (BUTTON_CAP_BODY_BOTTOM - button_cap_box[1]) * button_cap_k,
        ),
        button_origin,
        button_scale,
    ),
}
button_px = lambda v: round(v * button_scale * PX_PER_UNIT)  # noqa: E731
save(
    composite(
        [
            (button_base_sprite, (0, button_px(button_base_box[1] - button_frame[1]))),
            (button_cap_sprite, (button_px(button_cap_frame[0] - button_frame[0]), button_px(button_cap_frame[1] - button_frame[1]))),
        ],
        (button_base_sprite.width, button_px(button_frame[3] - button_frame[1])),
    ),
    THUMBS / "button.png",
)

# Tremplin : socle, ressort et plateau. Repère : pixels du socle. Le ressort
# est exporté tassé à sa hauteur de repos ; le renderer le tasse davantage
# pendant un rebond, le plateau descendant d'autant.
springboard_base = load("springboard/springboard_base.png")
springboard_base_box = opaque_box(springboard_base)
springboard_scale = 1.0 / (springboard_base_box[2] - springboard_base_box[0])
springboard_cx = (springboard_base_box[0] + springboard_base_box[2]) / 2
spring = load("springboard/springboard_spring.png")
spring_box = opaque_box(spring)
SPRING_WIDTH = 290
SPRING_BOTTOM = 200  # dans la douille du socle
SPRING_REST_HEIGHT = 244
spring_frame = (springboard_cx - SPRING_WIDTH / 2, SPRING_BOTTOM - SPRING_REST_HEIGHT, springboard_cx + SPRING_WIDTH / 2, SPRING_BOTTOM)
platform = load("springboard/springboard_platform.png")
platform_box = opaque_box(platform)
platform_height = (platform_box[3] - platform_box[1]) * (springboard_base_box[2] - springboard_base_box[0]) / (platform_box[2] - platform_box[0])
platform_bottom = spring_frame[1] + 10
platform_frame = (springboard_base_box[0], platform_bottom - platform_height, springboard_base_box[2], platform_bottom)
springboard_frame = (springboard_base_box[0], platform_frame[1], springboard_base_box[2], springboard_base_box[3])
springboard_origin = ((springboard_frame[0] + springboard_frame[2]) / 2, (springboard_frame[1] + springboard_frame[3]) / 2)
sb = lambda box: [round((box[i] - box[i - 2]) * springboard_scale, 4) for i in (2, 3)]  # noqa: E731
springboard_base_sprite = export(springboard_base, springboard_base_box, *sb(springboard_base_box), "springboard-base")
spring_sprite = export(spring, spring_box, *sb(spring_frame), "springboard-spring")
platform_sprite = export(platform, platform_box, *sb(platform_frame), "springboard-platform")
geometry["springboard"] = {
    "footprint": rect(springboard_frame, springboard_origin, springboard_scale),
    "base": rect(springboard_base_box, springboard_origin, springboard_scale),
    "basePolygon": to_world(hull(outline(springboard_base)), springboard_origin, springboard_scale),
    "spring": rect(spring_frame, springboard_origin, springboard_scale),
    "platform": rect(platform_frame, springboard_origin, springboard_scale),
}
sb_px = lambda v: round(v * springboard_scale * PX_PER_UNIT)  # noqa: E731
save(
    composite(
        [
            (spring_sprite, (sb_px(spring_frame[0] - springboard_frame[0]), sb_px(spring_frame[1] - springboard_frame[1]))),
            (springboard_base_sprite, (0, sb_px(springboard_base_box[1] - springboard_frame[1]))),
            (platform_sprite, (0, 0)),
        ],
        (springboard_base_sprite.width, sb_px(springboard_frame[3] - springboard_frame[1])),
    ),
    THUMBS / "springboard.png",
)

# Barrière : poteau fixe et barre qui coulisse dans le poteau. Repère :
# pixels du poteau, origine au centre du poteau. La barre est exportée
# entière ; le renderer n'en dessine que la partie sortie du poteau.
PILLAR_WIDTH = 0.9  # agrandi (1er octobre 2026), comme la barre
pillar = load("barrier/tinkerbolt_barrier_fixed.png")
pillar_box = opaque_box(pillar)
barrier_scale = PILLAR_WIDTH / (pillar_box[2] - pillar_box[0])
barrier_origin = ((pillar_box[0] + pillar_box[2]) / 2, (pillar_box[1] + pillar_box[3]) / 2)
BARREL = (90, 495)  # fût du poteau, où la barre rentre
BAR_CENTER_Y = 300
BAR_THICKNESS = 0.38
bar = load("barrier/tinkerbolt_barrier_mobile.png")
bar_box = opaque_box(bar)
bar_length = BAR_THICKNESS * (bar_box[2] - bar_box[0]) / (bar_box[3] - bar_box[1])
pillar_sprite = export(pillar, pillar_box, PILLAR_WIDTH, (pillar_box[3] - pillar_box[1]) * barrier_scale, "barrier-pillar")
bar_sprite = export(bar, bar_box, bar_length, BAR_THICKNESS, "barrier-bar")
geometry["barrier"] = {
    "pillar": rect(pillar_box, barrier_origin, barrier_scale),
    "pillarPolygon": to_world(hull(outline(pillar)), barrier_origin, barrier_scale),
    "barLength": round(bar_length, 4),
    "barThickness": BAR_THICKNESS,
    "barCenterY": round((BAR_CENTER_Y - barrier_origin[1]) * barrier_scale, 4),
    "barrelHalfWidth": round((BARREL[1] - BARREL[0]) / 2 * barrier_scale, 4),
}
bar_top = world_px((BAR_CENTER_Y - pillar_box[1]) * barrier_scale - BAR_THICKNESS / 2)
save(
    composite(
        [(bar_sprite, (pillar_sprite.width // 2, bar_top)), (pillar_sprite, (0, 0))],
        (pillar_sprite.width // 2 + bar_sprite.width, pillar_sprite.height),
    ),
    THUMBS / "barrier.png",
)

# Ventilateur : corps fixe et pales qui tournent derrière lui, vues à
# travers l'ouverture de la virole. Repère : pixels du corps, origine au
# centre de l'empreinte ; il souffle vers la droite tel que dessiné.
fan = load("fan/fan-fixed-part.png")
fan_box = opaque_box(fan)
fan_scale = 1.2 / (fan_box[2] - fan_box[0])
fan_origin = ((fan_box[0] + fan_box[2]) / 2, (fan_box[1] + fan_box[3]) / 2)
FAN_OPENING = (802, 232, 1074, 738)  # trou transparent de la virole
FAN_BLADES_HEIGHT = 520
FAN_BLADES_SQUASH = 0.53  # compression horizontale : les pales sont vues de biais
blades = load("fan/fan-blades.png")
blades_box = opaque_box(blades)
blades_k = FAN_BLADES_HEIGHT / (blades_box[3] - blades_box[1])
fan_sprite = export(fan, fan_box, 1.2, (fan_box[3] - fan_box[1]) * fan_scale, "fan-body")
blades_sprite = export(
    blades,
    blades_box,
    (blades_box[2] - blades_box[0]) * blades_k * fan_scale,
    FAN_BLADES_HEIGHT * fan_scale,
    "fan-blades",
)
opening_center = ((FAN_OPENING[0] + FAN_OPENING[2]) / 2, (FAN_OPENING[1] + FAN_OPENING[3]) / 2)
geometry["fan"] = {
    "footprint": rect(fan_box, fan_origin, fan_scale),
    "polygon": to_world(hull(outline(fan)), fan_origin, fan_scale),
    "opening": rect(FAN_OPENING, fan_origin, fan_scale),
    "bladesCenter": to_world([opening_center], fan_origin, fan_scale)[0],
    "blades": {"width": round(blades_sprite.width / PX_PER_UNIT, 4), "height": round(blades_sprite.height / PX_PER_UNIT, 4)},
    "bladesSquash": FAN_BLADES_SQUASH,
}
squashed = blades_sprite.resize((max(1, round(blades_sprite.width * FAN_BLADES_SQUASH)), blades_sprite.height), Image.LANCZOS)
fan_px = lambda v: round(v * fan_scale * PX_PER_UNIT)  # noqa: E731
save(
    composite(
        [
            (squashed, (fan_px(opening_center[0] - fan_box[0]) - squashed.width // 2, fan_px(opening_center[1] - fan_box[1]) - squashed.height // 2)),
            (fan_sprite, (0, 0)),
        ],
        fan_sprite.size,
    ),
    THUMBS / "fan.png",
)

print(json.dumps(geometry, indent=2))
