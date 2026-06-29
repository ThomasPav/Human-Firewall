# Human Firewall — digital build spec

A cyber-security awareness card game for non-technical staff (HR, finance, sales,
executives, admin, new hires, remote workers). Players face everyday incidents
(phishing, fake invoices, deepfake calls, QR scams, MFA fatigue, etc.) and choose
how to react. Consequences move four shared meters. The team wins by surviving
20 incidents in good shape.

This folder is the source of truth for any digital version. **Build from
`game-data.json`, never from a PDF** — the JSON holds every scenario, all five
decision outcomes, the score changes, roles, events, and the win/lose rules.

`humanfirewall.html` is a working reference implementation (open it in a browser).
Use it as the spec-in-code, then extend or rebuild as below.

---

## Data model (`game-data.json`)

- `meta` — title, subtitle, `incidentsPerGame` (20).
- `meters` — four meters keyed `R` (Reputation), `M` (Funds, shown as `$Nk`),
  `S` (Security), `X` (Stress). Each has `start`, `min`, `max`, `winLine`,
  `warn`, `crit`, and `higherIsBetter`. **Stress is the only meter where lower is
  better** (`higherIsBetter: false`).
- `decisions` — the four choices: TRUST, VERIFY, REPORT, ESCALATE (IGNORE was
  removed), each with a one-line `meaning` and a display `color`.
- `scenarios` — 40 cards, each with `id`, `category`/`categoryLabel`/`color`,
  `type`, `title`, `targets`, `text`, `best`, `learn`, a `legitimacy` flag
  (`malicious` | `legitimate` | `ambiguous`), a `bestDecision` (the single canonical
  right card: TRUST | VERIFY | REPORT | ESCALATE), and an `outcomes` map.
  Each outcome has `text` and a `deltas` object using meter keys, e.g.
  `{"S": -28, "X": 15}`. Missing keys mean no change. The deck is split evenly:
  10 scenarios per decision.
- `roles` — seven workplace roles with `description`, `targetedBy`, `ability`.
- `events` — twist cards, each with a `channel` (a scenario category, or null),
  `channelLabel`, `color`, `text`, and a structured `effect`:
  - `{"kind":"meter","deltas":{...}}` — apply the meter change immediately.
  - `{"kind":"amplify","mult":2,"duration":3}` — for the next `duration`
    incidents, multiply the **wrong-answer** penalty on cards of this `channel`.
  - `{"kind":"reward_best","amount":5,"duration":3}` — for the next `duration`
    incidents, a correct answer earns +`amount` Security.
- `ratings` — final score bands based on the Security meter.

## Game rules to preserve

1. Start each meter at its `start` value.
2. Per incident: show a scenario, play one decision, reveal the matching outcome,
   apply its `deltas` (clamp to min/max), then show `best` and `learn`.
3. **Instant loss** the moment any meter crashes: R, M or S reach `min` (0), or X
   reaches `max` (100).
4. After 20 incidents with no crash, **win** only if every meter is on the safe
   side of its `winLine` (R≥50, M>0, S≥40, X≤80). Otherwise it's an
   “exposed” ending.
5. Final star rating comes from the Security meter via `ratings`.
6. **Decision tension:** not every scenario is an attack. On `legitimate` scenarios
   TRUST is correct and over-reacting (REPORT / needless VERIFY) costs; on
   `ambiguous` ones VERIFY usually wins but TRUST is a gamble. Knowing the
   `legitimacy` doesn't hand you the answer (a legitimate request can still need
   ESCALATE; an attack can still be best handled by VERIFY). Show `legitimacy` on
   the outcome screen.
7. **Use every decision:** all four cards are correct answers, 10 scenarios each.
   Each 20-card round is built to include at least one scenario per `bestDecision`
   and to cap any single one (cap = round-size ÷ 4, so ≈ 5 of 20). Preserve
   this balanced draw.
