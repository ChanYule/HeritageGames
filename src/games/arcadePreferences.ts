export const arcadeMuteKey = "heritage-games-arcade-muted";
// Respect the established SKY mute preference when first opening another arcade game.
export function readArcadeMute() {
  try {
    const shared = localStorage.getItem(arcadeMuteKey);
    if (shared === "true" || shared === "false") return shared === "true";
    return JSON.parse(localStorage.getItem("sky1942_settings_v1") ?? "null")?.muted === true;
  } catch { return false; }
}
export function writeArcadeMute(muted: boolean) { try { localStorage.setItem(arcadeMuteKey, String(muted)); } catch { /* Session-only audio remains usable. */ } }
