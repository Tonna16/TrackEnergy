package com.energytracker.dto;


/**
 * A DTO for the “/summary” endpoint. 
 * Contains:
 *   - totalKwh: sum of all kWh used by this user (across all appliances, all time),
 *   - totalCost: sum of (kWh * rate) for that same set,
 *   - averageDailyKwh: average kWh/day based on distinct dates seen,
 *   - optionally you could add a breakdown per‐day or per‐appliance if desired—but for now just these three.
 */
public class UsageSummaryDTO {
    private final double totalKwh;
    private final double totalCost;
    private final double averageDailyKwh;

    public UsageSummaryDTO(double totalKwh, double totalCost, double averageDailyKwh) {
        this.totalKwh = totalKwh;
        this.totalCost = totalCost;
        this.averageDailyKwh = averageDailyKwh;
    }

    public double getTotalKwh() {
        return totalKwh;
    }

    public double getTotalCost() {
        return totalCost;
    }

    public double getAverageDailyKwh() {
        return averageDailyKwh;
    }
}
