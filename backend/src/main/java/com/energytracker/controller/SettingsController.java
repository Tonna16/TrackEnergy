package com.energytracker.controller;

import com.energytracker.model.User;
import com.energytracker.model.UserSettings;
import com.energytracker.service.UserService;
import com.energytracker.service.UserSettingsService;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.*;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/settings")
@CrossOrigin(origins = "http://localhost:5173")
public class SettingsController {
    private static final Logger logger = LoggerFactory.getLogger(SettingsController.class);

    private final UserSettingsService settingsService;
    private final UserService userService;

    public SettingsController(UserSettingsService settingsService,
                              UserService userService) {
        this.settingsService = settingsService;
        this.userService      = userService;
    }

    private Long getAuthenticatedUserIdOrNull() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) return null;

        Object principal = auth.getPrincipal();
        String email = null;
        if (principal instanceof String) {
            email = (String) principal;
        } else if (principal instanceof org.springframework.security.core.userdetails.UserDetails) {
            email = ((org.springframework.security.core.userdetails.UserDetails)principal).getUsername();
        }
        if (email == null || "anonymousUser".equals(email)) return null;

        User u = userService.getUserByEmail(email);
        return (u != null ? u.getId() : null);
    }

    /**
     * GET /api/settings
     * - If logged in, returns server settings + householdSize
     * - If guest, returns an object with default rate and default householdSize
     */
    @GetMapping
    public ResponseEntity<?> getSettings() {
        Long userId = getAuthenticatedUserIdOrNull();

        if (userId != null) {
            UserSettings s = settingsService.getOrCreateDefaultSettings(userId);
            User u = userService.getUserById(userId);

            Map<String,Object> resp = new HashMap<>();
            resp.put("electricityRatePerKWh", s.getElectricityRatePerKWh());
            resp.put("householdSize", u != null && u.getHouseholdSize() != null ? u.getHouseholdSize() : 2);
            // optional: include other server settings if you have them
            return ResponseEntity.ok(resp);
        } else {
            // Guest fallback
            Map<String,Object> resp = new HashMap<>();
            resp.put("electricityRatePerKWh", 0.15);
            resp.put("householdSize", 2);
            return ResponseEntity.ok(resp);
        }
    }

    /**
     * PUT /api/settings
     * Body example:
     *   { "electricityRatePerKWh": 0.17, "householdSize": 3 }
     *
     * Persists to UserSettings (rate) and to users.household_size (householdSize).
     */
    @PutMapping
    public ResponseEntity<?> updateSettings(@RequestBody Map<String, Object> incoming) {
        Long userId = getAuthenticatedUserIdOrNull();

        // read rate from either property name
        Double incomingRate = null;
        if (incoming.containsKey("electricityRatePerKWh")) {
            incomingRate = ((Number) incoming.get("electricityRatePerKWh")).doubleValue();
        } else if (incoming.containsKey("electricityRate")) {
            incomingRate = ((Number) incoming.get("electricityRate")).doubleValue();
        }

        Integer incomingHouseholdSize = null;
        if (incoming.containsKey("householdSize")) {
            Object val = incoming.get("householdSize");
            if (val instanceof Number) {
                incomingHouseholdSize = Integer.valueOf(((Number) val).intValue());
            }
        }
        

        if (incomingRate == null || incomingRate <= 0.0) {
            incomingRate = 0.15;
        }

        if (userId != null) {
            // persist rate to UserSettings
            UserSettings s = settingsService.getOrCreateDefaultSettings(userId);
            s.setElectricityRatePerKWh(incomingRate);
            UserSettings saved = settingsService.saveSettings(s);

            // persist household size to User record if present
            if (incomingHouseholdSize != null && incomingHouseholdSize >= 1) {
                userService.updateHouseholdSize(userId, incomingHouseholdSize);
            }

            Map<String,Object> resp = new HashMap<>();
            resp.put("electricityRatePerKWh", saved.getElectricityRatePerKWh());
            User u = userService.getUserById(userId);
            resp.put("householdSize", u != null && u.getHouseholdSize() != null ? u.getHouseholdSize() : 2);
            return ResponseEntity.ok(resp);
        } else {
            // guest - echo back so frontend can keep local copy
            Map<String,Object> resp = new HashMap<>();
            resp.put("electricityRatePerKWh", incomingRate);
            resp.put("householdSize", incomingHouseholdSize != null ? incomingHouseholdSize : 2);
            return ResponseEntity.ok(resp);
        }
    }
}
