package com.energytracker.service;

import com.energytracker.model.Appliance;
import com.energytracker.model.User;
import com.energytracker.repository.ApplianceRepository;
import com.energytracker.repository.EnergyUsageLogRepository;
import com.energytracker.repository.UserRepository;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ApplianceServiceActiveStateTest {

    @Test
    void setApplianceActiveFalseDeactivatesWithoutMarkingDeleted() {
        ApplianceRepository applianceRepo = mock(ApplianceRepository.class);
        EnergyUsageLogRepository logRepo = mock(EnergyUsageLogRepository.class);
        UserRepository userRepo = mock(UserRepository.class);

        ApplianceService service = new ApplianceService(applianceRepo, logRepo, userRepo);

        User owner = new User();
        owner.setId(9L);

        Appliance appliance = new Appliance();
        appliance.setId(2L);
        appliance.setUser(owner);
        appliance.setActive(true);
        appliance.setDeleted(false);

        when(applianceRepo.findById(2L)).thenReturn(Optional.of(appliance));
        when(applianceRepo.save(any(Appliance.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Appliance updated = service.setApplianceActive(9L, 2L, false);

        assertFalse(updated.isActive());
        assertFalse(updated.isDeleted());
    }

    @Test
    void setApplianceActiveTrueRestoresFromDeletedState() {
        ApplianceRepository applianceRepo = mock(ApplianceRepository.class);
        EnergyUsageLogRepository logRepo = mock(EnergyUsageLogRepository.class);
        UserRepository userRepo = mock(UserRepository.class);

        ApplianceService service = new ApplianceService(applianceRepo, logRepo, userRepo);

        User owner = new User();
        owner.setId(9L);

        Appliance appliance = new Appliance();
        appliance.setId(3L);
        appliance.setUser(owner);
        appliance.setActive(false);
        appliance.setDeleted(true);

        when(applianceRepo.findById(3L)).thenReturn(Optional.of(appliance));
        when(applianceRepo.save(any(Appliance.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Appliance updated = service.setApplianceActive(9L, 3L, true);

        assertTrue(updated.isActive());
        assertFalse(updated.isDeleted());
    }

    @Test
    void updatePreservesManualZeroOverrideAndInactiveState() {
        ApplianceRepository applianceRepo = mock(ApplianceRepository.class);
        EnergyUsageLogRepository logRepo = mock(EnergyUsageLogRepository.class);
        UserRepository userRepo = mock(UserRepository.class);
        ApplianceService service = new ApplianceService(applianceRepo, logRepo, userRepo);

        User owner = new User();
        owner.setId(9L);
        Appliance existing = new Appliance();
        existing.setId(4L);
        existing.setUser(owner);
        existing.setName("Old");
        existing.setWattage(100);
        existing.setHoursPerDay(1);
        existing.setDaysPerWeek(7);
        existing.setActive(true);

        Appliance edit = new Appliance();
        edit.setName("Edited");
        edit.setWattage(250);
        edit.setHoursPerDay(2);
        edit.setDaysPerWeek(3);
        edit.setEstimatedDailyKWh(0.0);
        edit.setActive(false);

        when(applianceRepo.findById(4L)).thenReturn(Optional.of(existing));
        when(applianceRepo.save(any(Appliance.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Appliance saved = service.updateAppliance(9L, 4L, edit);
        assertEquals(0.0, saved.getEstimatedDailyKWh());
        assertFalse(saved.isActive());
        assertEquals(250.0, saved.getWattage());
        assertEquals(3, saved.getDaysPerWeek());
    }
}
