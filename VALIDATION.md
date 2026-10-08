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
