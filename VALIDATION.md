# Prototype validation — 2026-10-02

## Passed locally

- `npm test`: 3 mathematical tests (2D ambiguity, 3D ambiguity, nested tolerance sets).
- `npm run build`: production bundle generated; approximately 125 kB gzipped JavaScript.
- `git diff --cached --check`: no whitespace errors at initial commit.
- Browser visual review: menu, circles, candidate labels, three-range reveal, uncertainty bands, 3D shells. Corrected small control labels and shell/control overlap.
- Browser interaction review through development controls using the same callbacks: both candidate branches, tolerance toggle, 3D rotation, Finish, Restart from takeaways, and Menu.
- Initial canvas pointer review: menu start, progression, candidate selection.

The in-app browser later stopped responding to test clicks without console errors; native Chrome completed the interaction review. Development controls and stage navigation are excluded from production.

## Still required on Meta Quest

Actual immersive session entry/exit, stereo rendering, left/right controller targeting, passthrough composition, recentering, seated comfort, frame rate, four-minute wrap-up, and headset sleep/resume. Automated tests and desktop scene review do not establish these results.

No hand tracking, room mesh, persistent anchoring, networked visitors, or desktop product experience is implemented.

## 2026-10-08 revision — floating model and controller manipulation

- Replaced the 3D backdrop/rotate buttons with an independent world-space assembly and side-grip movement/rotation. Two grips provide bounded, uniform scaling and rotation based on the line between controllers. A single grip also supports full wrist rotation.
- Stable shared bounds center across the three/four-beacon transition; added radius spokes as orientation cues.
- Added Reset View and a mandatory short distance-versus-direction introduction; clarified the circle and beacon explanations.
- Eight tests pass: prior geometry tests plus rigid child transforms, scale limits, grip transitions, coincident grips, and tracking-loss cancellation. Production build passes.
- Browser preview: reviewed intro and 3D layout; checked stage transition, reset, and restart.
- Still requires Quest validation: squeeze-event wiring and controller poses, real one/two-grip feel, stereo/AR layout, scale comfort, and recovery from real tracking loss. Unit tests do not simulate an actual Quest session.

## 2026-10-08 — Make It Rain

- Added a second selectable experience, a procedural landscape, rain/cloud interaction, bounded particle/trail rendering, basin overlays, a prediction/replay, takeaways, reset, and a four-minute wrap-up.
- Three new terrain tests exhaustively check all 1,681 cells: strict downhill routing, no cycles, termination at the intended two outlets, opposite-side behavior, deterministic paths, and coordinate clamping. Existing positioning/manipulation tests remain in the suite.
- Browser walkthrough: rain paths on both sides; overlay; both prediction answers; replay/takeaways; restart; return to the shared menu and launch of positioning. No browser console errors during that walkthrough.
- Quest gate: trigger aiming and hold/release, left/right controllers, cloud placement, terrain readability, runoff visibility in stereo/passthrough, reset, sleep/resume, and event timing. Browser preview and terrain tests do not establish those results.

## 2026-10-08 — Terrain sandbox

- Added side-grip terrain sculpting and Rain/Shape modes, with bounded smooth brush edits, fixed outer rim, persistent edits between modes, recalculated drainage, and exact terrain restore. Closed sinks have a separate purple destination category; they do not simulate storage or overflow.
- Fourteen tests pass, including brush falloff and limits, fixed boundaries, exhaustive edited-grid routing, controller motion through real Three.js transforms, mode switching, sink paths, restore, and timed stroke cancellation. Production build passes.
- Browser preview reviewed sculpted terrain, rain/basin display after editing, and restore. Preview uses development buttons; actual Quest squeeze events, drag comfort, tracking loss, and stereo performance still require headset testing.

## 2026-10-08 — Pond filling and overflow

- Added conservative surface-water storage on the terrain grid. Rain particles contribute arbitrary water volumes at path endpoints; fixed 20 ms steps exchange water according to surface-height differences. Excess can cross spill edges, feed downstream hollows, and leave the open rim. Cyan cell surfaces show stored water. Editing drains the water; Restore/Restart clears it too.
- Seventeen tests pass: below-spill retention, level rise, overflow, downstream hollow filling, volume conservation, nonnegative storage, equivalent frame partitions, clearing, and experience integration, alongside prior tests. Production build passes.
- Browser preview checked a sculpted pond, rainfall, and updated instructions; no console errors observed. This is an educational surface-level relaxation model, not a calibrated flood or hydraulic model. Grid shoreline appearance, stereo water visibility, and performance remain Quest acceptance checks.

