import type { MeterConfig } from '../../types'

interface Props {
  decisionName: string
  decisionColor: string
  outcomeText: string
  deltas: Record<string, number>
  meterConfigs: Record<string, MeterConfig>
  best: string
  learn: string
  isLast: boolean
  onNext: () => void
}

const DELTA_ORDER: Array<[string, string]> = [
  ['S', 'Sec'],
  ['R', 'Rep'],
  ['M', 'Funds'],
  ['X', 'Stress'],
]

function DeltaChips({
  deltas,
  meterConfigs,
}: {
  deltas: Record<string, number>
  meterConfigs: Record<string, MeterConfig>
}) {
  const active = DELTA_ORDER.filter(([k]) => deltas[k] != null && deltas[k] !== 0)

  if (active.length === 0) {
    return (
      <div className="deltas">
        <span className="delta flat">no change</span>
      </div>
    )
  }

  return (
    <div className="deltas">
      {active.map(([k, lbl]) => {
        const v = deltas[k]
        const up = v > 0
        const good = meterConfigs[k].higherIsBetter ? up : !up
        const unit = meterConfigs[k].unit ?? ''
        return (
          <span key={k} className={`delta ${good ? 'good' : 'bad'}`}>
            {lbl} {up ? '+' : '−'}
            {Math.abs(v)}
            {unit}
          </span>
        )
      })}
    </div>
  )
}

export function OutcomeScreen({
  decisionName,
  decisionColor,
  outcomeText,
  deltas,
  meterConfigs,
  best,
  learn,
  isLast,
  onNext,
}: Props) {
  return (
    <div className="card">
      <p className="chosen">
        You chose &middot;{' '}
        <b style={{ color: decisionColor }}>{decisionName}</b>
      </p>
      <p className="outcome-text">{outcomeText}</p>

      <DeltaChips deltas={deltas} meterConfigs={meterConfigs} />

      <div className="note best">
        <b>Best move:</b> {best}
      </div>
      <div className="note learn">
        <b>Learn:</b> {learn}
      </div>

      <div className="actions">
        <button className="btn primary" onClick={onNext} autoFocus>
          {isLast ? 'See result' : 'Next incident'}
        </button>
      </div>
    </div>
  )
}
