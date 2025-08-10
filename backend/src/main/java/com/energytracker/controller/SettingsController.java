package com.energytracker.controller;

import com.energytracker.model.UserSettings;
import com.energytracker.service.UserSettingsService;
import com.energytracker.model.User;
import com.energytracker.service.UserService;

import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.*;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

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

    /**
     * Utility: returns the current userId, or null if not logged in.
     */
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
     *   - If logged in, returns that user’s settings (creating defaults if needed).
     *   - If guest, returns a “default” settings object (rate = 0.15, blank location).
     */
    @GetMapping
    public ResponseEntity<UserSettings> getSettings() {
        Long userId = getAuthenticatedUserIdOrNull();

        UserSettings s;
        if (userId != null) {
            // Fetch or create real settings
            s = settingsService.getOrCreateDefaultSettings(userId);
        } else {
            // Guest fallback
            s = new UserSettings();
            s.setElectricityRatePerKWh(0.15);
        }

        return ResponseEntity.ok(s);
    }

    /**
     * PUT /api/settings
     *   - Body: JSON { "electricityRatePerKWh": 0.17, "location":"Berlin" }
     *   - If logged in, persists to DB.
     *   - If guest, just echoes back so front-end can store locally.
     */
   // in SettingsController
@PutMapping
public ResponseEntity<UserSettings> updateSettings(@RequestBody Map<String, Object> incoming) {
    Long userId = getAuthenticatedUserIdOrNull();

    // read rate from either property name
    Double incomingRate = null;
    if (incoming.containsKey("electricityRatePerKWh")) {
        incomingRate = ((Number) incoming.get("electricityRatePerKWh")).doubleValue();
    } else if (incoming.containsKey("electricityRate")) {
        incomingRate = ((Number) incoming.get("electricityRate")).doubleValue();
    }


    if (incomingRate == null || incomingRate <= 0.0) {
        // defend against bad client values -> set default
        incomingRate = 0.15;
    }

    if (userId != null) {
        UserSettings s = settingsService.getOrCreateDefaultSettings(userId);
        s.setElectricityRatePerKWh(incomingRate);
        UserSettings saved = settingsService.saveSettings(s);
        return ResponseEntity.ok(saved);
    } else {
        UserSettings guest = new UserSettings();
        guest.setElectricityRatePerKWh(incomingRate);
        return ResponseEntity.ok(guest);
    }
}

}
