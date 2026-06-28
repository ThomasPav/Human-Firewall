import type { GameData, MeterConfig, Rating, Scenario } from './types'

export const METER_KEYS = ['R', 'M', 'S', 'X'] as const
export type MeterKey = (typeof METER_KEYS)[number]
export type MeterValues = Record<MeterKey, number>

export interface GameState {
  mode: 'solo' | 'facilitator'
  phase: 'scenario' | 'outcome' | 'end'
  incident: number
  meters: MeterValues
  deck: Scenario[]
  eventUsed: boolean
}

export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

export function fmtMeter(cfg: MeterConfig, v: number): string {
  return (cfg.prefix ?? '') + v + (cfg.unit ?? '')
}

export function meterColorClass(cfg: MeterConfig, v: number): 'good' | 'warn' | 'bad' {
  if (cfg.higherIsBetter) {
    if (v <= cfg.crit) return 'bad'
    if (v <= cfg.warn) return 'warn'
    return 'good'
  } else {
    if (v >= cfg.crit) return 'bad'
    if (v >= cfg.warn) return 'warn'
    return 'good'
  }
}

export function applyDeltas(
  meters: MeterValues,
  deltas: Record<string, number>,
  meterConfigs: Record<string, MeterConfig>,
): MeterValues {
  const next = { ...meters }
  for (const k of Object.keys(deltas)) {
    if ((METER_KEYS as readonly string[]).includes(k)) {
      const mk = k as MeterKey
      next[mk] = clamp(next[mk] + deltas[k], meterConfigs[k].min, meterConfigs[k].max)
    }
  }
  return next
}

// A delta is "harmful" when it pushes a meter toward its losing side:
// for higher-is-better meters that means a drop, for Stress (lower is better)
// it means a rise. Wrong calls amplify only the harmful side of an outcome,
// so a bad decision bites harder while any silver lining stays intact.
export function amplifyHarm(
  deltas: Record<string, number>,
  meterConfigs: Record<string, MeterConfig>,
  multiplier: number,
): Record<string, number> {
  if (multiplier === 1) return deltas
  const out: Record<string, number> = {}
  for (const k of Object.keys(deltas)) {
    const v = deltas[k]
    const cfg = meterConfigs[k]
    const harmful = cfg ? (cfg.higherIsBetter ? v < 0 : v > 0) : v < 0
    out[k] = harmful ? Math.round(v * multiplier) : v
  }
  return out
}

export function crashedMeter(
  meters: MeterValues,
  meterConfigs: Record<string, MeterConfig>,
): MeterKey | null {
  for (const k of METER_KEYS) {
    const cfg = meterConfigs[k]
    const v = meters[k]
    if (cfg.higherIsBetter && v <= cfg.min) return k
    if (!cfg.higherIsBetter && v >= cfg.max) return k
  }
  return null
}

export function checkWin(
  meters: MeterValues,
  meterConfigs: Record<string, MeterConfig>,
): boolean {
  return METER_KEYS.every((k) => {
    const cfg = meterConfigs[k]
    return cfg.higherIsBetter ? meters[k] >= cfg.winLine : meters[k] <= cfg.winLine
  })
}

export function dangerZoneMeters(
  meters: MeterValues,
  meterConfigs: Record<string, MeterConfig>,
): string[] {
  return METER_KEYS.filter((k) => {
    const cfg = meterConfigs[k]
    return cfg.higherIsBetter ? meters[k] < cfg.winLine : meters[k] > cfg.winLine
  }).map((k) => meterConfigs[k].label.toLowerCase())
}

export function getRating(secValue: number, ratings: Rating[]): Rating {
  for (const r of ratings) {
    if (secValue >= r.min) return r
  }
  return ratings[ratings.length - 1]
}

export function initState(mode: 'solo' | 'facilitator', data: GameData): GameState {
  const meters = {} as MeterValues
  for (const k of METER_KEYS) {
    meters[k] = data.meters[k].start
  }
  return {
    mode,
    phase: 'scenario',
    incident: 1,
    meters,
    deck: shuffle(data.scenarios),
    eventUsed: false,
  }
}
