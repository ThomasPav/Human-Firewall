# CLAUDE.md — Human Firewall

## What this project is
A cyber-security awareness card game for **non-technical staff** (HR, finance,
sales, executives, admin, new hires, remote workers). Players face everyday
incidents (phishing, fake invoices, deepfake calls, QR scams, MFA fatigue, etc.)
and choose how to react. Consequences move four shared meters. The team wins by
surviving 10 incidents in good shape.

## Source of truth — read this first
- **`game-data.json`** is the single source of all content. Build the app to load
  it at runtime. **Never hard-code scenarios, outcomes, roles, or events.**
- **`README.md`** is the full build spec. Follow it.
- **`humanfirewall.html`** is the working reference implementation — match its
  behaviour and visual feel.
- **Ignore `Human_Firewall_Kit.pdf`.** It's only the printable kit; do not parse
  it for content. All structured data lives in `game-data.json`.

## Data model (in `game-data.json`)
- `meters`: four meters keyed `R` (Reputation), `M` (Funds, shown as `$Nk`),
  `S` (Security), `X` (Stress). Each has `start`, `min`, `max`, `winLine`, `warn`,
  `crit`, `higherIsBetter`. **Stress is the only meter where lower is better**
  (`higherIsBetter: false`).
- `decisions`: TRUST, VERIFY, REPORT, IGNORE, ESCALATE — each has `meaning` + `color`.
- `scenarios`: `id`, `category`/`categoryLabel`/`color`, `type`, `title`,
  `targets`, `text`, `best`, `learn`, and an `outcomes` map. Each outcome has
  `text` and a `deltas` object using meter keys, e.g. `{"S": -20, "X": 15}`.
  A missing key means no change to that meter.
- `roles`, `events` (some have a numeric `effect`; null `effect` = a rule the
  facilitator applies by hand), `ratings` (final bands from the Security meter).

## Rules that must stay correct
1. Start each meter at its `start` value; clamp every change to `min`/`max`.
2. Per incident: show scenario → play one decision → reveal that outcome → apply
   `deltas` → show the scenario's `best` move and `learn` point.
3. **Instant loss** the moment any meter crashes: R, M or S hit `min` (0), or X
   hits `max` (100).
4. After 10 incidents with no crash, **win only if every meter is on the safe side
   of its `winLine`** (R≥50, M>0, S≥40, X≤80). Otherwise it's an "exposed" ending.
5. Final star rating comes from the Security meter via `ratings`.

## Two required modes
- **Solo** — self-paced, one player, score + rating at the end.
- **Facilitator** — projection/presenter screen: larger type, "the team decides"
  framing, and a button to draw an Event card.

## Tech & conventions
- Target stack: **Vite + React + TypeScript** (unless told otherwise).
- Keep all content in `game-data.json`; type the data with interfaces.
- Responsive down to mobile; keyboard-accessible (number keys 1–5 select decisions);
  respect `prefers-reduced-motion`; visible focus states.
- Keep the four-meter HUD and the per-decision meter animation — that consequence
  feedback is the core of the experience.
- Run with `npm run dev`; build with `npm run build`.

## Working style
- This is a real, reviewable project: prefer small, committed steps. Show diffs
  before large rewrites. Don't introduce a backend unless asked.
