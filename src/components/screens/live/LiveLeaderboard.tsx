import type { Player } from '../../../live/types'

interface Props {
  /** Already sorted: score desc, then total_ms asc. */
  players: Player[]
  /** Highlight this player's own row (player view). */
  selfId?: string
  limit?: number
}

const MEDAL = ['🥇', '🥈', '🥉']

/** Anonymous leaderboard — alias + points only, never any identity. */
export function LiveLeaderboard({ players, selfId, limit }: Props) {
  const rows = typeof limit === 'number' ? players.slice(0, limit) : players
  return (
    <div className="leaderboard" aria-label="Leaderboard">
      {rows.map((p, i) => (
        <div className={`lb-row${p.id === selfId ? ' me' : ''}`} key={p.id}>
          <span className="lb-rank mono">{MEDAL[i] ?? i + 1}</span>
          <span className="lb-alias">{p.alias}</span>
          <span className="lb-score mono">{p.score}</span>
        </div>
      ))}
      {rows.length === 0 && <div className="lb-empty">No players yet.</div>}
    </div>
  )
}
