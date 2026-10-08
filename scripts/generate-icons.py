"""Regenerate the original Spatial Discovery Lab icons with Pillow."""
from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parents[1] / 'public' / 'icons'
OUT.mkdir(parents=True, exist_ok=True)
# Draw large and downsample for clean curves. Artwork fits the maskable safe circle.
scale = 4
im = Image.new('RGB', (512 * scale, 512 * scale), '#081a24')
draw = ImageDraw.Draw(im)
def ellipse(box, color, width=8):
    draw.ellipse(tuple(int(v * scale) for v in box), outline=color, width=width * scale)
def line(points, color, width=8):
    draw.line([(int(x * scale), int(y * scale)) for x, y in points], fill=color, width=width * scale)
ellipse((96, 96, 416, 416), '#b0f1da', 10)
ellipse((172, 96, 340, 416), '#60cbd4', 7)
ellipse((96, 191, 416, 321), '#60cbd4', 7)
line([(99, 256), (413, 256)], '#60cbd4', 7)
# Gold observation point links the globe to the positioning/scanning demos.
draw.ellipse((274 * scale, 156 * scale, 330 * scale, 212 * scale), fill='#081a24')
draw.ellipse((282 * scale, 164 * scale, 322 * scale, 204 * scale), fill='#ffce83')
for name, size in [('icon-192', 192), ('icon-512', 512), ('icon-maskable-512', 512), ('apple-touch-icon', 180), ('favicon-32', 32)]:
    im.resize((size, size), Image.Resampling.LANCZOS).save(OUT / f'{name}.png')
