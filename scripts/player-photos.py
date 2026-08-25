#!/usr/bin/env python3
"""
Player photos -> the check-in confirmation card.

Source files are named after the printed QR code, <SHORT_CODE>-<JERSEY>, so a
photo maps to exactly one roster row: MTX-88.jpg, THT-23.jpeg, GML-7.png. That
pair is uniquely indexed on mvl.players, and it is the same string already
printed on the QR cards, so the naming can be checked by eye.

  python3 scripts/player-photos.py --src <dir>            # match only, no writes
  python3 scripts/player-photos.py --src <dir> --build    # + write webp to tmp/player-photos
  python3 scripts/player-photos.py --src <dir> --build --sql   # + emit the UPDATE

The confirmation avatar is a circle capped at 190 CSS px, so 600x600 covers a
3x screen with room to spare. Crops are square and biased upward: a centred
square on a portrait cuts foreheads.
"""
import argparse, json, os, re, subprocess, sys, tempfile
from pathlib import Path

SIZE = 600
QUALITY = 82
# How much of the crop the head should occupy. 2.6 face-heights gives a
# head-and-shoulders frame with a little air above — the source photos are
# full-body studio shots, so a geometric crop leaves the face a speck.
FACE_ZOOM = 2.6
FACE_BIAS = 0.36  # fallback only, when no face is detected
FACEBOX = Path(__file__).parent / "bin" / "facebox"
READABLE = {".jpg", ".jpeg", ".png", ".webp", ".heic", ".nef", ".cr2", ".arw", ".dng", ".tif", ".tiff"}


def roster():
    """code -> player, straight from the database rather than a pasted list."""
    sql = ("select t.short_code||'-'||p.jersey_number as code, p.id, p.display_name, "
           "coalesce(p.surname,'') as surname, t.id as team "
           "from mvl.players p join mvl.teams t on t.id=p.team_id "
           "where p.jersey_number is not null and trim(p.jersey_number) <> '' "
           "and t.short_code is not null;")
    out = subprocess.run(["supabase", "db", "query", "--linked", sql],
                         capture_output=True, text=True).stdout
    rows = json.loads("{\"r\":" + out[out.index("["):out.rindex("]") + 1] + "}")["r"]
    return {r["code"].upper(): r for r in rows}


def face_of(path: Path):
    """Largest face as a normalised rect, or None."""
    if not FACEBOX.exists():
        return None
    out = subprocess.run([str(FACEBOX), str(path)], capture_output=True, text=True).stdout
    try:
        d = json.loads(out)
    except json.JSONDecodeError:
        return None
    return d if d.get("found") else None


def to_square_webp(src: Path, dst: Path):
    from PIL import Image, ImageOps
    tmp = None
    if src.suffix.lower() not in {".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff"}:
        # RAW/HEIC: let macOS decode it first, PIL will not
        tmp = Path(tempfile.mkstemp(suffix=".jpg")[1])
        subprocess.run(["sips", "-s", "format", "jpeg", str(src), "--out", str(tmp)],
                       capture_output=True)
        src = tmp

    im = Image.open(src)
    im = ImageOps.exif_transpose(im)          # honour the camera's rotation flag
    im = im.convert("RGB")
    w, h = im.size

    face = face_of(src)
    if face:
        fx, fy = face["x"] * w, face["y"] * h
        fw, fh = face["w"] * w, face["h"] * h
        side = max(fh * FACE_ZOOM, fw * FACE_ZOOM)
        side = min(side, w, h)                # never ask for more than exists
        cx = fx + fw / 2
        # sit the face above centre so the frame reads as a portrait, not a chin
        cy = fy + fh / 2 + side * 0.06
        left, top = cx - side / 2, cy - side / 2
    else:
        side = min(w, h)
        left = (w - side) / 2
        top = (h - side) * (1 - FACE_BIAS) if h > w else (h - side) / 2

    # keep the window inside the frame rather than letting the crop go negative
    left = max(0, min(left, w - side))
    top = max(0, min(top, h - side))
    box = (int(left), int(top), int(left + side), int(top + side))

    im = im.crop(box).resize((SIZE, SIZE), Image.LANCZOS)
    dst.parent.mkdir(parents=True, exist_ok=True)
    im.save(dst, "WEBP", quality=QUALITY, method=6)
    if tmp:
        tmp.unlink(missing_ok=True)
    return bool(face)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True)
    ap.add_argument("--build", action="store_true")
    ap.add_argument("--sql", action="store_true")
    ap.add_argument("--out", default="tmp/player-photos")
    args = ap.parse_args()

    people = roster()
    src = Path(args.src)
    files = sorted(f for f in src.iterdir() if f.is_file() and f.suffix.lower() in READABLE)

    matched, unmatched, noface = [], [], []
    for f in files:
        code = re.sub(r"[^A-Za-z0-9-]", "", f.stem).upper()
        (matched if code in people else unmatched).append((code, f))

    out = Path(args.out)
    for code, f in matched:
        if args.build:
            if not to_square_webp(f, out / f"{code}.webp"):
                noface.append(code)

    print(f"source        {len(files)} readable file(s) in {src}")
    print(f"matched       {len(matched)}")
    for code, f in matched:
        p = people[code]
        size = ""
        if args.build:
            kb = (out / f"{code}.webp").stat().st_size / 1024
            size = f"  ({kb:.0f} KB)"
        print(f"  {code:<9} {p['display_name']} {p['surname']}".rstrip() + size)
    if unmatched:
        print(f"\nunmatched     {len(unmatched)} — rename to <SHORT_CODE>-<JERSEY>")
        for code, f in unmatched:
            print(f"  {f.name}  (read as '{code}')")

    if noface:
        print(f"\nno face found  {len(noface)} — centre-cropped, check these by eye")
        print("  " + "  ".join(noface))

    have = {c for c, _ in matched}
    missing = sorted(set(people) - have)
    print(f"\nstill missing {len(missing)} of {len(people)} players with a jersey")
    if missing and len(missing) <= 40:
        print("  " + "  ".join(missing))

    if args.sql and matched:
        print("\n-- photo_path for the matched players")
        vals = ",".join(f"('{c}','{c}.webp')" for c, _ in matched)
        print("update mvl.players p set photo_path = v.path "
              f"from (values {vals}) as v(code, path) "
              "join mvl.teams t on upper(t.short_code) = split_part(v.code,'-',1) "
              "where p.team_id = t.id and p.jersey_number = split_part(v.code,'-',2);")


if __name__ == "__main__":
    main()