## 2026-10-08 — Movable terrain

- Reused the tested ModelGrab controller transform for the complete rain scene: one grip translates/rotates; two grips uniformly resize within 0.22–0.75. UI stays separate. Shape mode retains grip sculpting. Reset View restores all rotation axes and scale while preserving terrain and water.
- Eighteen tests and production build pass. New integration coverage verifies terrain transforms leave elevations/water unchanged, full pose reset, and grip cancellation at mode changes. Shared manipulation tests cover two-hand limits, grip transitions, and tracking loss.
- Quest check remains: grabbing with either controller, text clearance after moving/resizing, transitions into sculpting, tilt comfort, tracking-loss release, and reset. No new headset validation is claimed.

## 2026-10-08 — Erosion tray within Make It Rain

- Added an alternate tilted, rough sediment bed with automatic headwater pouring, trigger-directed pouring, sediment transport/deposition, live mesh updates, reset, takeaways, and switches to/from drainage. Reuses grip transforms; does not change physical slope when rotated. Fixed rim and bounded loose layer.
- Twenty-one tests pass, including dry stability, repeatable initial terrain, bed lowering, deposition/export, water and sediment mass balance, bedrock limits, live geometry changes, reset preserving viewing pose, and timed pour shutdown. Existing pond/drainage/positioning tests remain passing.
- Browser inspection checked initial and evolved terrain, mode controls, reset, and return to drainage. Corrected the side-wall elevations for the alternate surface. No browser console errors observed. Production build passes.
- The flow and sediment rules are deliberately simplified and accelerated, not calibrated hydraulics or soil erosion. Headset rendering, channel readability, controller targeting, and performance still require Quest testing.

## 2026-10-08 — Scan the Hidden World

- Third menu experience: a controller ray-cone scanner, bounded point cloud, alternate viewpoints via shared grip transforms, comparison scene, reversible vegetation filtering, clear/restart, and four-minute takeaways. First-hit occlusion applies even while solid objects are visually hidden.
- Twenty-four tests pass, including first-surface hits, deduplication, reversible filtering with no invented points, opposite-view samples, coordinate stability after transforms, point cap, intro gate, clear/reset, and timed grip release. Production build passes.
- Browser walkthrough reviewed front/back sampling, vegetation filtering, reveal/cloud comparison, clear, takeaways, reset, and shared-menu transitions. Actual Quest trigger/squeeze input, scan speed, stereo readability, passthrough, tracking recovery, and performance remain device acceptance checks.

## 2026-10-08 — Experimental real-room scanner

- Added optional AR hit testing, controller-bound sources, real-position-only sampling with reticles, feature/permission/no-hit status, frozen miniature and exact return to capture coordinates, range/height colors, clearing, source cancellation, and reference-space reset handling. Real-room capture is disposed at session exit.
- Twenty-nine tests pass, including mocked hit-test pose ingestion gated by trigger, miniature/resume invariance, finite/range/dedup/cap guards, unavailable API, bounded permission failure/retry, late-source cancellation, and timeout cleanup. Production build passes.
- Browser preview checks only room-mode navigation and its unavailable-session explanation. No headset surface capture has been verified. Quest 3S testing is required before claiming real-room support or accuracy.

## 2026-10-08 — Shuffled synthetic scan scenes

- Added original procedural woodland ruins, ravine bridge, hillside village, and terraced lookout models. New runs consume a shuffled bag, visiting each scene once before reshuffling and preventing immediate repeats across cycles. Active scans never switch automatically; clearing points preserves the scene.
- `npm test`: all 34 tests pass. Added rotation-cycle checks and sampling/class/bounds/clear checks for each model; existing occlusion, filtering, transform, room-scan, and other demo tests still pass.
- `npm run build`: passes (existing large-bundle warning). Browser preview inspected all four point clouds and the Takeaways → Next scene transition. Desktop screenshots show layout only; Quest stereo, controller scanning, and performance of the new scenes remain headset checks.

## 2026-10-08 — Visible erosion within the exhibit time window

