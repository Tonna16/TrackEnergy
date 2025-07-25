package com.energytracker.controller;

import com.energytracker.model.Appliance;
import com.energytracker.model.User;
import com.energytracker.service.ApplianceService;
import com.energytracker.service.UserService;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/appliances")
@CrossOrigin(origins = "http://localhost:5173")
public class ApplianceController {

    private final ApplianceService applianceService;
    private final UserService userService;

    public ApplianceController(ApplianceService applianceService, UserService userService) {
        this.applianceService = applianceService;
        this.userService = userService;
    }

    private Long getUserIdFromPrincipal() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (!(principal instanceof String email)) {
            throw new RuntimeException("User not authenticated");
        }
        User user = userService.getUserByEmail(email);
        if (user == null) {
            throw new RuntimeException("User not found");
        }
        return user.getId();
    }

    /** GET /api/appliances - get all appliances for authenticated user */
    @GetMapping
    public ResponseEntity<List<Appliance>> list() {
        Long userId = getUserIdFromPrincipal();
        List<Appliance> appliances = applianceService.listUserAppliances(userId);
        return ResponseEntity.ok(appliances);
    }

    /** POST /api/appliances - create new appliance for authenticated user */
    @PostMapping
    public ResponseEntity<Appliance> create(@RequestBody Appliance payload) {
        Long userId = getUserIdFromPrincipal();
        Appliance created = applianceService.createAppliance(userId, payload);
        return ResponseEntity.ok(created);
    }

    /** PUT /api/appliances/{applianceId} - update appliance for authenticated user */
    @PutMapping("/{applianceId}")
    public ResponseEntity<Appliance> update(
            @PathVariable Long applianceId,
            @RequestBody Appliance payload
    ) {
        Long userId = getUserIdFromPrincipal();
        Appliance updated = applianceService.updateAppliance(userId, applianceId, payload);
        return ResponseEntity.ok(updated);
    }

    /** DELETE /api/appliances/{applianceId} - delete appliance for authenticated user */
    @DeleteMapping("/{applianceId}")
    public ResponseEntity<Void> delete(@PathVariable Long applianceId) {
        Long userId = getUserIdFromPrincipal();
        applianceService.deleteAppliance(userId, applianceId);
        return ResponseEntity.ok().build();
    }
}
