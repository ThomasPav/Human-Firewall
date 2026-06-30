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
- **Team (pass-and-play)** — 2–6 players share one device and the four meters,
  taking turns deciding; an anonymous per-player scoreboard at the end.
- **Facilitator** — a single-screen presenter view for a room: larger type,
  “the team decides” framing, and a button to draw Event cards.
- **Live Compete (Menti-style)** — many players join from their phones with a code
  or QR and answer each incident in real time, **anonymously**; after each card the
  host shows the percentage who picked each choice. **This needs a backend** (see
  below); the single-file `humanfirewall.html` cannot do cross-device sync on its
  own — Live Compete lives in the React app only.

## Live Compete (the Menti-style mode) — as built

A host opens a session on a shared/projector screen; players scan a QR or enter a
short code on their phones and play **anonymously**. Each incident everyone picks a
decision; the host shows a live "X of Y answered" count, then on **Reveal** a
horizontal **bar chart of the percentage who chose each decision**, highlights the
correct one (`bestDecision`), and shows the outcome + `learn`. Players compete on
**individual points** (correct pick vs `bestDecision`, plus a speed bonus), shown on
a live anonymous leaderboard. The four meters are intentionally **not** used here —
the competition is individual, not the shared-meter game.

**Anonymity:** we store only an opaque player id + a random alias (e.g. "Teal
Otter") + score. No names, emails, or PII are ever collected or shown. The id lives
in the phone's `localStorage`, so a refresh/reconnect keeps the same score.

**Stack:** Supabase (Postgres + Realtime); the React app subscribes to row changes.
QR is generated client-side with the `qrcode` package; it encodes `<app-url>/join/<code>`.

**Data model (`supabase/migrations/0001_live_compete.sql`):**
- `sessions` (id, code, status[`lobby|playing|revealed|ended`], current_incident,
  deck[jsonb of 20 scenario ids], created_at).
- `players` (id, session_id, alias, score, total_ms[tie-break], joined_at).
- `votes` (id, session_id, incident, player_id, decision, answered_at) — unique on
  (session_id, incident, player_id).

**Code map:** logic in `src/live/` (`supabaseClient`, `api`, `scoring`, `alias`,
`types`); screens in `src/components/screens/live/` (`LiveHost`, `LivePlayer`,
`BarChart`, `LiveLeaderboard`). The deck reuses `buildDeck` via `buildDeckIds`.

### Live Compete setup

1. Create a free project at [supabase.com](https://supabase.com).
2. In the project's **SQL Editor**, paste and run
   `supabase/migrations/0001_live_compete.sql` (creates the tables, RLS policies,
   and adds them to the realtime publication).
3. Copy `.env.example` to `.env.local` and fill in `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY` from **Project Settings → API**. Optionally set
   `VITE_APP_URL` to your deployed origin so phones scan a reachable QR.
4. `npm run dev` (restart if it was already running). The start screen's **Live
   Compete** button opens the host; phones join at `<app-url>/join/<code>`.
5. Deploying to a static host? `public/_redirects` handles SPA deep links on
   Netlify; on Vercel add an equivalent rewrite (see the file's comment).

Without those env vars the Live Compete button shows a "setup needed" notice;
Solo, Team, and Facilitator work with no backend.

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
