package com.energytracker.dto;

import java.util.Map;

/**
 * Represents a projected usage point for charting or summary display.
 * - `label`: either a date (YYYY-MM-DD) or time range (e.g., 'This Week').
 * - `totalKwh`: total energy usage (kWh) for the interval.
 * - `totalCost`: total cost for the interval.
 * - `byAppCost`: cost breakdown per appliance.
 */
public class UsageProjectionDTO {

    private final String date;
    private final String weekStart;
    private final String weekEnd;
    private final double totalKwh;
    private final double totalCost;
    private final Map<String, Double> byAppCost;

    public UsageProjectionDTO(String date, double totalKwh, double totalCost, Map<String, Double> byAppCost) {
        this(date, totalKwh, totalCost, byAppCost, null, null);
    }

    public UsageProjectionDTO(
        String date,
        double totalKwh,
        double totalCost,
        Map<String, Double> byAppCost,
        String weekStart,
        String weekEnd
    ) {
        this.date = date;
        this.totalKwh = totalKwh;
        this.totalCost = totalCost;
        this.byAppCost = byAppCost;
        this.weekStart = weekStart;
        this.weekEnd = weekEnd;
    }

    public String getDate() {
        return date;
    }

    public String getWeekStart() {
        return weekStart;
    }

    public String getWeekEnd() {
        return weekEnd;
    }

    public double getTotalKwh() {
        return totalKwh;
    }

    public double getTotalCost() {
        return totalCost;
    }

    public Map<String, Double> getByAppCost() {
        return byAppCost;
    }
}
