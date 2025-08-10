package com.energytracker.controller;

import com.energytracker.model.Appliance;
import com.energytracker.model.User;
import com.energytracker.service.ApplianceService;
import com.energytracker.service.UserService;

import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;
import jakarta.validation.Validator;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import com.energytracker.repository.UserRepository;
import com.energytracker.repository.ApplianceRepository;

import java.util.List;
import java.util.Set;

@RestController
@RequestMapping("/api/appliances")
@CrossOrigin(origins = "http://localhost:5173")
public class ApplianceController {
    private static final Logger logger = LoggerFactory.getLogger(ApplianceController.class);

    private final ApplianceService applianceService;
    private final UserService userService;
    private final UserRepository userRepo; 
    private final ApplianceRepository applianceRepo;
    private final Validator validator;

    public ApplianceController(
            ApplianceService applianceService, 
            UserService userService, 
            UserRepository userRepo, 
            ApplianceRepository applianceRepo, Validator validator) {
        this.validator = validator;
        this.userRepo = userRepo;
        this.applianceRepo = applianceRepo;
        this.applianceService = applianceService;
        this.userService = userService;
    }

    private User getAuthenticatedUserOrNull() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) {
            return null;
        }
        String email = switch (auth.getPrincipal()) {
            case String s -> s;
            case org.springframework.security.core.userdetails.UserDetails ud -> ud.getUsername();
            default -> null;
        };
        return (email != null) ? userService.getUserByEmail(email) : null;
    }

    @GetMapping
    public ResponseEntity<List<Appliance>> list() {
        User user = getAuthenticatedUserOrNull();
        Long userId = (user != null ? user.getId() : null);
        List<Appliance> apps = applianceService.listUserAppliances(userId);
        logger.debug("Appliance list for {}: {}", userId == null ? "guest" : userId, apps);
        return ResponseEntity.ok(apps);
    }

    @Transactional
    public Appliance createAppliance(Long userId, Appliance payload) {
        logger.info("Creating appliance for userId={}, applianceName={}", userId, payload.getName());
    
        Set<ConstraintViolation<Appliance>> violations = validator.validate(payload);
        if (!violations.isEmpty()) {
            violations.forEach(v -> logger.warn("Validation error on {}: {}", v.getPropertyPath(), v.getMessage()));
            throw new ConstraintViolationException(violations);
        }
    
        try {
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
    
        } catch (Throwable t) {
            // Log full cause chain to catch root
            Throwable root = t;
            while (root.getCause() != null && root != root.getCause()) {
                root = root.getCause();
            }
            logger.error("💥 Failed to create appliance root cause: ", root);
            throw t;  // rethrow so Spring can handle it or your advice catches it
        }
    }
    


    // New POST endpoint to create appliance
    @PostMapping
    public ResponseEntity<Appliance> create(@Valid @RequestBody Appliance appliance) {
        User user = getAuthenticatedUserOrNull();
        Appliance created = createAppliance(user != null ? user.getId() : null, appliance);
        return ResponseEntity.ok(created);
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(
        @PathVariable Long id,
        @Valid @RequestBody Appliance payload
    ) {
        User user = getAuthenticatedUserOrNull();
        try {
            Appliance updated = applianceService.updateAppliance(
                user != null ? user.getId() : null,
                id,
                payload
            );
            return ResponseEntity.ok(updated);
        } catch (IllegalArgumentException e) {
            logger.warn("Update appliance failed: {}", e.getMessage());
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        User user = getAuthenticatedUserOrNull();
        try {
            applianceService.softDeleteAppliance(
                user != null ? user.getId() : null,
                id
            );
            return ResponseEntity.ok().build();
        } catch (IllegalArgumentException e) {
            logger.warn("Delete appliance failed: {}", e.getMessage());
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}
