# Spatial Discovery Lab — GIS Day

Quest-focused WebXR app with a simple immersive experience menu. Two playable modules: **Find Yourself Without GPS** and **Make It Rain**. Scan the Hidden World remains future work.

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

1. Read the short explanation of surface runoff and choose **Make some rain**.
2. Point at the terrain and **hold the trigger**. The cloud follows the aiming point and rain travels downhill. Releasing the trigger stops new rain; existing drops finish their paths. Try both sides of the ridge.
3. Toggle **Show basins** to color cells by their calculated outlet. Outlet A is blue and round; B is gold and square. Labels provide a cue independent of color.
4. Choose **Prediction**, then select which outlet will receive rain at the gold marker. Either answer reveals the computed path and an explanation. **Rain here again** replays it.
5. Read the takeaways or restart. The experience transitions to takeaways after four minutes of visible XR frame time.

**Reset View** places the landscape and controls in front of the current view. **Menu** switches experiences. The landscape stays upright for runoff exploration. Use the trigger to position rain on the land.

Choose **Shape terrain** during exploration for the sandbox. Point at the land, hold either controller side grip, and lift/lower the controller to raise/dig a soft patch of earth. Move sideways while lifting/lowering to shape adjacent ground. Release to end the stroke; one controller edits at a time. **Rain mode** retains the edited terrain and recalculates drainage; **Shape terrain → Restore terrain** restores the original landscape. Heights are bounded and the outer rim is anchored. Edits are temporary and cleared by Restart/Menu. Bare-hand tracking is not implemented.

After editing, blue/gold basin colors still indicate A/B; purple groups areas draining to any closed low spot (not one shared watershed). Paths stop at those sinks; there is no filling or overflow simulation. Original contour and divide lines hide after editing so they cannot describe the old landscape. Trees follow the new surface. The prediction quiz is available on the original terrain; edited landscapes lead to takeaways. Sandbox time shares the four-minute experience cap.

The 41×41 elevation grid and steepest-descent paths are computed locally. The illustration does not simulate infiltration, evaporation, ponding, erosion, rainfall intensity, flow volume, or flood risk. Trees are decoration and do not change runoff. Particle speed is illustrative; synthetic model units have no geographic scale. This is not a real watershed dataset.

For browser development review only, `?preview&demo=rain` opens the rain experience. Test buttons emit rain on either slope; pointer/trigger ray selection still needs Quest verification. Production has no desktop experience.

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
