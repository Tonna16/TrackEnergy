package com.energytracker.model;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;

@Entity
public class UserSettings {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long userId;

    private double electricityRatePerKWh;

    // Add more fields if needed

    // Getters and setters...
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public double getElectricityRatePerKWh() {
        return electricityRatePerKWh;
    }

    public void setElectricityRatePerKWh(double electricityRatePerKWh) {
        this.electricityRatePerKWh = electricityRatePerKWh;
    }
}
