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

## 🧠 Energy Forecasting Logic

EnergyIQ predicts household energy usage to help users save money and reduce their carbon footprint. 

**How it works:**
1. **Historical Usage:** The app analyzes past energy logs for each appliance to identify trends.
2. **Appliance Details:** Appliance wattage, hours of use, and seasonal patterns are incorporated.
3. **Trend & Seasonality:** Usage trends (increasing or decreasing) and weekly/seasonal cycles are considered.
4. **Fallback Estimates:** For new users or appliances with insufficient data, the app estimates energy use based on appliance parameters and seasonal adjustments.


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
