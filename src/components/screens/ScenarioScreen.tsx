import { useState } from 'react'
import type { Decision, GameEvent, Scenario } from '../../types'

interface Props {
  scenario: Scenario
  decisions: Decision[]
  mode: 'solo' | 'facilitator'
  eventUsed: boolean
  events: GameEvent[]
  onDecide: (decision: string) => void
  onEventDrawn: () => void
  onApplyEvent: (effect: Record<string, number>) => void
}

interface DrawnEvent {
  event: GameEvent
  applied: boolean
}

export function ScenarioScreen({
  scenario,
  decisions,
  mode,
  eventUsed,
  events,
  onDecide,
  onEventDrawn,
  onApplyEvent,
}: Props) {
  const [drawn, setDrawn] = useState<DrawnEvent | null>(null)

  const available = decisions.filter((d) => scenario.outcomes[d.name])

  function handleDrawEvent() {
    const ev = events[Math.floor(Math.random() * events.length)]
    setDrawn({ event: ev, applied: false })
    onEventDrawn()
  }

  function handleApply() {
    if (!drawn || !drawn.event.effect) return
    onApplyEvent(drawn.event.effect)
    setDrawn({ ...drawn, applied: true })
  }

  const prompt = mode === 'facilitator' ? 'The team decides — play one card.' : 'What do you do?'

  return (
    <div className="card" key={scenario.id}>
      <span className="tag" style={{ background: scenario.color }}>
        {scenario.type}
      </span>
      <p className="targets">Targets: {scenario.targets}</p>
      <h2 className="scenario-title">{scenario.title}</h2>
      <p className="scenario-text">{scenario.text}</p>
      <p className="prompt">{prompt}</p>

      <div className="decisions" role="group" aria-label="Choose a decision">
        {available.map((d, i) => (
          <button
            key={d.name}
            className="dec"
            style={{ '--dc': d.color } as React.CSSProperties}
            onClick={() => onDecide(d.name)}
            aria-label={`${i + 1}. ${d.name}: ${d.meaning}`}
          >
            <span className="k" aria-hidden="true">{i + 1}</span>
            <span className="nm">{d.name}</span>
            <span className="mn">{d.meaning}</span>
          </button>
        ))}
      </div>

      {mode === 'facilitator' && !eventUsed && !drawn && (
        <div className="fac-tools">
          <button className="btn" onClick={handleDrawEvent}>
            Draw an event card
          </button>
        </div>
      )}

      {drawn && (
        <div className="event-pop" role="region" aria-label="Event card">
          <div className="et">Event card</div>
          <div className="en">{drawn.event.title}</div>
          <div className="ex">{drawn.event.text}</div>
          {drawn.event.effect && !drawn.applied && (
            <div className="ea">
              <button className="btn primary" onClick={handleApply}>
                Apply effect
              </button>
            </div>
          )}
          {drawn.applied && (
            <div className="ea">
              <span style={{ color: 'var(--good)', fontSize: 13 }}>Applied.</span>
            </div>
          )}
          {!drawn.event.effect && (
            <div className="ea">
              <span style={{ color: 'var(--muted)', fontSize: 13 }}>
                Apply this as a rule for the round.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
