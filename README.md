### EnergyIQ

EnergyIQ is a full‑stack web application that helps households monitor, forecast, and reduce energy consumption by combining appliance‑level tracking, custom time‑series forecasting, and real‑time alerts for actionable, eco‑friendly decisions.

---

### What it does
- **Monitor appliances:** add, edit, and track devices with estimated energy usage.  
- **Forecast consumption:** daily, weekly, monthly, and annual predictions per appliance and for the whole household.  
- **Real‑time alerts:** notifications for high usage, currency/cost changes, and forecast updates via WebSockets.  
- **Visualize impact:** interactive charts for energy trends, projected costs, and carbon footprint.  
- **Flexible access:** guest mode for trial use and authenticated accounts for persistent data and full features.

---

### features
- **Appliance Management** — store device metadata (wattage, typical hours/day, category) and view per‑appliance and aggregated usage.  
- **Forecasting Engine** — combines historical logs and appliance simulations to produce interpretable predictions.  
- **Anomaly Detection & Tolerance Caps** — detect unrealistic spikes and cap extreme estimates to keep forecasts realistic.  
- **Interactive Charts** — Recharts visualizations for historical vs. predicted consumption and cost breakdowns.  
- **Real‑time Notifications** — server pushes alerts for threshold breaches and model updates.  
- **Guest & Authenticated Flows** — lightweight guest experience plus JWT‑protected accounts for saved data.

---

### forecasting
EnergyIQ prioritizes interpretability and responsiveness while handling sparse and uneven home energy data.

- **Holt Linear Trend** — used when historical data is limited; models level and trend but not seasonality.  
- **Holt‑Winters Additive** — applied when sufficient history exists; models level, trend, and weekly seasonality (season length = 7 days).  
- **Fallback Estimation** — for new appliances or new users: wattage × hours/day with weekly seasonal multipliers and injected random noise to avoid perfectly flat forecasts.  
- **Data preprocessing** — log entries are grouped by date and summed to form a daily time series used by the models.  
- **Design choices**  
  - **Season length = 7** to capture weekly usage cycles.  
  - **Manual algorithm implementation** for transparency, custom tuning, and deterministic behavior.  
  - **Noise injection** to simulate realistic variance and avoid overconfidence.  
  - **Tolerance thresholds** to detect anomalies and cap unrealistic predictions.

This combination balances accuracy for frequent users, reasonable default behavior for new users, and interpretability for explainable recommendations.

---

### Architecture & technologies
- **Frontend:** React, TypeScript, Tailwind CSS, Recharts, Lucide Icons  
  - Run locally: **npm run dev**
- **Backend:** Spring Boot, Java, JPA/Hibernate  
  - Run locally: **mvn spring-boot:run**
- **Database:** H2 for demo; PostgreSQL for production  
- **Real‑time:** WebSockets via Spring SimpMessagingTemplate  
- **Auth:** JWT authentication for protected endpoints

---

### Demo
A 5‑minute demo video can be viewed on youtube with this link: https://www.youtube.com/watch?v=tlNz26ZmPZE 

---

### Getting started 
1. Clone the repository.  
2. Start the backend: `mvn spring-boot:run` (configure PostgreSQL or use H2 for demo).  
3. Start the frontend: `npm install` then `npm run dev`.  
4. Open the frontend in your browser and try guest mode or sign up.

---

### Responsive QA checklist (sidebar/header)
- **~768px (md breakpoint):**
  - Confirm the sidebar can be opened from the header menu button and stays visible without overlapping main content.
  - Confirm the main content shifts right when the sidebar is open and shifts back when closed.
  - Confirm there is only one trigger path for mobile (`Header` menu) and no duplicate floating toggles.
- **~1024px (lg breakpoint):**
  - Confirm the desktop open control appears in the header when the sidebar is collapsed.
  - Confirm the sidebar close control is available inside the sidebar on desktop.
  - Confirm navigation links do not unexpectedly close the sidebar on desktop.
- **Keyboard focus behavior (both widths):**
  - Tab to the header sidebar trigger and activate it with `Enter`/`Space`.
  - After opening, tab to the sidebar close button and activate it with `Enter`/`Space`.
  - Verify focus order remains logical (header controls → main content when closed, sidebar controls included when open).

---

### Future goals / next steps
- Improve Guest mode functionality to ensure access and proper usage for both authenticated and unauthenticated users.
- Integrate real energy APIs or smart‑plug telemetry.  
- Add adaptive ML models that learn per‑home profiles.  
- Mobile responsive improvements and progressive web app support.  
- Public beta to collect real user data and validate forecasts.

---
I created a webpage that has the demo video, and explains the forecasting models and their usages in more detail, and also includes API testing instructions, here is the link: https://tonna16.github.io/energyiq-site/ 

### Contact & credits
**Author:** Tonna Agburu    
**License:** MIT

---

---

### Security hardening checklist

#### 1) Use environment variables for secrets
Backend secrets are read from environment variables:

- `DB_USERNAME`
- `DB_PASSWORD`
- `JWT_SECRET`
- `EIA_API_KEY`

A safe template is tracked at `backend/src/main/resources/application.properties.example`.

#### 2) Rotate/revoke exposed credentials immediately
If secrets were ever committed, rotate them in their source systems right away:

- **Database credentials**: create a new DB user/password, update grants, remove old user or revoke old password.
- **JWT secret**: generate and deploy a new signing key, then invalidate all existing access/refresh tokens.
- **EIA API key**: revoke old key in EIA account settings and issue a new one.

#### 3) Purge leaked secrets from Git history
Use `git filter-repo` from a clean clone and force-push rewritten history:

```bash
# install once (example)
pip install git-filter-repo

# rewrite known literal secrets (examples)
git filter-repo \
  --replace-text <(cat <<'REDACTIONS'
literal:old_db_username==>REDACTED_DB_USER
literal:old_db_password==>REDACTED_DB_PASSWORD
literal:old_jwt_secret==>REDACTED_JWT_SECRET
literal:old_eia_api_key==>REDACTED_EIA_API_KEY
REDACTIONS
)

# force-push rewritten refs
git push --force --all origin
git push --force --tags origin
```

After rewrite, require contributors to re-clone or hard-reset to the new history.

#### 4) Automated and local secret scanning
- CI runs **gitleaks** on pushes/PRs via `.github/workflows/gitleaks.yml`.
- Recommended local pre-commit hook:

```bash
# in repo root
pre-commit install
cat > .git/hooks/pre-commit <<'HOOK'
#!/usr/bin/env bash
set -euo pipefail
gitleaks detect --source . --staged --redact
HOOK
chmod +x .git/hooks/pre-commit
```

(Alternatively, configure gitleaks through your shared `pre-commit` framework.)
