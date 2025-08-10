package com.util;

import com.energytracker.model.Appliance;
import com.energytracker.model.EnergyUsageLog;
import com.energytracker.repository.EnergyUsageLogRepository;
import com.energytracker.repository.ApplianceRepository;
import org.apache.commons.math3.stat.descriptive.moment.Mean;
import org.springframework.stereotype.Component;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

@Component
public class TimeSeriesForecaster {

    private final EnergyUsageLogRepository logRepo;
    private final ApplianceRepository applianceRepo;
    private static final Logger logger = LoggerFactory.getLogger(TimeSeriesForecaster.class);

    private static final double ALPHA = 0.5;
    private static final double BETA = 0.3;
    private static final double GAMMA = 0.2;
    private static final int SEASON_LENGTH = 7;
    private static final double AGGREGATE_TOLERANCE = 0.15; // 15% tolerance

    public static final double MAX_KWH_PER_DAY = 50.0; // Cap for fallback estimates

    public TimeSeriesForecaster(EnergyUsageLogRepository logRepo, ApplianceRepository applianceRepo) {
        this.logRepo = logRepo;
        this.applianceRepo = applianceRepo;
    }

    /**
     * Forecast next single day kWh for a given appliance.
     */
    public double forecastNext(Long applianceId, int historyDays) {
        Appliance appliance = getActiveApplianceOrThrow(applianceId);
        LocalDate end = LocalDate.now().minusDays(1);
        LocalDate start = end.minusDays(historyDays - 1);

        List<Double> series = logRepo.findByApplianceIdAndDateBetween(applianceId, start, end).stream()
                .collect(Collectors.groupingBy(EnergyUsageLog::getDate, Collectors.summingDouble(EnergyUsageLog::getKWhUsed)))
                .entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .map(Map.Entry::getValue)
                .collect(Collectors.toList());

        logger.debug("[Forecast] Appliance {} usage series ({} points): {}", applianceId, series.size(), series);

        if (series.isEmpty()) {
            double fallback = fallbackEstimateForAppliance(appliance, LocalDate.now(), 1).get(0);
            logger.info("[Forecast] No history for appliance {}, fallback estimate: {}", applianceId, fallback);
            return fallback;
        }

        if (series.size() < 2) {
            double mean = new Mean().evaluate(series.stream().mapToDouble(Double::doubleValue).toArray());
            logger.info("[Forecast] Only one data point for appliance {}, using mean: {}", applianceId, mean);
            return mean;
        }

        if (series.size() < 2 * SEASON_LENGTH) {
            double forecast = holtLinearForecast(series);
            logger.info("[Forecast] Insufficient data for seasonality, using Holt linear forecast: {}", forecast);
            return forecast;
        }

        double forecast = holtWintersAdditiveForecast(series, SEASON_LENGTH);
        logger.info("[Forecast] Forecasted kWh for appliance {} is {}", applianceId, forecast);
        return forecast;
    }

    /**
     * Forecast next N days of kWh for given appliance.
     */
    public List<Double> forecastNextNDays(Long applianceId, int days) {
        Appliance appliance = getActiveApplianceOrThrow(applianceId);
        LocalDate end = LocalDate.now().minusDays(1);
        LocalDate start = end.minusDays(30);

        List<Double> series = logRepo.findByApplianceIdAndDateBetween(applianceId, start, end).stream()
                .collect(Collectors.groupingBy(EnergyUsageLog::getDate, Collectors.summingDouble(EnergyUsageLog::getKWhUsed)))
                .entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .map(Map.Entry::getValue)
                .collect(Collectors.toList());

        logger.debug("📊 Historical kWh usage series for appliance {}: {}", applianceId, series);
        logger.debug("📊 Series size: {}", series.size());

        if (series.isEmpty()) {
            logger.debug("[🔙 Forecast] No history found. Using fallback.");
            double fallback = fallbackEstimateForAppliance(appliance, LocalDate.now(), 1).get(0);
            List<Double> fallbackSeries = IntStream.range(0, days)
                    .mapToDouble(i -> fallback * (0.95 + Math.random() * 0.1))
                    .boxed()
                    .collect(Collectors.toList());

            logger.debug("🔮 Fallback forecast series: {}", fallbackSeries);
            return fallbackSeries;
        }

        if (series.size() < 2) {
            logger.debug("[📉 Forecast] Only 1 point. Using mean.");
            double mean = mean(series);
            return IntStream.range(0, days).mapToObj(i -> mean).collect(Collectors.toList());
        }

        if (series.size() < 2 * SEASON_LENGTH) {
            logger.debug("[📈 Forecast] <14 points. Using Holt Linear.");
            double forecast = holtLinearForecast(series);
            return IntStream.range(0, days).mapToObj(i -> forecast).collect(Collectors.toList());
        }

        logger.debug("[📊 Forecast] Using Holt-Winters with seasonality.");
        HoltWintersComponents hw = initializeHoltWinters(series, SEASON_LENGTH);
        List<Double> forecasts = new ArrayList<>(days);

        for (int i = 1; i <= days; i++) {
            int seasonIndex = (series.size() + i - 1) % SEASON_LENGTH;
            double forecast = hw.level + i * hw.trend + hw.seasonal[seasonIndex];
            forecasts.add(forecast);
        }

        logger.debug("🔮 Final Holt-Winters forecast series: {}", forecasts);
        return forecasts;
    }

