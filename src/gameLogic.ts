import type { GameData, MeterConfig, Rating, Scenario } from './types'

export const METER_KEYS = ['R', 'M', 'S', 'X'] as const
export type MeterKey = (typeof METER_KEYS)[number]
export type MeterValues = Record<MeterKey, number>

/** Active "amplify" event modifier: ×mult on wrong answers of a channel. */
export interface ActiveMod {
  channel: string | null
  channelLabel: string | null
  color: string
  label: string
  mult: number
  until: number
}

/** Active "reward_best" event modifier: +amount Security on correct answers. */
export interface ActiveReward {
  amount: number
  label: string
  until: number
}

export interface GameState {
  mode: 'solo' | 'facilitator'
  phase: 'scenario' | 'outcome' | 'end'
  incident: number
  meters: MeterValues
  deck: Scenario[]
  eventUsed: boolean
  activeMod: ActiveMod | null
  activeReward: ActiveReward | null
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

// Multiply only the harmful side of an outcome by `mult` (used by an active
// "amplify" event). Harm = a drop on higher-is-better meters, a rise on Stress.
export function amplify(
  deltas: Record<string, number>,
  mult: number,
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const k of Object.keys(deltas)) {
    const v = deltas[k]
    const bad = k !== 'X' ? v < 0 : v > 0
    out[k] = bad ? v * mult : v
  }
  return out
}

/** A modifier is in effect while the current incident is at or before its `until`. */
export function modActive(
  mod: ActiveMod | ActiveReward | null,
  incident: number,
): boolean {
  return !!mod && incident <= mod.until
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

// Draw a balanced round: guarantee one of every bestDecision, then fill the
// rest up to a per-decision cap (round-size ÷ 4) so no single answer dominates.
export function buildDeck(scenarios: Scenario[], roundSize: number): Scenario[] {
  const size = Math.min(roundSize, scenarios.length)
  const cap = Math.max(3, Math.round(size / 4))

  const byBest: Record<string, Scenario[]> = {}
  for (const s of scenarios) {
    ;(byBest[s.bestDecision] ||= []).push(s)
  }

  const pick: Scenario[] = []
  const used = new Set<number>()
  const count: Record<string, number> = {}

  // one of each best-decision first (guarantees every card type gets used)
  for (const b of shuffle(Object.keys(byBest))) {
    if (pick.length >= size) break
    const s = shuffle(byBest[b]).find((x) => !used.has(x.id))
    if (s) {
      pick.push(s)
      used.add(s.id)
      count[b] = (count[b] || 0) + 1
    }
  }
  // fill the rest, respecting the per-decision cap
  for (const s of shuffle(scenarios.filter((x) => !used.has(x.id)))) {
    if (pick.length >= size) break
    if ((count[s.bestDecision] || 0) < cap) {
      pick.push(s)
      used.add(s.id)
      count[s.bestDecision] = (count[s.bestDecision] || 0) + 1
    }
  }
  // last resort if caps left us short
  for (const s of shuffle(scenarios.filter((x) => !used.has(x.id)))) {
    if (pick.length >= size) break
    pick.push(s)
    used.add(s.id)
  }
  return shuffle(pick)
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
    deck: buildDeck(data.scenarios, data.meta.incidentsPerGame),
    eventUsed: false,
    activeMod: null,
    activeReward: null,
  }
}
