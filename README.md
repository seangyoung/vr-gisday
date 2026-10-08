# Spatial Discovery Lab — GIS Day

Quest-focused WebXR app with a simple immersive experience menu. Three playable modules: **Find Yourself Without GPS**, **Make It Rain**, and **Scan the Hidden World**.

## Run

Node 22 recommended.

```sh
npm ci
npm run dev
npm test
npm run build
```

Production: serve `dist/` over HTTPS. Quest cannot use ordinary HTTP from a laptop's LAN address for immersive WebXR. GitHub Pages supplies HTTPS. There are no runtime API keys or external asset requests. Dependencies are bundled by Vite.

A development-only `http://localhost:5173/?preview` view supports mouse selection of the same scene buttons for layout review. Optional `&stage=-2` (introduction), `&stage=-1` (menu), or `&stage=0` through `&stage=6` selects a stage for visual inspection; the small development toolbar calls the same actions as XR controls. It is removed from production builds; there is no desktop experience or walking mechanic.

## Find Yourself Without GPS

Enter VR or passthrough from Quest Browser, then use a controller ray and trigger to choose the experience. Both controllers work. The presentation is placed relative to the initial viewing direction and eye height, supporting seated or standing use. Recenter places it in front of the current view. No room scan, persistent anchor, physical-table placement, or hand tracking is required or implemented.

0. A short introduction establishes a known beacon location and a distance measurement without direction.
1. One range defines a circle of possible model positions.
2. Two circles intersect at two selectable predictions.
3. A third range identifies one candidate; feedback explains either choice.
4. Toggle range tolerance; white dots satisfy all three bands.
5. In 3D, three coplanar beacons admit two points. The model floats independently of the text and controls. Point at it or reach nearby and hold a controller side grip to move/rotate the entire assembly. Add the other grip and spread/squeeze to resize uniformly (scale 0.28–0.85; default 0.35). Release to leave it in place.
6. A fourth, noncoplanar beacon resolves this example, preserving your model position, rotation, and scale. Finish with takeaways.

The guided portion transitions to takeaways after 240 seconds of visible XR frame time. It can be completed sooner; paused/hidden sessions do not consume that time. Restart begins a new run. Menu, Restart, and Exit XR remain available throughout. In 3D, Reset View replaces Recenter and restores the default model pose and controls in front of the viewer. The assembly has a shared center; individual beacons cannot be moved independently because that would invalidate the measured-distance relationships. Tracking loss, hidden sessions, reset, or stage changes release active grips.

This is a scaled positioning model, **not a measurement of the visitor's real location**, a GPS implementation, or a probability model. Coordinates and tolerances use arbitrary model units. Headset tracking only places and views the content. The 3D example assumes exact ranges; GPS pseudoranges also require estimating receiver clock error. See SOURCES.md.

## Make It Rain

Choose **Make It Rain** inside the headset. This second experience is a floating synthetic landscape with two outlets, a drainage divide, contour lines, and a movable rain cloud.

1. Read the short explanation of surface runoff and choose **Drainage sandbox**.
2. Point at the terrain and **hold the trigger**. The cloud follows the aiming point and rain travels downhill. Releasing the trigger stops new rain; existing drops finish their paths. Try both sides of the ridge.
3. Toggle **Show basins** to color cells by their calculated outlet. Outlet A is blue and round; B is gold and square. Labels provide a cue independent of color.
4. Choose **Prediction**, then select which outlet will receive rain at the gold marker. Either answer reveals the computed path and an explanation. **Rain here again** replays it.
5. Read the takeaways or restart. The experience transitions to takeaways after four minutes of visible XR frame time.

During exploration, **hold the trigger on land to add water** and **hold a side grip on land to sculpt**. Lift/lower to raise/dig; move sideways to shape adjacent ground. These work together without a mode switch, and editing preserves water and suspended sediment. One controller sculpts at a time. Release the grip to refresh basin colors; new rain paths use the current terrain even during a stroke. **Reset terrain** restores the drainage landscape; **Reset tray** restores erosion. Edits are temporary and cleared by Restart/Menu. Heights are bounded and the rim anchored. Bare-hand tracking is not implemented.

To move the entire model, point at either **blue handle** beside the tray and hold a side grip. Add the other grip to resize (scale 0.22–0.75). Gripping land sculpts instead. **Reset View** restores pose and size without changing the experiment. Moving the model pauses new water input. Rotation changes the viewing angle, not simulated gravity. Hidden sessions, disconnects, and lost tracking release grabs/strokes.

