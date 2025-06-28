// src/main/java/com/energytracker/util/TimeSeriesForecaster.java
package com.util;

import com.energytracker.model.EnergyUsageLog;
import com.energytracker.repository.EnergyUsageLogRepository;
import org.apache.commons.math3.stat.descriptive.moment.Mean;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Simple Exponential Smoothing forecaster.
 */
@Component
public class TimeSeriesForecaster {

    private final EnergyUsageLogRepository logRepo;
    private static final double ALPHA = 0.3;  // smoothing factor

    public TimeSeriesForecaster(EnergyUsageLogRepository logRepo) {
        this.logRepo = logRepo;
    }

    /**
     * Forecasts tomorrow's usage (kWh) for a given appliance via SES over the last N days.
     * Falls back to straight mean if insufficient history.
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

        if (series.size() < 2) {
            // Not enough points: just use mean
            return new Mean().evaluate(series.stream().mapToDouble(d -> d).toArray());
        }

        // SES iterative smoothing
        double s = series.get(0);
        for (int i = 1; i < series.size(); i++) {
            double x = series.get(i);
            s = ALPHA * x + (1 - ALPHA) * s;
        }
        // the forecast for next point = last smoothed value
        return s;
    }
}
