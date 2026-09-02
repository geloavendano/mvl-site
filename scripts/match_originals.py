"""Map <SHORT_CODE>-<JERSEY> to a full-resolution original in unedited/.

The filenames carry player names, not codes, and the spellings drift between
the roster and the shoot list (Abrahan/Abraham, Bubbles/Bub, Matthew/Matt), so
scoring is on surname first — a surname hit is worth far more than a shared
first name, which is what produced the wrong pairings on a naive token count.
"""
import re
import sys
import unicodedata
from pathlib import Path

STOP = {"oh", "mb", "s", "l", "op", "opp", "captain", "v1", "v2", "v3",
        "setter", "libero", "middle", "blocker", "outside", "hitter", "opposite"}


def toks(s):
    s = unicodedata.normalize("NFKD", s.lower())
    return [t for t in re.findall(r"[a-z]+", s) if t not in STOP and len(t) > 1]


def score(roster_name, filename):
    r, f = toks(roster_name), toks(filename)
    if not r or not f:
        return 0
    surname = r[-1]
    s = 0
    # surname carries the identity; a first-name-only match is near worthless
    if surname in f:
        s += 10
    else:
        for t in f:
            if t.startswith(surname[:4]) or surname.startswith(t[:4]):
                s += 6
                break
    for t in r[:-1]:
        if t in f:
            s += 2
        elif any(x.startswith(t[:3]) or t.startswith(x[:3]) for x in f):
            s += 1
    return s


def main():
    roster = {}
    for line in open("/tmp/roster.tsv"):
        p = line.rstrip("\n").split("\t")
        if len(p) == 3:
            roster[p[0]] = (p[1].strip(), p[2].strip())

    originals = {}
    for f in Path("mvl/assets/player-photos/unedited").rglob("*"):
        if f.parent.name == "unedited" or not f.is_file():
            continue
        if f.suffix.lower() not in (".jpg", ".jpeg", ".png", ".nef", ".cr2", ".arw", ".heic"):
            continue
        originals.setdefault(f.parent.name, []).append(f)

    codes = [l.strip() for l in open(sys.argv[1]) if l.strip()]
    for c in codes:
        name, team = roster.get(c, ("", ""))
        if not name:
            print(f"{c}\t\t\tNO_ROSTER")
            continue
        ranked = sorted(((score(name, f.stem), f) for f in originals.get(team, [])),
                        key=lambda r: -r[0])
        if not ranked or ranked[0][0] < 6:
            print(f"{c}\t{name.strip()}\t\tNO_MATCH")
            continue
        top, second = ranked[0], (ranked[1] if len(ranked) > 1 else (0, None))
        conf = "SURE" if top[0] >= 10 and top[0] - second[0] >= 4 else "CHECK"
        print(f"{c}\t{name.strip()}\t{top[1]}\t{conf}({top[0]}/{second[0]})")


if __name__ == "__main__":
    main()