After editing, blue/gold basin colors still indicate A/B; purple groups areas draining to any closed low spot (not one shared watershed). Rain particles deliver a fixed illustrative volume to their path endpoint. A conservative grid water model stores water in hollows, raises the surface, and transfers excess across the lowest wet spill edge into neighboring terrain. Cyan tiles show the water surface; purple marks the original dry-terrain pond catchments, not eventual overflow destinations. Water leaves at the open outer rim. Original contour and divide lines hide after editing so they cannot describe the old landscape. Trees follow the new surface. The prediction quiz is available on the original terrain; edited landscapes lead to takeaways. Sandbox time shares the four-minute experience cap.

The 41×41 elevation grid and steepest-descent paths are computed locally. The illustration uses arbitrary water volumes and a fixed-step surface-level relaxation model, not calibrated hydraulics. It does not simulate infiltration, evaporation, erosion, real rainfall intensity, momentum, or flood risk. Trees are decoration and do not change runoff. Pond surfaces use grid cells and may look stepped along shorelines. Particle speed is illustrative; synthetic model units have no geographic scale. This is not a real watershed dataset.

For browser development review only, `?preview&demo=rain` opens the rain experience. Test buttons emit rain on either slope; pointer/trigger ray selection still needs Quest verification. Production has no desktop experience.


### Erosion tray (inside Make It Rain)

Choose **Erosion tray** from the Make It Rain introduction or drainage controls. A tilted, slightly rough, loose-sediment bed replaces the drainage landscape. Hold the trigger over any chosen part of the bed to pour; release to stop adding water. Existing water keeps flowing. There are no start/stop pour controls. Flow cuts darker grooves, carries sediment, and can deposit lighter material downstream. Brown-tinted water indicates suspended sediment. **Reset tray** restores the original bed and clears water; it preserves the viewing pose. Choose **Drainage** to return to the other simulation. Switching experiments starts a fresh run, and each retains the four-minute wrap-up.

**Original bed** overlays a white reference grid at the starting surface; it stays fixed while the actual terrain cuts down underneath. Darker grooves mark erosion and pale patches mark deposits. The loose-sand response is deliberately accelerated so channels become visible within about 10 seconds of sustained pouring. **Reset tray** restores the bed and hides the reference grid.

Side-grip sculpting works while water flows. Manual edits shift the erosion reference by the amount moved, preserving previous erosion relative to that reference; they do not clear water or sediment or restart the experiment. The white grid follows these manual changes. **Reset tray** restores the factory landscape.

The erosion bed and water solver use a **65×65 grid** (4,225 samples; drainage remains 41×41). A joined triangular water surface replaces flat water tiles. Terrain/water geometry refreshes at 10 Hz; the conservative simulation uses 50 fixed steps per second. A simple wet-bank slump transfers material from over-steep banks into adjacent cells, softening needle-like cuts while conserving earth. Shorelines are approximate at cell scale.

Grip the blue handles to move/rotate the tray; both grips resize. Rotation changes the viewing pose, not the fixed physical slope. This experiment does not include soil selection, roots, rainfall calibration, or realistic time/length units. The erosion experiment routes each cell toward its steepest neighboring water-surface drop to emphasize rivulets; the pond experiment retains its multi-neighbor spreading rule. Sediment capacity is a heuristic based on local flux and slope; erosion is accelerated, limited to a 0.24-model-unit loose layer, and the rim stays fixed. Sediment transfers use the water transfers and can leave the open rim. Channels are computed from evolving heights, not prerecorded lines. Water and sediment conservation are tested; this is not a predictive erosion model.

## Scan the Hidden World

Choose the third experience in the shared menu, then **Start scanning**. Hold the trigger and sweep a controller through the outlined miniature scene to collect a point cloud. One side grip moves/rotates the model; both grips resize it (0.22–0.75, default 0.43). Rotate and scan another side to observe formerly blocked surfaces. **Reset View** restores the pose without discarding points.

Four original procedural scenes rotate in shuffled order: **Woodland ruins**, **Ravine bridge**, **Hillside village**, and **Terraced lookout**. Starting or restarting the synthetic experience draws the next scene, with every scene appearing once per cycle and no immediate repeats across cycles. **Next scene** at the takeaways begins another run. Rotation is per app session; scenes never change during an active scan. **Clear scan** keeps the current scene. Real-room scanning is independent.

**Reveal scene** shows the synthetic ground, structures, and trees for comparison; **Cloud only** hides their solid surfaces again. **Hide plants** filters vegetation points, with **All points** restoring them. Filtering never changes what blocks a scan ray and never invents returns from unseen ground. **Clear scan** discards observations; **Takeaways** explains viewpoints, gaps, and classification. Each run wraps up after four minutes of visible session time.

