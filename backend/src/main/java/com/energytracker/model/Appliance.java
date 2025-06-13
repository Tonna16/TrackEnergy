package com.energytracker.model;

import jakarta.persistence.*;

@Entity
@Table(name = "appliances")
public class Appliance {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;
    private int wattage;
    private double hoursPerDay;
    private int daysPerWeek;
    private boolean isHighEfficiency;
    private String type;
    private String location;
    private String brand;
    private String model;

    // ── NEW: link back to User ──
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    // ── Getters / setters omitted for brevity ──

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public int getWattage() { return wattage; }
    public void setWattage(int wattage) { this.wattage = wattage; }

    public double getHoursPerDay() { return hoursPerDay; }
    public void setHoursPerDay(double hoursPerDay) { this.hoursPerDay = hoursPerDay; }

    public int getDaysPerWeek() { return daysPerWeek; }
    public void setDaysPerWeek(int daysPerWeek) { this.daysPerWeek = daysPerWeek; }

    public boolean isHighEfficiency() { return isHighEfficiency; }
    public void setHighEfficiency(boolean highEfficiency) { isHighEfficiency = highEfficiency; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getLocation() { return location; }
    public void setLocation(String location) { this.location = location; }

    public String getBrand() { return brand; }
    public void setBrand(String brand) { this.brand = brand; }

    public String getModel() { return model; }
    public void setModel(String model) { this.model = model; }

    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }
}
