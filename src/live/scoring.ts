// Per-incident scoring for Live Compete. A correct pick (matching the scenario's
// bestDecision) earns a base plus a speed bonus that decays over WINDOW_MS; a wrong
// pick scores 0. Pure and deterministic so it's easy to test and reason about.

export const BASE = 1000
export const SPEED_MAX = 1000
export const WINDOW_MS = 30_000

export function scorePoints(correct: boolean, elapsedMs: number): number {
  if (!correct) return 0
  const t = Math.max(0, Math.min(1, elapsedMs / WINDOW_MS))
  return BASE + Math.round(SPEED_MAX * (1 - t))
}
