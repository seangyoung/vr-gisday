"""Reduce the USGS March 2024 Marconi DSM/orthomosaic to a local WebXR patch.

Input GeoTIFFs are the unmodified USGS 2024-016-FA products named in SOURCES.md.
Run with the bundled Python runtime that includes Pillow and NumPy:
  python scripts/build-marconi-assets.py /path/to/DSM.tif /path/to/RGBavg.tif
"""
import json
import sys
from pathlib import Path
from PIL import Image
import numpy as np

DSM = Image.open(sys.argv[1])
ORTHO = Image.open(sys.argv[2])
OUT = Path('public/assets/marconi')
OUT.mkdir(parents=True, exist_ok=True)
# The southern survey patch includes the coastal access structure, bluff, and beach.
CROP = (1250, 5800, 4650, 9200)
SIZE = 321
ORTHO_SIZE = 2048
raw = np.asarray(DSM.crop(CROP).resize((SIZE, SIZE), Image.Resampling.NEAREST), dtype=float)
valid = raw > -900
# Invalid/unsurveyed cells receive no surface or point cloud.
heights = np.where(valid, np.round(raw, 2), None).tolist()
(OUT / 'terrain.json').write_text(json.dumps({
  'width': SIZE, 'height': SIZE, 'metersPerCell': 170 / (SIZE-1),
  'utm19nTopLeft': [419965 + CROP[0] * 0.05, 4638560 - CROP[1] * 0.05],
  'elevationDatum': 'NAVD88', 'heights': heights,
}, separators=(',', ':')))
image = ORTHO.crop(CROP).resize((ORTHO_SIZE, ORTHO_SIZE), Image.Resampling.LANCZOS).convert('RGB')
image.save(OUT / 'orthomosaic.jpg', quality=86, optimize=True)
print('Wrote terrain.json and orthomosaic.jpg', OUT)
