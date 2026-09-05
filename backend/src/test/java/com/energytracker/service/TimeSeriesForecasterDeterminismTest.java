package com.energytracker.service;

import com.energytracker.model.Appliance;
import com.energytracker.model.EnergyUsageLog;
import com.energytracker.repository.ApplianceRepository;
import com.energytracker.repository.EnergyUsageLogRepository;
import com.util.TimeSeriesForecaster;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class TimeSeriesForecasterDeterminismTest {
    @Test
    void matchesSharedCrossStackForecastFixture() throws Exception {
        JsonNode fixture;
        try (InputStream input = getClass().getResourceAsStream("/energy-domain.json")) {
            fixture = new ObjectMapper().readTree(input).path("historyForecastExamples").get(0);
        }

        EnergyUsageLogRepository logRepo = mock(EnergyUsageLogRepository.class);
        ApplianceRepository applianceRepo = mock(ApplianceRepository.class);
        Clock clock = Clock.fixed(Instant.parse("2026-04-15T12:00:00Z"), ZoneOffset.UTC);
        Appliance appliance = new Appliance();
        appliance.setId(1L);
        appliance.setActive(true);
        appliance.setDeleted(false);
        when(applianceRepo.findById(1L)).thenReturn(Optional.of(appliance));

        int historyDays = fixture.path("historyDays").asInt();
        JsonNode pattern = fixture.path("repeatPattern");
        LocalDate end = LocalDate.now(clock).minusDays(1);
        LocalDate start = end.minusDays(historyDays - 1L);
        List<EnergyUsageLog> logs = new ArrayList<>();
        for (int index = 0; index < historyDays; index++) {
            EnergyUsageLog log = new EnergyUsageLog();
            log.setAppliance(appliance);
            log.setDate(start.plusDays(index));
            log.setKWhUsed(pattern.get(index % pattern.size()).asDouble());
            logs.add(log);
        }
        when(logRepo.findByApplianceIdAndDateBetween(eq(1L), any(LocalDate.class), any(LocalDate.class))).thenReturn(logs);

        TimeSeriesForecaster forecaster = new TimeSeriesForecaster(
            logRepo,
            applianceRepo,
            new EnergyCalculationService(new EnergyDomainConfig()),
            clock
        );
        List<Double> expected = new ArrayList<>();
        fixture.path("expectedForecastKwh").forEach(value -> expected.add(value.asDouble()));
        assertEquals(expected, forecaster.forecastNextNDays(1L, fixture.path("forecastDays").asInt()));
    }

    @Test
    void repeatedHoltWintersRunsAreIdentical() {
        EnergyUsageLogRepository logRepo = mock(EnergyUsageLogRepository.class);
        ApplianceRepository applianceRepo = mock(ApplianceRepository.class);
        Clock clock = Clock.fixed(Instant.parse("2026-04-15T12:00:00Z"), ZoneOffset.UTC);
        Appliance appliance = new Appliance();
        appliance.setId(1L);
        appliance.setActive(true);
        appliance.setDeleted(false);
        when(applianceRepo.findById(1L)).thenReturn(Optional.of(appliance));

        List<EnergyUsageLog> logs = new ArrayList<>();
        LocalDate start = LocalDate.of(2026, 2, 15);
        for (int index = 0; index < 60; index++) {
            EnergyUsageLog log = new EnergyUsageLog();
            log.setAppliance(appliance);
            log.setDate(start.plusDays(index));
            log.setKWhUsed(2.0 + (index % 7) * 0.1);
            logs.add(log);
        }
        when(logRepo.findByApplianceIdAndDateBetween(eq(1L), any(LocalDate.class), any(LocalDate.class))).thenReturn(logs);

        TimeSeriesForecaster forecaster = new TimeSeriesForecaster(
            logRepo,
            applianceRepo,
            new EnergyCalculationService(new EnergyDomainConfig()),
            clock
        );
        List<Double> first = forecaster.forecastNextNDays(1L, 30);
        List<Double> second = forecaster.forecastNextNDays(1L, 30);
        assertEquals(first, second);
    }
}
