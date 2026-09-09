from __future__ import annotations

import json
import math
import shutil
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public" / "reference" / "templates"
OUTPUT = ROOT / "public" / "reference" / "templates-clean"
AUDIT = ROOT / "src" / "domain" / "templates" / "overlay-texts.json"

PAGE_SIZE = (1200, 1696)

# Text printed on top of solid badges/circles must be painted back to the
# badge color instead of made transparent.
FILL = {
    ("tpl1_p3_right", "letter_f"): "#ffffff",
    ("tpl1_p3_right", "letter_l"): "#ffffff",
    ("tpl1_p3_right", "letter_i1"): "#ffffff",
    ("tpl1_p3_right", "letter_p"): "#ffffff",
    ("tpl1_p3_right", "letter_i2"): "#ffffff",
    ("tpl1_p3_right", "letter_n"): "#ffffff",
    ("tpl1_p4_left", "badge12"): "#feed1c",
    ("tpl1_p4_left", "badge13"): "#feed1c",
    ("tpl1_p4_left", "badge14"): "#feed1c",
    ("tpl1_p5_left", "label_a"): "#feed1c",
    ("tpl1_p5_left", "label_b"): "#feed1c",
    ("tpl2_p4_left", "year"): "#ffffff",
}


def hex_rgb(value: str) -> tuple[int, int, int]:
    value = value.lstrip("#")
    return tuple(int(value[i : i + 2], 16) for i in (0, 2, 4))


def clean_item(arr: np.ndarray, template_id: str, item: dict) -> None:
    height, width = arr.shape[:2]
    x, y = item["x"], item["y"]
    box_w, box_h = item["width"], item["height"]

    # The audit boxes already follow the visible text closely. A small pad
    # catches anti-aliased edges while avoiding nearby rules and ornaments.
    pad_x = min(0.012, max(0.003, box_w * 0.08))
    pad_y = min(0.008, max(0.002, box_h * 0.12))
    x0, y0 = max(0, x - pad_x), max(0, y - pad_y)
    x1, y1 = min(1, x + box_w + pad_x), min(1, y + box_h + pad_y)
    X0, X1 = int(x0 * width), int(math.ceil(x1 * width))
    Y0, Y1 = int(y0 * height), int(math.ceil(y1 * height))
    sub = arr[Y0:Y1, X0:X1]
    if not sub.size:
        return

    rgb = sub[:, :, :3].astype(np.int16)
    alpha = sub[:, :, 3]
    luminance = 0.2126 * rgb[:, :, 0] + 0.7152 * rgb[:, :, 1] + 0.0722 * rgb[:, :, 2]
    chroma = rgb.max(axis=2) - rgb.min(axis=2)
    dark = ((alpha > 0) & (luminance < 215) & (chroma < 95)).astype("uint8")

    count, labels, stats, _ = cv2.connectedComponentsWithStats(dark, 8)
    chosen = np.zeros_like(dark, dtype=bool)
    region_h, region_w = dark.shape
    expected_px = max(2, item.get("fontSize", 0.02) * width)

    for component in range(1, count):
        _, _, component_w, component_h, area = stats[component]
        if area < 1:
            continue
        # Reject long rules, oval outlines and diagonal decorations. Actual
        # glyph components stay comfortably below these dimensions.
        if component_w > max(expected_px * 4.5, region_w * 0.72):
            continue
        if component_h > max(expected_px * 2.0, region_h * 0.92):
            continue
        if component_h <= max(2, int(expected_px * 0.12)) and component_w > expected_px * 1.8:
            continue
        chosen |= labels == component

    fill = FILL.get((template_id, item["key"]))
    if fill:
        # These boxes contain only the glyph and its solid badge/circle, so
        # take every dark glyph pixel and restore the known background color.
        chosen = dark.astype(bool)

    if not chosen.any():
        return

    radius = max(1, round(width / 2400))
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (radius * 2 + 1, radius * 2 + 1))
    chosen = cv2.dilate(chosen.astype("uint8"), kernel, iterations=1).astype(bool)

    if fill:
        color = hex_rgb(fill)
        for channel in range(3):
            sub[:, :, channel][chosen] = color[channel]
        sub[:, :, 3][chosen] = 255
    else:
        sub[:, :, 3][chosen] = 0


def main() -> None:
    audit: dict[str, list[dict]] = json.loads(AUDIT.read_text(encoding="utf-8"))
    if OUTPUT.exists():
        shutil.rmtree(OUTPUT)
    OUTPUT.mkdir(parents=True)

    for template_id, items in audit.items():
        source = SOURCE / f"{template_id}.png"
        if not source.exists():
            raise FileNotFoundError(f"Missing audited overlay: {source}")

        rgba = np.array(Image.open(source).convert("RGBA"))
        for item in items:
            clean_item(rgba, template_id, item)

        image = Image.fromarray(rgba, "RGBA")
        if image.size != PAGE_SIZE:
            image = image.resize(PAGE_SIZE, Image.Resampling.LANCZOS)
        image.save(OUTPUT / f"{template_id}.webp", "WEBP", lossless=True, method=6)

    print(f"Generated {len(audit)} cleaned template overlays in {OUTPUT}")


if __name__ == "__main__":
    main()
