package com.util;

import com.energytracker.model.EnergyUsageLog;
import com.energytracker.model.Appliance;
import com.energytracker.repository.EnergyUsageLogRepository;
import com.energytracker.repository.ApplianceRepository;
import org.apache.commons.math3.stat.descriptive.moment.Mean;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Simple Exponential Smoothing forecaster.
 * Improved to handle very limited data better with fallback.
 */
@Component
public class TimeSeriesForecaster {

    private final EnergyUsageLogRepository logRepo;
    private final ApplianceRepository applianceRepo;
    private static final double ALPHA = 0.3;  // smoothing factor

    public TimeSeriesForecaster(EnergyUsageLogRepository logRepo, ApplianceRepository applianceRepo) {
        this.logRepo = logRepo;
        this.applianceRepo = applianceRepo;
    }

    /**
     * Forecasts tomorrow's usage (kWh) for a given appliance via SES over the last N days.
     * Falls back to baseline estimate if insufficient history.
     */
    public double forecastNext(Long applianceId, int historyDays) {
        LocalDate end = LocalDate.now().minusDays(1);
        LocalDate start = end.minusDays(historyDays - 1);

        List<Double> series = logRepo
            .findByApplianceIdAndDateBetween(applianceId, start, end)
            .stream()
            .collect(Collectors.groupingBy(EnergyUsageLog::getDate,
                Collectors.summingDouble(EnergyUsageLog::getKWhUsed)))
            .entrySet().stream()
            .sorted((a, b) -> a.getKey().compareTo(b.getKey()))
            .map(e -> e.getValue())
            .collect(Collectors.toList());

        // No history at all → baseline fallback
        if (series.isEmpty()) {
            return fallbackEstimateForAppliance(applianceId);
        }

        // Only one data point → use it directly
        if (series.size() < 2) {
            return new Mean().evaluate(series.stream().mapToDouble(Double::doubleValue).toArray());
        }

        // SES smoothing over the series
        double s = series.get(0);
        for (int i = 1; i < series.size(); i++) {
            double x = series.get(i);
            s = ALPHA * x + (1 - ALPHA) * s;
        }
        // Forecast for next day = last smoothed value
        return s;
    }

    /**
     * Baseline fallback estimate if no usage data.
     * Estimates as wattage * hoursPerDay / 1000 (kWh).
     */
    private double fallbackEstimateForAppliance(Long applianceId) {
        return applianceRepo.findById(applianceId)
                .map(a -> (a.getWattage() * a.getHoursPerDay()) / 1000.0)
                .orElse(0.0);
    }
}
