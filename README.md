# EnergyIQ

EnergyIQ is a client-first household energy estimator and planning tool built with React, TypeScript, and Vite, with an optional Java 21 Spring Boot backend. It estimates energy from appliance schedules and can optionally forecast from recorded history; it is not a meter, sensor, or live monitoring system. The default build works entirely in the browser: no paid API, paid database, account, or continuously running server is required.

All formula-based values are estimates. Sample appliances and illustrative reference estimates are visibly labeled in the interface.

## Product terminology and limits

- **Recorded Usage** is a user-entered or backend-persisted observation, including an explicit zero. It does not imply that a meter or sensor captured the value. A current-day entry may be incomplete.
- **Estimated Daily Usage** is the present-day appliance formula result when there is no recorded observation.
- **Formula Projection** is a future result calculated only from appliance wattage, schedule, overrides, rate, and calendar length.
- **History-Based Forecast** is a future result generated from qualifying recorded history. Forecasts never blend in formula projection values.
- **Formula Estimate** on a historical report is a clearly labeled reconstruction fallback used only when that report period has no observations.
- **Illustrative Reference Estimate** is an EnergyIQ-bundled planning assumption. These values are not measured local, national, community, or peer data, and no external source date is claimed.

Whole-home comparisons are incomplete until the user adds the major energy loads in the home, including HVAC, water heating, refrigeration, cooking, lighting, laundry, EV charging, and pool equipment. Reference differences are planning context—not efficiency ratings, rankings, or energy audits. Full-stack H2 aggregates describe only records stored in that local installation and are not representative community or user statistics.

## Calculation contract

Formula Estimate uses one rule in both the frontend and backend:

```text
kWh/day = manualDailyKWhOverride ?? (wattage × hoursPerDay × daysPerWeek / 7 / 1000)
cost = kWh × electricityRate
estimated emissions = kWh × 0.394 kg CO₂/kWh
```

