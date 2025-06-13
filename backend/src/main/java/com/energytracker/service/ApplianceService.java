package com.energytracker.service;

import com.energytracker.model.Appliance;
import com.energytracker.model.User;
import com.energytracker.repository.ApplianceRepository;
import com.energytracker.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
public class ApplianceService {
    private final ApplianceRepository applianceRepo;
    private final UserRepository userRepo;

    public ApplianceService(ApplianceRepository applianceRepo, UserRepository userRepo) {
        this.applianceRepo = applianceRepo;
        this.userRepo = userRepo;
    }

    /** Create a new Appliance for a given userId. */
    @Transactional
    public Appliance createAppliance(Long userId, Appliance payload) {
        Optional<User> optUser = userRepo.findById(userId);
        if (optUser.isEmpty()) {
            throw new IllegalArgumentException("User not found: id=" + userId);
        }
        payload.setUser(optUser.get());
        return applianceRepo.save(payload);
    }

    /** Update an existing Appliance (must belong to that user). */
    @Transactional
    public Appliance updateAppliance(Long userId, Long applianceId, Appliance updated) {
        Appliance existing = applianceRepo.findById(applianceId)
            .orElseThrow(() -> new IllegalArgumentException("Appliance not found: id=" + applianceId));
        if (!existing.getUser().getId().equals(userId)) {
            throw new IllegalArgumentException("Not authorized to update this appliance.");
        }
        // Copy fields:
        existing.setName(updated.getName());
        existing.setWattage(updated.getWattage());
        existing.setHoursPerDay(updated.getHoursPerDay());
        existing.setDaysPerWeek(updated.getDaysPerWeek());
        existing.setBrand(updated.getBrand());
        existing.setModel(updated.getModel());
        existing.setType(updated.getType());
        existing.setLocation(updated.getLocation());
        existing.setHighEfficiency(updated.isHighEfficiency());
        return applianceRepo.save(existing);
    }

    /** Delete an appliance (only if it belongs to that user). */
    @Transactional
    public void deleteAppliance(Long userId, Long applianceId) {
        Appliance existing = applianceRepo.findById(applianceId)
            .orElseThrow(() -> new IllegalArgumentException("Appliance not found: id=" + applianceId));
        if (!existing.getUser().getId().equals(userId)) {
            throw new IllegalArgumentException("Not authorized to delete this appliance.");
        }
        applianceRepo.delete(existing);
    }

    /** Return all appliances belonging to userId. */
    @Transactional(readOnly = true)
    public List<Appliance> listUserAppliances(Long userId) {
        return applianceRepo.findByUserId(userId);
    }
}
