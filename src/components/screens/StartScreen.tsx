import type { GameData } from '../../types'
import { METER_KEYS } from '../../gameLogic'

interface Props {
  data: GameData
  onSelectMode: (mode: 'solo' | 'facilitator') => void
}

export function StartScreen({ data, onSelectMode }: Props) {
  return (
    <div className="hero">
      <div className="eyebrow">Cyber-awareness · card game</div>
      <h1>
        HUMAN <span className="fw">FIREWALL</span>
      </h1>
      <p className="sub">Ten everyday incidents. Five ways to react. Keep the company standing.</p>

      <div className="modes">
        <button className="modebtn" onClick={() => onSelectMode('solo')}>
          <span className="ic" aria-hidden="true">▶</span>
          <span>
            <span className="t">Play solo</span>
            <br />
            <span className="d">Train at your own pace and get a score.</span>
          </span>
        </button>

        <button className="modebtn" onClick={() => onSelectMode('facilitator')}>
          <span className="ic" aria-hidden="true">⌘</span>
          <span>
            <span className="t">Run a workshop</span>
            <br />
            <span className="d">A facilitator screen for a team or a room.</span>
          </span>
        </button>
      </div>

      <div className="legend" aria-label="Meter descriptions">
        {METER_KEYS.map((k) => {
          const m = data.meters[k]
          return (
            <span key={k}>
              <b>{m.label}</b> {m.hint.split('.')[0]}
            </span>
          )
        })}
      </div>
    </div>
  )
}
