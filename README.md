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

### Key features (high level)
- **Appliance Management** — store device metadata (wattage, typical hours/day, category) and view per‑appliance and aggregated usage.  
- **Forecasting Engine** — combines historical logs and appliance simulations to produce interpretable predictions.  
- **Anomaly Detection & Tolerance Caps** — detect unrealistic spikes and cap extreme estimates to keep forecasts realistic.  
- **Interactive Charts** — Recharts visualizations for historical vs. predicted consumption and cost breakdowns.  
- **Real‑time Notifications** — server pushes alerts for threshold breaches and model updates.  
- **Guest & Authenticated Flows** — lightweight guest experience plus JWT‑protected accounts for saved data.

---

### Forecasting: approach and models
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
A 5‑minute demo video (energyiq-demo.mp4) demonstrates appliance management, forecasting workflows, and real‑time notifications. Add hosted link or embed here for reviewers.

---

### Getting started (quick)
1. Clone the repository.  
2. Start the backend: `mvn spring-boot:run` (configure PostgreSQL or use H2 for demo).  
3. Start the frontend: `npm install` then `npm run dev`.  
4. Open the frontend in your browser and try guest mode or sign up.

---

### Roadmap / next steps
- Improve Guest mode functionality to ensure access and proper usage for both authenticated and unauthenticated users.
- Integrate real energy APIs or smart‑plug telemetry.  
- Add adaptive ML models that learn per‑home profiles.  
- Mobile responsive improvements and progressive web app support.  
- Public beta to collect real user data and validate forecasts.

---

### Contact & credits
**Author:** Tonna Agburu    
**License:** MIT

---
