"""Build road-centered, non-overlapping ward polygons for the Snow map.

Run with Python 3 and Shapely 2.1+. The generated JSON is committed so the
headset never computes Voronoi geometry at runtime.
"""

import json
import math
import subprocess
from pathlib import Path

from shapely import MultiPoint, box, coverage_is_valid, coverage_simplify, voronoi_polygons
from shapely.geometry import LineString, Polygon
from shapely.ops import linemerge, unary_union


ROOT = Path(__file__).resolve().parents[1]
blocks = json.loads((ROOT / "src/showcase/data/snow-blocks.json").read_text())["blocks"]
modes = json.loads(subprocess.check_output(
    ["node", "--input-type=module", "-e",
     "import { CLUSTER_MODES } from './src/showcase/cluster-model.js'; "
     "console.log(JSON.stringify(CLUSTER_MODES));"], cwd=ROOT, text=True))
extent = box(529115, 180770, 529700, 181350)
housing_footprint = unary_union([Polygon(block[3][0]) for block in blocks])
# Close narrow street gaps in the *outside* envelope. Otherwise an exterior
# border follows a road into a ward and back out as a spurious-looking spur.
# The ward-to-ward divisions below still follow the original block geometry.
urban_footprint = (housing_footprint.buffer(18, join_style=2)
                   .buffer(-8, join_style=2).intersection(extent))

# Samples along the real block edges make the dividing lines run down streets
# rather than cutting across the buildings. Voronoi cells partition the street
# gaps, then cells assigned to the same ward are dissolved into one polygon.
sites = []
owners = []
seen = set()
for block_id, block in enumerate(blocks):
    perimeter = LineString(block[3][0])
    candidates = [perimeter.interpolate(distance)
                  for distance in range(0, math.ceil(perimeter.length), 12)]
    candidates.append(Polygon(block[3][0]).representative_point())
    for point in candidates:
        key = (round(point.x, 4), round(point.y, 4))
        if key in seen:
            continue
        seen.add(key)
        sites.append(key)
        owners.append(block_id)

cells = list(voronoi_polygons(MultiPoint(sites), extend_to=extent, ordered=True).geoms)
output = {}
for mode, definition in modes.items():
    if "wards" not in definition:
        continue
    wards = []
    for ward_id in range(definition["count"]):
        ward_cells = [cell for cell, block_id in zip(cells, owners)
                      if definition["wards"][block_id] == ward_id]
        wards.append(unary_union(ward_cells).intersection(urban_footprint))
    if not coverage_is_valid(wards):
        raise ValueError(f"{mode} is not an edge-matched polygon coverage")
    # Simplify the coverage together: neighboring wards retain precisely the
    # same street-center line instead of drawing two near-parallel lines.
    wards = coverage_simplify(wards, 13)
    polygons = []
    outlines = []
    for ward in wards:
        parts = [ward] if isinstance(ward, Polygon) else list(ward.geoms)
        # Voronoi clipping can create tiny isolated wedges in road junctions.
        # They contain no housing blocks and read as dangling ward borders.
        visible = [part for part in parts if isinstance(part, Polygon) and part.area >= 150]
        polygons.append([
            [[round(x, 1), round(y, 1)] for x, y in part.exterior.coords]
            for part in visible
        ])
        outlines.extend(part.exterior for part in visible)
    # Union noded outlines into a single network; shared edges are stroked once.
    linework = linemerge(unary_union(outlines))
    lines = [linework] if isinstance(linework, LineString) else list(linework.geoms)
    output[mode] = {
        "zones": polygons,
        "boundaries": [
            [[round(x, 1), round(y, 1)] for x, y in line.coords]
            for line in lines if isinstance(line, LineString) and line.length >= 10
        ],
    }

destination = ROOT / "src/showcase/data/snow-zone-polygons.json"
destination.write_text(json.dumps(output, separators=(",", ":")) + "\n")
print(f"Wrote zone polygons to {destination}")
