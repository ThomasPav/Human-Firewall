# Human Firewall

A cyber-security awareness card game for non-technical staff — HR, finance, sales, executives, admin, new hires, and remote workers.

Players face real-world incidents like phishing emails, fake invoices, deepfake phone calls, QR code scams, and MFA fatigue attacks. For each incident the team chooses how to react. Every decision has consequences that move four shared meters. Survive 20 incidents in good shape and your organisation wins.

---

## How to play

Each round presents a scenario — a suspicious email, an urgent call from IT, a strange link from a colleague. You pick one of five responses:

| Decision | Meaning |
|----------|---------|
| **TRUST** | Take it at face value and act |
| **VERIFY** | Check with the source before doing anything |
| **REPORT** | Flag it to security or your manager |
| **IGNORE** | Do nothing |
| **ESCALATE** | Treat it as a potential incident and involve leadership |

Not every scenario is an attack. On legitimate requests, trusting is correct — over-reacting carries a cost. That tension is the point: the game teaches judgement, not just suspicion.

The right call depends on context. After each decision the game reveals what would really happen and what the best move was — that's the learning moment.

### The four meters

| Meter | Starts at | Instant loss if... |
|-------|-----------|-------------------|
| Reputation (R) | 70 | Drops to 0 |
| Funds ($) | 100 | Drops to 0 |
| Security (S) | 60 | Drops to 0 |
| Stress (X) | 30 | Hits 100 |

After 20 incidents you win only if every meter is in the safe zone (R ≥ 50, $ > 0, S ≥ 40, Stress ≤ 80). Your final Security score earns a star rating.

### Two modes

- **Solo** — self-paced, one player, personal score and rating at the end.
- **Facilitator** — projection screen for workshops: larger text, team framing, and an Event card button for surprise twists.

---

## Running locally

Requires [Node.js](https://nodejs.org) 18+.

```bash
git clone https://github.com/ThomasPav/Human-Firewall.git
cd Human-Firewall
npm install
npm run dev
```

The app opens at `http://localhost:5173`.

```bash
npm run build   # production build → dist/
```

---

## Deploying

`npm run build` produces a `dist/` folder that is a fully static site — host it anywhere:

- **Netlify** — connect the repo and set the build command to `npm run build`, publish directory to `dist`
- **Vercel** — import the repo; Vite is auto-detected
- **Cloudflare Pages** — same as Vercel
- **GitHub Pages** — push `dist/` to a `gh-pages` branch or use the Actions workflow
- **Any static host or intranet** — upload `dist/` as-is

---

## Tech stack

- [Vite](https://vitejs.dev/) + [React](https://react.dev/) + TypeScript
- All game content lives in `game-data.json` — no hard-coded scenarios
- Responsive, keyboard-accessible (number keys 1–5 select decisions), respects `prefers-reduced-motion`

---

## Project structure

```
game-data.json        — single source of truth for all scenarios, rules, and content
src/
  App.tsx             — top-level game state and routing
  gameLogic.ts        — meter clamping, win/loss checks, scoring
  types.ts            — TypeScript interfaces matching game-data.json
  components/
    screens/          — StartScreen, ScenarioScreen, OutcomeScreen, EndScreen
humanfirewall.html    — standalone single-file reference implementation
```

---

## Scenarios covered

Phishing emails · Fake IT support calls · Deepfake audio/video · Malicious QR codes · MFA fatigue attacks · Suspicious invoice requests · Impersonation scams · Data handling mistakes · USB drop attacks · Social engineering · Legitimate requests that test over-reaction

---

## Licence

MIT — free to use, adapt, and run in your organisation.
