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
  /** Every decision that counts as a correct (non-penalised) answer, best first. */
  acceptableDecisions?: string[]
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

export interface GameEvent {
  title: string
  text: string
  effect: Record<string, number> | null
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
    wrongAnswerPenalty: number
  }
  meters: Record<string, MeterConfig>
  decisions: Decision[]
  scenarios: Scenario[]
  roles: Role[]
  events: GameEvent[]
  ratings: Rating[]
}
