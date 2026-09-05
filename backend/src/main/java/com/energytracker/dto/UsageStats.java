package com.energytracker.dto;

public class UsageStats {

    private double totalKwh;

    public UsageStats(double totalKwh) {
        this.totalKwh = totalKwh;
    }

    public double getTotalKwh() {
        return totalKwh;
    }

    public void setTotalKwh(double totalKwh) {
        this.totalKwh = totalKwh;
    }
}
