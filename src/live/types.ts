/** Row shapes for the Live Compete Supabase tables (see the SQL migration). */

export type SessionStatus = 'lobby' | 'playing' | 'revealed' | 'ended'

export interface Session {
  id: string
  code: string
  status: SessionStatus
  current_incident: number
  /** Ordered scenario ids for the 20-incident round. */
  deck: number[]
  created_at: string
}

export interface Player {
  id: string
  session_id: string
  /** Anonymous display name only — never a real name. */
  alias: string
  score: number
  /** Cumulative response time, for leaderboard tie-breaks. */
  total_ms: number
  joined_at: string
}

export interface Vote {
  id: string
  session_id: string
  incident: number
  player_id: string
  decision: string
  answered_at: string
}
