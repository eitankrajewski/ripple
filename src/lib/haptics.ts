type Kind = "pick" | "tick" | "drop" | "success" | "error";

const PATTERN: Record<Kind, number | number[]> = {
  pick: 12,
  tick: 6,
  drop: [10, 30, 16],
  success: [8, 40, 8],
  error: [30, 50, 30],
};

/**
 * Vibration where the platform allows it (Android browsers). Desktop mice/trackpads and iOS
 * Safari expose no haptics API to the web, so callers pair this with visual feedback.
 */
export function haptic(kind: Kind) {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  try {
    navigator.vibrate(PATTERN[kind]);
  } catch {
    /* unsupported */
  }
}
