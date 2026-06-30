import { useState } from 'react'

interface Props {
  onStart: (names: string[]) => void
  onBack: () => void
}

const MIN = 2
const MAX = 6

export function PlayerSetupScreen({ onStart, onBack }: Props) {
  const [names, setNames] = useState<string[]>(['', ''])

  function setName(i: number, v: string) {
    setNames((ns) => ns.map((n, idx) => (idx === i ? v : n)))
  }
  function addPlayer() {
    setNames((ns) => (ns.length < MAX ? [...ns, ''] : ns))
  }
  function removePlayer(i: number) {
    setNames((ns) => (ns.length > MIN ? ns.filter((_, idx) => idx !== i) : ns))
  }

  const clean = names.map((n) => n.trim()).filter(Boolean)
  const canStart = clean.length >= MIN

  function start() {
    if (canStart) onStart(clean)
  }

  return (
    <div className="hero setup">
      <div className="eyebrow">Team mode · pass &amp; play</div>
      <h1>Who&rsquo;s playing?</h1>
      <p className="sub">
        Add {MIN}&ndash;{MAX} players. You&rsquo;ll take turns deciding &mdash; one
        incident each, in order. The meters are shared, so you win or lose as a team.
      </p>

      <div className="roster">
        {names.map((n, i) => (
          <div className="roster-row" key={i}>
            <span className="rn mono">{i + 1}</span>
            <input
              className="pinput"
              value={n}
              maxLength={20}
              placeholder={`Player ${i + 1}`}
              onChange={(e) => setName(i, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') start()
              }}
              aria-label={`Player ${i + 1} name`}
              autoFocus={i === 0}
            />
            <button
              type="button"
              className="rrm"
              onClick={() => removePlayer(i)}
              disabled={names.length <= MIN}
              aria-label={`Remove player ${i + 1}`}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        className="btn ghost addp"
        onClick={addPlayer}
        disabled={names.length >= MAX}
      >
        + Add player
      </button>

      <div className="actions">
        <button type="button" className="btn primary" onClick={start} disabled={!canStart}>
          Start game
        </button>
        <button type="button" className="btn ghost" onClick={onBack}>
          Back
        </button>
      </div>
    </div>
  )
}
