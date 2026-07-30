#!/usr/bin/env python3
"""Split an AI mood sheet into transparent sticker PNGs with soft edges.

Usage:
  python3 scripts/mood-stickers.py SHEET.png joyful
  python3 scripts/mood-stickers.py SHEET.png joyful --order male,female,cat,dog
  python3 scripts/mood-stickers.py ONE.png calm --order female

Writes assets/moods/<emotion>/{male,female,cat,dog}.png
"""

from __future__ import annotations

import argparse
import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

REPO_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_SIZE = 256

# Models often place each character on a light card with a soft gray shadow, so
# background is "bright and colourless" rather than strictly white. Warm fur
# (cat/dog) keeps a channel spread well above NEUTRAL_SPREAD and is preserved.
BACKGROUND_BRIGHTNESS = 202
NEUTRAL_SPREAD = 18

# The model draws an antialiased outline, so pixels along the silhouette are a
# blend of ink and white. Treating them as fully opaque or fully clear is what
# makes cut-outs look jagged; instead map that brightness range onto partial
# coverage. Only pixels near the flood-fill boundary get this treatment, which
# keeps light interior fills (a cream belly, white teeth) fully opaque.
CLEAR_AT = 252.0
OPAQUE_AT = 205.0
EDGE_BAND = 2

# Ignore specks left behind by compression ringing around the artwork.
MIN_BLOB_AREA = 64
# Below this coverage a pixel is treated as empty when measuring the crop box.
VISIBLE_ALPHA = 0.02


