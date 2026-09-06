package com.energytracker.service;

import com.energytracker.model.Appliance;
import com.energytracker.model.EnergyUsageLog;
import com.energytracker.model.User;
import com.energytracker.model.UserSettings;
import com.energytracker.repository.ApplianceRepository;
import com.energytracker.repository.EnergyUsageLogRepository;
import com.energytracker.repository.UserRepository;
import com.energytracker.repository.UserSettingsRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import com.util.TimeSeriesForecaster;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;

@DataJpaTest(properties = {
    "spring.datasource.url=jdbc:h2:mem:energyiq-persistence;MODE=PostgreSQL",
    "spring.jpa.hibernate.ddl-auto=create-drop"
})
class DomainPersistenceTest {
    @Autowired private UserRepository userRepository;
    @Autowired private ApplianceRepository applianceRepository;
    @Autowired private UserSettingsRepository settingsRepository;
    @Autowired private EnergyUsageLogRepository logRepository;

    @Test
    void persistedOldHistoryCannotQualifyButSixtyRecentZeroObservationsCan() {
        Clock clock = Clock.fixed(Instant.parse("2024-01-15T12:00:00Z"), ZoneOffset.UTC);
        LocalDate today = LocalDate.now(clock);
        User owner = new User();
        owner.setEmail("history@example.com");
        owner.setPassword("unused");
        owner = userRepository.saveAndFlush(owner);
        Appliance appliance = new Appliance();
        appliance.setName("Recorded load");
        appliance.setUser(owner);
        appliance.setWattage(1000);
        appliance.setHoursPerDay(1);
        appliance.setDaysPerWeek(7);
        appliance.setActive(true);
        appliance.setDeleted(false);
        appliance = applianceRepository.saveAndFlush(appliance);
        var entries = new ArrayList<EnergyUsageLog>();
        for (int index = 1; index <= 60; index++) {
            EnergyUsageLog entry = new EnergyUsageLog();
            entry.setAppliance(appliance);
            entry.setDate(today.minusDays(400 + index));
            entry.setKWhUsed(2.0);
            entries.add(entry);
        }
        logRepository.saveAllAndFlush(entries);
        EnergyCalculationService calculations = new EnergyCalculationService(new EnergyDomainConfig());
        EnergyUsageService service = new EnergyUsageService(logRepository, applianceRepository,
            mock(UserSettingsService.class), new TimeSeriesForecaster(logRepository, applianceRepository, calculations, clock),
            mock(UserService.class), mock(NotificationService.class), calculations, clock);
        var oldForecast = service.getHistoryForecast(owner.getId(), "daily");
        assertEquals("insufficient_history", oldForecast.getStatus());
        assertEquals(0, oldForecast.getHistoryDays());
        assertTrue(oldForecast.getProjections().isEmpty());

        entries.clear();
        for (int index = 1; index <= 60; index++) {
            EnergyUsageLog entry = new EnergyUsageLog();
            entry.setAppliance(appliance);
            entry.setDate(today.minusDays(index));
            entry.setKWhUsed(0.0);
            entries.add(entry);
        }
        logRepository.saveAllAndFlush(entries);
        var zeroForecast = service.getHistoryForecast(owner.getId(), "daily");
        assertEquals("available", zeroForecast.getStatus());
        assertEquals(60, zeroForecast.getHistoryDays());
        assertEquals(30, zeroForecast.getProjections().size());
        assertTrue(zeroForecast.getProjections().stream().allMatch(point -> point.getTotalKwh() == 0.0));
    }

    @Test
    void persistsManualOverrideInactiveStateAndCurrency() {
        User owner = new User();
        owner.setEmail("persistence@example.com");
        owner.setPassword("not-used-in-this-repository-test");
        owner = userRepository.saveAndFlush(owner);

        Appliance appliance = new Appliance();
        appliance.setName("Inactive override appliance");
        appliance.setWattage(1500);
        appliance.setHoursPerDay(8);
        appliance.setDaysPerWeek(7);
        appliance.setEstimatedDailyKWh(0.0);
        appliance.setActive(false);
        appliance.setDeleted(false);
        appliance.setUser(owner);
        applianceRepository.saveAndFlush(appliance);

        Appliance loaded = applianceRepository.findAllByUserIdAndDeletedFalse(owner.getId()).getFirst();
        assertEquals(0.0, loaded.getEstimatedDailyKWh());
        assertFalse(loaded.isActive());

        UserSettings settings = new UserSettings();
        settings.setUserId(owner.getId());
        settings.setElectricityRatePerKWh(0.23);
        settings.setCurrency("EUR");
        settingsRepository.saveAndFlush(settings);

        UserSettings loadedSettings = settingsRepository.findByUserId(owner.getId()).orElseThrow();
        assertEquals(0.23, loadedSettings.getElectricityRatePerKWh());
        assertEquals("EUR", loadedSettings.getCurrency());
    }
}
