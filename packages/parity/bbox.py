#!/usr/bin/env python3
"""bbox.py img x0 y0 x1 y1 [thr] -> bbox (css px at given scale=img.w/1320) of pixels darker than bg by thr."""
import sys
from PIL import Image
im = Image.open(sys.argv[1]).convert('L'); s = im.size[0] / 1320
x0, y0, x1, y1 = [int(float(v) * s) for v in sys.argv[2:6]]; thr = int(sys.argv[6]) if len(sys.argv) > 6 else 60
c = im.crop((x0, y0, x1, y1)); bg = c.getpixel((0, 0)); px = c.load()
pts = [(x, y) for x in range(c.size[0]) for y in range(c.size[1]) if abs(px[x, y] - bg) > thr]
if not pts: print('none'); sys.exit()
xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
print(f'x {x0/s + min(xs)/s:.1f}-{x0/s + (max(xs)+1)/s:.1f}  y {y0/s + min(ys)/s:.1f}-{y0/s + (max(ys)+1)/s:.1f}')
