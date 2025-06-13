package com.energytracker.dto;

import java.util.Map;

/**
 * Holds a single projection point:
 *   - date (either "YYYY-MM-DD" for daily/weekly or "MMM yyyy" for monthly),
 *   - totalCost (sum of all appliances for that period),
 *   - byAppCost → a map: { applianceName → cost }.
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
