package com.energytracker.dto;

import java.util.Map;

/**
 * Represents a projected usage point for charting or summary display.
 * - `label`: either a date (YYYY-MM-DD) or time range (e.g., 'This Week').
 * - `totalCost`: total cost for the interval.
 * - `byAppCost`: cost breakdown per appliance.
 */
public class UsageProjectionDTO {

    private final String label;
    private final double totalCost;
    private final Map<String, Double> byAppCost;

    public UsageProjectionDTO(String label, double totalCost, Map<String, Double> byAppCost) {
        this.label = label;
        this.totalCost = totalCost;
        this.byAppCost = byAppCost;
    }

    public String getLabel() {
        return label;
    }

    public double getTotalCost() {
        return totalCost;
    }

    public Map<String, Double> getByAppCost() {
        return byAppCost;
    }
}