- User reported runoff without perceptible terrain change. Fixed erosion eligibility to use actual outgoing water flux rather than leftover depth (fast runoff can empty a cell). Increased the illustrative sediment response and loose layer to 0.24 model units; reduced initial roughness so evolving channels stand out. This remains an accelerated teaching model, not calibrated erosion.
- Added a toggleable original-bed reference grid that follows the tray pose but retains initial heights, plus stronger erosion/deposition colors. Reset hides the grid and restores terrain and water.
- All 36 tests pass, including conservation, bounded bed removal, a fast-emptying-cell regression, more than 100 downstream cells cut over 0.02 units after 10 seconds, and actual rendered terrain change via the experience update loop. Production build passes with the existing bundle-size warning.
- Browser preview checked the initial tray, 30 seconds of simulated pour, original-bed comparison, and reset; no console errors. Channels visibly cut the mesh in preview. Quest stereo readability and revised controller-button sizing remain headset checks.

## 2026-10-08 — Web app manifest and icons

- Added and linked `public/manifest.json`, standalone display preference, relative app ID/start URL/scope, regular 192/512 PNG icons, a maskable 512 PNG, favicon, and Apple touch icon. Original globe artwork and regeneration script are included.
- Production build passes with the existing chunk warning. Parsed the built manifest and verified URL resolution under `/vr-gisday/`, PNG formats/dimensions, and the built HTML manifest link. Visually inspected the 512 icon; foreground fits the maskable central safe area.
- Quest Add to Library and installed relaunch remain device acceptance checks. No offline capability or store package is claimed.

## 2026-10-08 — Sound effects

- Added original synthesized UI tones, scan-return pings, and water noise, plus persistent mute in shared navigation. Master gain fades when the document/session is hidden or XR ends; scan pings are capped to one per 140 ms; water fades after the last delivery. No audio asset downloads.
- All 37 tests pass, including audio lazy initialization, cue throttling, mute, and visibility behavior with a mocked audio graph. Production build passes (existing chunk warning). Browser preview verifies mute persistence across reload, navigation, and pouring without console errors. Audibility, volume balance, and headset session interruption remain Quest listening checks; mock tests do not validate sound quality.

## 2026-10-08 — Sculptable, finer erosion tray

- Erosion uses a 65×65 bed and water grid (drainage remains 41×41). Shared-vertex water triangles replace erosion water tiles. Geometry updates at 10 Hz; simulation remains fixed at 50 Hz. Wet over-steep banks redistribute earth conservatively to reduce sharp cuts; dry land stays stable.
- Shape terrain uses the existing grip sculpt interaction. Editing stops pouring and clears water/suspended sediment. Returning to pour mode rebases sediment limits and the reference grid to the edited bed. Reset restores the original factory tray. Erosion avoids computing unused drainage routes on every edit.
- All 39 tests pass, including higher-resolution water/earth conservation, bounded erosion, sculpt-to-pour continuity, reference-grid rebase, dry water-surface removal, and reset. Production build passes with the existing chunk warning.
- Browser preview reviewed sculpting a hollow/ridge, pouring over the edited terrain, smoother channels, and reference controls without console errors. A 600-step local Node sample measured ~2.3 ms median / ~2.6 ms p95 per 65-grid simulation step on this computer; this excludes rendering and is not a Quest frame-rate measurement. Quest controller feel, stereo water visibility, and sustained frame rate remain device checks.

## 2026-10-08 — Simultaneous rain and sculpting

- Both exploration simulations now accept trigger watering and side-grip sculpting concurrently. Removed user-facing mode switches and start/stop pour buttons. Water and sediment remain during manual edits; erosion reference heights shift by the manual edit rather than restarting the experiment.
- Blue handles separate model move/rotate/resize from gripping the land to sculpt. Active model grabs block sculpting and new rain. Newly emitted drainage paths use current heights; basin colors refresh on stroke release.
- All 41 tests pass, including simultaneous water input during active strokes in both simulations, retained water, and model-grab exclusion. Production build passes with the existing chunk warning. Browser review verified simplified controls, editing/raining without a switch, and handles without console errors. Physical Quest grip targeting and simultaneous two-controller use remain device checks.

## 2026-10-08 — Handed triggers and restored grip manipulation

