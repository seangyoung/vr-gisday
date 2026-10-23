// Some exhibits are panels, while others are free-floating 3D models. Keep
// controller hover hit testing limited to surfaces an exhibit actually owns.
export function exhibitPanelHit(raycaster, exhibit) {
  if (!exhibit?.started || exhibit.finished) return null;
  if (exhibit.kind === "spectral" && exhibit.phase === "platforms") {
    exhibit.platformGroup.updateWorldMatrix(true, true);
    return raycaster.intersectObjects(exhibit.platformHits, false)[0] ?? null;
  }
  if (exhibit.kind === "spectral" && exhibit.phase !== "bands") return null;
  const targets = exhibit.kind === "projection"
    ? [exhibit.globe, exhibit.map]
    : [exhibit.image ?? exhibit.map];
  const available = targets.filter(Boolean);
  return available.length
    ? raycaster.intersectObjects(available, false)[0] ?? null
    : null;
}
