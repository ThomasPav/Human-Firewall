import { useCallback, useEffect, useState } from 'react'
import rawData from '../game-data.json'
import type { EventEffect, GameData } from './types'
import {
  type GameMode,
  type GameState,
  amplify,
  applyDeltas,
  checkWin,
  crashedMeter,
  currentPlayerIndex,
  initState,
  modActive,
} from './gameLogic'
import { MeterHUD } from './components/MeterHUD'
import { StartScreen } from './components/screens/StartScreen'
import { PlayerSetupScreen } from './components/screens/PlayerSetupScreen'
import { ScenarioScreen } from './components/screens/ScenarioScreen'
import { OutcomeScreen } from './components/screens/OutcomeScreen'
import { EndScreen } from './components/screens/EndScreen'
import { LiveHost } from './components/screens/live/LiveHost'
import { LivePlayer } from './components/screens/live/LivePlayer'
import { isLiveConfigured } from './live/supabaseClient'

const data = rawData as unknown as GameData

type Screen = 'start' | 'setup' | 'scenario' | 'outcome' | 'end' | 'live' | 'live-setup'

// A /join or /join/<code> URL drops straight into the Live Compete player flow.
// Returns the (possibly empty) code, or null when the path isn't a join link.
function parseJoin(path: string): string | null {
  const m = path.match(/^\/join\/?([A-Za-z0-9]*)$/)
  return m ? m[1] || '' : null
}

export interface OutcomeNote {
  kind: 'amp' | 'reward'
  text: string
}

interface OutcomeData {
  decisionName: string
  decisionColor: string
  outcomeText: string
  deltas: Record<string, number>
  legitimacy: 'malicious' | 'legitimate' | 'ambiguous'
  best: string
  learn: string
  notes: OutcomeNote[]
}

interface EndData {
  survived: boolean
  crashedKey: string | null
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('start')
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [outcomeData, setOutcomeData] = useState<OutcomeData | null>(null)
  const [endData, setEndData] = useState<EndData | null>(null)
  const [joinCode, setJoinCode] = useState<string | null>(() => parseJoin(window.location.pathname))

