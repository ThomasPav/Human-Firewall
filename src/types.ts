export interface MeterConfig {
  key: string
  label: string
  short: string
  start: number
  min: number
  max: number
  higherIsBetter: boolean
  winLine: number
  warn: number
  crit: number
  unit?: string
  prefix?: string
  hint: string
}

export interface Decision {
  name: string
  color: string
  meaning: string
}

export interface Outcome {
  text: string
  deltas: Record<string, number>
}

export interface Scenario {
  id: number
  category: string
  categoryLabel: string
  color: string
  type: string
  title: string
  targets: string
  text: string
  legitimacy: 'malicious' | 'legitimate' | 'ambiguous'
  bestDecision: string
  outcomes: Record<string, Outcome>
  best: string
  learn: string
}

export interface Role {
  name: string
  color: string
  description: string
  targetedBy: string
  ability: string
}

/** An event's effect is one of three structured kinds (V3). */
export type EventEffect =
  | { kind: 'meter'; deltas: Record<string, number> }
  | { kind: 'amplify'; mult: number; duration: number }
  | { kind: 'reward_best'; amount: number; duration: number }

export interface GameEvent {
  title: string
  text: string
  /** Scenario category this event correlates with, or null for a global event. */
  channel: string | null
  channelLabel: string | null
  color: string
  effect: EventEffect
}

export interface Rating {
  min: number
  stars: number
  label: string
}

export interface GameData {
  meta: {
    title: string
    subtitle: string
    incidentsPerGame: number
  }
  meters: Record<string, MeterConfig>
  decisions: Decision[]
  scenarios: Scenario[]
  roles: Role[]
  events: GameEvent[]
  ratings: Rating[]
}
