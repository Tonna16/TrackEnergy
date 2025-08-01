package com.energytracker.service;

import com.energytracker.model.Appliance;
import com.energytracker.model.User;
import com.energytracker.repository.ApplianceRepository;
import com.energytracker.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.util.List;
import java.util.Optional;

@Service
public class ApplianceService {
    private static final Logger logger = LoggerFactory.getLogger(ApplianceService.class);
    private final ApplianceRepository applianceRepo;
    private final UserRepository userRepo;

    public ApplianceService(ApplianceRepository applianceRepo, UserRepository userRepo) {
        this.applianceRepo = applianceRepo;
        this.userRepo = userRepo;
    }

    @Transactional
    public Appliance createAppliance(Long userId, Appliance payload) {
        logger.info("Creating appliance for userId={}, applianceName={}", userId, payload.getName());
        if (userId != null) {
            User user = userRepo.findById(userId)
                .orElseThrow(() -> {
                    logger.error("User not found with id={}", userId);
                    return new IllegalArgumentException("User not found: id=" + userId);
                });
            payload.setUser(user);
        } else {
            logger.info("Creating guest appliance (no user)");
            payload.setUser(null);
        }
        Appliance saved = applianceRepo.save(payload);
        logger.info("Appliance created with id={}", saved.getId());
        return saved;
    }

    @Transactional
    public Appliance updateAppliance(Long userId, Long applianceId, Appliance updated) {
        logger.info("Updating appliance id={} for userId={}", applianceId, userId);
        Appliance existing = applianceRepo.findById(applianceId)
            .orElseThrow(() -> {
                logger.error("Appliance not found with id={}", applianceId);
                return new IllegalArgumentException("Appliance not found: id=" + applianceId);
            });

        if (userId != null) {
            if (existing.getUser() == null || !existing.getUser().getId().equals(userId)) {
                logger.warn("Unauthorized update attempt for appliance id={} by userId={}", applianceId, userId);
                throw new IllegalArgumentException("Not authorized to update this appliance.");
            }
        } else {
            if (existing.getUser() != null) {
                logger.warn("Unauthorized guest update attempt for appliance id={}", applianceId);
                throw new IllegalArgumentException("Not authorized to update this appliance.");
            }
        }

        // Copy fields
        existing.setName(updated.getName());
        existing.setWattage(updated.getWattage());
        existing.setHoursPerDay(updated.getHoursPerDay());
        existing.setDaysPerWeek(updated.getDaysPerWeek());
        existing.setBrand(updated.getBrand());
        existing.setModel(updated.getModel());
        existing.setType(updated.getType());
        existing.setLocation(updated.getLocation());
        existing.setHighEfficiency(updated.isHighEfficiency());

        Appliance saved = applianceRepo.save(existing);
        logger.info("Appliance id={} updated successfully", saved.getId());
        return saved;
    }

    @Transactional
    public void deleteAppliance(Long userId, Long applianceId) {
        logger.info("Deleting appliance id={} for userId={}", applianceId, userId);
        Appliance existing = applianceRepo.findById(applianceId)
            .orElseThrow(() -> {
                logger.error("Appliance not found with id={}", applianceId);
                return new IllegalArgumentException("Appliance not found: id=" + applianceId);
            });

        if (userId != null) {
            if (existing.getUser() == null || !existing.getUser().getId().equals(userId)) {
                logger.warn("Unauthorized delete attempt for appliance id={} by userId={}", applianceId, userId);
                throw new IllegalArgumentException("Not authorized to delete this appliance.");
            }
        } else {
            if (existing.getUser() != null) {
                logger.warn("Unauthorized guest delete attempt for appliance id={}", applianceId);
                throw new IllegalArgumentException("Not authorized to delete this appliance.");
            }
        }

        applianceRepo.delete(existing);
        logger.info("Appliance id={} deleted successfully", applianceId);
    }

    @Transactional(readOnly = true)
    public List<Appliance> listUserAppliances(Long userId) {
        logger.info("Listing appliances for userId={}", userId);
        if (userId != null) {
            var list = applianceRepo.findByUserId(userId);
            logger.info("Found {} appliances for userId={}", list.size(), userId);
            return list;
        } else {
            var list = applianceRepo.findByUserIsNull();
            logger.info("Found {} guest appliances", list.size());
            return list;
        }
    }
}