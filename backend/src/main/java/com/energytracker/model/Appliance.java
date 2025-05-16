package com.energytracker.model;

import jakarta.persistence.*;

@Entity
public class Appliance {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;
    private String type;
    private double wattage;
    private double hoursPerDay;

    // Constructors
    public Appliance() {}

    public Appliance(String name, String type, double wattage, double hoursPerDay) {
        this.name = name;
        this.type = type;
        this.wattage = wattage;
        this.hoursPerDay = hoursPerDay;
    }

    // Getters and Setters
    public Long getId() { return id; }
    public String getName() { return name; }
    public String getType() { return type; }
    public double getWattage() { return wattage; }
    public double getHoursPerDay() { return hoursPerDay; }

    public void setId(Long id) { this.id = id; }
    public void setName(String name) { this.name = name; }
    public void setType(String type) { this.type = type; }
    public void setWattage(double wattage) { this.wattage = wattage; }
    public void setHoursPerDay(double hoursPerDay) { this.hoursPerDay = hoursPerDay; }
}
