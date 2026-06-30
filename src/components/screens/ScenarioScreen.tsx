import { useState } from 'react'
import type { Decision, EventEffect, GameEvent, Scenario } from '../../types'
import type { ActiveMod, ActiveReward, GameMode } from '../../gameLogic'

interface Props {
  scenario: Scenario
  decisions: Decision[]
  mode: GameMode
  /** Name of the player whose turn it is (multiplayer only). */
  currentPlayer: string | null
  eventUsed: boolean
  events: GameEvent[]
  incident: number
  activeMod: ActiveMod | null
  activeReward: ActiveReward | null
  onDecide: (decision: string) => void
  onEventDrawn: () => void
  onApplyEvent: (
    effect: EventEffect,
    title: string,
    color: string,
    channel: string | null,
    channelLabel: string | null,
  ) => void
}

interface DrawnEvent {
  event: GameEvent
  applied: boolean
}

function applyLabel(effect: EventEffect): string {
  if (effect.kind === 'amplify') return 'Start the wave'
  if (effect.kind === 'reward_best') return 'Begin'
  return 'Apply effect'
}

export function ScenarioScreen({
  scenario,
  decisions,
  mode,
  currentPlayer,
  eventUsed,
  events,
  activeMod,
  activeReward,
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
    if (!drawn) return
    const ev = drawn.event
    onApplyEvent(ev.effect, ev.title, ev.color, ev.channel, ev.channelLabel)
    setDrawn({ ...drawn, applied: true })
  }

  const prompt =
    mode === 'facilitator'
      ? 'The team decides — play one card.'
      : mode === 'multiplayer' && currentPlayer
        ? `${currentPlayer}, what do you do?`
        : 'What do you do?'

  return (
    <>
      {mode === 'multiplayer' && currentPlayer && (
        <div className="turnbanner" role="status" aria-live="polite">
          <span className="who">{currentPlayer}</span>
          <span className="up">it&rsquo;s your call</span>
        </div>
      )}

      {activeMod && (
        <div className="evbanner" style={{ borderColor: activeMod.color }} role="status">
          <b>{activeMod.label}</b> — wrong answers on {activeMod.channelLabel} cost ×
          {activeMod.mult} (through incident {activeMod.until}).
        </div>
      )}
      {!activeMod && activeReward && (
        <div className="evbanner" style={{ borderColor: 'var(--good)' }} role="status">
          <b>{activeReward.label}</b> — correct answers earn +{activeReward.amount} Security
          (through incident {activeReward.until}).
        </div>
      )}

      <div className="card" key={scenario.id}>
        <span className="tag" style={{ background: scenario.color }}>
          {scenario.categoryLabel}
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
          <div
            className="event-pop"
            style={{ borderLeftColor: drawn.event.color }}
            role="region"
            aria-label="Event card"
          >
            <div
              className="et"
              style={{ color: drawn.event.channel ? drawn.event.color : 'var(--warn)' }}
            >
              {drawn.event.channelLabel || 'Event'}
            </div>
            <div className="en">{drawn.event.title}</div>
            <div className="ex">{drawn.event.text}</div>
            {!drawn.applied ? (
              <div className="ea">
                <button className="btn primary" onClick={handleApply}>
                  {applyLabel(drawn.event.effect)}
                </button>
              </div>
            ) : (
              <div className="ea">
                <span style={{ color: 'var(--good)', fontSize: 13 }}>Applied.</span>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
