# Teaching and implementation references

Checked 2026-10-02. Original text and procedural lesson diagrams; controller models are attributed below.

## Controller models — checked 2026-10-09

- Immersive Web, [WebXR Input Profiles assets](https://github.com/immersive-web/webxr-input-profiles/tree/main/packages/assets) and [Three.js XRControllerModelFactory](https://threejs.org/docs/pages/XRControllerModelFactory.html): locally bundled Quest Touch and fallback controller models, selected from the headset's WebXR input profile. The asset package is MIT licensed; see `public/controller-profiles/LICENSE.md` and THIRD_PARTY_NOTICES.md. These models are hardware UI, not educational landscape assets. On-device profile selection, model alignment, and label readability remain to be checked on Quest.

- FAA, *Satellite Navigation — GPS — How It Works*: https://www.faa.gov/about/office_org/headquarters_offices/ato/service_units/techops/navservices/gnss/gps/howitworks — GPS solves position and receiver clock time. The fourth range in our exact-ranging model should not be equated with a complete GPS solution.
- GPS.gov, *Trilateration*: https://www.gps.gov/trilateration — public educational activity relevant to future facilitator materials. Referenced, not reproduced or adapted in this prototype.
- Meta, *Mixed Reality Support in Browser*: https://developers.meta.com/vr/documentation/web/webxr-mixed-reality/ — `immersive-ar` passthrough. No camera pixel access or room-scanning assumptions in this app.
- Three.js, *How to create VR content*: https://threejs.org/manual/pages/how-to-create-vr-content.html — renderer XR support and animation loop.
- GitHub, *What is GitHub Pages?*: https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages — static hosting.

## Model limitations

2D: the first two anchors share a horizontal baseline; the two candidate positions are reflections across it. A third off-baseline anchor resolves the ambiguity. Three noncollinear anchors with consistent exact distances uniquely identify the modeled planar point.

3D: the first three anchors lie in z=0. The two candidates have equal and opposite z. The fourth anchor lies outside that plane and distinguishes them. This intentionally chosen geometry illustrates ambiguity; it is not a complete satellite-positioning algorithm.

Uncertainty: points are sampled on a grid and retained when all absolute range residuals are below a tolerance. They approximate a feasible set, not a statistical confidence region. No random error is generated and no probability is assigned. Model units are arbitrary.

## Make It Rain — checked 2026-10-08

- USGS Water Science School, *Watersheds and Drainage Basins*: https://www.usgs.gov/water-science-school/science/watersheds-and-drainage-basins — watershed/outlet and drainage-divide concepts.
- USGS Water Science School, *Streamflow and the Water Cycle*: https://www.usgs.gov/water-science-school/science/streamflow-and-water-cycle — gravity, surface runoff, and infiltration.

The terrain, trees, cloud, contours, and learning text are original procedural content. No third-party OER graphics, elevation data, or copied educational passages are included.

Routing uses the largest downhill gradient among eight neighboring cells, accounting for diagonal distance. Every cell reaches one of two designated outlet cells on this deliberately simple surface. The overlay is computed from those same paths. Contours are extracted from the rendered surface triangles. Water speed and quantities are illustrative; there is no hydraulic/flood calculation or soil model.

## Scan the Hidden World

- USGS, *What is lidar data and where can I download it?*: https://www.usgs.gov/faqs/what-lidar-data-and-where-can-i-download-it — background on laser ranging, point clouds, vegetation/structure returns, and bare-earth products.
- USGS, *What is the difference between lidar data and a digital elevation model (DEM)?*: https://www.usgs.gov/faqs/what-difference-between-lidar-data-and-a-digital-elevation-model-dem — point-cloud and ground-elevation-product distinction used in the terrain takeaway.
- USGS, *Lidar Base Specification: Glossary*: https://www.usgs.gov/ngp-standards-and-specifications/lidar-base-specification-glossary — definitions of point classification and data voids, including obstruction.

All demo geometry is original procedural content. The sampler illustrates first-hit occlusion; it is not a physical laser or multi-return vegetation model. Synthetic class labels are assigned by object identity, not inferred from observed points. Filtering does not reconstruct unobserved ground.

## Real-room sampling

- W3C WebXR Hit Test Module: https://www.w3.org/TR/webxr-hit-test-1/ — session feature requests, controller-relative hit-test sources, optional `offsetRay` for the three-ray sweep, default plane entity type, result poses, cancellation, and possible source-count rejection.
- W3C WebXR Device API: https://www.w3.org/TR/webxr/ — immersive VR and AR are exclusive sessions; a fresh immersive request may require a new user activation after ending VR.
- Immersive Web Working Group, WebXR Gamepads Module: https://immersive-web.github.io/webxr-gamepads-module/ — the right thumbstick horizontal input is `xr-standard` axis 2.
- Meta IWSDK Environment Raycast guide: https://iwsdk.dev/guides/14-environment-raycast.html — controller-based real-surface hit testing and runtime support checks.

This prototype uses browser hit-test estimates directly, not raw depth or camera reconstruction. Actual headset support and data quality remain unverified until tested on the user's Quest 3S.

## Can You See It? — checked 2026-10-09

- USGS, *Visual Impacts*: https://www.usgs.gov/special-topics/significant-topographic-changes-in-the-united-states/science/visual-impacts — viewshed/intervisibility as a terrain-based GIS analysis, with a bounded observer radius.
- Esri, *Viewshed (Spatial Analyst)*: https://pro.arcgis.com/en/pro-app/3.5/tool-reference/spatial-analyst/viewshed.htm — raster cells visible from observer locations and the effect of input resolution.

The expanded landscape and visibility overlay use original synthetic geometry and calculations. The 2 m and 12 m observer heights are model values; no measured elevation, vegetation obstruction, or real-world visibility data are used.

## How Big Is a Pixel? — checked 2026-10-09

- USGS, *Landsat 10 — Finer Spatial Resolution*: https://www.usgs.gov/landsat-missions/landsat-10 — spatial resolution as the size of ground represented by an image pixel, and finer pixels revealing smaller features.
- USGS, *Prevalence of pure versus mixed snow cover pixels across spatial resolutions*: https://www.usgs.gov/publications/prevalence-pure-versus-mixed-snow-cover-pixels-across-spatial-resolutions-alpine — real-world example of fractional land-cover mixtures in pixels at different sizes.

The app uses original synthetic colors and known model categories, averaged over fixed square ground areas. It illustrates ground pixel size and mixing; it does not simulate a particular satellite, spectral response, image sharpness, or physical radiance measurement.

## What Changed? — checked 2026-10-15

- USGS Earthshots, [Illinois/Indiana flood](https://eros.usgs.gov/earthshots/illinoisindiana-usa): Landsat 5 path/row 22/33 on June 9, 2007 and June 11, 2008. Both source PNGs use TM bands 5/4/3 (shortwave infrared, near infrared, red) and cover the same 1000 × 873-pixel footprint. USGS describes the June 2008 flood, heavy rain, and saturated antecedent conditions.
- USGS Earthshots, [Fire and Recovery](https://eros.usgs.gov/earthshots/fire-and-recovery): Landsat 5 path/row 38/29 on September 22, 1987 and October 10, 1988. Both 1000 × 973-pixel source PNGs use the same shortwave infrared / near infrared / red composite. USGS identifies dark-red burn scars after the 1988 Yellowstone fires and shows later recovery in the longer series.
- USGS Earthshots, [Rapid Suburban Expansion](https://eros.usgs.gov/earthshots/rapid-suburban-expansion): northeastern Dallas, March 22, 1989 (Landsat 5 bands 4/3/2) and March 4, 2023 (Landsat 8 bands 5/4/3). Both are near infrared / red / green composites, at 1000 × 745 and 1000 × 744 pixels. The app normalizes the latter's one-pixel height difference on the display canvas. USGS describes expansion around Plano, Allen, and McKinney.
- USGS Earthshots, [Mount St. Helens](https://eros.usgs.gov/earthshots/mount-st-helens): September 15, 1973 (Landsat 1) and May 22, 1983 (Landsat 4), both 1000 × 817-pixel false-color source PNGs. USGS describes the gray eruption zone and red forest. The app displays the shared 580 × 500-pixel footprint around the volcano from the two saved crops, aligning unchanged terrain across the slider. Because the acquisitions use different sensors and seasons, varying snow cover and color should not be read as eruption damage.
- USGS EROS, [Joplin, Missouri—One Year Later](https://eros.usgs.gov/media-gallery/image-of-the-week/joplin-missouri-one-year-later): the downloadable Landsat 7 poster includes May 7, 2011 and June 8, 2011 natural-color views, before and 17 days after the May 22 EF5 tornado. The app extracts the matching top two image panels, crops them around southern Joplin, and resizes each to 1000 × 700 pixels. The pale band is the visible damage path; ground surveys are needed to assess specific impacts. The page's smaller second comparison image instead shows May 9, 2012; the app uses the poster's June 8, 2011 image.
- USGS, [Landsat data-use guidance](https://www.usgs.gov/faqs/are-there-any-restrictions-use-or-redistribution-landsat-data): USGS Landsat data and images may be redistributed, with a requested source credit. The app credits USGS imagery in the lesson and links these pages here.

The original six `src/change/data/*.jpg` images were transcoded directly from the Earthshots source PNGs to quality-88 JPEG with macOS `sips`; they were not redrawn or semantically altered. Original source PNG SHA-256 prefixes, in scene before/after order: flood `570c2008a686002a` / `be5fb18834721195`; fire `83f011c88532baa0` / `809874f4b130b44f`; Dallas `ad20bc265a0ef803` / `0f9cca519f36b9a3`. For Mount St. Helens, the app's quality-90 JPEGs crop source PNGs (`db4dfa378f7ede74` / `f2be10451247b509`) at pixel boxes `(210,45,810,545)` / `(230,45,830,545)`. The app displays columns 20–599 of the first saved JPEG and 0–579 of the second, so both display the same source box `(230,45,810,545)` without re-encoding the assets. For Joplin, the source poster JPEG (`d6207d869e35c7c0`) is cropped at `(220,920,2220,2320)` / `(2380,920,4380,2320)` and resized to 1000 × 700 at JPEG quality 90. The hand-drawn oval after each answer identifies one example area of visible change, not a mapped boundary. These display-rendered pixels are not calibrated reflectance or a quantitative change map. The flood and fire pairs use the same Landsat 5 sensor; the Dallas and Mount St. Helens pairs span sensors and are used for qualitative interpretation.

## Candidate demos — checked 2026-10-12

### See the Invisible

- NASA Earth Observatory, [*Measuring Vegetation*](https://science.nasa.gov/earth/earth-observatory/measuring-vegetation-ndvi-evi/) — leaves absorb visible red and reflect much near infrared; red/NIR response can distinguish vegetation conditions.
- NASA Earth Observatory, [*Why is that Forest Red and That Cloud Blue?*](https://earthobservatory.nasa.gov/features/FalseColor) — spectral signatures and assigning non-visible bands to display colors.
- USGS, [Landsat/ASTER false-color example](https://www.usgs.gov/news/science-snippet/earthview-landsat-aster-work-together-russian-wildfires) — vegetation appears red when NIR is assigned to the display's red channel.
- NASA Goddard Scientific Visualization Studio, [*Creating Landsat Images from Raw Data: San Francisco - Oakland*](https://svs.gsfc.nasa.gov/936/) — source of the aligned, unlabeled 960 × 540 natural-color Landsat 5 TM 3-2-1 and false-color 4-3-2 JPEG frames bundled in `src/showcase/data/`. NASA lists a 1997-09-27 Landsat dataset for the visualization and says the terrain is vertically exaggerated threefold. Credit: NASA/Goddard Space Flight Center Scientific Visualization Studio. [SVS usage guidance](https://svs.gsfc.nasa.gov/help/).
- NASA Earth Observatory, [*Why is that Forest Red and That Cloud Blue?*](https://science.nasa.gov/earth/earth-observatory/how-to-interpret-a-false-color-satellite-image/) — source of the matched 720 × 720 southeastern Florida / northern Everglades Landsat 5 natural-color 3-2-1 and NIR false-color 4-3-2 JPEGs. The article identifies fields, wetlands, and Miami. Credit: NASA Earth Observatory image by Matt Radcliff, using Landsat 5 data from USGS Earth Explorer.
- NASA Earth Observatory, [*Lilongwe and Landsat Grew Up Together*](https://science.nasa.gov/earth/earth-observatory/lilongwe-and-landsat-grew-up-together-144401/) — source of the matched September 26, 2018 Landsat 8 natural-color and NIR false-color 5-4-3 JPEGs. The natural-color 1440 × 1800 pan-sharpened frame is downsampled in the app to the false-color frame's 720 × 900 display dimensions. Credit: NASA Earth Observatory images by Lauren Dauphin, using Landsat data from USGS. These scenes show vegetation along streams and in city neighborhoods.

Each scene samples blue, green, and red **display brightness** from its natural-color JPEG and an approximate NIR brightness from its false-color JPEG's red display channel. Those rendered channels may have different contrast stretches and JPEG artifacts. They are not raw Landsat measurements, calibrated reflectance, or a valid quantitative spectral signature/NDVI. NIR-only is a grayscale visualization of that same approximate display channel, not a standalone source band. The Florida source includes baked-in annotations; sampling those labels reflects their white pixels rather than the underlying land cover.

### Where Did the Cluster Go?

- University of Chicago Center for Spatial Data Science, [Snow2 building deaths](https://geodacenter.github.io/data-and-lab/snow2/), [Snow3 block deaths](https://geodacenter.github.io/data-and-lab/snow3/), and [Snow6 pumps](https://geodacenter.github.io/data-and-lab/snow6/); [documentation](https://geodacenter.github.io/data-and-lab/data/snow_documentation.pdf). The locally stored building/pump coordinates and counts, plus housing-block geometry and counts, were extracted from the source ZIPs on 2026-10-12. The source describes these as Snow-map digitizations. Its documentation lists the modern digitization's license as **unknown**; attribution is provided here, but no open-license claim is made.
- Esri, [MAUP definition](https://support.esri.com/en-us/gis-dictionary/modifiable-areal-unit-problem) — scale and zoning effects. The demo's hypothetical wards group whole source blocks; the pale gaps between the block polygons depict street corridors.
- Mark Monmonier, [*How to Lie with Maps*](https://press.uchicago.edu/ucp/books/book/chicago/H/bo27400568.html), University of Chicago Press — conceptual inspiration for comparing Snow's point map with areal aggregations. No book image, wording, or boundaries were copied.

`src/showcase/data/snow.json` retains 250 buildings totaling 489 recorded deaths plus 8 pumps. It uses the British National Grid coordinate fields rather than the GeoJSON geographic geometry because the latter contains repeated point coordinates in the `snow2.zip` download. `src/showcase/data/snow-blocks.json` retains 40 Snow3 housing-block polygon shapes and their recorded death counts, also totaling 489. The polygons come from the projected shapefile. Some Snow2 building points are slightly outside Snow3 block polygons, so no point-in-polygon join is asserted; ward counts sum Snow3's recorded block counts. Source ZIP SHA-256 prefixes at extraction: `snow2` `f29fcff80dde63cd`, `snow3` `60b3ccda8bea26f7`, `snow6` `3cb386ef6ad205a3`. The six-, six-, and five-ward groupings are hypothetical teaching choices. Shading is recorded deaths **per ward (count)**; no population denominator, inferential cluster test, or causal estimate is provided.

`python3 scripts/prepare-showcase-data.py` can rebuild the compact Snow files and Natural Earth outline using Python's standard library. It checks complete SHA-256 hashes and stops for review if an upstream download changes; normal app builds do not access the network.

### Make the World Flat

- USGS, [How are different map projections used?](https://www.usgs.gov/faqs/how-are-different-map-projections-used) — no flat world map preserves shape, area, distance, and direction everywhere; Mercator inflates high-latitude areas and equal-area maps trade shape.
- USGS, [*Map Projections—A Working Manual*](https://pubs.usgs.gov/pp/1395/report.pdf), section 4 — Tissot's indicatrix represents how a tiny circle on the globe becomes a circle or ellipse on a map. The app draws larger finite circles for legibility, so these are illustrative approximations of the infinitesimal construction.
- [Natural Earth vector data](https://github.com/nvkelso/natural-earth-vector), public domain. `src/showcase/data/ne_110m_land.json` is the project's 1:110m land GeoJSON as fetched on 2026-10-12; SHA-256 prefix `9e0729ee253ca7d7`. Coordinates are rendered into an original canvas texture at runtime.

The three cylindrical projection formulas, local area-scale comparison, indicatrix axis ratios, and uniform display fit are in `src/showcase/projection-model.js`. Mercator is capped at 85° latitude for finite display; this intentional display limit is not a geographic boundary. Coastline detail comes from the 1:110m generalized source, not a high-resolution global atlas.

### Between the Rain Gauges

- Esri, [*How inverse distance weighted interpolation works*](https://pro.arcgis.com/en/pro-app/3.6/help/analysis/geostatistical-analyst/how-inverse-distance-weighted-interpolation-works.htm) — closer observations receive more weight; power 2 gives inverse-distance-squared weighting, the neighborhood can be limited, and IDW is exact at observations. The demo fixes the neighborhood at the three nearest stations and normalizes their weights to sum to one.
- Esri, [*How Spline works*](https://pro.arcgis.com/en/pro-app/3.4/tool-reference/3d-analyst/how-spline-works.htm) — a minimum-curvature spline also passes exactly through observations. The demo's deliberately non-exact broad trend is therefore labeled a Gaussian-smoothed average rather than a spline.

All 12 rainfall readings, station positions, and surfaces are generated locally from original synthetic teaching data in `src/interpolation/model.js`. The two horizontal coordinates are dimensionless model positions; rainfall values are millimeters. Display heights are exaggerated for readability. Neither the synthetic gauges nor the surfaces represent an actual storm.
