# Third-party notices

## Three.js

The MIT License

Copyright © 2010-2025 three.js authors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

## WebXR Input Profiles assets

Controller profile JSON and GLB models in `public/controller-profiles/` come from
`@webxr-input-profiles/assets@1.0.20` (Immersive Web project). They are
distributed under the MIT License; the full package notice is copied to
`public/controller-profiles/LICENSE.md`. The local `profilesList.json` selects
the bundled Quest profiles and generic fallback from that package.

## Natural Earth land outlines

The 1:110m land GeoJSON in `src/showcase/data/ne_110m_land.json` comes from
[Natural Earth Vector](https://github.com/nvkelso/natural-earth-vector), a
public-domain map dataset. The app draws its own globe and projection texture
from those coordinates.

## John Snow buildings, housing blocks, and pump coordinates

The compact fields in `src/showcase/data/snow.json` and
`src/showcase/data/snow-blocks.json` were extracted from
[GeoDa's Snow2](https://geodacenter.github.io/data-and-lab/snow2/),
[Snow3](https://geodacenter.github.io/data-and-lab/snow3/), and
[Snow6](https://geodacenter.github.io/data-and-lab/snow6/) downloads, credited
to the University of Chicago Center for Spatial Data Science and its cited
digitizers. GeoDa's documentation lists the digitizations' license as unknown.
See `SOURCES.md` for provenance and the limitations of this teaching use.
