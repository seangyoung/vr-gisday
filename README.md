# Spatial Discovery Lab — GIS Day

Quest-focused WebXR app with a simple immersive experience menu. First module: **Find Yourself Without GPS**. Other experiences are labeled as future work.

## Run

Node 22 recommended.

```sh
npm ci
npm run dev
npm test
npm run build
```

Production: serve `dist/` over HTTPS. Quest cannot use ordinary HTTP from a laptop's LAN address for immersive WebXR. GitHub Pages supplies HTTPS. There are no runtime API keys or external asset requests. Dependencies are bundled by Vite.

A development-only `http://localhost:5173/?preview` view supports mouse selection of the same scene buttons for layout review. Optional `&stage=0` through `&stage=6` selects a stage for visual inspection; the small development toolbar calls the same actions as XR controls. It is removed from production builds; there is no desktop experience or walking mechanic.

## Experience

Enter VR or passthrough from Quest Browser, then use a controller ray and trigger to choose the experience. Both controllers work. The presentation is placed relative to the initial viewing direction and eye height, supporting seated or standing use. Recenter places it in front of the current view. No room scan, persistent anchor, physical-table placement, or hand tracking is required or implemented.

1. One range defines a circle of possible model positions.
2. Two circles intersect at two selectable predictions.
3. A third range identifies one candidate; feedback explains either choice.
4. Toggle range tolerance; white dots satisfy all three bands.
5. In 3D, three coplanar beacons admit two points. Rotate the model.
6. A fourth, noncoplanar beacon resolves this example. Finish with takeaways.

The guided portion transitions to takeaways after 240 seconds of visible XR frame time. It can be completed sooner; paused/hidden sessions do not consume that time. Restart begins a new run. Menu, Restart, Recenter, and Exit XR remain available throughout.

This is a scaled positioning model, **not a measurement of the visitor's real location**, a GPS implementation, or a probability model. Coordinates and tolerances use arbitrary model units. Headset tracking only places and views the content. The 3D example assumes exact ranges; GPS pseudoranges also require estimating receiver clock error. See SOURCES.md.

## GitHub Pages

Prepared workflow: `.github/workflows/deploy.yml` tests and builds on pushes to `main`, then deploys `dist/` using GitHub Actions. Relative Vite asset paths support a project subdirectory.

1. Create an empty repository under the intended GitHub account (suggested name: `vr-gisday`).
2. Push this project's files to `main`.
3. Repository Settings → Pages → Build and deployment → Source: **GitHub Actions**.
4. Run/re-run the Deploy GIS Day to Pages workflow if necessary.
5. Open the HTTPS URL from its successful deployment in Quest Browser.

Repository: https://github.com/seangyoung/vr-gisday. GitHub Pages is configured to deploy using GitHub Actions. Site: https://seangyoung.github.io/vr-gisday/.

## Validation and headset acceptance

Automated geometry tests check planar and 3D ambiguity and uncertainty-set inclusion. Production build and browser scene inspection are separate from device validation. Before public use, test on the actual Quest:

- VR and passthrough enter and exit successfully; cancellation can be retried.
- Left/right controller rays select menu buttons and both candidate points.
- All text is readable and geometry remains stable in stereo.
- Seated entry and Recenter place content comfortably.
- Uncertainty toggle and 3D rotations work; no clipping when inspecting shells.
- Menu and Restart work from every stage and takeaways.
- Four-minute wrap-up, headset sleep/resume, and fresh-session reset work.
- Repeat several visitors and check comfort and frame rate.

## Assets

All diagrams and scene assets are generated in code. No Blender models or third-party educational illustrations are included. Three.js is MIT licensed; its license is included in THIRD_PARTY_NOTICES.md. Licensing of original project content has not yet been selected by the owner.
