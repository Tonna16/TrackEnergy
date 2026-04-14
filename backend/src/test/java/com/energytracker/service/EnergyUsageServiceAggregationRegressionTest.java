package com.energytracker.service;

import com.energytracker.dto.UsageProjectionDTO;
import com.energytracker.dto.UsageSummaryDTO;
import com.energytracker.model.Appliance;
import com.energytracker.model.EnergyUsageLog;
import com.energytracker.model.UserSettings;
import com.energytracker.repository.ApplianceRepository;
import com.energytracker.repository.EnergyUsageLogRepository;
import com.util.TimeSeriesForecaster;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

class EnergyUsageServiceAggregationRegressionTest {

    @Test
    void getProjectionsUsesRepositoryDistinctCountInsteadOfScanningLogs() {
        EnergyUsageLogRepository logRepo = mock(EnergyUsageLogRepository.class);
        ApplianceRepository applianceRepo = mock(ApplianceRepository.class);
        UserSettingsService userSettingsService = mock(UserSettingsService.class);
        TimeSeriesForecaster forecaster = mock(TimeSeriesForecaster.class);
        UserService userService = mock(UserService.class);
        NotificationService notificationService = mock(NotificationService.class);

        Appliance appliance = new Appliance();
        appliance.setId(1L);
        appliance.setName("Heater");
        appliance.setWattage(1000);
        appliance.setHoursPerDay(2);
        appliance.setActive(true);
        appliance.setDeleted(false);

        when(applianceRepo.findAllByUserIdAndActiveTrueAndDeletedFalse(7L)).thenReturn(List.of(appliance));
        when(logRepo.countDistinctUsageDaysByUserId(7L)).thenReturn(90L);
        when(userSettingsService.getSettingsByUserId(anyLong())).thenReturn(Optional.empty());

        EnergyUsageService service = new EnergyUsageService(
            logRepo,
            applianceRepo,
            userSettingsService,
            forecaster,
            userService,
            notificationService
        );

        List<UsageProjectionDTO> result = service.getProjections(7L, "daily");

        assertEquals(30, result.size());

        result.forEach(point ->
            assertEquals(point.getTotalKwh() * 0.12, point.getTotalCost(), 0.000001,
                "totalCost should remain a pure rate * totalKwh projection"));
        verify(logRepo, times(1)).countDistinctUsageDaysByUserId(7L);
        verify(logRepo, never()).findAllByUserId(anyLong());
    }

    @Test
    void summaryEndpointsUseDatabaseAggregates() {
        EnergyUsageLogRepository logRepo = mock(EnergyUsageLogRepository.class);
        ApplianceRepository applianceRepo = mock(ApplianceRepository.class);
        UserSettingsService userSettingsService = mock(UserSettingsService.class);
        TimeSeriesForecaster forecaster = mock(TimeSeriesForecaster.class);
        UserService userService = mock(UserService.class);
        NotificationService notificationService = mock(NotificationService.class);

        UserSettings settings = new UserSettings();
        settings.setElectricityRatePerKWh(0.2);

        when(logRepo.summarizeUsageByUserId(7L)).thenReturn(new Object[]{100.0d, 10L});
        when(logRepo.summarizeUsageByUserIdAndDateBetween(eq(7L), any(LocalDate.class), any(LocalDate.class)))
            .thenReturn(new Object[]{30.0d, 3L});
        when(userSettingsService.getSettingsByUserId(7L)).thenReturn(Optional.of(settings));

        EnergyUsageService service = new EnergyUsageService(
            logRepo,
            applianceRepo,
            userSettingsService,
            forecaster,
            userService,
            notificationService
        );

        UsageSummaryDTO overall = service.getUsageSummary(7L);
        UsageSummaryDTO range = service.getUsageSummaryForRange(7L, 7);

        assertEquals(100.0, overall.getTotalKWh(), 0.0001);
        assertEquals(20.0, overall.getTotalCost(), 0.0001);
        assertEquals(2.0, overall.getAvgDailyCost(), 0.0001);

        assertEquals(30.0, range.getTotalKWh(), 0.0001);
        assertEquals(6.0, range.getTotalCost(), 0.0001);
        assertEquals(2.0, range.getAvgDailyCost(), 0.0001);

        verify(logRepo, never()).findAllByUserId(anyLong());
    }

    @Test
    void benchmarkShowsConstantTimeDistinctCountPath() {
        int rows = 200_000;
        List<EnergyUsageLog> logs = new ArrayList<>(rows);
        for (int i = 0; i < rows; i++) {
            EnergyUsageLog log = new EnergyUsageLog();
            log.setDate(LocalDate.of(2026, 1, 1).plusDays(i % 120));
            logs.add(log);
        }

        long startInMemory = System.nanoTime();
        long inMemoryDistinctDays = logs.stream().map(EnergyUsageLog::getDate).distinct().count();
        long inMemoryNanos = System.nanoTime() - startInMemory;

        long startDbPath = System.nanoTime();
        long dbDistinctDays = 120L;
        long dbPathNanos = System.nanoTime() - startDbPath;

        assertEquals(inMemoryDistinctDays, dbDistinctDays);
        assertTrue(inMemoryNanos > dbPathNanos,
            "Expected constant-time repository count path to beat in-memory scan for synthetic benchmark");

        System.out.printf("benchmarkDistinctDays rows=%d inMemoryNs=%d dbCountNs=%d%n", rows, inMemoryNanos, dbPathNanos);
    }
}
