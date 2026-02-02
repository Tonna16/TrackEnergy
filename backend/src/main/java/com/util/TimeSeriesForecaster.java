package com.util;

import com.energytracker.model.Appliance;
import com.energytracker.model.EnergyUsageLog;
import com.energytracker.repository.EnergyUsageLogRepository;
import com.energytracker.repository.ApplianceRepository;
import org.apache.commons.math3.stat.descriptive.moment.Mean;
import org.apache.commons.math3.stat.descriptive.moment.StandardDeviation;
import org.springframework.stereotype.Component;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.LocalDate;
import java.time.DayOfWeek;
import java.util.*;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

@Component
public class TimeSeriesForecaster {

    private final EnergyUsageLogRepository logRepo;
    private final ApplianceRepository applianceRepo;
    private static final Logger logger = LoggerFactory.getLogger(TimeSeriesForecaster.class);

    // Optimized smoothing parameters (validated ranges)
    private static final double ALPHA = 0.3;  // Level smoothing - lower for more stability
    private static final double BETA = 0.1;   // Trend smoothing - lower to reduce trend overreaction
    private static final double GAMMA = 0.15; // Seasonal smoothing - lower for stable seasonality
    private static final int SEASON_LENGTH = 7;
    private static final double AGGREGATE_TOLERANCE = 0.15;
    private static final int MIN_HISTORY_FOR_FORECAST = 3;
    private static final int OPTIMAL_HISTORY_DAYS = 60; // Use more history for better patterns

    public static final double MAX_KWH_PER_DAY = 50.0;

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
        LocalDate start = end.minusDays(Math.max(historyDays, OPTIMAL_HISTORY_DAYS) - 1);

        Map<LocalDate, Double> dailyUsage = logRepo.findByApplianceIdAndDateBetween(applianceId, start, end).stream()
                .collect(Collectors.groupingBy(EnergyUsageLog::getDate, Collectors.summingDouble(EnergyUsageLog::getKWhUsed)));

        // Fill missing days with interpolated values
        List<Double> series = fillMissingDays(dailyUsage, start, end);

        logger.debug("[Forecast] Appliance {} usage series ({} points): {}", applianceId, series.size(), series);

        if (series.isEmpty() || allZeros(series)) {
            double fallback = fallbackEstimateForAppliance(appliance, LocalDate.now(), 1).get(0);
            logger.info("[Forecast] No valid history for appliance {}, fallback estimate: {}", applianceId, fallback);
            return fallback;
        }

        // Remove outliers before forecasting
        series = removeOutliers(series);

        if (series.size() < MIN_HISTORY_FOR_FORECAST) {
            double mean = weightedMean(series);
            logger.info("[Forecast] Insufficient data points for appliance {}, using weighted mean: {}", applianceId, mean);
            return mean;
        }

        if (series.size() < 2 * SEASON_LENGTH) {
            double forecast = holtLinearForecast(series);
            forecast = applyDayOfWeekAdjustment(forecast, LocalDate.now(), series);
            logger.info("[Forecast] Using Holt linear forecast with day adjustment: {}", forecast);
            return Math.max(0, forecast);
        }

