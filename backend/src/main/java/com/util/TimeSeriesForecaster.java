package com.util;

import com.energytracker.model.Appliance;
import com.energytracker.model.EnergyUsageLog;
import com.energytracker.repository.EnergyUsageLogRepository;
import com.energytracker.repository.ApplianceRepository;
import com.energytracker.service.EnergyCalculationService;
import org.apache.commons.math3.stat.descriptive.moment.StandardDeviation;
import org.springframework.stereotype.Component;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.LocalDate;
import java.time.Clock;
import java.util.*;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

@Component
public class TimeSeriesForecaster {

    private final EnergyUsageLogRepository logRepo;
    private final ApplianceRepository applianceRepo;
    private final EnergyCalculationService calculations;
    private final Clock clock;
    private static final Logger logger = LoggerFactory.getLogger(TimeSeriesForecaster.class);

    // Default smoothing parameters
    private static final double DEFAULT_ALPHA = 0.3;
    private static final double DEFAULT_BETA = 0.1;
    private static final double DEFAULT_GAMMA = 0.15;
    private static final double[] ALPHA_GRID = {0.1, 0.3, 0.5};
    private static final double[] BETA_GRID = {0.05, 0.1, 0.2};
    private static final double[] GAMMA_GRID = {0.1, 0.15, 0.2};
    private static final int SEASON_LENGTH = 7;
    private static final int MIN_HISTORY_FOR_FORECAST = 3;
    private static final int OPTIMAL_HISTORY_DAYS = 60; // Use more history for better patterns

    public TimeSeriesForecaster(
        EnergyUsageLogRepository logRepo,
        ApplianceRepository applianceRepo,
        EnergyCalculationService calculations,
        Clock clock
    ) {
        this.logRepo = logRepo;
        this.applianceRepo = applianceRepo;
        this.calculations = calculations;
        this.clock = clock;
    }

    /**
     * Forecast next single day kWh for a given appliance.
     */
    public double forecastNext(Long applianceId, int historyDays) {
        Appliance appliance = getActiveApplianceOrThrow(applianceId);
        LocalDate end = LocalDate.now(clock).minusDays(1);
        LocalDate start = end.minusDays(Math.max(historyDays, OPTIMAL_HISTORY_DAYS) - 1);

        Map<LocalDate, Double> dailyUsage = logRepo.findByApplianceIdAndDateBetween(applianceId, start, end).stream()
                .filter(entry -> Double.isFinite(entry.getKWhUsed()) && entry.getKWhUsed() >= 0)
                .collect(Collectors.groupingBy(EnergyUsageLog::getDate, Collectors.summingDouble(EnergyUsageLog::getKWhUsed)));

        // Fill missing days with interpolated values
        List<Double> series = fillMissingDays(dailyUsage, start, end);

        logger.debug("[Forecast] Appliance {} usage series ({} points): {}", applianceId, series.size(), series);

        if (series.isEmpty() || allZeros(series)) {
            double fallback = fallbackEstimateForAppliance(appliance, 1).get(0);
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
            SmoothingParams tuned = tuneHoltLinearParameters(series);
            double forecast = holtLinearForecast(series, tuned.alpha, tuned.beta);
            logger.info("[Forecast] Using Holt linear forecast: {} (alpha={}, beta={})",
                    forecast, tuned.alpha, tuned.beta);
            return Math.max(0, forecast);
        }

        SmoothingParams tuned = tuneHoltWintersParameters(series, SEASON_LENGTH);
        double forecast = holtWintersAdditiveForecast(series, SEASON_LENGTH, tuned.alpha, tuned.beta, tuned.gamma);
        logger.info("[Forecast] Forecasted kWh for appliance {} is {} (alpha={}, beta={}, gamma={})",
                applianceId, forecast, tuned.alpha, tuned.beta, tuned.gamma);
        return Math.max(0, forecast);
    }

