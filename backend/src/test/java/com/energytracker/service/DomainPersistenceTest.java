package com.energytracker.service;

import com.energytracker.model.Appliance;
import com.energytracker.model.User;
import com.energytracker.model.UserSettings;
import com.energytracker.repository.ApplianceRepository;
import com.energytracker.repository.UserRepository;
import com.energytracker.repository.UserSettingsRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

@DataJpaTest(properties = {
    "spring.datasource.url=jdbc:h2:mem:energyiq-persistence;MODE=PostgreSQL",
    "spring.jpa.hibernate.ddl-auto=create-drop"
})
class DomainPersistenceTest {
    @Autowired private UserRepository userRepository;
    @Autowired private ApplianceRepository applianceRepository;
    @Autowired private UserSettingsRepository settingsRepository;

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
