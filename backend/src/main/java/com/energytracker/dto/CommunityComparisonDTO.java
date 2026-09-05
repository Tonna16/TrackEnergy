package com.energytracker.dto;

public class CommunityComparisonDTO {
    private final double averageUsage;
    private final String source;
    private final boolean sample;

    public CommunityComparisonDTO(double averageUsage, String source, boolean sample) {
        this.averageUsage = averageUsage;
        this.source = source;
        this.sample = sample;
    }

    public double getAverageUsage() { return averageUsage; }
    public String getSource() { return source; }
    public boolean isSample() { return sample; }
}
