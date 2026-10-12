"""Rebuild the compact Snow fields and pinned Natural Earth outline.

Run explicitly from a networked machine; app builds use the checked-in files.
If a provider changes a download, review it before updating the hashes.
"""

from __future__ import annotations

import hashlib
import io
import json
from pathlib import Path
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
    DATA.mkdir(parents=True, exist_ok=True)
    payload = {
        "source": "GeoDa Snow2 and Snow6; British National Grid coordinates in metres",
        "buildings": buildings,
        "pumps": pumps,
    }
    (DATA / "snow.json").write_text(json.dumps(payload, separators=(",", ":")) + "\n")
    (DATA / "ne_110m_land.json").write_bytes(download("land"))


if __name__ == "__main__":
    main()
