package com.energytracker.service;

import com.energytracker.dto.UsageProjectionDTO;
import com.energytracker.model.Appliance;
import com.energytracker.repository.ApplianceRepository;
import com.energytracker.repository.EnergyUsageLogRepository;
import com.util.TimeSeriesForecaster;
import org.junit.jupiter.api.Test;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class EnergyUsageServiceWeeklyProjectionTest {

    @Test
    void weeklyProjectionsExposeAlignedWeekStartAndWeekEnd() {
        EnergyUsageLogRepository logRepo = mock(EnergyUsageLogRepository.class);
        ApplianceRepository applianceRepo = mock(ApplianceRepository.class);
        UserSettingsService userSettingsService = mock(UserSettingsService.class);
        TimeSeriesForecaster forecaster = mock(TimeSeriesForecaster.class);
        UserService userService = mock(UserService.class);
        NotificationService notificationService = mock(NotificationService.class);

        Appliance appliance = new Appliance();
        appliance.setId(1L);
        appliance.setName("Heater");
        appliance.setWattage(1500);
        appliance.setHoursPerDay(2);
        appliance.setActive(true);
        appliance.setDeleted(false);

        when(applianceRepo.findAllByUserIdAndActiveTrueAndDeletedFalse(anyLong())).thenReturn(List.of(appliance));
        when(userSettingsService.getSettingsByUserId(anyLong())).thenReturn(Optional.empty());
        when(logRepo.findAllByUserId(anyLong())).thenReturn(List.of());

        EnergyUsageService service = new EnergyUsageService(
            logRepo,
            applianceRepo,
            userSettingsService,
            forecaster,
            userService,
            notificationService
        );

        List<UsageProjectionDTO> projections = service.getProjections(99L, "weekly");

        LocalDate expectedWeekStart = LocalDate.now()
            .with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))
            .plusWeeks(1);
        LocalDate expectedWeekEnd = expectedWeekStart.plusDays(6);

        assertEquals(expectedWeekStart.toString(), projections.get(0).getWeekStart());
        assertEquals(expectedWeekEnd.toString(), projections.get(0).getWeekEnd());
        assertEquals(expectedWeekStart.toString(), projections.get(0).getDate());
    }
}