  // Keep the join route in sync with back/forward navigation.
  useEffect(() => {
    const onPop = () => setJoinCode(parseJoin(window.location.pathname))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // Multiplayer first collects a roster; Live Compete needs a backend; the rest
  // start straight away.
  function selectMode(mode: GameMode) {
    if (mode === 'multiplayer') {
      setScreen('setup')
      return
    }
    if (mode === 'live') {
      setScreen(isLiveConfigured ? 'live' : 'live-setup')
      return
    }
    startGame(mode, [])
  }

  function startGame(mode: GameMode, names: string[]) {
    setGameState(initState(mode, data, names))
    setOutcomeData(null)
    setEndData(null)
    setScreen('scenario')
  }

  const handleDecision = useCallback(
    (decisionName: string) => {
      if (!gameState) return
      const scenario = gameState.deck[gameState.incident - 1]
      const outcome = scenario.outcomes[decisionName]
      const decision = data.decisions.find((d) => d.name === decisionName)

      let deltas = { ...(outcome.deltas ?? {}) }
      const notes: OutcomeNote[] = []
      const wrong = decisionName !== scenario.bestDecision

      // An active "amplify" event multiplies the penalty for a wrong answer,
      // but only on scenarios whose category matches the event's channel.
      if (
        modActive(gameState.activeMod, gameState.incident) &&
        gameState.activeMod &&
        scenario.category === gameState.activeMod.channel &&
        wrong
      ) {
        deltas = amplify(deltas, gameState.activeMod.mult)
        notes.push({
          kind: 'amp',
          text: `${gameState.activeMod.label}: wrong-answer penalty ×${gameState.activeMod.mult}`,
        })
      }

      // An active "reward_best" event grants bonus Security for a correct call.
      if (
        modActive(gameState.activeReward, gameState.incident) &&
        gameState.activeReward &&
        !wrong
      ) {
        deltas = { ...deltas, S: (deltas.S ?? 0) + gameState.activeReward.amount }
        notes.push({
          kind: 'reward',
          text: `${gameState.activeReward.label}: +${gameState.activeReward.amount} Security for a correct call`,
        })
      }

      const newMeters = applyDeltas(gameState.meters, deltas, data.meters)

      setGameState((prev) => {
        if (!prev) return prev
        let players = prev.players
        // In multiplayer, tally this incident against whoever's turn it is.
        if (prev.mode === 'multiplayer' && players.length) {
          const idx = currentPlayerIndex(players, prev.incident)
          players = players.map((p, i) =>
            i === idx
              ? {
                  ...p,
                  correct: p.correct + (wrong ? 0 : 1),
                  wrong: p.wrong + (wrong ? 1 : 0),
                }
              : p,
          )
        }
        return { ...prev, meters: newMeters, players }
      })
      setOutcomeData({
        decisionName,
        decisionColor: decision?.color ?? '#fff',
        outcomeText: outcome.text,
        deltas,
        legitimacy: scenario.legitimacy,
        best: scenario.best,
        learn: scenario.learn,
        notes,
      })
      setScreen('outcome')
    },
    [gameState],
  )

  const handleNext = useCallback(() => {
    if (!gameState) return

    const crashed = crashedMeter(gameState.meters, data.meters)
    if (crashed) {
      setEndData({ survived: false, crashedKey: crashed })
      setScreen('end')
      return
    }

    if (gameState.incident >= data.meta.incidentsPerGame) {
      setEndData({ survived: checkWin(gameState.meters, data.meters), crashedKey: null })
      setScreen('end')
      return
    }

    setGameState((prev) =>
      prev ? { ...prev, incident: prev.incident + 1, eventUsed: false } : prev,
    )
    setScreen('scenario')
  }, [gameState])

  // Apply a drawn event card: a "meter" effect changes meters immediately,
  // while "amplify"/"reward_best" install a modifier that lasts a few incidents.
  const handleApplyEvent = useCallback(
    (effect: EventEffect, eventTitle: string, eventColor: string, channel: string | null, channelLabel: string | null) => {
      if (!gameState) return
      setGameState((prev) => {
        if (!prev) return prev
        if (effect.kind === 'meter') {
          return { ...prev, meters: applyDeltas(prev.meters, effect.deltas, data.meters) }
        }
        if (effect.kind === 'amplify') {
          return {
            ...prev,
            activeMod: {
              channel,
              channelLabel,
              color: eventColor,
              label: eventTitle,
              mult: effect.mult,
              until: prev.incident + effect.duration - 1,
            },
          }
        }
        // reward_best
        return {
          ...prev,
          activeReward: {
            amount: effect.amount,
            label: eventTitle,
            until: prev.incident + effect.duration - 1,
          },
        }
      })

      if (effect.kind === 'meter') {
        const newMeters = applyDeltas(gameState.meters, effect.deltas, data.meters)
        const crashed = crashedMeter(newMeters, data.meters)
        if (crashed) {
          setEndData({ survived: false, crashedKey: crashed })
          setScreen('end')
        }
      }
    },
    [gameState],
  )

  const handleEventDrawn = useCallback(() => {
    setGameState((prev) => (prev ? { ...prev, eventUsed: true } : prev))
  }, [])

  const handleQuitToMenu = useCallback(() => {
    const ok = window.confirm('Leave this game and return to the main menu? Your progress will be lost.')
    if (!ok) return
    setGameState(null)
    setOutcomeData(null)
    setEndData(null)
    setScreen('start')
  }, [])

  // Keys 1–4 select a decision during the scenario screen
  useEffect(() => {
    if (screen !== 'scenario' || !gameState) return
    const scenario = gameState.deck[gameState.incident - 1]
    const available = data.decisions.filter((d) => scenario.outcomes[d.name])
    function onKey(e: KeyboardEvent) {
      const n = parseInt(e.key, 10)
      if (n >= 1 && n <= available.length) handleDecision(available[n - 1].name)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [screen, gameState, handleDecision])

  const isFacilitator = gameState?.mode === 'facilitator'
  const modeLabel =
    gameState?.mode === 'facilitator'
      ? 'FACILITATOR'
      : gameState?.mode === 'multiplayer'
        ? 'TEAM'
        : 'SOLO'

  const goHome = () => {
    if (window.location.pathname !== '/') window.history.pushState({}, '', '/')
    setJoinCode(null)
  }

  // A /join URL is the phone player flow — it bypasses the normal app shell.
  if (joinCode !== null) {
    return (
      <div className="wrap">
        <main className="stage">
          <LivePlayer initialCode={joinCode} onExit={goHome} />
        </main>
      </div>
    )
  }

  return (
    <div className={isFacilitator ? 'facilitator' : ''}>
      <div className="wrap">
        {screen !== 'start' && screen !== 'setup' && gameState && (
          <header className="topbar">
            <div className="brand">
              HUMAN <span className="fw">FIREWALL</span>
            </div>
            <div className="pill mono">{modeLabel}</div>
            {screen !== 'end' && (
              <>
                <div className="counter mono" aria-live="polite" aria-atomic="true">
                  INCIDENT{' '}
                  <strong>{String(gameState.incident).padStart(2, '0')}</strong> /{' '}
                  {data.meta.incidentsPerGame}
                </div>
                <button
                  type="button"
                  className="quitbtn mono"
                  onClick={handleQuitToMenu}
                  aria-label="Quit to main menu"
                >
                  ✕ Menu
                </button>
              </>
            )}
          </header>
        )}

        {screen !== 'start' && gameState && (
          <MeterHUD meters={gameState.meters} meterConfigs={data.meters} />
        )}

        <main className="stage">
          {screen === 'start' && (
            <StartScreen
              data={data}
              onSelectMode={selectMode}
              onJoin={() => {
                window.history.pushState({}, '', '/join')
                setJoinCode('')
              }}
            />
          )}

          {screen === 'setup' && (
            <PlayerSetupScreen
              onStart={(names) => startGame('multiplayer', names)}
              onBack={() => setScreen('start')}
            />
          )}

          {screen === 'live' && <LiveHost onExit={() => setScreen('start')} />}

          {screen === 'live-setup' && (
            <div className="card live-msg">
              <div className="eyebrow">Live Compete · setup needed</div>
              <h2>Connect a backend first</h2>
              <p className="reason">
                Live Compete syncs phones through Supabase. Add your project keys to a
                <code> .env.local</code> file (<code>VITE_SUPABASE_URL</code>,{' '}
                <code>VITE_SUPABASE_ANON_KEY</code>), run the SQL migration in{' '}
                <code>supabase/migrations/</code>, then restart the dev server. See the
                README “Live Compete setup” section.
              </p>
              <div className="actions">
                <button className="btn primary" onClick={() => setScreen('start')}>Back</button>
              </div>
            </div>
          )}

          {screen === 'scenario' && gameState && (
            <ScenarioScreen
              key={gameState.incident}
              scenario={gameState.deck[gameState.incident - 1]}
              decisions={data.decisions}
              mode={gameState.mode}
              currentPlayer={
                gameState.mode === 'multiplayer' && gameState.players.length
                  ? gameState.players[currentPlayerIndex(gameState.players, gameState.incident)].name
                  : null
              }
              eventUsed={gameState.eventUsed}
              events={data.events}
              incident={gameState.incident}
              activeMod={modActive(gameState.activeMod, gameState.incident) ? gameState.activeMod : null}
              activeReward={
                modActive(gameState.activeReward, gameState.incident) ? gameState.activeReward : null
              }
              onDecide={handleDecision}
              onEventDrawn={handleEventDrawn}
              onApplyEvent={handleApplyEvent}
            />
          )}

          {screen === 'outcome' && gameState && outcomeData && (
            <OutcomeScreen
              decisionName={outcomeData.decisionName}
              decisionColor={outcomeData.decisionColor}
              outcomeText={outcomeData.outcomeText}
              deltas={outcomeData.deltas}
              meterConfigs={data.meters}
              legitimacy={outcomeData.legitimacy}
              best={outcomeData.best}
              learn={outcomeData.learn}
              notes={outcomeData.notes}
              isLast={gameState.incident >= data.meta.incidentsPerGame}
              onNext={handleNext}
            />
          )}

          {screen === 'end' && gameState && endData && (
            <EndScreen
              survived={endData.survived}
              crashedKey={endData.crashedKey}
              meters={gameState.meters}
              meterConfigs={data.meters}
              ratings={data.ratings}
              totalIncidents={data.meta.incidentsPerGame}
              players={gameState.players}
              onAgain={() => startGame(gameState.mode, gameState.players.map((p) => p.name))}
              onHome={() => setScreen('start')}
            />
          )}
        </main>

        {screen === 'start' && (
          <footer className="foot mono">
            {data.scenarios.length} scenarios · {data.events.length} event cards
          </footer>
        )}
      </div>
    </div>
  )
}
