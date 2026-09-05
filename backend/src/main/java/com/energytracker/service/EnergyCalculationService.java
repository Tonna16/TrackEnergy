package com.energytracker.service;

import com.energytracker.model.Appliance;
import org.springframework.stereotype.Service;

import java.time.Year;
import java.time.YearMonth;
import java.util.Collection;

@Service
public class EnergyCalculationService {
    private final EnergyDomainConfig domain;

    public EnergyCalculationService(EnergyDomainConfig domain) {
        this.domain = domain;
    }

    public double dailyKwh(Appliance appliance) {
        if (appliance.getEstimatedDailyKWh() != null) {
            return Math.max(0.0, appliance.getEstimatedDailyKWh());
        }
        double wattage = Math.max(0.0, appliance.getWattage());
        double hours = Math.max(0.0, appliance.getHoursPerDay());
        double days = Math.max(0, Math.min(7, appliance.getDaysPerWeek()));
        return wattage * hours * (days / 7.0) / 1000.0;
    }

    public double weeklyKwh(Appliance appliance) { return dailyKwh(appliance) * 7.0; }
    public double monthlyKwh(Appliance appliance, YearMonth month) { return dailyKwh(appliance) * month.lengthOfMonth(); }
    public double annualKwh(Appliance appliance, int year) { return dailyKwh(appliance) * Year.of(year).length(); }

    public boolean included(Appliance appliance) {
        return appliance != null && appliance.isActive() && !appliance.isDeleted();
    }

    public double totalDailyKwh(Collection<Appliance> appliances) {
        return appliances.stream().filter(this::included).mapToDouble(this::dailyKwh).sum();
    }

    public double cost(double kwh, double electricityRate) {
        return Math.max(0.0, kwh) * Math.max(0.0, electricityRate);
    }

    public double estimatedCarbonKg(double kwh) {
        return Math.max(0.0, kwh) * domain.getCarbonKgPerKwh();
    }

    public double defaultElectricityRate() { return domain.getDefaultElectricityRate(); }
    public String defaultCurrency() { return domain.getDefaultCurrency(); }

    public String normalizeCurrency(String currency) {
        return "EUR".equalsIgnoreCase(currency) ? "EUR" : "USD";
    }
}
