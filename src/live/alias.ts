// Anonymous identity for Live Compete: a random fun alias plus an opaque id, kept in
// localStorage per session code so a refresh/reconnect keeps the same player and score.
// No names, emails, or PII anywhere.

const ADJECTIVES = [
  'Teal', 'Amber', 'Brave', 'Swift', 'Calm', 'Clever', 'Bold', 'Mellow',
  'Lucky', 'Cosmic', 'Quiet', 'Sunny', 'Nimble', 'Jolly', 'Royal', 'Witty',
  'Crimson', 'Silver', 'Hazel', 'Plucky',
]
const ANIMALS = [
  'Otter', 'Falcon', 'Lynx', 'Heron', 'Badger', 'Fox', 'Panda', 'Koala',
  'Wolf', 'Raven', 'Tiger', 'Moth', 'Gecko', 'Bison', 'Crane', 'Seal',
  'Hare', 'Owl', 'Marten', 'Stork',
]

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function randomAlias(): string {
  return `${pick(ADJECTIVES)} ${pick(ANIMALS)}`
}

export interface Identity {
  playerId: string
  alias: string
}

const keyFor = (code: string) => `hf_live_${code.toUpperCase()}`

export function loadIdentity(code: string): Identity | null {
  try {
    const raw = localStorage.getItem(keyFor(code))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Identity
    if (parsed && parsed.playerId && parsed.alias) return parsed
  } catch {
    // ignore malformed/blocked storage
  }
  return null
}

export function saveIdentity(code: string, id: Identity): void {
  try {
    localStorage.setItem(keyFor(code), JSON.stringify(id))
  } catch {
    // storage unavailable — identity just won't persist across refresh
  }
}

/** A fresh ephemeral identity (not yet persisted). */
export function newIdentity(): Identity {
  const playerId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`
  return { playerId, alias: randomAlias() }
}
