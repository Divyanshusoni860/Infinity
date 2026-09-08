# Finqy — Loan Tools

A small full-stack web app hosting a growing set of loan tools behind one
home dashboard — currently the Car Loan BT Top-Up Advisor, a Car Refinance
checker (for vehicles with no existing loan), and an EMI Calculator, with
more tools stubbed in as "coming soon" cards. Every tool page also has a
"Handy tools" side rail so you can jump between them without going back to
the dashboard.

Zero external dependencies — built entirely on Node.js's built-in `http`
and `fs` modules, so there's nothing to `npm install`.

## Project structure

```
finqy-app/
├── server.js              Entry point — HTTP server + tiny router
├── package.json
├── lib/
│   └── eligibility.js     BT Top-Up eligibility engine (pure functions)
├── db/
│   ├── store.js           File-based "database" (read/write JSON)
│   └── lenders.seed.json  Default lender policies (seeds the db on first run)
├── routes/
│   ├── lenders.js         GET/POST/PUT/DELETE /api/lenders (both BT + refinance)
│   └── check.js           POST /api/check, POST /api/check-refinance, GET/DELETE /api/history
├── data/                  Created automatically — this is your live database
│   ├── lenders.json       Your lenders, persisted (survives restarts)
│   └── history.json       Log of past eligibility checks (tagged `type: "bt"|"refinance"`)
└── public/                Frontend (served as static files)
    ├── index.html          Home dashboard — links to every tool
    ├── home.js              "Coming soon" toast for disabled tool cards
    ├── style.css            Shared glassmorphism theme, used by every page
    ├── bt-topup.html         Car Loan BT Top-Up Advisor
    ├── bt-topup.js
    ├── refinance.html        Car Refinance checker (loan-closed vehicle)
    ├── refinance.js
    ├── emi-calculator.html   EMI Calculator (client-side only, no API calls)
    └── emi-calculator.js
```

Each tool is its own HTML + JS pair under `public/`, all sharing
`style.css`. Clean URLs work without the `.html` — `/bt-topup` and
`/emi-calculator` both resolve automatically (see `serveStatic` in
`server.js`). To add a new tool later: drop in `public/<tool>.html` +
`public/<tool>.js`, then flip its card on the home dashboard from
`disabled` to a real `href="/<tool>"` link.

## BT Top-Up vs. Refinance

Both live in the same `lenders.json`, distinguished by a `category` field:

- **`"bt"`** — balance-transfer + top-up on an *existing* car loan.
  Calculated from EMI/valuation × tier multiplier, then a top-up
  (cash-out) = loan amount − closure amount. Some lenders cap the
  **total loan** (`loanCapping`), some instead cap the **top-up itself**
  (`maxTopupCap`, or `maxTopupMultipleOfEMI` for Hero STAR's "2× current
  EMI" rule) — both are enforced in `lib/eligibility.js`.
- **`"refinance"`** — for a vehicle with **no existing loan** (already
  closed / fully owned). Just `valuation × multiplier`, no topup/closure
  math. These 5 lenders were cloned from their BT counterparts per your
  mapping: ICICI Max Refinance ← ICICI, Axis Max Refinance ← Axis IP
  (FOIR Met), Piramal Max Refinance ← Piramal, Hero Max ← Hero
  (Multiplier), TATA Max Refinance ← Tata Capital — each with its own
  refinance multiplier and owner limit from the policy sheet.


## Running it on Windows

1. **Install Node.js** (one-time setup): download the LTS installer from
   [nodejs.org](https://nodejs.org) and run it. This also installs a
   Command Prompt-usable `node` command.

2. **Unzip this folder** anywhere, e.g. `C:\Users\You\Documents\finqy-app`.

3. **Open Command Prompt** (or PowerShell) in that folder:
   - In File Explorer, click the address bar, type `cmd`, press Enter — it
     opens a Command Prompt already inside the folder.

4. **Start the server:**
   ```
   node server.js
   ```
   You should see:
   ```
   Finqy — Loan Tools
   Server running at http://localhost:3000
   ```

5. **Open your browser** to **http://localhost:3000** — that's the home
   dashboard, with a card for every tool.

6. To stop the server, go back to the Command Prompt window and press
   `Ctrl + C`.

No `npm install` step is needed — there are no external packages.

## How the "database" works

`data/lenders.json` and `data/history.json` are created automatically the
first time you run the server (seeded from `db/lenders.seed.json`). Every
edit you make in the **Lenders** tab is saved straight to
`data/lenders.json`, so your changes survive closing and reopening the app.

If you ever want to wipe your edits and start over, either:
- click **"Reset to defaults"** in the Lenders tab, or
- delete `data/lenders.json` and restart the server — it'll be re-seeded.

## Changing the port

By default it runs on port 3000. To use a different one:
```
set PORT=8080 && node server.js
```
(PowerShell: `$env:PORT=8080; node server.js`)

## Swapping in a real database later

Everything the rest of the app touches goes through the functions exported
by `db/store.js` (`getLenders`, `saveLenders`, `addLender`, etc.). If you
outgrow the JSON-file store, you can rewrite just that one file to talk to
SQLite/Postgres/MySQL instead — `server.js`, the routes, and the frontend
don't need to change.
