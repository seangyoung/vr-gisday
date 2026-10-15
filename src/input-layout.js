// Face-button indices 4/5 are only used when the browser and both input
// profiles identify the Quest-style controllers the app was designed for.
// Unknown, single-controller, or hand-tracking sessions keep visible actions.
const QUEST_BROWSER = /OculusBrowser|MetaQuestBrowser/i;
const QUEST_CONTROLLER = /^(?:meta-quest-touch(?:-plus(?:-v2)?|-pro)?|oculus-touch-v[23])$/;

export function hasQuestShortcuts(userAgent, sources) {
  if (!QUEST_BROWSER.test(userAgent ?? "")) return false;
  const inputSources = Array.from(sources ?? []);
  return ["left", "right"].every((hand) => {
    const source = inputSources.find((input) =>
      input?.handedness === hand && input?.gamepad?.mapping === "xr-standard" &&
      input?.profiles?.some((profile) => QUEST_CONTROLLER.test(profile)));
    return !!source?.gamepad?.buttons?.[4] && !!source?.gamepad?.buttons?.[5];
  });
}