def channel_stats(rgb: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    low = rgb.min(axis=2)
    high = rgb.max(axis=2)
    return low, high - low


def background_mask(rgb: np.ndarray) -> np.ndarray:
    """Flood-fill from the border so white eyes and teeth stay opaque."""
    height, width = rgb.shape[:2]
    low, spread = channel_stats(rgb)
    candidate = (
        (low >= BACKGROUND_BRIGHTNESS) & (spread <= NEUTRAL_SPREAD)
    ).ravel()

    filled = np.zeros(height * width, dtype=bool)
    queue: deque[int] = deque()

    def enqueue(index: int) -> None:
        if candidate[index] and not filled[index]:
            filled[index] = True
            queue.append(index)

    for x in range(width):
        enqueue(x)
        enqueue((height - 1) * width + x)
    for y in range(height):
        enqueue(y * width)
        enqueue(y * width + width - 1)

    while queue:
        index = queue.popleft()
        x = index % width
        if x > 0:
            enqueue(index - 1)
        if x < width - 1:
            enqueue(index + 1)
        if index >= width:
            enqueue(index - width)
        if index < (height - 1) * width:
            enqueue(index + width)

    return filled.reshape(height, width)


def dilate(mask: np.ndarray, iterations: int) -> np.ndarray:
    grown = mask.copy()
    for _ in range(iterations):
        step = grown.copy()
        step[1:, :] |= grown[:-1, :]
        step[:-1, :] |= grown[1:, :]
        step[:, 1:] |= grown[:, :-1]
        step[:, :-1] |= grown[:, 1:]
        grown = step
    return grown


def soft_alpha(rgb: np.ndarray, background: np.ndarray) -> np.ndarray:
    """Full coverage inside the artwork, zero outside, a ramp along the edge."""
    low, _ = channel_stats(rgb)
    coverage = np.clip((CLEAR_AT - low) / (CLEAR_AT - OPAQUE_AT), 0.0, 1.0)

    edge = dilate(background, EDGE_BAND) & dilate(~background, EDGE_BAND)
    alpha = np.where(background, 0.0, 1.0)
    return np.where(edge, coverage, alpha)


def find_blobs(mask: np.ndarray) -> list[np.ndarray]:
    """Connected runs of artwork, as flat index arrays."""
    height, width = mask.shape
    flat = mask.ravel()
    visited = np.zeros(height * width, dtype=bool)
    blobs: list[np.ndarray] = []

    for start in np.flatnonzero(flat):
        if visited[start]:
            continue
        blob: list[int] = []
        stack = [int(start)]
        visited[start] = True
        while stack:
            index = stack.pop()
            blob.append(index)
            x = index % width
            neighbours = []
            if x > 0:
                neighbours.append(index - 1)
            if x < width - 1:
                neighbours.append(index + 1)
            if index >= width:
                neighbours.append(index - width)
            if index < (height - 1) * width:
                neighbours.append(index + width)
            for neighbour in neighbours:
                if flat[neighbour] and not visited[neighbour]:
                    visited[neighbour] = True
                    stack.append(neighbour)
        if len(blob) >= MIN_BLOB_AREA:
            blobs.append(np.array(blob, dtype=np.int64))

    return blobs


def group_by_quadrant(
    blobs: list[np.ndarray],
    shape: tuple[int, int],
) -> list[np.ndarray]:
    """Bucket blobs by centroid, so a shirt that crosses the midline stays with
    its own character instead of bleeding into the tile below."""
    height, width = shape
    groups = [np.zeros(shape, dtype=bool) for _ in range(4)]

    for blob in blobs:
        centroid_x = float((blob % width).mean())
        centroid_y = float((blob // width).mean())
        quadrant = (0 if centroid_y < height / 2 else 2) + (
            0 if centroid_x < width / 2 else 1
        )
        groups[quadrant].ravel()[blob] = True

    return groups


def unmultiply_white(rgb: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    """Recover the ink colour hidden inside a blend with the white background,
    otherwise every soft edge keeps a pale halo."""
    coverage = alpha[..., None]
    safe = np.maximum(coverage, 1e-6)
    recovered = (rgb - 255.0 * (1.0 - coverage)) / safe
    return np.clip(np.where(coverage > 0, recovered, rgb), 0.0, 255.0)


def to_sticker(rgb: np.ndarray, alpha: np.ndarray) -> Image.Image:
    """Crop, square, and resize in premultiplied space so the downscale cannot
    drag background colour into the silhouette."""
    visible = alpha > VISIBLE_ALPHA
    rows = np.flatnonzero(visible.any(axis=1))
    cols = np.flatnonzero(visible.any(axis=0))
    top, bottom = int(rows[0]), int(rows[-1]) + 1
    left, right = int(cols[0]), int(cols[-1]) + 1

    alpha = alpha[top:bottom, left:right]
    colour = unmultiply_white(rgb[top:bottom, left:right], alpha)

    height, width = alpha.shape
    side = max(height, width)
    offset_y, offset_x = (side - height) // 2, (side - width) // 2

    square_alpha = np.zeros((side, side), dtype=np.float64)
    square_colour = np.zeros((side, side, 3), dtype=np.float64)
    square_alpha[offset_y : offset_y + height, offset_x : offset_x + width] = alpha
    square_colour[offset_y : offset_y + height, offset_x : offset_x + width] = colour

    premultiplied = Image.fromarray(
        np.round(square_colour * square_alpha[..., None]).astype(np.uint8),
        mode='RGB',
    ).resize((OUTPUT_SIZE, OUTPUT_SIZE), Image.LANCZOS)
    resized_alpha = Image.fromarray(
        np.round(square_alpha * 255.0).astype(np.uint8),
        mode='L',
    ).resize((OUTPUT_SIZE, OUTPUT_SIZE), Image.LANCZOS)

    out_alpha = np.asarray(resized_alpha, dtype=np.float64) / 255.0
    out_premultiplied = np.asarray(premultiplied, dtype=np.float64)
    divisor = np.maximum(out_alpha, 1e-6)[..., None]
    out_colour = np.clip(out_premultiplied / divisor, 0.0, 255.0)

    sticker = np.dstack(
        [out_colour, np.round(out_alpha * 255.0)[..., None]]
    ).astype(np.uint8)
    return Image.fromarray(sticker, mode='RGBA')


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('sheet', help='2x2 sheet produced by the image model')
    parser.add_argument('emotion', help='emotion id, e.g. joyful')
    parser.add_argument(
        '--order',
        default='male,female,cat,dog',
        help='variant order, reading left-to-right then top-to-bottom. '
        'Pass a single variant when the input holds one character.',
    )
    args = parser.parse_args()

    variants = [item.strip() for item in args.order.split(',') if item.strip()]
    if len(variants) not in (1, 4):
        parser.error('--order needs either 1 or 4 variants')

    sheet_path = Path(args.sheet).expanduser()
    if not sheet_path.is_file():
        parser.error(f'sheet not found: {sheet_path}')

    out_dir = REPO_ROOT / 'assets' / 'moods' / args.emotion
    out_dir.mkdir(parents=True, exist_ok=True)

    rgb = np.asarray(Image.open(sheet_path).convert('RGB'), dtype=np.float64)
    background = background_mask(rgb)
    alpha = soft_alpha(rgb, background)
    blobs = find_blobs(~background)

    if len(variants) == 1:
        artwork = ~background
        groups = [artwork]
    else:
        groups = group_by_quadrant(blobs, background.shape)

    exit_code = 0
    for variant, group in zip(variants, groups):
        if not group.any():
            print(f'warning: no artwork found for {variant}', file=sys.stderr)
            exit_code = 1
            continue

        others = np.zeros_like(group)
        for other in groups:
            if other is not group:
                others |= other

        region = dilate(group, EDGE_BAND) & ~others
        sticker = to_sticker(rgb, alpha * region)

        destination = out_dir / f'{variant}.png'
        sticker.save(destination, optimize=True)
        size_kb = destination.stat().st_size / 1024
        print(
            f'{destination.relative_to(REPO_ROOT)}  '
            f'{OUTPUT_SIZE}px  {size_kb:.1f} KB'
        )

    return exit_code


if __name__ == '__main__':
    sys.exit(main())
