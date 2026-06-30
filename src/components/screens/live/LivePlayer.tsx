import { useCallback, useEffect, useRef, useState } from 'react'
import rawData from '../../../../game-data.json'
import type { GameData } from '../../../types'
import { type Identity, loadIdentity, newIdentity, saveIdentity } from '../../../live/alias'
import { scorePoints } from '../../../live/scoring'
import type { Player, Session } from '../../../live/types'
import {
  castVote,
  fetchPlayers,
  joinSession,
  recordScore,
  removeChannel,
  subscribePlayers,
  subscribeSession,
  upsertPlayer,
} from '../../../live/api'
import { LiveLeaderboard } from './LiveLeaderboard'

const data = rawData as unknown as GameData

interface Props {
  initialCode: string
  onExit: () => void
}

export function LivePlayer({ initialCode, onExit }: Props) {
  const [codeInput, setCodeInput] = useState(initialCode.toUpperCase())
  const [session, setSession] = useState<Session | null>(null)
  const [identity, setIdentity] = useState<Identity | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [score, setScore] = useState(0)
  const [totalMs, setTotalMs] = useState(0)
  const [lastPoints, setLastPoints] = useState<number | null>(null)
  const [decision, setDecision] = useState<string | null>(null)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const incidentStart = useRef(0)
  const elapsedMs = useRef(0)
  const scoredIncident = useRef(0) // guards one score write per incident (StrictMode-safe)
  const identityRef = useRef<Identity | null>(null)
  identityRef.current = identity

  const join = useCallback(async (code: string) => {
    setError(null)
    setJoining(true)
    try {
      const s = await joinSession(code)
      if (!s) {
        setError(`No live game found for code “${code.toUpperCase()}”.`)
        return
      }
      const id = loadIdentity(s.code) ?? newIdentity()
      saveIdentity(s.code, id)
      const me = await upsertPlayer(s.id, id.playerId, id.alias)
      setScore(me.score)
      setTotalMs(me.total_ms)
      setIdentity(id)
      setSession(s)
      setPlayers(await fetchPlayers(s.id))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setJoining(false)
    }
  }, [])

  // Auto-join when arriving via /join/<code>.
  useEffect(() => {
    if (initialCode) join(initialCode)
  }, [initialCode, join])

  // Realtime: follow the host's session and keep the roster (for rank) fresh.
  useEffect(() => {
    if (!session) return
    const chans = [
      subscribeSession(session.id, (next) => setSession(next)),
      subscribePlayers(session.id, async () => setPlayers(await fetchPlayers(session.id))),
    ]
    return () => chans.forEach(removeChannel)
  }, [session?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // New incident → reset the vote and start this player's response timer.
  useEffect(() => {
    if (session?.status === 'playing') {
      setDecision(null)
      setLastPoints(null)
      incidentStart.current = Date.now()
    }
  }, [session?.status, session?.current_incident])

  const scenario =
    session && session.current_incident > 0
      ? data.scenarios.find((s) => s.id === session.deck[session.current_incident - 1]) ?? null
      : null

  // On reveal, score this incident exactly once (only if we voted in this session).
  useEffect(() => {
    if (!session || session.status !== 'revealed' || !scenario || !identity) return
    if (decision == null) return
    if (scoredIncident.current === session.current_incident) return
    scoredIncident.current = session.current_incident
    const correct = decision === scenario.bestDecision
    const pts = scorePoints(correct, elapsedMs.current)
    const newScore = score + pts
    const newMs = totalMs + elapsedMs.current
    setScore(newScore)
    setTotalMs(newMs)
    setLastPoints(pts)
    recordScore(identity.playerId, newScore, newMs).catch((e) => setError((e as Error).message))
  }, [session?.status, session?.current_incident, scenario, identity]) // eslint-disable-line react-hooks/exhaustive-deps

  const vote = useCallback(
    (d: string) => {
      if (!session || !identity || decision) return
      elapsedMs.current = Date.now() - incidentStart.current
      setDecision(d)
      castVote(session.id, session.current_incident, identity.playerId, d).catch((e) =>
        setError((e as Error).message),
      )
    },
    [session, identity, decision],
  )

  const myRank = identity ? players.findIndex((p) => p.id === identity.playerId) + 1 : 0

  // ── Join screen ──
  if (!session || !identity) {
    return (
      <div className="card live-join">
        <div className="eyebrow">Live Compete</div>
        <h2>Join the game</h2>
        <p className="sub">Enter the code shown on the host screen.</p>
        <input
          className="pinput codeinput mono"
          value={codeInput}
          maxLength={6}
          placeholder="CODE"
          autoFocus
          onChange={(e) => setCodeInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
          onKeyDown={(e) => { if (e.key === 'Enter' && codeInput) join(codeInput) }}
          aria-label="Join code"
        />
        {error && <div className="live-err" role="alert">{error}</div>}
        <div className="actions">
          <button
            className="btn primary"
            onClick={() => join(codeInput)}
            disabled={joining || codeInput.length < 5}
          >
            {joining ? 'Joining…' : 'Join'}
          </button>
          <button className="btn ghost" onClick={onExit}>Back</button>
        </div>
      </div>
    )
  }

  const header = (
    <div className="player-id mono">
      You are <b>{identity.alias}</b> · {score} pts{myRank > 0 ? ` · #${myRank}` : ''}
    </div>
  )

  // ── Lobby ──
  if (session.status === 'lobby') {
    return (
      <div className="card live-player">
        {header}
        <h2>You’re in!</h2>
        <p className="reason">Waiting for the host to start the game…</p>
      </div>
    )
  }

  // ── Ended ──
  if (session.status === 'ended') {
    return (
      <div className="card live-player">
        {header}
        <h2>Game over</h2>
        <p className="reason">You finished <b>#{myRank}</b> with <b>{score}</b> points.</p>
        <LiveLeaderboard players={players} selfId={identity.playerId} limit={10} />
        <div className="actions"><button className="btn ghost" onClick={onExit}>Leave</button></div>
      </div>
    )
  }

  // ── Revealed ──
  if (session.status === 'revealed' && scenario) {
    const correct = decision === scenario.bestDecision
    return (
      <div className="card live-player">
        {header}
        {decision == null ? (
          <p className="reason">No answer recorded this round.</p>
        ) : (
          <h2 style={{ color: correct ? 'var(--good)' : 'var(--bad)' }}>
            {correct ? 'Correct!' : 'Not this time'}
          </h2>
        )}
        <p className="reason">
          Correct answer: <b>{scenario.bestDecision}</b>
          {lastPoints != null && lastPoints > 0 && <> · you earned <b>+{lastPoints}</b></>}
        </p>
        <p className="reason mono">Waiting for the host to continue…</p>
      </div>
    )
  }

  // ── Playing ──
  return (
    <div className="card live-player">
      {header}
      <div className="counter mono">
        INCIDENT <strong>{String(session.current_incident).padStart(2, '0')}</strong> / {session.deck.length}
      </div>
      {decision ? (
        <>
          <h2>Locked in</h2>
          <p className="reason">
            You chose <b>{decision}</b>. Waiting for the reveal…
          </p>
        </>
      ) : (
        <>
          <p className="prompt">What do you do?</p>
          <div className="decisions" role="group" aria-label="Choose a decision">
            {data.decisions.map((d, i) => (
              <button
                key={d.name}
                className="dec"
                style={{ '--dc': d.color } as React.CSSProperties}
                onClick={() => vote(d.name)}
                aria-label={`${i + 1}. ${d.name}: ${d.meaning}`}
              >
                <span className="k" aria-hidden="true">{i + 1}</span>
                <span className="nm">{d.name}</span>
                <span className="mn">{d.meaning}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
