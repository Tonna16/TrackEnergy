EnergyIQ

EnergyIQ is a full-stack web app that helps users monitor and forecast household energy consumption, providing actionable insights and real-time alerts for smarter, eco-friendly living.

🌟 Key Features

Appliance Management – Add, edit, and track devices with estimated energy usage.

Real-Time Notifications – Alerts for high usage, currency changes, and forecast updates.

Energy Forecasting – Provides daily,weekly, monthly, and annual predictions using both historical data and appliance-based simulations:

Backend forecasting uses historical energy logs per appliance, applying Holt Linear or Holt-Winters additive time-series methods with weekly seasonality to predict actual usage.

Fallback estimates are used when there is insufficient data, incorporating appliance wattage, hours used, seasonal adjustments, and minor random noise.

Frontend projections simulate energy usage for charting, cost, and carbon estimates, using appliance parameters, monthly seasonal multipliers, and optional noise to produce realistic forecasts.

Interactive Charts – Visualize energy trends, projected costs, and carbon footprint over time.

Responsive Design – Sidebar navigation works on both mobile and desktop.

Guest & Auth Users – Try the app without signing up, or log in for full features.

🛠️ Technologies

Frontend: React, TypeScript, Tailwind CSS, Recharts, Lucide Icons, to run it, the command is npm run dev

Backend: Spring Boot, Java, JPA/Hibernate, to run it, the command is mvn spring-boot:run

Database: H2 (demo) / PostgreSQL (production)

Real-Time: WebSockets (SimpMessagingTemplate)

Authentication: JWT

I have also included a demo video, about 5 minutes long, the file is called "energyiq-demo.mp4)

