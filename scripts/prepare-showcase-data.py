"""Rebuild the compact Snow fields and pinned Natural Earth outline.

Run explicitly from a networked machine; app builds use the checked-in files.
If a provider changes a download, review it before updating the hashes.
"""

from __future__ import annotations

import hashlib
import io
import json
from pathlib import Path
import struct
from urllib.request import urlopen
from zipfile import ZipFile


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src" / "showcase" / "data"
SOURCES = {
    "snow2": (
        "https://geodacenter.github.io/data-and-lab/data/snow2.zip",
        "f29fcff80dde63cdc9a81538ec52364b0a2155bfdf6919a30615806bf7dab0db",
    ),
    "snow6": (
        "https://geodacenter.github.io/data-and-lab/data/snow6.zip",
        "3cb386ef6ad205a31f6684939d037d29d36331c17266eb0fafbbc1dc1ca49ed2",
    ),
    "snow3": (
        "https://geodacenter.github.io/data-and-lab/data/snow3.zip",
        "60b3ccda8bea26f755cebde7dd9ae267f0a4107963dae64c8e851a755a29ea1e",
    ),
    "land": (
        "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_land.geojson",
        "9e0729ee253ca7d7a5c4ae9395fb1902264c5377c52e224d13dd85010e2835d9",
    ),
}


def download(name: str) -> bytes:
    url, expected = SOURCES[name]
    with urlopen(url, timeout=30) as response:
        raw = response.read()
    actual = hashlib.sha256(raw).hexdigest()
    if actual != expected:
        raise RuntimeError(f"{name} changed: SHA-256 {actual}; review source first")
    return raw


def geojson_from_zip(raw: bytes) -> list[dict]:
    with ZipFile(io.BytesIO(raw)) as archive:
        filename = next(name for name in archive.namelist()
                        if name.endswith(".geojson") and
                        not name.startswith("__MACOSX"))
        return json.loads(archive.read(filename))["features"]


def block_shapes(raw: bytes) -> list[list[list[list[float]]]]:
    """Read projected polygon rings from Snow3's shapefile without GIS packages."""
    with ZipFile(io.BytesIO(raw)) as archive:
        shp = archive.read("deaths_by_block.shp")
    if struct.unpack_from(">i", shp, 0)[0] != 9994 or \
            struct.unpack_from("<i", shp, 32)[0] != 5:
        raise RuntimeError("Snow3 is not the expected polygon shapefile")
    shapes = []
    offset = 100
    while offset < len(shp):
        _, words = struct.unpack_from(">ii", shp, offset)
        content = offset + 8
        if struct.unpack_from("<i", shp, content)[0] != 5:
            raise RuntimeError("Unexpected Snow3 shape type")
        parts, count = struct.unpack_from("<ii", shp, content + 36)
        starts = struct.unpack_from(f"<{parts}i", shp, content + 44)
        point_offset = content + 44 + 4 * parts
        rings = []
        for start, stop in zip(starts, (*starts[1:], count)):
            ring = [
                [round(x, 1), round(y, 1)]
                for index in range(start, stop)
                for x, y in [struct.unpack_from("<dd", shp, point_offset + 16 * index)]
            ]
            if len(ring) < 4:
                raise RuntimeError("Unexpected Snow3 polygon ring")
            rings.append(ring)
        shapes.append(rings)
        offset = content + words * 2
    if offset != len(shp):
        raise RuntimeError("Snow3 shapefile length mismatch")
    return shapes


def polygon_centroid(rings: list[list[list[float]]]) -> list[float]:
    origin_x, origin_y = rings[0][0]
    twice_area = centroid_x = centroid_y = 0.0
    for ring in rings:
        for (ax, ay), (bx, by) in zip(ring, ring[1:]):
            ax -= origin_x
            ay -= origin_y
            bx -= origin_x
            by -= origin_y
            cross = ax * by - bx * ay
            twice_area += cross
            centroid_x += (ax + bx) * cross
            centroid_y += (ay + by) * cross
    if abs(twice_area) < 1e-6:
        raise RuntimeError("Degenerate Snow3 block")
    return [round(origin_x + centroid_x / (3 * twice_area), 1),
            round(origin_y + centroid_y / (3 * twice_area), 1)]


def main() -> None:
    buildings = [
        [round(feature["properties"]["COORD_X"], 1),
         round(feature["properties"]["COORD_Y"], 1),
         int(feature["properties"]["deaths"])]
        for feature in geojson_from_zip(download("snow2"))
    ]
    pumps = [
        [round(feature["properties"]["COORD_X"], 1),
         round(feature["properties"]["COORD_Y"], 1),
         feature["properties"]["name"].strip()]
        for feature in geojson_from_zip(download("snow6"))
    ]
    if len(buildings) != 250 or sum(row[2] for row in buildings) != 489 or len(pumps) != 8:
        raise RuntimeError("Unexpected Snow records; inspect source before publishing")
    snow3 = download("snow3")
    block_features = geojson_from_zip(snow3)
    shapes = block_shapes(snow3)
    if len(shapes) != len(block_features) or len(shapes) != 40:
        raise RuntimeError("Unexpected Snow3 block count")
    blocks = [[int(feature["properties"]["deaths"]),
               *polygon_centroid(rings), rings]
              for feature, rings in zip(block_features, shapes)]
    if sum(block[0] for block in blocks) != 489:
        raise RuntimeError("Snow3 deaths no longer agree with Snow2")
    DATA.mkdir(parents=True, exist_ok=True)
    payload = {
        "source": "GeoDa Snow2 and Snow6; British National Grid coordinates in metres",
        "buildings": buildings,
        "pumps": pumps,
    }
    (DATA / "snow.json").write_text(json.dumps(payload, separators=(",", ":")) + "\n")
    (DATA / "snow-blocks.json").write_text(json.dumps({
        "source": "GeoDa Snow3 housing blocks; projected shapefile coordinates in metres",
        "blocks": blocks,
    }, separators=(",", ":")) + "\n")
    (DATA / "ne_110m_land.json").write_bytes(download("land"))


if __name__ == "__main__":
    main()
