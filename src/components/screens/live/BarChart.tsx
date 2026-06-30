import type { Decision } from '../../../types'

interface Props {
  decisions: Decision[]
  /** decision name → number of votes */
  counts: Record<string, number>
  total: number
  /** the scenario's bestDecision, highlighted as correct */
  correct: string
}

/** Horizontal percentage bars per decision; the correct choice is highlighted. */
export function BarChart({ decisions, counts, total, correct }: Props) {
  return (
    <div className="barchart" aria-label="Votes per choice">
      {decisions.map((d) => {
        const n = counts[d.name] ?? 0
        const pct = total > 0 ? Math.round((n / total) * 100) : 0
        const isCorrect = d.name === correct
        return (
          <div className={`bar-row${isCorrect ? ' correct' : ''}`} key={d.name}>
            <div className="bar-head">
              <span className="bar-name" style={{ color: d.color }}>
                {d.name}
                {isCorrect && <span className="bar-check" aria-label="correct answer"> ✓</span>}
              </span>
              <span className="bar-pct mono">
                {pct}% <span className="bar-n">({n})</span>
              </span>
            </div>
            <div className="bar-track">
              <div
                className="bar-fill"
                style={{ width: pct + '%', background: d.color }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