    /**
     * Generate forecast points with date and forecasted value.
     */
    public List<ForecastPoint> generateForecastSeries(Long applianceId, int daysAhead) {
        List<Double> kwhForecasts = forecastNextNDays(applianceId, daysAhead);
        List<ForecastPoint> result = new ArrayList<>();
        LocalDate startDate = LocalDate.now();

        for (int i = 0; i < kwhForecasts.size(); i++) {
            result.add(new ForecastPoint(startDate.plusDays(i), kwhForecasts.get(i)));
        }

        return result;
    }

    // Holt Linear forecasting method
    private double holtLinearForecast(List<Double> series) {
        double level = series.get(0);
        double trend = series.get(1) - series.get(0);

        for (int i = 1; i < series.size(); i++) {
            double value = series.get(i);
            double lastLevel = level;
            level = ALPHA * value + (1 - ALPHA) * (level + trend);
            trend = BETA * (level - lastLevel) + (1 - BETA) * trend;
        }

        return level + trend;
    }

    // Holt-Winters additive forecasting for next day
    private double holtWintersAdditiveForecast(List<Double> series, int seasonLength) {
        HoltWintersComponents hw = initializeHoltWinters(series, seasonLength);
        int nextSeasonIndex = series.size() % seasonLength;
        return hw.level + hw.trend + hw.seasonal[nextSeasonIndex];
    }

    // Initialize Holt-Winters components (level, trend, seasonal)
    private HoltWintersComponents initializeHoltWinters(List<Double> series, int seasonLength) {
        double[] seasonal = new double[seasonLength];
        double overallMean = mean(series);

        for (int i = 0; i < seasonLength; i++) {
            double sum = 0.0;
            int count = 0;
            for (int j = i; j < series.size(); j += seasonLength) {
                sum += series.get(j);
                count++;
            }
            seasonal[i] = (count == 0) ? 0 : (sum / count) - overallMean;
        }

        double level = series.get(0);
        double trend = series.get(seasonLength) - series.get(0);

        for (int i = 0; i < series.size(); i++) {
            double value = series.get(i);
            int seasonIndex = i % seasonLength;
            double lastLevel = level;
            double lastSeason = seasonal[seasonIndex];

            level = ALPHA * (value - lastSeason) + (1 - ALPHA) * (level + trend);
            trend = BETA * (level - lastLevel) + (1 - BETA) * trend;
            seasonal[seasonIndex] = GAMMA * (value - level) + (1 - GAMMA) * lastSeason;
        }

        return new HoltWintersComponents(level, trend, seasonal);
    }

    // Fallback estimate for appliance with seasonal adjustment and noise
    private List<Double> fallbackEstimateForAppliance(Appliance a, LocalDate startDate, int days) {
        double wattage = a.getWattage();
        double hoursPerDay = a.getHoursPerDay();
        double estimatedDailyKWh = (wattage * hoursPerDay) / 1000.0;

        if (estimatedDailyKWh > MAX_KWH_PER_DAY) {
            logger.warn("⚠️ Unusually high fallback kWh/day estimate ({}) for appliance {}. Capping at {}.",
                    estimatedDailyKWh, a.getId(), MAX_KWH_PER_DAY);
            estimatedDailyKWh = MAX_KWH_PER_DAY;
        }

        List<Double> forecast = new ArrayList<>();
        for (int i = 0; i < days; i++) {
            LocalDate date = startDate.plusDays(i);
            double seasonalMultiplier = 1.0;
            int month = date.getMonthValue();

            // Simple seasonal adjustment
            if (month == 1 || month == 12) {          // Jan, Dec
                seasonalMultiplier = 1.10;
            } else if (month == 6 || month == 7 || month == 8) {  // Jun, Jul, Aug
                seasonalMultiplier = 1.05;
            }

            // Noise between 0.95 and 1.05
            double noise = 0.95 + (Math.random() * 0.10);
            double adjusted = estimatedDailyKWh * seasonalMultiplier * noise;
            forecast.add(adjusted);
        }

        return forecast;
    }

    // Calculate mean of list
    private double mean(List<Double> data) {
        return data.stream().mapToDouble(Double::doubleValue).average().orElse(0.0);
    }

    // Retrieve active and non-deleted appliance or throw exception
    private Appliance getActiveApplianceOrThrow(Long id) {
        return applianceRepo.findById(id)
                .filter(appliance -> appliance.isActive() && !appliance.isDeleted())
                .orElseThrow(() -> new IllegalArgumentException("Appliance not found or inactive: " + id));
    }

    private static class HoltWintersComponents {
        double level;
        double trend;
        double[] seasonal;

        HoltWintersComponents(double level, double trend, double[] seasonal) {
            this.level = level;
            this.trend = trend;
            this.seasonal = seasonal;
        }
    }

    // ForecastPoint class to hold date and forecasted value, add if not already defined elsewhere
    public static class ForecastPoint {
        private final LocalDate date;
        private final double forecastKwh;

        public ForecastPoint(LocalDate date, double forecastKwh) {
            this.date = date;
            this.forecastKwh = forecastKwh;
        }

        public LocalDate getDate() {
            return date;
        }

        public double getForecastKwh() {
            return forecastKwh;
        }
    }
}
