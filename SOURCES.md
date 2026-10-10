# Teaching and implementation references

Checked 2026-10-02. Original text and procedural diagrams; no copied OER assets.

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
- USGS, *Lidar Base Specification: Glossary*: https://www.usgs.gov/ngp-standards-and-specifications/lidar-base-specification-glossary — definitions of point classification and data voids, including obstruction.

All demo geometry is original procedural content. The sampler illustrates first-hit occlusion; it is not a physical laser or multi-return vegetation model. Synthetic class labels are assigned by object identity, not inferred from observed points. Filtering does not reconstruct unobserved ground.

## Real-room sampling

- W3C WebXR Hit Test Module: https://www.w3.org/TR/webxr-hit-test-1/ — session feature requests, controller-relative hit-test sources, default plane entity type, result poses, and cancellation.
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
