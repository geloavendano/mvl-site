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

# The confirmation card frames the player the way the team cards on the landing
# do: the whole cut-out standing on the team artwork, not a face crop. So the
# only processing is trim-to-content and scale — height drives it, width falls
# where it falls, and the card's CSS does the placing.
HEIGHT = 900          # ~300 CSS px at 3x
QUALITY = 82
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


# Sources shorter than HEIGHT, collected during a build and reported at the end.
UNDERSIZED = []

def to_card_webp(src: Path, dst: Path):
    """Trim to the cut-out's own bounds, scale to HEIGHT, keep the alpha."""
    from PIL import Image, ImageOps
    tmp = None
    if src.suffix.lower() not in {".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff"}:
        # RAW/HEIC: let macOS decode it first, PIL will not
        tmp = Path(tempfile.mkstemp(suffix=".png")[1])
        subprocess.run(["sips", "-s", "format", "png", str(src), "--out", str(tmp)],
                       capture_output=True)
        src = tmp

    im = Image.open(src)
    im = ImageOps.exif_transpose(im)          # honour the camera's rotation flag
    has_alpha = im.mode in ("RGBA", "LA") or "transparency" in im.info
    im = im.convert("RGBA" if has_alpha else "RGB")

    if has_alpha:
        # Background-removed sources carry a lot of empty margin. Trimming to
        # the figure means the card's own padding decides the framing, rather
        # than however much space the cut-out happened to leave.
        box = im.getchannel("A").getbbox()
        if box:
            im = im.crop(box)

    w, h = im.size
    # Downscale only. Enlarging a small cut-out to HEIGHT invents no detail —
    # it just interpolates, then the browser resamples again, and the result is
    # visibly soft while the file gets *smaller* because blur compresses well.
    # A source under HEIGHT is a source problem; report it rather than paper
    # over it (see UNDERSIZED below).
    if h > HEIGHT:
        im = im.resize((max(1, round(w * HEIGHT / h)), HEIGHT), Image.LANCZOS)
    elif h < HEIGHT * 0.95:
        UNDERSIZED.append((src.name, w, h))

    dst.parent.mkdir(parents=True, exist_ok=True)
    if im.mode == "RGBA":
        im.save(dst, "WEBP", quality=QUALITY, method=6, alpha_quality=90)
    else:
        im.save(dst, "WEBP", quality=QUALITY, method=6)
    if tmp:
        tmp.unlink(missing_ok=True)
    return has_alpha


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True)
    ap.add_argument("--build", action="store_true")
    ap.add_argument("--sql", action="store_true")
    ap.add_argument("--out", default="tmp/player-photos")
    args = ap.parse_args()

    people = roster()
    src = Path(args.src)
    # A folder may hold the same player twice (e.g. GML-1.png and GML-1.webp).
    # Keep one per stem, preferring the least-lossy source available.
    PREF = {".png": 0, ".tif": 1, ".tiff": 1, ".nef": 2, ".cr2": 2, ".arw": 2, ".dng": 2,
            ".heic": 3, ".jpg": 4, ".jpeg": 4, ".webp": 5}
    best = {}
    for f in sorted(src.iterdir()):
        if not f.is_file() or f.suffix.lower() not in READABLE:
            continue
        key = f.stem.upper()
        if key not in best or PREF.get(f.suffix.lower(), 9) < PREF.get(best[key].suffix.lower(), 9):
            best[key] = f
    files = [best[k] for k in sorted(best)]

    matched, unmatched, noface = [], [], []
    for f in files:
        code = re.sub(r"[^A-Za-z0-9-]", "", f.stem).upper()
        (matched if code in people else unmatched).append((code, f))

    out = Path(args.out)
    for code, f in matched:
        if args.build:
            if not to_card_webp(f, out / f"{code}.webp"):
                noface.append(code)

    if UNDERSIZED:
        print(f"\n!! {len(UNDERSIZED)} source(s) shorter than the {HEIGHT}px target — these were NOT")
        print("   enlarged, so they will render soft on a retina card. Re-export them")
        print("   taller from the originals in mvl/assets/player-photos/extracted/.")
        for name, w, h in sorted(UNDERSIZED, key=lambda r: r[2]):
            print(f"     {name:28} {w}x{h}  ({HEIGHT/h:.1f}x short)")
        print()

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
        print(f"\nno transparency {len(noface)} — these still carry their background")
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
