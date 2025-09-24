# EnergyIQ

EnergyIQ is a full-stack web app that helps users monitor and forecast household energy consumption, providing actionable insights and real-time alerts for smarter, eco-friendly living.

---

## 🌟 Key Features
- **Appliance Management** – Add, edit, and track devices with estimated energy usage.
- **Real-Time Notifications** – Alerts for high usage, currency changes, and forecast updates.
- **Energy Forecasting** – Provides daily, weekly, monthly, and annual predictions using both historical data and appliance-based simulations.
- **Interactive Charts** – Visualize energy trends, projected costs, and carbon footprint over time.
- **Responsive Design** – Sidebar navigation works on both mobile and desktop.
- **Guest & Auth Users** – Try the app without signing up, or log in for full features.

---

EnergyIQ uses time series forecasting to predict household energy consumption for each appliance. The goal is to provide users with actionable insights to reduce costs and carbon footprint.

### Forecasting Models Used:
- **Holt Linear Trend**: Applied when limited historical data is available. Captures level and trend but not seasonality.
- **Holt-Winters Additive Model**: Used when sufficient data exists. Captures level, trend, and seasonality (weekly cycles).
- **Fallback Estimation**: For new appliances or users, estimates are based on wattage × hours/day with seasonal multipliers and random noise.

### Design Decisions:
- **Season Length**: Set to 7 days to capture weekly usage patterns.
- **Manual Implementation**: Forecasting algorithms are implemented from scratch for transparency and customization.
- **Noise Injection**: Adds realism to fallback estimates to avoid flat predictions.
- **Data Grouping**: Historical logs are grouped by date and summed to form the time series.
- **Tolerance Thresholds**: Used to detect anomalies and cap unrealistic estimates.

This approach balances accuracy, interpretability, and responsiveness for real-time energy forecasting.

## 🛠️ Technologies

- **Frontend:** React, TypeScript, Tailwind CSS, Recharts, Lucide Icons  
  *Run:* `npm run dev`
- **Backend:** Spring Boot, Java, JPA/Hibernate  
  *Run:* `mvn spring-boot:run`
- **Database:** H2 (demo) / PostgreSQL (production)
- **Real-Time:** WebSockets (SimpMessagingTemplate)
- **Authentication:** JWT

---

## 🎬 Demo Video

A 5-minute demo video is included (`energyiq-demo.mp4`) showing the app in action, including appliance management, forecasting, and real-time notifications.
