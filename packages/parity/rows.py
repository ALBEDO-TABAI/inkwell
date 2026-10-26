#!/usr/bin/env python3
"""rows.py ref ours [x0 x1] -> text-row runs (css px) side-by-side to find vertical drift."""
import sys
from PIL import Image
def runs(path, x0, x1):
    im = Image.open(path).convert('L'); s = im.size[0] / 1320
    im = im.resize((1320, int(im.size[1] / s))).crop((x0, 44, x1, 824))
    bg = im.getpixel((2, 2)); W, H = im.size; px = im.load(); out = []; cur = None
    for y in range(H):
        ink = sum(1 for x in range(0, W, 1) if abs(px[x, y] - bg) > 40)
        if ink and cur is None: cur = y
        if not ink and cur is not None: out.append((cur + 44, y + 44)); cur = None
    return out
x0, x1 = (int(sys.argv[3]), int(sys.argv[4])) if len(sys.argv) > 4 else (440, 1150)
a = runs(sys.argv[1], x0, x1); b = runs(sys.argv[2], x0, x1)
for i in range(max(len(a), len(b))):
    ra = a[i] if i < len(a) else None; rb = b[i] if i < len(b) else None
    d = f'{rb[0]-ra[0]:+d}/{(rb[1]-rb[0])-(ra[1]-ra[0]):+d}' if ra and rb else ''
    print(f'{str(ra):14} {str(rb):14} {d}')
