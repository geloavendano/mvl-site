"""Crop a standing full-body cut-out to hips-up.

A fixed fraction does not survive the variety here — some players were shot
head-to-toe, some from the chest. So classify on the figure's own proportions
and cut relative to head height, which is stable across poses:

  a standing adult runs about 7.5 head-heights, with the hips near 3.8 down
  from the crown, so keeping ~4.25 heads lands just below them. Cutting at the
  waist (3.6) took too much and clipped balls held low.

Photos already framed above the hips are left alone.
"""
import json
import subprocess
from pathlib import Path

from PIL import Image

FACEBOX = Path(__file__).parent / "bin" / "facebox"
# below this width/height the figure is full-body enough to be worth cutting
FULL_BODY_RATIO = 0.52
HEADS_TO_HIPS = 4.25


def face_rect(path: Path):
    out = subprocess.run([str(FACEBOX), str(path)], capture_output=True, text=True).stdout
    try:
        d = json.loads(out)
    except json.JSONDecodeError:
        return None
    return d if d.get("found") else None


def waist_crop(path: Path):
    """Return (image, reason). reason says why it was or wasn't cut."""
    im = Image.open(path).convert("RGBA")
    w, h = im.size
    if w / h > FULL_BODY_RATIO:
        return im, f"kept (ratio {w/h:.2f} — already above the hips)"

    f = face_rect(path)
    if not f:
        # no face to measure from; a blind fraction is worse than leaving it
        return im, f"kept (ratio {w/h:.2f} — no face found)"

    head_top = f["y"] * h
    head_h = f["h"] * h
    cut = int(round(head_top + HEADS_TO_HIPS * head_h))
    if cut >= h * 0.95:
        return im, f"kept (hip line past the frame)"

    im = im.crop((0, 0, w, cut))
    b = im.getchannel("A").getbbox()      # re-trim: arms narrow above the hips
    if b:
        im = im.crop(b)
    return im, f"cropped to {im.width}x{im.height}"


if __name__ == "__main__":
    import sys
    src, dst = Path(sys.argv[1]), Path(sys.argv[2])
    out, why = waist_crop(src)
    out.save(dst)
    print(why)
