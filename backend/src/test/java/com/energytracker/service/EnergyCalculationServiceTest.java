package com.energytracker.service;

import com.energytracker.model.Appliance;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.io.InputStream;
import java.time.YearMonth;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class EnergyCalculationServiceTest {
    private final EnergyCalculationService calculations = new EnergyCalculationService(new EnergyDomainConfig());

    @Test
    void mirrorsSharedCrossStackFixtures() throws Exception {
        try (InputStream input = getClass().getResourceAsStream("/energy-domain.json")) {
            JsonNode examples = new ObjectMapper().readTree(input).path("calculationExamples");
            for (JsonNode example : examples) {
                Appliance appliance = appliance(
                    example.path("wattage").asDouble(),
                    example.path("hoursPerDay").asDouble(),
                    example.path("daysPerWeek").asInt()
                );
                if (!example.path("estimatedDailyKWh").isNull()) {
                    appliance.setEstimatedDailyKWh(example.path("estimatedDailyKWh").asDouble());
                }
                assertEquals(example.path("expectedDailyKwh").asDouble(), calculations.dailyKwh(appliance), 1e-12);
            }
        }
    }

    @Test
    void calculatesAllPeriodsAndCalendarLengths() {
        Appliance appliance = appliance(1000, 1, 7);
        assertEquals(1.0, calculations.dailyKwh(appliance), 1e-12);
        assertEquals(7.0, calculations.weeklyKwh(appliance), 1e-12);
        assertEquals(28.0, calculations.monthlyKwh(appliance, YearMonth.of(2025, 2)), 1e-12);
        assertEquals(29.0, calculations.monthlyKwh(appliance, YearMonth.of(2024, 2)), 1e-12);
        assertEquals(30.0, calculations.monthlyKwh(appliance, YearMonth.of(2026, 4)), 1e-12);
        assertEquals(31.0, calculations.monthlyKwh(appliance, YearMonth.of(2026, 1)), 1e-12);
        assertEquals(365.0, calculations.annualKwh(appliance, 2025), 1e-12);
        assertEquals(366.0, calculations.annualKwh(appliance, 2024), 1e-12);
    }

    @Test
    void handlesSchedulesOverridesVisibilityCurrencyAndCarbon() {
        Appliance fiveDays = appliance(1200, 1, 5);
        assertEquals(1.2 * 5 / 7.0, calculations.dailyKwh(fiveDays), 1e-12);
        fiveDays.setEstimatedDailyKWh(0.0);
        assertEquals(0.0, calculations.dailyKwh(fiveDays), 1e-12);

        Appliance active = appliance(1000, 1, 7);
        Appliance inactive = appliance(1000, 1, 7);
        inactive.setActive(false);
        Appliance deleted = appliance(1000, 1, 7);
        deleted.setDeleted(true);
        assertEquals(1.0, calculations.totalDailyKwh(List.of(active, inactive, deleted)), 1e-12);

        active.setHighEfficiency(true);
        assertEquals(1.0, calculations.dailyKwh(active), 1e-12);
        assertEquals(2.0, calculations.cost(10, 0.2), 1e-12);
        assertEquals("USD", calculations.normalizeCurrency("USD"));
        assertEquals("EUR", calculations.normalizeCurrency("EUR"));
        assertEquals(3.94, calculations.estimatedCarbonKg(10), 1e-12);
    }

    private Appliance appliance(double wattage, double hoursPerDay, int daysPerWeek) {
        Appliance appliance = new Appliance();
        appliance.setName("Fixture Appliance");
        appliance.setWattage(wattage);
        appliance.setHoursPerDay(hoursPerDay);
        appliance.setDaysPerWeek(daysPerWeek);
        appliance.setActive(true);
        appliance.setDeleted(false);
        return appliance;
    }
}
