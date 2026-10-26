#!/usr/bin/env python3
"""compare.py ref.png ours.png out.png [x0 y0 x1 y1 in css px] -> prints mismatch %; writes ref|ours|diff."""
import sys
half = '--1x' in sys.argv
sys.argv = [a for a in sys.argv if a != '--1x']
from PIL import Image, ImageChops
ref, ours, out = sys.argv[1:4]
a = Image.open(ref).convert('RGB'); b = Image.open(ours).convert('RGB')
if b.size != a.size: b = b.resize(a.size)
scale = a.size[0] / 1320
if len(sys.argv) > 4:
    x0, y0, x1, y1 = [int(float(v) * scale) for v in sys.argv[4:8]]
    a = a.crop((x0, y0, x1, y1)); b = b.crop((x0, y0, x1, y1))
d = ImageChops.difference(a, b).convert('L')
mask = d.point(lambda v: 255 if v > 24 else 0)
n = mask.histogram()[255]
tot = mask.size[0] * mask.size[1]
print(f'mismatch {100*n/tot:.2f}%  ({n}/{tot})')
red = Image.new('RGB', a.size, (255, 0, 64))
diff = Image.composite(red, Image.blend(a, Image.new('RGB', a.size, (255,255,255)), 0.7), mask)
W, H = a.size
im = Image.new('RGB', (W * 3 + 20, H), (128, 128, 128))
im.paste(a, (0, 0)); im.paste(b, (W + 10, 0)); im.paste(diff, (2 * W + 20, 0))
if half: im = im.resize((im.width // 2, im.height // 2), Image.LANCZOS)
im.save(out)
