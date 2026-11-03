"""Download and resize six adjacent public-domain USGS Marconi survey images.

The source IDs and processing are recorded in SOURCES.md. Requires Pillow.
Run from the repository root. Only the compressed output JPEGs ship with the app.
"""
from pathlib import Path
import subprocess
from io import BytesIO
from PIL import Image

BASE = 'https://cmgds.marine.usgs.gov/idsviewer/ids-imagery/media/images/10.5066-P14VBPYC/'
SOURCE_FILES = [
    '6359572ee63d4d798f128ebad3ba96ed.JPG',
    '15ce1e394ea54606abf844376cc6bbec.JPG',
    'b193ce8f49f8460b8379b4b6900b9ad4.JPG',
    '6e17fe202f974605a77a4679e54b2be2.JPG',
    '1327c755479c45408e6542d87464f57b.JPG',
    '2e7c7bb1a86b4923be9b0d700610ffa0.JPG',
]
OUT = Path('public/assets/marconi')
OUT.mkdir(parents=True, exist_ok=True)
for index, name in enumerate(SOURCE_FILES, 1):
    data = subprocess.check_output(['curl', '-fsSL', BASE + name])
    image = Image.open(BytesIO(data))
    image.thumbnail((1200, 900), Image.Resampling.LANCZOS)
    image.save(OUT / f'photo-{index}.jpg', quality=80, optimize=True)
    print(f'photo-{index}.jpg <- {name}')