This is a controller-driven illustration of first-surface range sampling. It does not use Quest room meshes, depth sensors, cameras, real lidar, multiple returns, or automated classification. Color/class labels come from known synthetic objects. Each sweep fires a small cone of rays; only the nearest hit is recorded. Samples are deduplicated in model coordinates and capped at 18,000. No scan leaves the device or persists after restart. Modeled scene positions and classifications are exact; real scanning also has measurement and positioning errors. See SOURCES.md for USGS background.

Development-only `?preview&demo=scan` provides front/back sampling actions through the same nearest-hit routine for repeatable visual review. Add `&scene=ruins`, `bridge`, `village`, or `terraces` to inspect a particular model. These controls are excluded from production; real controller sweeping still needs headset verification.

### Scan your room (experimental Quest 3S path)

Choose **Enter mixed reality → Scan the Hidden World → Scan your room → Start room scan**. Allow the browser's spatial permission if requested. Aim a controller at nearby physical surfaces; a green dot indicates an actual WebXR hit-test return. Hold the trigger and sweep slowly to accumulate a sparse point cloud. This path requests the WebXR `hit-test` feature and default plane-type surface estimates. It does not claim access to raw live depth, a global mesh, photogrammetry, camera images, or semantic classification; the runtime determines which surfaces are represented and whether its data is reconstructed or updated live.

**Freeze** centers and scales a copy of the recorded points in front of you. Use one/two side grips to move/rotate/resize it. **Resume** restores the original recorded room coordinates. **Color** switches relative-height versus capture-range coloring. **Clear** discards points; **Retry** retries source creation when surface access fails or no hits arrive. Room registration is preserved during Reset View while live; only the controls move. Reset View restores the miniature when frozen.

No synthetic positions are substituted for missing real data. Unsupported API, rejected permission, and no-hit states are shown explicitly. Each tracked controller uses one persistent hit-test source; samples are deduplicated at 1.5 cm, restricted to 0.2–8 m range, and capped at 18,000. These limits are application choices, not sensor accuracy claims. Captures stay in memory and clear on restart, session exit, or reference-space reset. Four-minute wrap-up freezes the cloud if it contains points. Keep passthrough visible; do not treat the cloud as a complete obstacle map.

Device acceptance is still required on Quest 3S: API availability, actual surface-return quality, permissions, registration stability, tracking recovery, and useful point density. Desktop checks use mocked API results and cannot establish those properties.

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
- Uncertainty toggle works. One grip translates/rotates all shells together; two grips resize within limits. Check no jumps when adding/releasing the second grip, Reset View after moving the model away, and grip release on tracking loss/sleep.
- Menu and Restart work from every stage and takeaways.
- Four-minute wrap-up, headset sleep/resume, and fresh-session reset work.
- Repeat several visitors and check comfort and frame rate.

## Assets

All diagrams and scene assets are generated in code. No Blender models or third-party educational illustrations are included. Three.js is MIT licensed; its license is included in THIRD_PARTY_NOTICES.md. Licensing of original project content has not yet been selected by the owner.

## Web app installation metadata

The linked `public/manifest.json` supplies the app name, standalone display preference, theme, and 192/512-pixel PNG icons, including a maskable icon. Its ID, start URL, and scope resolve relative to the manifest, keeping this installation inside `/vr-gisday/` on GitHub Pages. The landing page also links a favicon and Apple touch icon. Original icon artwork can be regenerated with `python3 scripts/generate-icons.py` (Pillow required).

In Quest Browser, open the published site and use its web-app installation / Add to Library option if offered. Launching the saved app opens the existing VR/mixed-reality entry screen. Library installation and relaunch must be verified on the headset; providing a manifest does not itself confirm successful installation. This change adds no offline cache or service worker, so loading the app requires connectivity. Store packaging is a separate workflow. References: [Meta WebXR PWA manifest guidance](https://developers.meta.com/vr/documentation/web/pwa-webxr-gs/) and [MDN installability](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable).

## Sound effects

Original Web Audio synthesis provides soft UI tones, rate-limited pings for newly collected scan points (including room scans), and filtered water noise during rain/pouring, fading shortly after the last water delivery. No sound files or external audio services are loaded. **Sound: on/off** in the shared navigation mutes all effects and remembers the preference locally when browser storage is available. Audio initializes on user interaction, fades out when the page/XR session is hidden, and remains optional if audio is unavailable. Quest loudness and comfort require headset listening. Implementation follows [MDN Web Audio best practices](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices).
