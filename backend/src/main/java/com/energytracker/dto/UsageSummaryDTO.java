package com.energytracker.dto;

/**
 * A DTO for the “/summary” endpoint. 
 * Contains:
 *   - totalKwh: sum of all kWh used by this user (across all appliances, all time),
 *   - totalCost: sum of (kWh * rate) for that same set,
 *   - averageDailyKwh: average kWh/day based on distinct dates seen,
 */
public class UsageSummaryDTO {
    private double totalKwh;
    private double totalCost;
    private double averageDailyKwh;

    // No-arg constructor for fallback or serialization libraries
    public UsageSummaryDTO() {
        this.totalKwh = 0.0;
        this.totalCost = 0.0;
        this.averageDailyKwh = 0.0;
    }

    // Full constructor
    public UsageSummaryDTO(double totalKwh, double totalCost, double averageDailyKwh) {
        this.totalKwh = totalKwh;
        this.totalCost = totalCost;
        this.averageDailyKwh = averageDailyKwh;
    }

    // Static factory method for empty summary
    public static UsageSummaryDTO empty() {
        return new UsageSummaryDTO(0.0, 0.0, 0.0);
    }

    // Getters and setters (needed now that fields are non-final)
    public double getTotalKwh() {
        return totalKwh;
    }

    public void setTotalKwh(double totalKwh) {
        this.totalKwh = totalKwh;
    }

    public double getTotalCost() {
        return totalCost;
    }

    public void setTotalCost(double totalCost) {
        this.totalCost = totalCost;
    }

    public double getAverageDailyKwh() {
        return averageDailyKwh;
    }

    public void setAverageDailyKwh(double averageDailyKwh) {
        this.averageDailyKwh = averageDailyKwh;
    }
}