- Entered wattage is authoritative. The high-efficiency flag is informational.
- A manual daily kWh override, including zero, replaces the formula everywhere.
- Inactive and deleted appliances are excluded from household totals.
- Monthly estimates use the actual 28, 29, 30, or 31 days in the target calendar month; annual estimates use 365 or 366 days.
- The electricity rate is already in the selected currency. Switching USD/EUR preserves the numeric rate and changes only the label and formatting.
- The carbon result is an estimate based on the [U.S. EPA national electricity-consumption factor](https://www.epa.gov/energy/greenhouse-gas-equivalencies-calculator-calculations-and-references); regional emissions vary.

The shared defaults, source metadata, and cross-stack fixtures live in `shared/energy-domain.json` and are bundled into both applications.

## Client-only demo (default)

Requirements: Node.js 20 or newer and npm.

```powershell
cd frontend
npm ci
npm run dev
```

Open `http://localhost:5173`. With no environment variables, fail-safe Local Demo mode is enabled. The app uses hash routing and makes no backend, authentication, WebSocket, forecast, comparison, tips, or report requests.

All demo state is kept in the versioned `energyiq.demo.v2` localStorage record: appliances, settings, daily usage history, and initialization state. On first use, EnergyIQ loads five labeled sample appliances plus 90 deterministic days per appliance (450 entries) ending yesterday. It migrates the older `appliances`, `settings`, and `manualUsageLog` values once when present, and then continues from the v2 store after refresh.

Demo controls have deliberately different scopes:

- **Load Sample Home** refreshes sample-tagged appliances and history while preserving user-created records.
- **Remove Sample Data** removes only sample-tagged appliances and history.
- **Reset Demo Data** confirms before clearing all local appliances, settings, and history. A reset stays blank after refresh until the user explicitly loads samples.

The **Usage History** page accepts one non-negative daily value per date/scope, including zero. Scope may be a household total or an active appliance. Explicit household totals take precedence over per-appliance rows on the same day, future dates are rejected, and the incomplete current day is ignored by forecasting. Deleting an appliance retains its history and labels that history as belonging to a removed appliance.

The dashboard’s local printable report offers completed-day weekly and monthly views. It reports actual observed-day coverage without inventing missing observations, falls back visibly to Formula Estimate when the selected window has no history, and uses the browser print dialog to print or save as PDF. Server-generated PDFs remain an authenticated full-stack feature.

Useful client commands:

```powershell
npm run lint
npm test
npm run build
npm run preview
```

For a production static demo build:

```powershell
cd frontend
npm ci
npm run build
```

Deploy only the generated contents of `frontend/dist` to the static host. The default build uses hash routing, needs no backend, and keeps demo data in that browser's localStorage. Browser-local demo history is intentionally not synchronized into H2 when changing modes.

Runtime mode resolution is fail-safe:

| `VITE_DEMO_MODE` | `VITE_BACKEND_ENABLED` | Result |
|---|---|---|
| unset | unset | Local Demo |
| `true` | any value | Local Demo; all backend/WebSocket activity suppressed |
| `false` | `true` | Local full-stack |
| `false` | unset/`false` | Local Demo (fail-safe; full-stack was not fully enabled) |

## Optional local full-stack mode

Requirements: Java 21, Node.js 20 or newer, and npm. H2 is the zero-configuration database and is stored under `backend/data`; PostgreSQL remains optional through environment overrides.

Terminal 1:

```powershell
cd backend
.\mvnw.cmd spring-boot:run
```

Terminal 2:

```powershell
cd frontend
npm ci
npm run dev:fullstack
```

Open `http://localhost:5173`. Full-stack mode uses browser routing and enables accounts, authenticated persistence, server reports, WebSocket notifications, formula APIs, and the separate server History-Based Forecast option. Existing appliances and settings load as part of authentication, before login navigation completes. `.env.fullstack` sets `VITE_DEMO_MODE=false` and `VITE_BACKEND_ENABLED=true` for both full-stack scripts.

**Server history forecast (API-only):** full-stack mode has no Usage History editor. Enter appliance observations through authenticated `POST /api/energy-usage` with `applianceId`, `date`, and `kWhUsed` query parameters. The chart reads `GET /api/energy-usage/history-forecast?timeRange=daily` (also `weekly` or `monthly`). The Local Demo Usage History editor stores records only in the browser and does not synchronize them to H2. Server PDF reports remain available through the authenticated report controls.

The backend defaults to:

- H2: `jdbc:h2:file:./data/energy_tracker`
- Port: `8080`
- Allowed frontend origin: `http://localhost:5173`

Set `JWT_SECRET` for any non-local deployment. Database and CORS settings can be overridden with `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DRIVER`, and `CORS_ALLOWED_ORIGINS`. `CORS_ALLOWED_ORIGINS` is a comma-separated list used for both HTTP API requests and WebSocket handshakes, for example `https://energyiq.example,http://localhost:5173`.

## Tests and production builds

Run the complete frontend verification from a dependency-lock clean install:

```powershell
cd frontend
npm ci
npm run lint
npm test
npm run build
npm run build:fullstack
```

Run the Java 21 backend tests and create the executable Spring Boot package:

```powershell
cd backend
.\mvnw.cmd test
.\mvnw.cmd clean package
```

`npm run build` creates the server-free static demo. `npm run build:fullstack` creates a browser-routing frontend that expects the Spring application at the configured `/api` and `/ws` routes. The backend package is written under `backend/target`; run it with `java -jar target/backend-0.0.1-SNAPSHOT.jar`. H2 remains a local runtime database under `backend/data`.

Major pages load on demand. Production mode constants remove account routes, Axios request interceptors, JWT decoding, and STOMP/SockJS dependencies from the default client build; those dependencies remain available in the full-stack build.

Generated dependencies, build output, local databases, operating-system metadata, and logs are deliberately ignored. Do not add `frontend/node_modules`, `frontend/dist`, `backend/target`, `backend/data`, `.DS_Store`, database files, or `installation_summary.log` to source commits or archives.

## Projection and forecast modes

- **Formula Projection** is deterministic and is always available. Daily periods begin tomorrow, weekly periods begin next Monday, and monthly periods begin with the next complete calendar month.
- **History-Based Forecast** uses local history in Local Demo or authenticated H2 history entered through the API in full-stack mode. Local forecasting prefers per-appliance history when every active appliance qualifies, otherwise it uses a qualifying household-total series. Eligibility requires a finite, non-negative observation on **each of the latest 60 completed calendar days**, ending yesterday, for the household series or every active appliance. Duplicate dates count once; old records, gaps, invalid values, today, and future observations cannot unlock a forecast. The model trains on that same 60-day window. Coverage also reports distinct observed days in the latest 90 completed days (at most 90), using the minimum across active appliances. Coverage is an observation count, not an accuracy or confidence rating; holdout error is used only for parameter tuning. Household-only forecasts disable the per-appliance chart breakdown. If history is insufficient, the UI returns to Formula Projection and never mixes the two data sources.
- Forecast API metadata uses `dataCoverage`, `historyDays` (latest 90 completed days), and `recentHistoryDays` (latest 60 completed days); the unsupported `confidence` rating has been removed.
- Holt and Holt-Winters calculations are deterministic: identical history produces identical output, with no injected random noise or static seasonal adjustment.

## Technology

- Frontend: React 18, TypeScript, Vite, Tailwind CSS, Recharts, Vitest
- Backend: Java 21, Spring Boot, Spring Security/JWT, JPA/Hibernate, WebSockets
- Local database: H2
- Optional database override: PostgreSQL

## Demo and credits

An earlier demo video is available on [YouTube](https://www.youtube.com/watch?v=tlNz26ZmPZE). Some behavior shown there predates the client-first stabilization described above.

Author: Tonna Agburu  
License: MIT