    /**
     * Forecast next N days of kWh for given appliance.
     */
    public List<Double> forecastNextNDays(Long applianceId, int days) {
        Appliance appliance = getActiveApplianceOrThrow(applianceId);
        LocalDate end = LocalDate.now(clock).minusDays(1);
        LocalDate start = end.minusDays(OPTIMAL_HISTORY_DAYS - 1);

        Map<LocalDate, Double> dailyUsage = logRepo.findByApplianceIdAndDateBetween(applianceId, start, end).stream()
                .filter(entry -> Double.isFinite(entry.getKWhUsed()) && entry.getKWhUsed() >= 0)
                .collect(Collectors.groupingBy(EnergyUsageLog::getDate, Collectors.summingDouble(EnergyUsageLog::getKWhUsed)));

        List<Double> series = fillMissingDays(dailyUsage, start, end);

        logger.debug("📊 Historical kWh usage series for appliance {}: {}", applianceId, series);
        logger.debug("📊 Series size: {}", series.size());

        if (series.isEmpty()) {
            return fallbackEstimateForAppliance(appliance, days);
        }
        if (allZeros(series)) {
            return new ArrayList<>(Collections.nCopies(days, 0.0));
        }

        // Remove outliers
        series = removeOutliers(series);

        if (series.size() < MIN_HISTORY_FOR_FORECAST) {
            logger.debug("[📉 Forecast] Insufficient points. Using a deterministic weighted mean.");
            double mean = weightedMean(series);
            return new ArrayList<>(Collections.nCopies(days, Math.max(0.0, mean)));
        }

        if (series.size() < 2 * SEASON_LENGTH) {
            logger.debug("[📈 Forecast] <14 points. Using deterministic Holt Linear.");
            SmoothingParams tuned = tuneHoltLinearParameters(series);
            return holtLinearForecastMultiple(series, days, tuned.alpha, tuned.beta);
        }

        logger.debug("[📊 Forecast] Using Holt-Winters with seasonality.");
        SmoothingParams tuned = tuneHoltWintersParameters(series, SEASON_LENGTH);
        List<Double> forecasts = holtWintersMultipleForecast(series, SEASON_LENGTH, days, tuned.alpha, tuned.beta, tuned.gamma);

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
        LocalDate startDate = LocalDate.now(clock).plusDays(1);

        for (int i = 0; i < kwhForecasts.size(); i++) {
            result.add(new ForecastPoint(startDate.plusDays(i), kwhForecasts.get(i)));
        }

        return result;
    }

