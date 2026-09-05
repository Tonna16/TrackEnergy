package com.energytracker.dto;

public class UsageSummaryDTO {
    private double totalKwh;
    private double totalCost;
    private double averageDailyKwh;
    private double estimatedCarbonKg;
    private String currency;

    public UsageSummaryDTO() {}

    public UsageSummaryDTO(
        double totalKwh,
        double totalCost,
        double averageDailyKwh,
        double estimatedCarbonKg,
        String currency
    ) {
        this.totalKwh = totalKwh;
        this.totalCost = totalCost;
        this.averageDailyKwh = averageDailyKwh;
        this.estimatedCarbonKg = estimatedCarbonKg;
        this.currency = currency;
    }

    public static UsageSummaryDTO empty(String currency) {
        return new UsageSummaryDTO(0.0, 0.0, 0.0, 0.0, currency);
    }

    public double getTotalKwh() { return totalKwh; }
    public void setTotalKwh(double totalKwh) { this.totalKwh = totalKwh; }
    public double getTotalCost() { return totalCost; }
    public void setTotalCost(double totalCost) { this.totalCost = totalCost; }
    public double getAverageDailyKwh() { return averageDailyKwh; }
    public void setAverageDailyKwh(double averageDailyKwh) { this.averageDailyKwh = averageDailyKwh; }
    public double getEstimatedCarbonKg() { return estimatedCarbonKg; }
    public void setEstimatedCarbonKg(double estimatedCarbonKg) { this.estimatedCarbonKg = estimatedCarbonKg; }
    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }
}
