import { useCallback, useEffect, useState } from 'react'
import rawData from '../game-data.json'
import type { GameData } from './types'
import {
  type GameState,
  applyDeltas,
  checkWin,
  crashedMeter,
  initState,
} from './gameLogic'
import { MeterHUD } from './components/MeterHUD'
import { StartScreen } from './components/screens/StartScreen'
import { ScenarioScreen } from './components/screens/ScenarioScreen'
import { OutcomeScreen } from './components/screens/OutcomeScreen'
import { EndScreen } from './components/screens/EndScreen'

const data = rawData as unknown as GameData

type Screen = 'start' | 'scenario' | 'outcome' | 'end'

interface OutcomeData {
  decisionName: string
  decisionColor: string
  outcomeText: string
  deltas: Record<string, number>
  best: string
  learn: string
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

  function startGame(mode: 'solo' | 'facilitator') {
    setGameState(initState(mode, data))
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
      const newMeters = applyDeltas(gameState.meters, outcome.deltas ?? {}, data.meters)

      setGameState((prev) => (prev ? { ...prev, meters: newMeters } : prev))
      setOutcomeData({
        decisionName,
        decisionColor: decision?.color ?? '#fff',
        outcomeText: outcome.text,
        deltas: outcome.deltas ?? {},
        best: scenario.best,
        learn: scenario.learn,
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

  const handleApplyEvent = useCallback(
    (effect: Record<string, number>) => {
      if (!gameState) return
      const newMeters = applyDeltas(gameState.meters, effect, data.meters)
      setGameState((prev) => (prev ? { ...prev, meters: newMeters } : prev))
      const crashed = crashedMeter(newMeters, data.meters)
      if (crashed) {
        setEndData({ survived: false, crashedKey: crashed })
        setScreen('end')
      }
    },
    [gameState],
  )

  const handleEventDrawn = useCallback(() => {
    setGameState((prev) => (prev ? { ...prev, eventUsed: true } : prev))
  }, [])

  // Keys 1–5 select a decision during the scenario screen
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

  return (
    <div className={isFacilitator ? 'facilitator' : ''}>
      <div className="wrap">
        {screen !== 'start' && gameState && (
          <header className="topbar">
            <div className="brand">
              HUMAN <span className="fw">FIREWALL</span>
            </div>
            <div className="pill mono">{isFacilitator ? 'FACILITATOR' : 'SOLO'}</div>
            {screen !== 'end' && (
              <div className="counter mono" aria-live="polite" aria-atomic="true">
                INCIDENT{' '}
                <strong>{String(gameState.incident).padStart(2, '0')}</strong> /{' '}
                {data.meta.incidentsPerGame}
              </div>
            )}
          </header>
        )}

        {screen !== 'start' && gameState && (
          <MeterHUD meters={gameState.meters} meterConfigs={data.meters} />
        )}

        <main className="stage">
          {screen === 'start' && <StartScreen data={data} onSelectMode={startGame} />}

          {screen === 'scenario' && gameState && (
            <ScenarioScreen
              key={gameState.incident}
              scenario={gameState.deck[gameState.incident - 1]}
              decisions={data.decisions}
              mode={gameState.mode}
              eventUsed={gameState.eventUsed}
              events={data.events}
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
              best={outcomeData.best}
              learn={outcomeData.learn}
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
              onAgain={() => startGame(gameState.mode)}
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
