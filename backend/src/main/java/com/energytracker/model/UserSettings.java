package com.energytracker.model;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Column;
import jakarta.validation.constraints.Pattern;

@Entity
public class UserSettings {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long userId;

    private double electricityRatePerKWh;

    private Integer householdSize;// Default household size

    @Column(nullable = false, length = 3)
    @Pattern(regexp = "USD|EUR", message = "Currency must be USD or EUR")
    private String currency;


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
    public Integer getHouseholdSize() {
        return householdSize;
    }   
    public void setHouseholdSize(Integer householdSize) {
        this.householdSize = householdSize;
    }
    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }
}
