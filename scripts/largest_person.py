"""Keep only the main subject from a Vision person-segmentation cut-out.

VNGeneratePersonSegmentationRequest masks every person in the frame, so a gym
background full of team-mates survives. The subject of these portraits is always
the largest blob, so keep that component and drop the rest.

Pure PIL: the component search runs on a downsampled alpha (the blobs are huge
relative to the image), then the winning component is scaled back up and
multiplied into the full-resolution alpha.
"""
from collections import deque
from PIL import Image


def keep_largest_person(im: Image.Image, work_w: int = 480) -> Image.Image:
    im = im.convert("RGBA")
    alpha = im.getchannel("A")

    scale = work_w / im.width
    w, h = max(1, round(im.width * scale)), max(1, round(im.height * scale))
    small = alpha.resize((w, h), Image.BILINEAR)
    px = small.load()

    seen = [[False] * w for _ in range(h)]
    best, best_size = None, 0
    for sy in range(h):
        for sx in range(w):
            if seen[sy][sx] or px[sx, sy] <= 128:
                continue
            q, comp = deque([(sx, sy)]), []
            seen[sy][sx] = True
            while q:
                x, y = q.popleft()
                comp.append((x, y))
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h and not seen[ny][nx] and px[nx, ny] > 128:
                        seen[ny][nx] = True
                        q.append((nx, ny))
            if len(comp) > best_size:
                best, best_size = comp, len(comp)

    if not best:
        return im

    keep = Image.new("L", (w, h), 0)
    kp = keep.load()
    for x, y in best:
        kp[x, y] = 255
    # blur-free upscale then multiply: bilinear would feather the component edge
    # back over neighbours it was meant to drop
    keep_full = keep.resize(im.size, Image.NEAREST)
    from PIL import ImageChops
    im.putalpha(ImageChops.multiply(alpha, keep_full))
    return im


if __name__ == "__main__":
    import sys
    src, dst = sys.argv[1], sys.argv[2]
    out = keep_largest_person(Image.open(src))
    b = out.getchannel("A").getbbox()
    if b:
        out = out.crop(b)
    out.save(dst)
    print(f"  {out.width}x{out.height}")
