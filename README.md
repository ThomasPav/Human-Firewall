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
- `decisions` — the five choices: TRUST, VERIFY, REPORT, IGNORE, ESCALATE,
  each with a one-line `meaning` and a display `color`.
- `scenarios` — each has `id`, `category`/`categoryLabel`/`color`, `type`,
  `title`, `targets`, `text`, `best`, `learn`, a `legitimacy` flag
  (`malicious` | `legitimate` | `ambiguous`), a `bestDecision` (the single canonical
  right card: TRUST | VERIFY | REPORT | IGNORE | ESCALATE), and an `outcomes` map.
  Each outcome has `text` and a `deltas` object using meter keys, e.g.
  `{"S": -20, "X": 15}`. Missing keys mean no change to that meter.
- `roles` — seven workplace roles with `description`, `targetedBy`, `ability`.
- `events` — facilitator twist cards. Some have a numeric `effect` (apply it
  directly); where `effect` is null the `text` is a rule the facilitator applies.
- `ratings` — final score bands based on the Security meter.

## Game rules to preserve

1. Start each meter at its `start` value.
2. Per incident: show a scenario, the player/team plays one decision, reveal the
   matching outcome, apply its `deltas` (clamp each meter to min/max), then show
   the scenario's `best` move and `learn` point.
3. **Instant loss** the moment any meter crashes: R, M or S reach `min` (0), or X
   reaches `max` (100).
4. After 20 incidents with no crash, **win** only if every meter is on the safe
   side of its `winLine` (R≥50, M>0, S≥40, X≤80). Otherwise it's an
   “exposed” ending.
5. Final star rating comes from the Security meter via `ratings`.
6. **Decision tension (important):** not every scenario is an attack. On
   `legitimate` scenarios, TRUST is the correct move and over-reacting (REPORT /
   IGNORE / needless VERIFY) carries a cost; on `ambiguous` ones, VERIFY wins but
   TRUST is a gamble rather than an automatic failure. Preserve these costs —
   they are what stop players defaulting to "always REPORT." Show the scenario's
   `legitimacy` on the outcome screen (attack / legitimate / judgment call) to
   reinforce the lesson.
7. **Use every decision (important):** all five cards must be correct answers
   across the deck — TRUST on legitimate requests, VERIFY on the ambiguous,
   REPORT on clear attacks, IGNORE on nuisances that aren't incidents (spam,
   hoaxes, trolls, strangers), and ESCALATE on judgment calls above your authority
   (press/regulator questions, big access grants, insider mistakes, extortion).
   Each round's 20-card deck is built to include at least one scenario for every
   `bestDecision` and to cap any single one (the cap scales with round size) so no card — VERIFY
   especially — dominates. Preserve this balanced draw.

## Two required modes

- **Solo** — self-paced; one player; show a score and rating at the end.
- **Facilitator** — a projection/presenter screen for a workshop: larger type,
  “the team decides” framing, and the ability to draw an Event card.

## Suggested builds (pick per goal)

- **Quick win (no backend):** ship `humanfirewall.html` as-is on Netlify, GitHub
  Pages, or your intranet. Single file, works offline.
- **App with structure:** scaffold a Vite + React app; load `game-data.json`,
  split the screens (Start, Scenario, Outcome, End) into components, keep the
  exact rules above. Good base for adding accounts, content packs, or analytics.
- **Microsoft Teams tab:** wrap the web app with the Teams JS SDK and register it
  as a static tab so staff play inside Teams.
- **Self-paced training at scale:** add a tiny backend to record completion and
  scores per user, and an admin view of results.

## Stretch ideas (from the original concept)

- Speed Round (60-second timer per incident).
- Industry packs (hospitals, banks, schools, retail, shipping) — add scenarios
  with a `sector` field and filter by it.
- AI-generated practice phishing and company-customised scenarios.

## A prompt you can paste into Claude Code

> Read `game-data.json` and `README.md` in this folder. Build a Vite + React +
> TypeScript web app that implements the Human Firewall game exactly as the README
> describes, with Solo and Facilitator modes. Load all content from
> `game-data.json` (do not hard-code scenarios). Keep the four-meter scoring,
> instant-loss and win-line rules, and the end-screen star rating. Make it
> responsive and keyboard-accessible. Use `humanfirewall.html` as the visual and
> behavioural reference. Then add a Microsoft Teams tab wrapper behind a feature flag.
