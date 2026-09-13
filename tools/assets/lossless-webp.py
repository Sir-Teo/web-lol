"""Lossless texture packing; verify decoded RGBA bytes, including transparent RGB."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import sys
from PIL import Image


def convert(path):
    with Image.open(path) as source:
        rgba = source.convert("RGBA")
        output = path.with_suffix(".webp")
        rgba.save(output, "WEBP", lossless=True, exact=True, method=6)
        with Image.open(output) as result:
            assert result.size == rgba.size and result.convert("RGBA").tobytes() == rgba.tobytes(), str(path)


with ThreadPoolExecutor(max_workers=4) as pool:
    list(pool.map(convert, sorted(Path(sys.argv[1]).glob("*.png"))))
