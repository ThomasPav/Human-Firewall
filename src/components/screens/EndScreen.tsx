import type { MeterConfig, Rating } from '../../types'
import { METER_KEYS, type MeterValues, type Player, fmtMeter, meterColorClass, getRating, dangerZoneMeters } from '../../gameLogic'

interface Props {
  survived: boolean
  crashedKey: string | null
  meters: MeterValues
  meterConfigs: Record<string, MeterConfig>
  ratings: Rating[]
  totalIncidents: number
  /** Roster with per-player tallies (multiplayer only). */
  players: Player[]
  onAgain: () => void
  onHome: () => void
}

const CRASH_REASONS: Record<string, string> = {
  R: "reputation hit zero — the company's name is ruined",
  M: 'funds hit zero — the company is bankrupt',
  S: 'security hit zero — the company is wide open',
  X: 'stress hit the limit — the team burned out',
}

export function EndScreen({
  survived,
  crashedKey,
  meters,
  meterConfigs,
  ratings,
  totalIncidents,
  players,
  onAgain,
  onHome,
}: Props) {
  const rating = getRating(meters.S, ratings)
  const won = survived

  // Crown the player with the most correct calls (only if anyone scored).
  const ranked = [...players].sort((a, b) => b.correct - a.correct)
  const topCorrect = ranked.length ? ranked[0].correct : 0

  let reason: string
  if (crashedKey) {
    reason = `Breach: ${CRASH_REASONS[crashedKey] ?? 'a meter hit the limit'}.`
  } else if (won) {
    reason = `You cleared all ${totalIncidents} incidents with every meter in safe territory. That's a human firewall.`
  } else {
    const danger = dangerZoneMeters(meters, meterConfigs)
    reason = `You made it through all ${totalIncidents} incidents, but ${danger.join(' and ')} finished in the danger zone.`
  }

  const filledStars = won ? rating.stars : 0
  const stars = '★'.repeat(filledStars) + '☆'.repeat(3 - filledStars)

  return (
    <div className="card verdict">
      <div
        className="stars"
        style={{ color: won ? 'var(--good)' : 'var(--bad)' }}
        aria-label={`${filledStars} out of 3 stars`}
      >
        {stars}
      </div>
      <h2>{won ? 'Company secured' : 'Company breached'}</h2>
      <div className="rk">{won ? rating.label : 'incident response required'}</div>
      <p className="reason">{reason}</p>

      <div className="final" aria-label="Final meter values">
        {METER_KEYS.map((k) => {
          const cfg = meterConfigs[k]
          const v = meters[k]
          const colorCls = meterColorClass(cfg, v)
          const cssColor =
            colorCls === 'good'
              ? 'var(--good)'
              : colorCls === 'warn'
                ? 'var(--warn)'
                : 'var(--bad)'
          return (
            <div key={k} className="fm">
              <div className="n">{cfg.short}</div>
              <div className="v" style={{ color: cssColor }}>
                {fmtMeter(cfg, v)}
              </div>
            </div>
          )
        })}
      </div>

      {ranked.length > 0 && (
        <div className="scoreboard" aria-label="Team scoreboard">
          <h3>Team scoreboard</h3>
          {ranked.map((p) => {
            const calls = p.correct + p.wrong
            const isMvp = topCorrect > 0 && p.correct === topCorrect
            return (
              <div className="sb-row" key={p.name}>
                <span className="sb-name">
                  {isMvp && <span aria-label="Most valuable player">👑 </span>}
                  {p.name}
                </span>
                <span className="sb-score mono">
                  {p.correct}/{calls} correct
                </span>
              </div>
            )
          })}
        </div>
      )}

      <div className="actions">
        <button className="btn primary" onClick={onAgain} autoFocus>
          Play again
        </button>
        <button className="btn ghost" onClick={onHome}>
          Switch mode
        </button>
      </div>
    </div>
  )
}
