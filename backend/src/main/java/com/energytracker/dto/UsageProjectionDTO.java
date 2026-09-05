package com.energytracker.dto;

import java.util.Collections;
import java.util.Map;

public class UsageProjectionDTO {
    private final String date;
    private final String weekStart;
    private final String weekEnd;
    private final int daysInPeriod;
    private final double totalKwh;
    private final double totalCost;
    private final double estimatedCarbonKg;
    private final Map<String, Double> byAppKwh;
    private final Map<String, Double> byAppCost;
    private final String currency;
    private final String source;

    public UsageProjectionDTO(
        String date,
        String weekStart,
        String weekEnd,
        int daysInPeriod,
        double totalKwh,
        double totalCost,
        double estimatedCarbonKg,
        Map<String, Double> byAppKwh,
        Map<String, Double> byAppCost,
        String currency,
        String source
    ) {
        this.date = date;
        this.weekStart = weekStart;
        this.weekEnd = weekEnd;
        this.daysInPeriod = daysInPeriod;
        this.totalKwh = totalKwh;
        this.totalCost = totalCost;
        this.estimatedCarbonKg = estimatedCarbonKg;
        this.byAppKwh = byAppKwh == null ? Collections.emptyMap() : Map.copyOf(byAppKwh);
        this.byAppCost = byAppCost == null ? Collections.emptyMap() : Map.copyOf(byAppCost);
        this.currency = currency;
        this.source = source;
    }

    public String getDate() { return date; }
    public String getWeekStart() { return weekStart; }
    public String getWeekEnd() { return weekEnd; }
    public int getDaysInPeriod() { return daysInPeriod; }
    public double getTotalKwh() { return totalKwh; }
    public double getTotalCost() { return totalCost; }
    public double getEstimatedCarbonKg() { return estimatedCarbonKg; }
    public Map<String, Double> getByAppKwh() { return byAppKwh; }
    public Map<String, Double> getByAppCost() { return byAppCost; }
    public String getCurrency() { return currency; }
    public String getSource() { return source; }
}