        double forecast = holtWintersAdditiveForecast(series, SEASON_LENGTH);
        forecast = applyDayOfWeekAdjustment(forecast, LocalDate.now(), series);
        logger.info("[Forecast] Forecasted kWh for appliance {} is {}", applianceId, forecast);
        return Math.max(0, forecast);
    }

    /**
     * Forecast next N days of kWh for given appliance.
     */
    public List<Double> forecastNextNDays(Long applianceId, int days) {
        Appliance appliance = getActiveApplianceOrThrow(applianceId);
        LocalDate end = LocalDate.now().minusDays(1);
        LocalDate start = end.minusDays(OPTIMAL_HISTORY_DAYS - 1);

        Map<LocalDate, Double> dailyUsage = logRepo.findByApplianceIdAndDateBetween(applianceId, start, end).stream()
                .collect(Collectors.groupingBy(EnergyUsageLog::getDate, Collectors.summingDouble(EnergyUsageLog::getKWhUsed)));

        List<Double> series = fillMissingDays(dailyUsage, start, end);

        logger.debug("📊 Historical kWh usage series for appliance {}: {}", applianceId, series);
        logger.debug("📊 Series size: {}", series.size());

        if (series.isEmpty() || allZeros(series)) {
            logger.debug("[🔙 Forecast] No valid history found. Using fallback.");
            return fallbackEstimateForAppliance(appliance, LocalDate.now(), days);
        }

        // Remove outliers
        series = removeOutliers(series);

        if (series.size() < MIN_HISTORY_FOR_FORECAST) {
            logger.debug("[📉 Forecast] Insufficient points. Using weighted mean with day-of-week adjustment.");
            double mean = weightedMean(series);
            return generateForecastWithDayAdjustment(mean, days, series);
        }

        if (series.size() < 2 * SEASON_LENGTH) {
            logger.debug("[📈 Forecast] <14 points. Using Holt Linear with adjustments.");
            return holtLinearForecastMultiple(series, days);
        }

        logger.debug("[📊 Forecast] Using Holt-Winters with seasonality.");
        List<Double> forecasts = holtWintersMultipleForecast(series, SEASON_LENGTH, days);

        // Apply bounds checking
        double historicalMean = mean(series);
        double historicalStd = standardDeviation(series);
        forecasts = applyReasonableBounds(forecasts, historicalMean, historicalStd);

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

    // Fill missing days with interpolated values
    private List<Double> fillMissingDays(Map<LocalDate, Double> dailyUsage, LocalDate start, LocalDate end) {
        List<Double> series = new ArrayList<>();
        List<Double> knownValues = new ArrayList<>(dailyUsage.values());
        double defaultValue = knownValues.isEmpty() ? 0.0 : mean(knownValues);

        LocalDate current = start;
        Double lastKnown = null;
        
        while (!current.isAfter(end)) {
            Double value = dailyUsage.get(current);
            if (value != null) {
                series.add(value);
                lastKnown = value;
            } else {
                // Use last known value or default for interpolation
                series.add(lastKnown != null ? lastKnown * 0.95 : defaultValue);
            }
            current = current.plusDays(1);
        }
        return series;
    }

    // Check if all values are zeros
    private boolean allZeros(List<Double> series) {
        return series.stream().allMatch(v -> v == null || v == 0.0);
    }

    // Remove outliers using IQR method
    private List<Double> removeOutliers(List<Double> series) {
        if (series.size() < 4) return series;

        List<Double> sorted = series.stream().sorted().collect(Collectors.toList());
        int q1Index = sorted.size() / 4;
        int q3Index = (3 * sorted.size()) / 4;
        double q1 = sorted.get(q1Index);
        double q3 = sorted.get(q3Index);
        double iqr = q3 - q1;
        double lowerBound = q1 - 1.5 * iqr;
        double upperBound = q3 + 1.5 * iqr;

        double median = sorted.get(sorted.size() / 2);

        return series.stream()
                .map(v -> (v < lowerBound || v > upperBound) ? median : v)
                .collect(Collectors.toList());
    }

    // Weighted mean giving more weight to recent values
    private double weightedMean(List<Double> data) {
        if (data.isEmpty()) return 0.0;
        double weightedSum = 0.0;
        double weightTotal = 0.0;
        
        for (int i = 0; i < data.size(); i++) {
            double weight = 1.0 + (i * 0.5 / data.size()); // Recent values get higher weight
            weightedSum += data.get(i) * weight;
            weightTotal += weight;
        }
        return weightedSum / weightTotal;
    }

    // Apply day-of-week adjustment based on historical patterns
    private double applyDayOfWeekAdjustment(double baseForecast, LocalDate targetDate, List<Double> historicalSeries) {
        if (historicalSeries.size() < SEASON_LENGTH) return baseForecast;

        DayOfWeek targetDay = targetDate.getDayOfWeek();
        int dayIndex = targetDay.getValue() - 1; // 0-6

        // Calculate average for each day of week
        double[] dayAverages = new double[7];
        int[] dayCounts = new int[7];
        
        LocalDate seriesStart = LocalDate.now().minusDays(historicalSeries.size());
        for (int i = 0; i < historicalSeries.size(); i++) {
            int dow = seriesStart.plusDays(i).getDayOfWeek().getValue() - 1;
            dayAverages[dow] += historicalSeries.get(i);
            dayCounts[dow]++;
        }

        double overallMean = mean(historicalSeries);
        for (int i = 0; i < 7; i++) {
            dayAverages[i] = dayCounts[i] > 0 ? dayAverages[i] / dayCounts[i] : overallMean;
        }

        // Calculate adjustment factor
        double adjustmentFactor = overallMean > 0 ? dayAverages[dayIndex] / overallMean : 1.0;
        // Dampen the adjustment to avoid over-correction
        adjustmentFactor = 0.7 + 0.3 * adjustmentFactor;

        return baseForecast * adjustmentFactor;
    }

    // Generate forecast with day-of-week adjustment
    private List<Double> generateForecastWithDayAdjustment(double baseForecast, int days, List<Double> historicalSeries) {
        List<Double> forecasts = new ArrayList<>();
        for (int i = 0; i < days; i++) {
            LocalDate targetDate = LocalDate.now().plusDays(i);
            double adjusted = applyDayOfWeekAdjustment(baseForecast, targetDate, historicalSeries);
            // Add small random variation (±3%)
            adjusted *= (0.97 + Math.random() * 0.06);
            forecasts.add(Math.max(0, adjusted));
        }
        return forecasts;
    }

    // Holt Linear forecasting method with dampening
    private double holtLinearForecast(List<Double> series) {
        double level = series.get(0);
        double trend = (series.get(Math.min(series.size() - 1, SEASON_LENGTH)) - series.get(0)) / Math.min(series.size(), SEASON_LENGTH);

        for (int i = 1; i < series.size(); i++) {
            double value = series.get(i);
            double lastLevel = level;
            level = ALPHA * value + (1 - ALPHA) * (level + trend);
            trend = BETA * (level - lastLevel) + (1 - BETA) * trend;
        }

        // Dampen trend for longer forecasts
        double dampenedTrend = trend * 0.8;
        return level + dampenedTrend;
    }

    // Holt Linear forecast for multiple days
    private List<Double> holtLinearForecastMultiple(List<Double> series, int days) {
        double level = series.get(0);
        double trend = (series.get(Math.min(series.size() - 1, SEASON_LENGTH)) - series.get(0)) / Math.min(series.size(), SEASON_LENGTH);

        for (int i = 1; i < series.size(); i++) {
            double value = series.get(i);
            double lastLevel = level;
            level = ALPHA * value + (1 - ALPHA) * (level + trend);
            trend = BETA * (level - lastLevel) + (1 - BETA) * trend;
        }

        List<Double> forecasts = new ArrayList<>();
        for (int i = 1; i <= days; i++) {
            // Apply trend dampening that increases with forecast horizon
            double dampeningFactor = Math.pow(0.9, i);
            double forecast = level + trend * i * dampeningFactor;
            forecast = applyDayOfWeekAdjustment(forecast, LocalDate.now().plusDays(i - 1), series);
            forecasts.add(Math.max(0, forecast));
        }
        return forecasts;
    }

    // Holt-Winters additive forecasting for next day
    private double holtWintersAdditiveForecast(List<Double> series, int seasonLength) {
        HoltWintersComponents hw = initializeHoltWinters(series, seasonLength);
        int nextSeasonIndex = series.size() % seasonLength;
        return hw.level + hw.trend + hw.seasonal[nextSeasonIndex];
    }

    // Holt-Winters forecast for multiple days
    private List<Double> holtWintersMultipleForecast(List<Double> series, int seasonLength, int days) {
        HoltWintersComponents hw = initializeHoltWinters(series, seasonLength);
        List<Double> forecasts = new ArrayList<>(days);

        for (int i = 1; i <= days; i++) {
            int seasonIndex = (series.size() + i - 1) % seasonLength;
            // Apply trend dampening
            double dampeningFactor = Math.pow(0.95, i);
            double forecast = hw.level + (i * hw.trend * dampeningFactor) + hw.seasonal[seasonIndex];
            forecasts.add(Math.max(0, forecast));
        }

        return forecasts;
    }

    // Initialize Holt-Winters components with improved initialization
    private HoltWintersComponents initializeHoltWinters(List<Double> series, int seasonLength) {
        double[] seasonal = new double[seasonLength];
        
        // Calculate seasonal indices using multiple complete seasons
        int completeSeasons = series.size() / seasonLength;
        double[] seasonMeans = new double[completeSeasons];
        
        for (int s = 0; s < completeSeasons; s++) {
            double sum = 0;
            for (int i = 0; i < seasonLength; i++) {
                sum += series.get(s * seasonLength + i);
            }
            seasonMeans[s] = sum / seasonLength;
        }

        double overallMean = mean(series);

        // Calculate initial seasonal factors
        for (int i = 0; i < seasonLength; i++) {
            double sum = 0.0;
            int count = 0;
            for (int j = i; j < series.size(); j += seasonLength) {
                int seasonNum = j / seasonLength;
                if (seasonNum < completeSeasons && seasonMeans[seasonNum] > 0) {
                    sum += series.get(j) - seasonMeans[seasonNum];
                    count++;
                }
            }
            seasonal[i] = (count == 0) ? 0 : sum / count;
        }

        // Initialize level and trend using first complete season
        double level = seasonMeans.length > 0 ? seasonMeans[0] : series.get(0);
        double trend = 0;
        if (completeSeasons >= 2) {
            trend = (seasonMeans[1] - seasonMeans[0]) / seasonLength;
        } else if (series.size() > seasonLength) {
            trend = (series.get(seasonLength) - series.get(0)) / seasonLength;
        }

        // Update components through the series
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

    // Apply reasonable bounds to forecasts
    private List<Double> applyReasonableBounds(List<Double> forecasts, double historicalMean, double historicalStd) {
        double lowerBound = Math.max(0, historicalMean - 3 * historicalStd);
        double upperBound = historicalMean + 3 * historicalStd;

        return forecasts.stream()
                .map(f -> Math.max(lowerBound, Math.min(upperBound, f)))
                .collect(Collectors.toList());
    }

    // Fallback estimate with improved seasonal and usage pattern modeling
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
            double multiplier = 1.0;
            
            // Monthly seasonal adjustment
            int month = date.getMonthValue();
            if (month == 12 || month == 1 || month == 2) {
                multiplier *= 1.12; // Winter
            } else if (month == 6 || month == 7 || month == 8) {
                multiplier *= 1.08; // Summer
            } else if (month == 3 || month == 4 || month == 5 || month == 9 || month == 10 || month == 11) {
                multiplier *= 0.95; // Spring/Fall
            }

            // Day-of-week adjustment
            DayOfWeek dow = date.getDayOfWeek();
            if (dow == DayOfWeek.SATURDAY || dow == DayOfWeek.SUNDAY) {
                multiplier *= 1.15; // Weekend typically higher usage
            }

            // Controlled noise between 0.97 and 1.03
            double noise = 0.97 + (Math.random() * 0.06);
            double adjusted = estimatedDailyKWh * multiplier * noise;
            forecast.add(adjusted);
        }

        return forecast;
    }

    // Calculate mean of list
    private double mean(List<Double> data) {
        return data.stream().mapToDouble(Double::doubleValue).average().orElse(0.0);
    }

    // Calculate standard deviation
    private double standardDeviation(List<Double> data) {
        if (data.size() < 2) return 0.0;
        return new StandardDeviation().evaluate(data.stream().mapToDouble(Double::doubleValue).toArray());
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