- Both rain simulations now use left trigger for water and right trigger for sculpting; either trigger still selects UI buttons. Roles follow WebXR input-source handedness, including reversed controller connection order. Right-trigger release ends the sculpt stroke.
- Removed blue move handles. Either side grip can grab the terrain by pointing at it or reaching near it; a second grip joins to resize. Starting a model grab ends sculpting and cancels held rain input, preventing competing transformations.
- All 43 tests pass, including hand-role mapping for both controller orders in both simulations, unknown/untracked hand handling, stroke release isolation, and grab exclusion. Production build passes with the existing chunk warning. Browser preview confirms updated instructions and handle removal without console errors. Physical Quest hand mapping, simultaneous triggers, and grip transitions remain headset checks.

## 2026-10-08 — Stand Inside the Layers

- Added a fourth Quest experience with five independent checkbox layers over one synthetic 30-by-30-unit landscape: relief, trees, a river and feeder stream, crossing roads, and a district population choropleth. Both flat and raised versions align the other layers when topography changes. A central standing area remains flat. Population classes and place geometry are fictional teaching data.
- The panel explains each selected layer and keeps the population color thresholds visible while that layer is checked. A four-minute visible-session timer leads to a short interpretation takeaway and reset.
- `npm test`: 44 tests pass, including empty starting state, arbitrary combination order, topography alignment, density categories, time limit, and reset. Production build passes with the existing large-bundle warning. Browser preview inspected empty and fully layered scenes, mixed toggle order, and button states with no console errors. Quest stereo, comfort, legibility, and controller interaction remain device checks.

## 2026-10-08 — Left-hand layer clipboard

- Moved the fourth demo's five layer toggles, explanation, legend, and navigation from the shared front panel to a small clipboard that tracks the left controller and faces the viewer. It hides if that controller is not tracked. The other demos retain their existing panels. A stationary left-side version supports development preview.
- `npm test`: 44 tests pass, including clipboard placement, facing direction, and tracking loss. Production build passes with the existing large-bundle warning. In browser preview, I selected each checkbox directly on the 3D clipboard and verified that all five layers appeared, with no console errors. Handheld placement, text legibility, and right-controller ray selection still require Quest validation.

## 2026-10-08 — Expanded landscape and synchronized map

- Expanded the fourth demo's main terrain from 30×30 to 220×220 model units at 320×320 grid resolution, with a distant terrain ring and sky-matched fog in VR. Instanced vegetation has more than 1,600 trees; the highway has four lanes, markings, bridge supports, and rails. The river is a surface ribbon inside a carved channel, with a strictly descending water elevation.
- Added a Map tab to the left-hand clipboard. The overhead map and landscape use the same terrain, tree positions, river course, highway alignment, and district classes. Both tabs can toggle layers. The district overlay is subtler in the landscape, while the map displays its boundaries and colors. All geography and population values remain synthetic.
- `npm test`: 45 tests pass, including river-channel coverage, strictly downhill water elevation, bridge clearance, and restoration of the previous sky/fog. Production build passes with the existing large-bundle warning. Browser preview verified the river beneath the bridge, visibility of the water after correcting the shoreline cross-section, five-layer rendering, and a checkbox selection directly on the map page. Quest frame rate, stereo detail, and headset readability remain device checks.

## 2026-10-09 — Shared larger landscape and Can You See It?

- Both the Layers and Viewshed experiences use the same expanded procedural landscape: 320×320 model units, a 400×400 terrain mesh concentrated near the visitor, extra outer ridges, more instanced trees, and an extended terrain ring/fog range. The river, highway, forest, and overhead map continue to derive from the same coordinates.
- Added the fifth Quest menu experience. A terrain-only 257×257 sampled elevation grid supplies 129×129 viewshed cells within 115 model units. An observer marker moves by ground ray or clipboard-map selection; 2-unit eye level and 12-unit tower controls recompute the green-visible/purple-hidden result. The four-minute takeaway states that trees and structures are not modeled as blockers.
- `npm test`: 48 tests pass, including ridge occlusion, higher-observer comparison, DEM interpolation, map and terrain marker placement, timed wrap-up, reset, and disposal. `npm run build` passes with the existing large-bundle warning. Browser preview confirmed the five-demo menu, both clipboard tabs, map placement, tower change, terrain placement, and return to the updated Layers world with no console errors. This does not establish Quest controller targeting, left-hand text legibility, stereo contrast, or sustained headset frame rate.
