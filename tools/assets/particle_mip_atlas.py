"""Lossless delivery atlas for an already decoded, authored RGBA mip chain.

This is a transport container, not a sampled atlas: a consumer must extract
each rectangle into its own texture level. No gutter, resampling, generated
mip, premultiplication, color conversion, or native GPU parity is implied.
"""
import binascii
import struct
import zlib
from masteryi_q_decode import png_rgba8, sha
from masteryi_q_particles import require

MAX_PIXELS = 16_777_216


def dimensions(width, height):
    require(type(width) is int and type(height) is int and width > 0 and height > 0
            and width * height <= MAX_PIXELS, 'Invalid atlas dimensions')


def encode_png(width, height, rgba):
    dimensions(width, height)
    require(len(rgba) == width * height * 4, 'RGBA extent differs')
    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', binascii.crc32(tag + data) & 0xffffffff)
    stride = width * 4
    scanlines = b''.join(b'\0' + rgba[y * stride:(y + 1) * stride] for y in range(height))
    raw = (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0))
           + chunk(b'IDAT', zlib.compress(scanlines, 9)) + chunk(b'IEND', b''))
    require(png_rgba8(raw, width, height) == rgba, 'Encoded atlas replay differs')
    return raw


def pack(levels):
    """levels: ordered (width, height, RGBA bytes), including authored level 0."""
    require(len(levels) > 0, 'Missing authored levels')
    width, height = levels[0][:2]
    dimensions(width, height)
    require(len(levels) in (1, max(width, height).bit_length()), 'Incomplete authored mip chain')
    for index, (w, h, rgba) in enumerate(levels):
        dimensions(w, h)
        require((w, h) == (max(1, width >> index), max(1, height >> index)), 'Mip dimensions/order differ')
        require(len(rgba) == w * h * 4, 'Mip RGBA extent differs')
    total_height = sum(level[1] for level in levels)
    dimensions(width, total_height)
    atlas = bytearray(width * total_height * 4)
    rectangles = []; y = 0
    for index, (w, h, rgba) in enumerate(levels):
        for row in range(h):
            start = ((y + row) * width) * 4
            atlas[start:start + w * 4] = rgba[row * w * 4:(row + 1) * w * 4]
        rectangles.append({'level': index, 'x': 0, 'y': y, 'width': w, 'height': h, 'rgbaSha256': sha(rgba)})
        y += h
    png = encode_png(width, total_height, atlas)
    record = {'width': width, 'height': total_height, 'rectangles': rectangles, 'rgbaSha256': sha(atlas)}
    require(unpack(png, record) == [bytes(level[2]) for level in levels], 'Packed mip round trip differs')
    return png, record


def unpack(png, record):
    """Strict independent container replay, including zero-filled unused pixels."""
    width, height = record['width'], record['height']
    dimensions(width, height)
    rectangles = record['rectangles']
    require(len(rectangles) > 0, 'Missing atlas rectangles')
    base_width, base_height = rectangles[0]['width'], rectangles[0]['height']
    dimensions(base_width, base_height)
    require(width == base_width and len(rectangles) in (1, max(base_width, base_height).bit_length()), 'Invalid atlas mip chain')
    rgba = png_rgba8(png, width, height)
    require(sha(rgba) == record['rgbaSha256'], 'Atlas pixels differ')
    y = 0; levels = []
    for index, rect in enumerate(rectangles):
        w, h = max(1, base_width >> index), max(1, base_height >> index)
        coordinates = (rect['level'], rect['x'], rect['y'], rect['width'], rect['height'])
        require(all(type(v) is int for v in coordinates) and coordinates == (index, 0, y, w, h)
                and y + h <= height, 'Atlas rectangle layout differs')
        rows = []
        for row in range(h):
            start = ((y + row) * width) * 4
            rows.append(rgba[start:start + w * 4])
            require(not any(rgba[start + w * 4:start + width * 4]), 'Atlas padding differs')
        pixels = b''.join(rows)
        require(sha(pixels) == rect['rgbaSha256'], 'Authored mip pixels differ')
        levels.append(pixels); y += h
    require(y == height, 'Unexpected atlas rows')
    return levels