    // Fill missing days with linear interpolation
    private List<Double> fillMissingDays(Map<LocalDate, Double> dailyUsage, LocalDate start, LocalDate end) {
        List<LocalDate> dates = new ArrayList<>();
        for (LocalDate current = start; !current.isAfter(end); current = current.plusDays(1)) {
            dates.add(current);
        }

        List<Double> series = new ArrayList<>(Collections.nCopies(dates.size(), null));
        for (int i = 0; i < dates.size(); i++) {
            series.set(i, dailyUsage.get(dates.get(i)));
        }

        List<Double> knownValues = series.stream().filter(Objects::nonNull).toList();
        if (knownValues.isEmpty()) {
            return IntStream.range(0, dates.size()).mapToObj(i -> 0.0).collect(Collectors.toList());
        }

        int firstKnownIdx = IntStream.range(0, series.size()).filter(i -> series.get(i) != null).findFirst().orElse(0);
        int lastKnownIdx = IntStream.iterate(series.size() - 1, i -> i - 1).limit(series.size())
                .filter(i -> series.get(i) != null).findFirst().orElse(series.size() - 1);

        // Edge fill for leading/trailing nulls
        for (int i = 0; i < firstKnownIdx; i++) {
            series.set(i, series.get(firstKnownIdx));
        }
        for (int i = lastKnownIdx + 1; i < series.size(); i++) {
            series.set(i, series.get(lastKnownIdx));
        }

        // Linear interpolation for inner gaps
        int i = firstKnownIdx;
        while (i < lastKnownIdx) {
            if (series.get(i) != null) {
                i++;
                continue;
            }
            int gapStart = i - 1;
            int gapEnd = i;
            while (gapEnd <= lastKnownIdx && series.get(gapEnd) == null) {
                gapEnd++;
            }
            double left = series.get(gapStart);
            double right = series.get(gapEnd);
            int gapLength = gapEnd - gapStart;
            for (int step = 1; step < gapLength; step++) {
                double fraction = (double) step / gapLength;
                series.set(gapStart + step, left + fraction * (right - left));
            }
            i = gapEnd + 1;
        }

        return series.stream().map(v -> v == null ? mean(knownValues) : v).collect(Collectors.toList());
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

    // Holt Linear forecasting method with dampening
    private double holtLinearForecast(List<Double> series, double alpha, double beta) {
        double level = series.get(0);
        double trend = (series.get(Math.min(series.size() - 1, SEASON_LENGTH)) - series.get(0)) / Math.min(series.size(), SEASON_LENGTH);

        for (int i = 1; i < series.size(); i++) {
            double value = series.get(i);
            double lastLevel = level;
            level = alpha * value + (1 - alpha) * (level + trend);
            trend = beta * (level - lastLevel) + (1 - beta) * trend;
        }

        // Dampen trend for longer forecasts
        double dampenedTrend = trend * 0.8;
        return level + dampenedTrend;
    }

    // Holt Linear forecast for multiple days
    private List<Double> holtLinearForecastMultiple(List<Double> series, int days, double alpha, double beta) {
        double level = series.get(0);
        double trend = (series.get(Math.min(series.size() - 1, SEASON_LENGTH)) - series.get(0)) / Math.min(series.size(), SEASON_LENGTH);

        for (int i = 1; i < series.size(); i++) {
            double value = series.get(i);
            double lastLevel = level;
            level = alpha * value + (1 - alpha) * (level + trend);
            trend = beta * (level - lastLevel) + (1 - beta) * trend;
        }

        List<Double> forecasts = new ArrayList<>();
        for (int i = 1; i <= days; i++) {
            // Apply trend dampening that increases with forecast horizon
            double dampeningFactor = Math.pow(0.9, i);
            double forecast = level + trend * i * dampeningFactor;
            forecasts.add(Math.max(0, forecast));
        }
        return forecasts;
    }

    // Holt-Winters additive forecasting for next day
    private double holtWintersAdditiveForecast(List<Double> series, int seasonLength, double alpha, double beta, double gamma) {
        HoltWintersComponents hw = initializeHoltWinters(series, seasonLength, alpha, beta, gamma);
        int nextSeasonIndex = series.size() % seasonLength;
        return hw.level + hw.trend + hw.seasonal[nextSeasonIndex];
    }

    // Holt-Winters forecast for multiple days
    private List<Double> holtWintersMultipleForecast(List<Double> series, int seasonLength, int days,
                                                     double alpha, double beta, double gamma) {
        HoltWintersComponents hw = initializeHoltWinters(series, seasonLength, alpha, beta, gamma);
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
    private HoltWintersComponents initializeHoltWinters(List<Double> series, int seasonLength,
                                                        double alpha, double beta, double gamma) {
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

            level = alpha * (value - lastSeason) + (1 - alpha) * (level + trend);
            trend = beta * (level - lastLevel) + (1 - beta) * trend;
            seasonal[seasonIndex] = gamma * (value - level) + (1 - gamma) * lastSeason;
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

    // Deterministic formula fallback. The high-efficiency flag is informational only.
    private List<Double> fallbackEstimateForAppliance(Appliance appliance, int days) {
        return new ArrayList<>(Collections.nCopies(days, calculations.dailyKwh(appliance)));
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

    private SmoothingParams tuneHoltLinearParameters(List<Double> series) {
        if (series.size() < MIN_HISTORY_FOR_FORECAST + 1) {
            return new SmoothingParams(DEFAULT_ALPHA, DEFAULT_BETA, DEFAULT_GAMMA, 0, 0);
        }
        int holdout = Math.max(1, Math.min(7, series.size() / 4));
        List<Double> train = series.subList(0, series.size() - holdout);
        List<Double> actual = series.subList(series.size() - holdout, series.size());

        SmoothingParams best = new SmoothingParams(DEFAULT_ALPHA, DEFAULT_BETA, DEFAULT_GAMMA, Double.MAX_VALUE, Double.MAX_VALUE);
        for (double alpha : ALPHA_GRID) {
            for (double beta : BETA_GRID) {
                List<Double> predicted = holtLinearForecastMultiple(train, holdout, alpha, beta);
                ErrorMetrics metrics = calculateErrorMetrics(actual, predicted);
                if (metrics.mae < best.mae) {
                    best = new SmoothingParams(alpha, beta, DEFAULT_GAMMA, metrics.mae, metrics.rmse);
                }
            }
        }
        logger.debug("[Forecast] Tuned Holt params alpha={}, beta={} => MAE={}, RMSE={}",
                best.alpha, best.beta, best.mae, best.rmse);
        return best;
    }

    private SmoothingParams tuneHoltWintersParameters(List<Double> series, int seasonLength) {
        if (series.size() < 2 * seasonLength + 1) {
            return new SmoothingParams(DEFAULT_ALPHA, DEFAULT_BETA, DEFAULT_GAMMA, 0, 0);
        }
        int holdout = Math.max(1, Math.min(7, series.size() / 4));
        List<Double> train = series.subList(0, series.size() - holdout);
        List<Double> actual = series.subList(series.size() - holdout, series.size());

        SmoothingParams best = new SmoothingParams(DEFAULT_ALPHA, DEFAULT_BETA, DEFAULT_GAMMA, Double.MAX_VALUE, Double.MAX_VALUE);
        for (double alpha : ALPHA_GRID) {
            for (double beta : BETA_GRID) {
                for (double gamma : GAMMA_GRID) {
                    List<Double> predicted = holtWintersMultipleForecast(train, seasonLength, holdout, alpha, beta, gamma);
                    ErrorMetrics metrics = calculateErrorMetrics(actual, predicted);
                    if (metrics.mae < best.mae) {
                        best = new SmoothingParams(alpha, beta, gamma, metrics.mae, metrics.rmse);
                    }
                }
            }
        }
        logger.debug("[Forecast] Tuned Holt-Winters params alpha={}, beta={}, gamma={} => MAE={}, RMSE={}",
                best.alpha, best.beta, best.gamma, best.mae, best.rmse);
        return best;
    }

    private ErrorMetrics calculateErrorMetrics(List<Double> actual, List<Double> predicted) {
        int n = Math.min(actual.size(), predicted.size());
        if (n == 0) return new ErrorMetrics(0, 0);

        double absError = 0;
        double squaredError = 0;
        for (int i = 0; i < n; i++) {
            double error = actual.get(i) - predicted.get(i);
            absError += Math.abs(error);
            squaredError += error * error;
        }
        return new ErrorMetrics(absError / n, Math.sqrt(squaredError / n));
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

    private static class ErrorMetrics {
        double mae;
        double rmse;

        ErrorMetrics(double mae, double rmse) {
            this.mae = mae;
            this.rmse = rmse;
        }
    }

    private static class SmoothingParams {
        double alpha;
        double beta;
        double gamma;
        double mae;
        double rmse;

        SmoothingParams(double alpha, double beta, double gamma, double mae, double rmse) {
            this.alpha = alpha;
            this.beta = beta;
            this.gamma = gamma;
            this.mae = mae;
            this.rmse = rmse;
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
