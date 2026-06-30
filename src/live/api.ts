import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'
import type { Player, Session, SessionStatus, Vote } from './types'

// Thin helpers over Supabase for Live Compete. The host owns session status
// transitions; each player only inserts their own vote and writes their own score
// row (single writer per row, so absolute writes are race-free).

function db() {
  if (!supabase) throw new Error('Live Compete is not configured (missing Supabase env).')
  return supabase
}

// Unambiguous code alphabet (no 0/O/1/I/L).
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
function makeCode(len = 5): string {
  let out = ''
  for (let i = 0; i < len; i++) out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
  return out
}

/** Create a lobby session with a unique join code; retries on code collision. */
export async function createSession(deck: number[]): Promise<Session> {
  const sb = db()
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = makeCode(attempt < 4 ? 5 : 6)
    const { data, error } = await sb
      .from('sessions')
      .insert({ code, deck, status: 'lobby', current_incident: 0 })
      .select()
      .single()
    if (!error && data) return data as Session
    // 23505 = unique_violation → try another code
    if (error && error.code !== '23505') throw error
  }
  throw new Error('Could not allocate a unique join code, please try again.')
}

/** Look up a session by its join code (codes are stored uppercase). */
export async function joinSession(code: string): Promise<Session | null> {
  const { data, error } = await db()
    .from('sessions')
    .select()
    .eq('code', code.toUpperCase())
    .maybeSingle()
  if (error) throw error
  return (data as Session) ?? null
}

/** Insert/reuse this player's row (id is client-owned so reconnect keeps the score). */
export async function upsertPlayer(
  sessionId: string,
  playerId: string,
  alias: string,
): Promise<Player> {
  const sb = db()
  await sb
    .from('players')
    .upsert(
      { id: playerId, session_id: sessionId, alias },
      { onConflict: 'id', ignoreDuplicates: true },
    )
  const { data, error } = await sb.from('players').select().eq('id', playerId).single()
  if (error) throw error
  return data as Player
}

/** Record this player's vote for an incident (idempotent via the unique constraint). */
export async function castVote(
  sessionId: string,
  incident: number,
  playerId: string,
  decision: string,
): Promise<void> {
  const { error } = await db()
    .from('votes')
    .upsert(
      { session_id: sessionId, incident, player_id: playerId, decision },
      { onConflict: 'session_id,incident,player_id', ignoreDuplicates: true },
    )
  if (error) throw error
}

/** Absolute write of this player's running totals (single writer = no race). */
export async function recordScore(playerId: string, score: number, totalMs: number): Promise<void> {
  const { error } = await db().from('players').update({ score, total_ms: totalMs }).eq('id', playerId)
  if (error) throw error
}

export async function updateSession(
  sessionId: string,
  patch: Partial<Pick<Session, 'status' | 'current_incident'>>,
): Promise<void> {
  const { error } = await db().from('sessions').update(patch).eq('id', sessionId)
  if (error) throw error
}

export const startGame = (sessionId: string) =>
  updateSession(sessionId, { status: 'playing', current_incident: 1 })
export const revealIncident = (sessionId: string) =>
  updateSession(sessionId, { status: 'revealed' as SessionStatus })

/** Advance to the next incident, or end the game after the last one. */
export function nextIncident(session: Session): Promise<void> {
  if (session.current_incident >= session.deck.length) {
    return updateSession(session.id, { status: 'ended' })
  }
  return updateSession(session.id, {
    status: 'playing',
    current_incident: session.current_incident + 1,
  })
}

export async function fetchPlayers(sessionId: string): Promise<Player[]> {
  const { data, error } = await db()
    .from('players')
    .select()
    .eq('session_id', sessionId)
    .order('score', { ascending: false })
    .order('total_ms', { ascending: true })
  if (error) throw error
  return (data ?? []) as Player[]
}

export async function fetchVotes(sessionId: string, incident: number): Promise<Vote[]> {
  const { data, error } = await db()
    .from('votes')
    .select()
    .eq('session_id', sessionId)
    .eq('incident', incident)
  if (error) throw error
  return (data ?? []) as Vote[]
}

/** All votes for a session — used for the end-of-game "% correct" summary. */
export async function fetchAllVotes(sessionId: string): Promise<Vote[]> {
  const { data, error } = await db().from('votes').select().eq('session_id', sessionId)
  if (error) throw error
  return (data ?? []) as Vote[]
}

export async function fetchSession(sessionId: string): Promise<Session | null> {
  const { data, error } = await db().from('sessions').select().eq('id', sessionId).maybeSingle()
  if (error) throw error
  return (data as Session) ?? null
}

// ── Realtime subscriptions (caller removes the channel on cleanup) ──────────────
// Each also reconciles on SUBSCRIBED: any rows written during the websocket
// handshake would otherwise be missed, so we re-fetch once the channel is ready.

export function subscribeSession(sessionId: string, onChange: (s: Session) => void): RealtimeChannel {
  return db()
    .channel(`session:${sessionId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${sessionId}` },
      (payload) => onChange(payload.new as Session),
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') fetchSession(sessionId).then((s) => s && onChange(s)).catch(() => {})
    })
}

export function subscribePlayers(sessionId: string, onChange: () => void): RealtimeChannel {
  return db()
    .channel(`players:${sessionId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'players', filter: `session_id=eq.${sessionId}` },
      () => onChange(),
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') onChange()
    })
}

export function subscribeVotes(sessionId: string, onChange: () => void): RealtimeChannel {
  return db()
    .channel(`votes:${sessionId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'votes', filter: `session_id=eq.${sessionId}` },
      () => onChange(),
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') onChange()
    })
}

export function removeChannel(ch: RealtimeChannel | null): void {
  if (ch) supabase?.removeChannel(ch)
}
