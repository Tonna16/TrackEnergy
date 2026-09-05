package com.energytracker.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import java.io.InputStream;

@Component
public class EnergyDomainConfig {
    private final double defaultElectricityRate;
    private final String defaultCurrency;
    private final double carbonKgPerKwh;

    public EnergyDomainConfig() {
        try (InputStream input = EnergyDomainConfig.class.getResourceAsStream("/energy-domain.json")) {
            if (input == null) throw new IllegalStateException("energy-domain.json was not bundled");
            JsonNode root = new ObjectMapper().readTree(input);
            defaultElectricityRate = root.path("defaults").path("electricityRate").asDouble();
            defaultCurrency = root.path("defaults").path("currency").asText();
            carbonKgPerKwh = root.path("carbon").path("kgCo2PerKwh").asDouble();
        } catch (Exception error) {
            throw new IllegalStateException("Unable to load shared energy domain configuration", error);
        }
    }

    public double getDefaultElectricityRate() { return defaultElectricityRate; }
    public String getDefaultCurrency() { return defaultCurrency; }
    public double getCarbonKgPerKwh() { return carbonKgPerKwh; }
}
