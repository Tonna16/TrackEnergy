package com.energytracker.dto;

import java.util.Map;

/**
 * Represents a single projected usage point for charting.
 * - `date`: either ISO format (YYYY-MM-DD) or 'MMM yyyy' depending on granularity.
 * - `totalCost`: summed cost of all appliances for the interval.
 * - `byAppCost`: breakdown of cost per appliance.
 */
public class UsageProjectionDTO {
    private final String date;
    private final double totalCost;
    private final Map<String, Double> byAppCost;

    public UsageProjectionDTO(String date, double totalCost, Map<String, Double> byAppCost) {
        this.date = date;
        this.totalCost = totalCost;
        this.byAppCost = byAppCost;
    }

    public String getDate() {
        return date;
    }

    public double getTotalCost() {
        return totalCost;
    }

    public Map<String, Double> getByAppCost() {
        return byAppCost;
    }
}
