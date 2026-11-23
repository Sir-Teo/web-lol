"""Rasterize the five authored crests and their spell diagrams."""
import json
import math
from pathlib import Path
import sys

from PIL import Image, ImageDraw

ROOT = Path("public/assets/icons")
SCALE = 4


def render(palette, draw_symbol, output):
    color = tuple((palette["light"] >> shift) & 255 for shift in (16, 8, 0))
    image = Image.new("RGB", (64 * SCALE, 64 * SCALE))
    for y in range(image.height):
        for x in range(image.width):
            nx = x / SCALE - 32
            ny = y / SCALE - 33
            glow = max(0, 1 - math.hypot(nx, ny * 0.88) / 47)
            sheen = 1.5 if (x + y) // (SCALE * 7) % 2 else 0
            image.putpixel((x, y), tuple(int(9 + glow * c * 0.32 + sheen) for c in color))
    painter = ImageDraw.Draw(image)
    point = lambda xy: tuple(round(value * SCALE) for value in xy)
    pale = tuple(min(255, round(c * 0.45 + 144)) for c in color)
    dark = tuple(int(c * 0.31) for c in color)

    def polygon(coords, fill=color):
        painter.polygon([point(xy) for xy in coords], fill)
        painter.line([point(xy) for xy in (*coords, coords[0])], fill=pale, width=SCALE, joint="curve")

    def line(coords, width=1, fill=pale):
        painter.line([point(xy) for xy in coords], fill=fill, width=round(width * SCALE), joint="curve")

    def ring(center, radius, width=2, fill=color):
        x, y = center
        painter.ellipse((*point((x - radius, y - radius)), *point((x + radius, y + radius))),
                        outline=fill, width=round(width * SCALE))

    line([(3, 19), (3, 3), (17, 3)], fill=color)
    line([(61, 45), (61, 61), (47, 61)], fill=color)
    draw_symbol(polygon, line, ring, dark)
    image.resize((64, 64), Image.Resampling.LANCZOS).save(output, optimize=True)


def emblem(champion):
    def draw(polygon, line, ring, dark):
        if champion == "brannic":
            polygon([(15, 25), (32, 11), (49, 25), (44, 46), (32, 54), (20, 46)], dark)
            polygon([(31, 17), (38, 33), (35, 42), (25, 44), (23, 35), (29, 30)])
        elif champion == "taviq":
            polygon([(12, 18), (49, 13), (49, 37), (33, 51), (17, 46)], dark)
            line([(19, 44), (43, 20)], 3)
            line([(22, 29), (27, 36), (40, 39)], 2)
        elif champion == "irielle":
            polygon([(32, 9), (51, 23), (46, 48), (32, 54), (18, 48), (13, 23)], dark)
            polygon([(32, 15), (42, 32), (32, 49), (21, 32)])
            line([(13, 23), (32, 31), (51, 23)], 1)
        elif champion == "vess":
            ring((32, 32), 20, 4)
            polygon([(35, 12), (23, 34), (34, 34), (29, 52), (46, 27), (35, 27)])
        else:
            ring((32, 32), 20, 3)
            polygon([(33, 14), (45, 30), (45, 37), (39, 44), (28, 46), (21, 41), (19, 33)], dark)
            line([(23, 36), (31, 39), (39, 35), (42, 28)], 2)
    return draw


SHAPES = {
    "brannic": ("line", "shield", "dash", "ring"),
    "taviq": ("disk", "shield", "dash", "line"),
    "irielle": ("line", "disk", "shield", "disk"),
    "vess": ("line", "disk", "dash", "line"),
    "oona": ("line", "shield", "ring", "heal"),
}


def spell(shape, ultimate=False):
    def draw(polygon, line, ring, dark):
        if ultimate:
            ring((32, 32), 25, 1)
        if shape == "line":
            polygon([(12, 41), (40, 17), (51, 16), (48, 27), (19, 49)], dark)
            line([(15, 45), (46, 20)], 3)
        elif shape == "dash":
            line([(10, 46), (34, 29)], 3)
            polygon([(30, 18), (50, 14), (46, 36), (40, 31), (25, 39), (22, 32)])
        elif shape == "shield":
            polygon([(17, 19), (32, 14), (47, 19), (45, 41), (32, 51), (19, 41)], dark)
            line([(32, 21), (32, 43)], 3)
            line([(25, 31), (39, 31)], 3)
        elif shape == "heal":
            ring((32, 32), 20, 3)
            line([(22, 33), (42, 33)], 4)
            line([(32, 23), (32, 43)], 4)
        else:
            ring((32, 32), 20, 3)
            ring((32, 32), 12, 2)
            if shape == "disk":
                polygon([(32, 26), (39, 32), (32, 39), (25, 32)])
    return draw


for name, palette in json.loads(sys.argv[1]).items():
    render(palette, emblem(name), ROOT / f"{name}.png")
    for slot, shape in zip("qwer", SHAPES[name]):
        render(palette, spell(shape, slot == "r"), ROOT / f"{name}-{slot}.png")
