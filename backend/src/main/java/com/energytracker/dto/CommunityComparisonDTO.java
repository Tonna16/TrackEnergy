package com.energytracker.dto;

public class CommunityComparisonDTO {

    private double averageUsage;
    private double someOtherMetric; // placeholder, adjust as needed

    public CommunityComparisonDTO() {}

    public CommunityComparisonDTO(double averageUsage, double someOtherMetric) {
        this.averageUsage = averageUsage;
        this.someOtherMetric = someOtherMetric;
    }

    public double getAverageUsage() {
        return averageUsage;
    }

    public void setAverageUsage(double averageUsage) {
        this.averageUsage = averageUsage;
    }

    public double getSomeOtherMetric() {
        return someOtherMetric;
    }

    public void setSomeOtherMetric(double someOtherMetric) {
        this.someOtherMetric = someOtherMetric;
    }
}
