package com.energytracker.service;

import com.energytracker.dto.HistoryForecastDTO;
import com.energytracker.dto.UsageProjectionDTO;
import com.energytracker.model.Appliance;
import com.energytracker.model.UserSettings;
import com.energytracker.repository.ApplianceRepository;
import com.energytracker.repository.EnergyUsageLogRepository;
import com.util.TimeSeriesForecaster;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class EnergyUsageProjectionContractTest {
    private static final Clock CLOCK = Clock.fixed(Instant.parse("2024-01-15T12:00:00Z"), ZoneOffset.UTC);

    @Test
    void formulaProjectionsUseExactBoundariesAndExpandedContract() {
        Fixture fixture = fixture(List.of(appliance(1L, "Heater", 1000, 1, 7, null)));
        List<UsageProjectionDTO> monthly = fixture.service.getProjections(7L, "monthly");

        assertEquals("2024-02-01", monthly.get(0).getDate());
        assertEquals(29, monthly.get(0).getDaysInPeriod());
        assertEquals(29.0, monthly.get(0).getTotalKwh(), 1e-12);
        assertEquals(5.8, monthly.get(0).getTotalCost(), 1e-12);
        assertEquals(11.426, monthly.get(0).getEstimatedCarbonKg(), 1e-12);
        assertEquals(29.0, monthly.get(0).getByAppKwh().get("Heater"), 1e-12);
        assertEquals(5.8, monthly.get(0).getByAppCost().get("Heater"), 1e-12);
        assertEquals("EUR", monthly.get(0).getCurrency());
        assertEquals("formula-estimate", monthly.get(0).getSource());
        assertEquals(List.of(29, 31, 30, 31, 30, 31), monthly.stream().map(UsageProjectionDTO::getDaysInPeriod).toList());

        UsageProjectionDTO daily = fixture.service.getProjections(7L, "daily").get(0);
        assertEquals("2024-01-16", daily.getDate());

        UsageProjectionDTO weekly = fixture.service.getProjections(7L, "weekly").get(0);
        assertEquals("2024-01-22", weekly.getWeekStart());
        assertEquals("2024-01-28", weekly.getWeekEnd());
    }

    @Test
    void formulaProjectionHonorsManualZeroAndVisibility() {
        Appliance override = appliance(1L, "Override", 1000, 24, 7, 0.0);
        Appliance inactive = appliance(2L, "Inactive", 1000, 24, 7, null);
        inactive.setActive(false);
        Appliance deleted = appliance(3L, "Deleted", 1000, 24, 7, null);
        deleted.setDeleted(true);
        Fixture fixture = fixture(List.of(override, inactive, deleted));
        UsageProjectionDTO point = fixture.service.projectPoint(List.of(override, inactive, deleted), java.time.LocalDate.of(2024, 1, 16), 1, false, 0.2);
        assertEquals(0.0, point.getTotalKwh(), 1e-12);
        assertEquals(1, point.getByAppKwh().size());
    }

    @Test
    void historyAvailabilityAndConfidenceNeverMixFormulaData() {
        Appliance first = appliance(1L, "One", 1000, 1, 7, null);
        Appliance second = appliance(2L, "Two", 1000, 1, 7, null);
        Fixture fixture = fixture(List.of(first, second));
        when(fixture.logRepo.countDistinctValidUsageDaysByApplianceId(1L)).thenReturn(90L);
        when(fixture.logRepo.countDistinctValidUsageDaysByApplianceId(2L)).thenReturn(59L);

        HistoryForecastDTO insufficient = fixture.service.getHistoryForecast(7L, "daily");
        assertEquals("insufficient_history", insufficient.getStatus());
        assertTrue(insufficient.getProjections().isEmpty());
        verify(fixture.forecaster, never()).forecastNextNDays(anyLong(), anyInt());

        when(fixture.logRepo.countDistinctValidUsageDaysByApplianceId(2L)).thenReturn(60L);
        when(fixture.forecaster.forecastNextNDays(anyLong(), anyInt())).thenAnswer(invocation -> {
            int days = invocation.getArgument(1);
            long applianceId = invocation.getArgument(0);
            return new ArrayList<>(Collections.nCopies(days, applianceId == 1L ? 1.0 : 2.0));
        });
        HistoryForecastDTO medium = fixture.service.getHistoryForecast(7L, "monthly");
        assertEquals("available", medium.getStatus());
        assertEquals("medium", medium.getConfidence());
        assertEquals(60, medium.getHistoryDays());
        assertEquals("history-based", medium.getProjections().get(0).getSource());
        assertEquals(87.0, medium.getProjections().get(0).getTotalKwh(), 1e-12);

        when(fixture.logRepo.countDistinctValidUsageDaysByApplianceId(2L)).thenReturn(90L);
        HistoryForecastDTO high = fixture.service.getHistoryForecast(7L, "daily");
        assertEquals("high", high.getConfidence());
    }

    private Fixture fixture(List<Appliance> appliances) {
        EnergyUsageLogRepository logRepo = mock(EnergyUsageLogRepository.class);
        ApplianceRepository applianceRepo = mock(ApplianceRepository.class);
        UserSettingsService settingsService = mock(UserSettingsService.class);
        TimeSeriesForecaster forecaster = mock(TimeSeriesForecaster.class);
        UserService userService = mock(UserService.class);
        NotificationService notificationService = mock(NotificationService.class);
        UserSettings settings = new UserSettings();
        settings.setElectricityRatePerKWh(0.2);
        settings.setCurrency("EUR");
        when(settingsService.getSettingsByUserId(7L)).thenReturn(Optional.of(settings));
        when(applianceRepo.findAllByUserIdAndActiveTrueAndDeletedFalse(7L)).thenReturn(appliances);
        EnergyUsageService service = new EnergyUsageService(
            logRepo,
            applianceRepo,
            settingsService,
            forecaster,
            userService,
            notificationService,
            new EnergyCalculationService(new EnergyDomainConfig()),
            CLOCK
        );
        return new Fixture(service, logRepo, forecaster);
    }

    private Appliance appliance(Long id, String name, double watts, double hours, int days, Double override) {
        Appliance appliance = new Appliance();
        appliance.setId(id);
        appliance.setName(name);
        appliance.setWattage(watts);
        appliance.setHoursPerDay(hours);
        appliance.setDaysPerWeek(days);
        appliance.setEstimatedDailyKWh(override);
        appliance.setActive(true);
        appliance.setDeleted(false);
        return appliance;
    }

    private record Fixture(EnergyUsageService service, EnergyUsageLogRepository logRepo, TimeSeriesForecaster forecaster) {}
}
