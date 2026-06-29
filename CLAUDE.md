# CLAUDE.md — Human Firewall

## What this project is
A cyber-security awareness card game for **non-technical staff** (HR, finance,
sales, executives, admin, new hires, remote workers). Players face everyday
incidents (phishing, fake invoices, deepfake calls, QR scams, MFA fatigue, etc.)
and choose how to react. Consequences move four shared meters. The team wins by
surviving 20 incidents in good shape.

## Source of truth — read this first
- **`game-data.json`** is the single source of all content. Build the app to load
  it at runtime. **Never hard-code scenarios, outcomes, roles, or events.**
- **`README.md`** documents the game and project for contributors.
- **`humanfirewall.html`** is the working reference implementation — match its
  behaviour and visual feel.

## Data model (in `game-data.json`)
- `meters`: four meters keyed `R` (Reputation), `M` (Funds, shown as `$Nk`),
  `S` (Security), `X` (Stress). Each has `start`, `min`, `max`, `winLine`, `warn`,
  `crit`, `higherIsBetter`. **Stress is the only meter where lower is better**
  (`higherIsBetter: false`).
- `decisions`: TRUST, VERIFY, REPORT, ESCALATE (four cards; IGNORE was removed) —
  each has `meaning` + `color`.
- `scenarios`: 40 cards, each with `id`, `category`/`categoryLabel`/`color`, `type`,
  `title`, `targets`, `text`, `best`, `learn`, `legitimacy` (`malicious` |
  `legitimate` | `ambiguous`), `bestDecision` (the single canonical right card:
  TRUST | VERIFY | REPORT | ESCALATE), and an `outcomes` map. Each outcome has
  `text` and a `deltas` object using meter keys, e.g. `{"S": -28, "X": 15}`. A
  missing key means no change. The deck is split evenly: 10 scenarios per decision.
- `roles`, `ratings` (final bands from the Security meter).
- `events`: twist cards, each with a `channel` (a scenario `category`, or null),
  `channelLabel`, `color`, `text`, and a structured `effect`:
  - `{"kind":"meter","deltas":{…}}` — apply the meter change immediately.
  - `{"kind":"amplify","mult":2,"duration":3}` — for the next `duration` incidents,
    multiply the **wrong-answer** penalty on cards of this `channel`.
  - `{"kind":"reward_best","amount":5,"duration":3}` — for the next `duration`
    incidents, a correct answer earns +`amount` Security.

## Rules that must stay correct
1. Start each meter at its `start` value; clamp every change to `min`/`max`.
2. Per incident: show scenario → play one decision → reveal that outcome → apply
   `deltas` → show the scenario's `best` move and `learn` point.
3. **Instant loss** the moment any meter crashes: R, M or S hit `min` (0), or X
   hits `max` (100).
4. After 20 incidents with no crash, **win only if every meter is on the safe side
   of its `winLine`** (R≥50, M>0, S≥40, X≤80). Otherwise it's an "exposed" ending.
5. Final star rating comes from the Security meter via `ratings`.
6. **Decision tension:** not every scenario is an attack. On `legitimate` scenarios
   TRUST is correct and over-reacting carries a cost; on `ambiguous` ones VERIFY
   wins but TRUST is a gamble rather than an automatic failure. Show `legitimacy`
   on the outcome screen (attack / legitimate / judgment call).
7. **Balanced draw:** all four decisions are correct answers across the deck
   (10 scenarios each). `buildDeck` must include at least one scenario per
   `bestDecision` and cap any single one (cap = round-size ÷ 4, ≈5 of 20).
8. **Harder scoring & correlated events:** penalties are scaled up in the data.
   Apply an active `amplify` event's multiplier in the scoring step **only** when
   the chosen decision is **not** the `bestDecision` and the scenario's `category`
   matches the active event's `channel`; `reward_best` adds Security on a correct
   call; both expire after their `duration`. Show the active modifier as a banner.

## Two required modes
- **Solo** — self-paced, one player, score + rating at the end.
- **Facilitator** — projection/presenter screen: larger type, "the team decides"
  framing, and a button to draw an Event card.

## Tech & conventions
- Target stack: **Vite + React + TypeScript** (unless told otherwise).
- Keep all content in `game-data.json`; type the data with interfaces.
- Responsive down to mobile; keyboard-accessible (number keys 1–4 select decisions);
  respect `prefers-reduced-motion`; visible focus states.
- Keep the four-meter HUD and the per-decision meter animation — that consequence
  feedback is the core of the experience.
- Run with `npm run dev`; build with `npm run build`.

## Working style
- This is a real, reviewable project: prefer small, committed steps. Show diffs
  before large rewrites. Don't introduce a backend unless asked.