8. **Harder scoring & correlated events:** wrong answers bite (penalties are already
   scaled up in the data). Event cards correlate with a scenario `channel`: an
   `amplify` event doubles the wrong-answer penalty on that channel for a few
   incidents; `reward_best` and `meter` events give relief. Implement events as an
   active modifier on game state (with a `until` incident), apply the multiplier in
   the scoring step only when the chosen decision is **not** the `bestDecision` and
   the scenario's `category` matches the active event's `channel`.

## Required modes

- **Solo** — self-paced; one player; score and rating at the end.
- **Facilitator** — a single-screen presenter view for a room: larger type,
  “the team decides” framing, and a button to draw Event cards.
- **Live multiplayer (Menti-style)** — many players join from their phones with a
  code or QR and answer each incident in real time. **This needs a backend** (see
  below); the single-file `humanfirewall.html` cannot do cross-device sync on its
  own.

## Live multiplayer spec (the Menti-style mode)

Goal: a host opens a session on a shared screen; players scan a QR or enter a short
code on their phones; each incident, everyone picks a decision; the host screen
shows a live tally, then reveals the outcome and updates the shared meters.

**Recommended stack (easiest for this):** Supabase (Postgres + Realtime) — no
server to run; the React app subscribes to row changes. Alternatives: Firebase
Realtime DB, PartyKit or Ably (WebSocket rooms), or a tiny Node + `ws` server.
Generate the QR client-side with the `qrcode` npm package; the QR encodes the join
URL `https://yourapp/join/<code>`.

**Data model (Supabase tables):**
- `sessions` (id, code, host_id, status[`lobby|playing|revealed|ended`],
  current_incident, deck[jsonb of 20 scenario ids], meters[jsonb], active_event[jsonb]).
- `players` (id, session_id, name, joined_at, score).
- `votes` (id, session_id, incident, player_id, decision) — one row per player per
  incident.

**Screens to build:**
- **Host / present:** create session → show code + QR → lobby with joined players
  → per incident: show scenario big, a live count of votes per decision, a
  “Reveal” button → on reveal, resolve using the **majority** (or host-picked)
  decision, apply `deltas` to shared meters, show outcome + learn → Next.
- **Player (phone):** join by code/QR → enter name → each incident shows the four
  decision buttons → tap to vote → “locked in” until reveal → see the outcome and
  their running personal score (award points for matching the `bestDecision`).
- Reuse all existing rules, scoring, the balanced 20-card `buildDeck`, and the
  event modifiers — the only new parts are session/realtime sync and the
  vote-aggregation step.

**Flow:** host create → players join (Realtime presence) → host starts → for each
of 20 incidents: players vote (Realtime inserts) → host reveals (majority resolves,
meters update, broadcast) → repeat → end screen with team result + a per-player
leaderboard.

## Other build options

- **Quick win:** ship `humanfirewall.html` (Solo + Facilitator) as-is — single
  file, hosts anywhere, works offline. No multiplayer.
- **Microsoft Teams tab:** wrap the web app with the Teams JS SDK as a static tab.
- **Speed Round:** 60-second timer per incident.
- **Industry packs:** add a `sector` field and filter (hospitals, banks, schools,
  retail, shipping).

## A prompt you can paste into Claude Code

> Read `game-data.json` and `README.md`. Build a Vite + React + TypeScript app that
> implements Human Firewall exactly as the README describes: four decisions
> (TRUST/VERIFY/REPORT/ESCALATE), 40 scenarios, 20-incident rounds, the four-meter
> scoring with harder penalties, the balanced `buildDeck`, the verdict badge driven
> by `legitimacy`, and the channel-correlated event modifiers (amplify / reward_best
> / meter). Load everything from `game-data.json`; use `humanfirewall.html` as the
> Solo + Facilitator reference. Then add the Live multiplayer mode using Supabase
> Realtime per the README spec: host screen with a join code + QR (qrcode package),
> phone join screen, live vote tally, majority-resolves-the-incident, shared meters,
> and a per-player leaderboard.
