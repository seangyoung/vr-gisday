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
