package com.energytracker.service;

import com.energytracker.dto.HistoryForecastDTO;
import com.energytracker.dto.UsageProjectionDTO;
import com.energytracker.model.Appliance;
import com.energytracker.model.EnergyUsageLog;
import com.energytracker.model.UserSettings;
import com.energytracker.repository.ApplianceRepository;
import com.energytracker.repository.EnergyUsageLogRepository;
import com.util.TimeSeriesForecaster;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
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
    void historyAvailabilityAndCoverageNeverMixFormulaData() {
        Appliance first = appliance(1L, "One", 1000, 1, 7, null);
        Appliance second = appliance(2L, "Two", 1000, 1, 7, null);
        Fixture fixture = fixture(List.of(first, second));
        stubHistory(fixture, 1L, history(90, 0));
        stubHistory(fixture, 2L, history(59, 0));

        HistoryForecastDTO insufficient = fixture.service.getHistoryForecast(7L, "daily");
        assertEquals("insufficient_history", insufficient.getStatus());
        assertTrue(insufficient.getProjections().isEmpty());
        verify(fixture.forecaster, never()).forecastNextNDays(anyLong(), anyInt());

        stubHistory(fixture, 2L, history(60, 0));
        when(fixture.forecaster.forecastNextNDays(anyLong(), anyInt())).thenAnswer(invocation -> {
            int days = invocation.getArgument(1);
            long applianceId = invocation.getArgument(0);
            return new ArrayList<>(Collections.nCopies(days, applianceId == 1L ? 1.0 : 2.0));
        });
        HistoryForecastDTO available = fixture.service.getHistoryForecast(7L, "monthly");
        assertEquals("available", available.getStatus());
        assertEquals("60/90 completed days recorded; 60/60 in the latest training window", available.getDataCoverage());
        assertEquals(60, available.getHistoryDays());
        assertEquals(60, available.getRecentHistoryDays());
        assertEquals("history-based", available.getProjections().get(0).getSource());
        assertEquals(87.0, available.getProjections().get(0).getTotalKwh(), 1e-12);

        stubHistory(fixture, 2L, history(120, 0));
        assertEquals("90/90 completed days recorded; 60/60 in the latest training window",
            fixture.service.getHistoryForecast(7L, "daily").getDataCoverage());
    }

    @Test
    void sixtyObservationsOverAYearOldNeverUnlockAZeroForecast() {
        Fixture fixture = fixture(List.of(appliance(1L, "One", 1000, 1, 7, null)));
        List<EnergyUsageLog> old = history(60, 400);
        stubHistory(fixture, 1L, old);
        HistoryForecastDTO result = fixture.service.getHistoryForecast(7L, "daily");
        assertEquals("insufficient_history", result.getStatus());
        assertEquals(0, result.getHistoryDays());
        assertTrue(result.getProjections().isEmpty());
        old.addAll(history(1, 0));
        result = fixture.service.getHistoryForecast(7L, "daily");
        assertEquals("insufficient_history", result.getStatus());
        assertEquals(1, result.getRecentHistoryDays());
        assertTrue(result.getProjections().isEmpty());
        verify(fixture.forecaster, never()).forecastNextNDays(anyLong(), anyInt());
    }

    @Test
    void sparseDuplicateInvalidCurrentAndFutureDaysCannotQualify() {
        Fixture fixture = fixture(List.of(appliance(1L, "One", 1000, 1, 7, null)));
        List<EnergyUsageLog> sparse = history(90, 0).stream()
            .filter(entry -> java.time.temporal.ChronoUnit.DAYS.between(entry.getDate(), LocalDate.now(CLOCK)) % 3 != 0)
            .toList();
        assertEquals(60, sparse.size());
        stubHistory(fixture, 1L, sparse);
        assertEquals("insufficient_history", fixture.service.getHistoryForecast(7L, "daily").getStatus());

        List<EnergyUsageLog> incomplete = history(59, 0);
        incomplete.addAll(history(59, 0));
        incomplete.addAll(history(2, -2)); // today and tomorrow
        EnergyUsageLog invalid = history(1, 59).getFirst();
        for (double kwh : new double[] {Double.NaN, Double.POSITIVE_INFINITY, -1.0}) {
            invalid.setKWhUsed(kwh);
            List<EnergyUsageLog> entries = new ArrayList<>(incomplete);
            entries.add(invalid);
            stubHistory(fixture, 1L, entries);
            HistoryForecastDTO result = fixture.service.getHistoryForecast(7L, "daily");
            assertEquals("insufficient_history", result.getStatus());
            assertEquals(59, result.getRecentHistoryDays());
        }
        verify(fixture.forecaster, never()).forecastNextNDays(anyLong(), anyInt());
    }

    private List<EnergyUsageLog> history(int days, int age) {
        List<EnergyUsageLog> entries = new ArrayList<>();
        for (int index = 1; index <= days; index++) {
            EnergyUsageLog entry = new EnergyUsageLog();
            entry.setDate(LocalDate.now(CLOCK).minusDays(age + index));
            entry.setKWhUsed(2.0);
            entries.add(entry);
        }
        return entries;
    }

    private void stubHistory(Fixture fixture, Long applianceId, List<EnergyUsageLog> entries) {
        when(fixture.logRepo.findByApplianceIdAndDateBetween(applianceId,
            LocalDate.now(CLOCK).minusDays(90), LocalDate.now(CLOCK).minusDays(1))).thenReturn(entries);
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
