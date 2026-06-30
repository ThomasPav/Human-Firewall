import { useCallback, useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import rawData from '../../../../game-data.json'
import type { GameData } from '../../../types'
import { buildDeckIds } from '../../../gameLogic'
import { appUrl } from '../../../live/supabaseClient'
import type { Player, Session, Vote } from '../../../live/types'
import {
  createSession,
  fetchAllVotes,
  fetchPlayers,
  fetchVotes,
  nextIncident,
  removeChannel,
  revealIncident,
  startGame,
  subscribePlayers,
  subscribeSession,
  subscribeVotes,
} from '../../../live/api'
import { BarChart } from './BarChart'
import { LiveLeaderboard } from './LiveLeaderboard'

const data = rawData as unknown as GameData

const VERDICT: Record<string, [string, string]> = {
  malicious: ['mal', 'This was an attack'],
  legitimate: ['leg', 'This was legitimate'],
  ambiguous: ['amb', 'A judgment call'],
}

interface Props {
  onExit: () => void
}

export function LiveHost({ onExit }: Props) {
  const [session, setSession] = useState<Session | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [votes, setVotes] = useState<Vote[]>([])
  const [qr, setQr] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [correctPct, setCorrectPct] = useState<number | null>(null)

  // Mirror live values so realtime callbacks read fresh data without re-subscribing.
  const sessionRef = useRef<Session | null>(null)
  sessionRef.current = session

  // Create the session once and wire up realtime subscriptions.
  useEffect(() => {
    let channels: ReturnType<typeof subscribeSession>[] = []
    let cancelled = false
    ;(async () => {
      try {
        const deck = buildDeckIds(data.scenarios, data.meta.incidentsPerGame)
        const s = await createSession(deck)
        if (cancelled) return
        setSession(s)
        setQr(await QRCode.toDataURL(`${appUrl()}/join/${s.code}`, { margin: 1, width: 320 }))
        setPlayers(await fetchPlayers(s.id))

        const refreshVotes = async () => {
          const cur = sessionRef.current
          if (cur) setVotes(await fetchVotes(cur.id, cur.current_incident))
        }
        channels = [
          subscribeSession(s.id, (next) => setSession(next)),
          subscribePlayers(s.id, async () => setPlayers(await fetchPlayers(s.id))),
          subscribeVotes(s.id, refreshVotes),
        ]
      } catch (e) {
        if (!cancelled) setError((e as Error).message)
      }
    })()
    return () => {
      cancelled = true
      channels.forEach(removeChannel)
    }
  }, [])

  // On each new incident, reset the tally and pull any votes already in.
  useEffect(() => {
    if (!session) return
    if (session.status === 'playing') {
      setVotes([])
      fetchVotes(session.id, session.current_incident).then(setVotes).catch(() => {})
    }
    if (session.status === 'ended') {
      fetchAllVotes(session.id)
        .then((all) => {
          if (all.length === 0) return setCorrectPct(null)
          let correct = 0
          for (const v of all) {
            const sc = data.scenarios.find((x) => x.id === session.deck[v.incident - 1])
            if (sc && v.decision === sc.bestDecision) correct++
          }
          setCorrectPct(Math.round((correct / all.length) * 100))
        })
        .catch(() => {})
    }
  }, [session?.status, session?.current_incident]) // eslint-disable-line react-hooks/exhaustive-deps

  const onStart = useCallback(() => {
    if (session) startGame(session.id).catch((e) => setError((e as Error).message))
  }, [session])
  const onReveal = useCallback(() => {
    if (session) revealIncident(session.id).catch((e) => setError((e as Error).message))
  }, [session])
  const onNext = useCallback(() => {
    if (session) nextIncident(session).catch((e) => setError((e as Error).message))
  }, [session])

  if (error) {
    return (
      <div className="card live-msg">
        <h2>Live game error</h2>
        <p className="reason">{error}</p>
        <button className="btn primary" onClick={onExit}>Back to menu</button>
      </div>
    )
  }
  if (!session) {
    return <div className="card live-msg"><p className="reason">Starting a live game…</p></div>
  }

  const scenario =
    session.current_incident > 0
      ? data.scenarios.find((s) => s.id === session.deck[session.current_incident - 1]) ?? null
      : null
  const counts: Record<string, number> = {}
  for (const v of votes) counts[v.decision] = (counts[v.decision] ?? 0) + 1

  // ── Lobby ──
  if (session.status === 'lobby') {
    return (
      <div className="card live-lobby">
        <div className="eyebrow">Live Compete · host</div>
        <h2>Scan to join</h2>
        {qr && <img className="qr" src={qr} alt="QR code to join the game" />}
        <div className="joincode mono" aria-label="Join code">{session.code}</div>
        <div className="joinurl mono">{appUrl().replace(/^https?:\/\//, '')}/join/{session.code}</div>
        <div className="playercount" aria-live="polite">
          <strong>{players.length}</strong> {players.length === 1 ? 'player' : 'players'} in
        </div>
        <div className="actions">
          <button className="btn primary" onClick={onStart} disabled={players.length === 0}>
            Start game
          </button>
          <button className="btn ghost" onClick={onExit}>Cancel</button>
        </div>
      </div>
    )
  }

  // ── End ──
  if (session.status === 'ended') {
    return (
      <div className="card verdict live-end">
        <div className="eyebrow">Live Compete · results</div>
        <h2>Final leaderboard</h2>
        {correctPct != null && (
          <p className="reason">{correctPct}% of all calls across the team were correct.</p>
        )}
        <LiveLeaderboard players={players} limit={10} />
        <div className="actions">
          <button className="btn primary" onClick={onExit}>Back to menu</button>
        </div>
      </div>
    )
  }

  // ── Playing / revealed (scenario present) ──
  const answered = votes.length
  const revealed = session.status === 'revealed'
  const verdict = scenario ? VERDICT[scenario.legitimacy] ?? VERDICT.malicious : VERDICT.malicious

  return (
    <div className="card live-incident">
      <div className="counter mono">
        INCIDENT <strong>{String(session.current_incident).padStart(2, '0')}</strong> / {session.deck.length}
      </div>
      {scenario && (
        <>
          <span className="tag" style={{ background: scenario.color }}>{scenario.categoryLabel}</span>
          <h2 className="scenario-title">{scenario.title}</h2>
          <p className="scenario-text">{scenario.text}</p>
        </>
      )}

      {!revealed ? (
        <>
          <div className="answered mono" aria-live="polite">
            <strong>{answered}</strong> of {players.length} answered
          </div>
          <div className="actions">
            <button className="btn primary" onClick={onReveal}>Reveal</button>
            <button className="btn ghost" onClick={onExit}>End game</button>
          </div>
        </>
      ) : (
        scenario && (
          <>
            <div className={`vtag ${verdict[0]}`}>{verdict[1]}</div>
            <BarChart
              decisions={data.decisions}
              counts={counts}
              total={answered}
              correct={scenario.bestDecision}
            />
            <p className="outcome-text">{scenario.outcomes[scenario.bestDecision]?.text}</p>
            <div className="note best"><b>Best move:</b> {scenario.best}</div>
            <div className="note learn"><b>Learn:</b> {scenario.learn}</div>
            <div className="actions">
              <button className="btn primary" onClick={onNext}>
                {session.current_incident >= session.deck.length ? 'See results' : 'Next incident'}
              </button>
            </div>
          </>
        )
      )}
    </div>
  )
}
