package com.energytracker.model;

import jakarta.persistence.*;
import java.time.LocalDate;


@Entity
@Table(name = "energy_usage_logs")
public class EnergyUsageLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // The date this usage was recorded
    @Column(nullable = false)
    private LocalDate date;

    // The kWh used for that appliance on that date
    @Column(name = "kwh_used", nullable = false)
    private double kWhUsed;

    // Many UsageLogs → one Appliance
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "appliance_id", nullable = false)
    private Appliance appliance;

    public Long getId() {
        return id;
    }

    public LocalDate getDate() {
        return date;
    }
    public void setDate(LocalDate date) {
        this.date = date;
    }

    public double getKWhUsed() {
        return kWhUsed;
    }
    public void setKWhUsed(double kWhUsed) {
        this.kWhUsed = kWhUsed;
    }

    public Appliance getAppliance() {
        return appliance;
    }
    public void setAppliance(Appliance appliance) {
        this.appliance = appliance;
    }
}
