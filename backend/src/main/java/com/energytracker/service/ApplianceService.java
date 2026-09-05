package com.energytracker.service;

import com.energytracker.model.Appliance;
import com.energytracker.model.User;
import com.energytracker.repository.ApplianceRepository;
import com.energytracker.repository.EnergyUsageLogRepository;
import com.energytracker.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class ApplianceService {
    private static final Logger logger = LoggerFactory.getLogger(ApplianceService.class);

    private final ApplianceRepository applianceRepo;
    private final EnergyUsageLogRepository logRepo;
    private final UserRepository userRepo;

    private static final double MAX_WATTAGE = 10000;
    private static final double MAX_HOURS_PER_DAY = 24;
    private static final int MAX_DAYS_PER_WEEK = 7;

    public ApplianceService(
        ApplianceRepository applianceRepo,
        EnergyUsageLogRepository logRepo,
        UserRepository userRepo
    ) {
        this.applianceRepo = applianceRepo;
        this.logRepo       = logRepo;
        this.userRepo      = userRepo;
    }
    @Transactional
    public Appliance createAppliance(Long userId, Appliance payload) {
        logger.info("Creating appliance for userId={}, applianceName={}", userId, payload.getName());
    
        if (userId != null) {
            User user = userRepo.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: id=" + userId));
            payload.setUser(user);
        } else {
            payload.setUser(null);
        }
    
        Appliance saved = applianceRepo.save(payload);
        logger.info("Appliance saved with id={}, name={}, userId={}", saved.getId(), saved.getName(), 
            saved.getUser() != null ? saved.getUser().getId() : null);
        return saved;
    }
    @Scheduled(cron = "0 0 3 * * *") // Runs daily at 3:00 AM
    @Transactional
    public void cleanUpSoftDeletedAppliances() {
        LocalDateTime threshold = LocalDateTime.now().minusDays(7);
        List<Appliance> toDelete = applianceRepo.findAllByDeletedTrueAndUpdatedAtBefore(threshold);
    
        if (!toDelete.isEmpty()) {
            applianceRepo.deleteAllInBatch(toDelete);
            logger.info("🧹 Deleted {} soft-deleted appliances (inactive for over 7 days)", toDelete.size());
        }
    }
    


    @Transactional
    public Appliance updateAppliance(Long userId, Long applianceId, Appliance updated) {
        logger.info("Updating appliance id={} for userId={}", applianceId, userId);

        Appliance existing = applianceRepo.findById(applianceId)
            .orElseThrow(() -> new IllegalArgumentException("Appliance not found: id=" + applianceId));

        if (userId != null) {
            if (existing.getUser() == null || !existing.getUser().getId().equals(userId)) {
                throw new IllegalArgumentException("Not authorized to update this appliance.");
            }
        } else if (existing.getUser() != null) {
            throw new IllegalArgumentException("Not authorized to update this appliance.");
        }

        existing.setName(updated.getName());
        existing.setWattage((double) updated.getWattage());
        existing.setHoursPerDay(updated.getHoursPerDay());
        existing.setDaysPerWeek(updated.getDaysPerWeek());
        existing.setBrand(updated.getBrand());
        existing.setModel(updated.getModel());
        existing.setType(updated.getType());
        existing.setLocation(updated.getLocation());
        existing.setHighEfficiency(updated.isHighEfficiency());
        existing.setEstimatedDailyKWh(updated.getEstimatedDailyKWh());
        existing.setActive(updated.isActive());

        return applianceRepo.save(existing);
    }

    @Transactional
    public void softDeleteAppliance(Long userId, Long applianceId) {
        logger.info("Soft deleting appliance id={} for userId={}", applianceId, userId);
        Appliance existing = applianceRepo.findById(applianceId)
            .orElseThrow(() -> new IllegalArgumentException("Appliance not found: id=" + applianceId));
    
        if (userId != null) {
            if (existing.getUser() == null || !existing.getUser().getId().equals(userId)) {
                throw new IllegalArgumentException("Not authorized to delete this appliance.");
            }
        } else if (existing.getUser() != null) {
            throw new IllegalArgumentException("Not authorized to delete this appliance.");
        }
    
        existing.setActive(false);
        existing.setDeleted(true);
        existing.setUpdatedAt(java.time.LocalDateTime.now());
        applianceRepo.save(existing);
    
        // Optionally delete historical logs tied to this appliance so it no longer shows up anywhere:
        try {
            logRepo.deleteByApplianceId(applianceId);
            logger.info("Deleted usage logs for appliance id={}", applianceId);
        } catch (Exception ex) {
            logger.warn("Failed to delete usage logs for appliance id={} : {}", applianceId, ex.getMessage());
        }
    
        logger.info("Appliance id={} marked inactive & deleted", applianceId);
    }
    
    
    

    @Transactional(readOnly = true)
    public List<Appliance> listUserAppliances(Long userId) {
        if (userId == null) {
            logger.warn("Rejected appliance listing without an authenticated user");
            return List.of();
        }

        logger.info("Listing non-deleted appliances for userId={}", userId);
        return applianceRepo.findAllByUserIdAndDeletedFalse(userId);
    }

    @Transactional
    public Appliance setApplianceActive(Long userId, Long applianceId, boolean active) {
        logger.info("Setting active state for appliance id={} userId={} active={}", applianceId, userId, active);
        Appliance existing = applianceRepo.findById(applianceId)
            .orElseThrow(() -> new IllegalArgumentException("Appliance not found: id=" + applianceId));

        if (userId != null) {
            if (existing.getUser() == null || !existing.getUser().getId().equals(userId)) {
                throw new IllegalArgumentException("Not authorized to update this appliance.");
            }
        } else if (existing.getUser() != null) {
            throw new IllegalArgumentException("Not authorized to update this appliance.");
        }

        existing.setActive(active);
        if (active) {
            existing.setDeleted(false);
        }
        existing.setUpdatedAt(LocalDateTime.now());
        return applianceRepo.save(existing);
    }


}
