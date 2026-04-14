package com.energytracker.service;

import com.energytracker.model.User;
import com.energytracker.repository.ApplianceRepository;
import com.energytracker.repository.EnergyUsageLogRepository;
import com.util.SecurityUtils;
import com.util.TimeSeriesForecaster;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.LocalDate;
import java.util.NoSuchElementException;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.*;

class EnergyUsageServiceLogUsageOwnershipTest {

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void logUsageBlocksCrossUserApplianceIdWrites() {
        EnergyUsageLogRepository logRepo = mock(EnergyUsageLogRepository.class);
        ApplianceRepository applianceRepo = mock(ApplianceRepository.class);
        UserSettingsService userSettingsService = mock(UserSettingsService.class);
        TimeSeriesForecaster forecaster = mock(TimeSeriesForecaster.class);
        UserService userService = mock(UserService.class);
        NotificationService notificationService = mock(NotificationService.class);

        EnergyUsageService service = new EnergyUsageService(
            logRepo,
            applianceRepo,
            userSettingsService,
            forecaster,
            userService,
            notificationService
        );

        User authenticatedUser = new User();
        authenticatedUser.setId(10L);
        authenticatedUser.setEmail("owner@example.com");
        SecurityUtils.setUserService(userService);
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken("owner@example.com", "token")
        );
        when(userService.getUserByEmail("owner@example.com")).thenReturn(authenticatedUser);

        when(applianceRepo.existsByIdAndUserId(77L, 10L)).thenReturn(false);
        when(applianceRepo.existsById(77L)).thenReturn(true);

        assertThrows(
            AccessDeniedException.class,
            () -> service.logUsage(77L, LocalDate.of(2026, 4, 14), 5.0)
        );

        verify(logRepo, never()).save(any());
        verify(applianceRepo, never()).findByIdAndUserIdAndActiveTrueAndDeletedFalse(anyLong(), anyLong());
    }

    @Test
    void logUsageReturnsNotFoundWhenOwnedApplianceRecordCannotBeUsed() {
        EnergyUsageLogRepository logRepo = mock(EnergyUsageLogRepository.class);
        ApplianceRepository applianceRepo = mock(ApplianceRepository.class);
        UserSettingsService userSettingsService = mock(UserSettingsService.class);
        TimeSeriesForecaster forecaster = mock(TimeSeriesForecaster.class);
        UserService userService = mock(UserService.class);
        NotificationService notificationService = mock(NotificationService.class);

        EnergyUsageService service = new EnergyUsageService(
            logRepo,
            applianceRepo,
            userSettingsService,
            forecaster,
            userService,
            notificationService
        );

        User authenticatedUser = new User();
        authenticatedUser.setId(22L);
        authenticatedUser.setEmail("active@example.com");
        SecurityUtils.setUserService(userService);
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken("active@example.com", "token")
        );
        when(userService.getUserByEmail("active@example.com")).thenReturn(authenticatedUser);

        when(applianceRepo.existsByIdAndUserId(15L, 22L)).thenReturn(true);
        when(applianceRepo.findByIdAndUserIdAndActiveTrueAndDeletedFalse(15L, 22L)).thenReturn(Optional.empty());

        assertThrows(
            NoSuchElementException.class,
            () -> service.logUsage(15L, LocalDate.of(2026, 4, 14), 2.5)
        );

        verify(logRepo, never()).save(any());
    }
}
