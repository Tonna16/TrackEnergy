package com.energytracker.dto;

import java.time.LocalDate;

/**
 * A simple DTO that holds a single energy usage record.
 * - Represents an appliance's energy usage on a specific day.
 */
public class EnergyUsageDTO {
    private final LocalDate date;
    private final Long applianceId;
    private final String applianceName;
    private final double kWhUsed;

    public EnergyUsageDTO(LocalDate date, Long applianceId, String applianceName, double kWhUsed) {
        this.date = date;
        this.applianceId = applianceId;
        this.applianceName = applianceName;
        this.kWhUsed = kWhUsed;
    }

    public LocalDate getDate() {
        return date;
    }

    public Long getApplianceId() {
        return applianceId;
    }

    public String getApplianceName() {
        return applianceName;
    }

    public double getkWhUsed() {
        return kWhUsed;
    }
}
