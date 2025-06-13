package com.energytracker.controller;

import com.energytracker.model.Appliance;
import com.energytracker.service.ApplianceService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Endpoints under /api/appliances
 */
@RestController
@RequestMapping("/api/appliances")
public class ApplianceController {
    private final ApplianceService applianceService;

    public ApplianceController(ApplianceService applianceService) {
        this.applianceService = applianceService;
    }

    /**
     * GET /api/appliances?userId={userId}
     * Returns all appliances for that user.
     */
    @GetMapping
    public List<Appliance> list(@RequestParam Long userId) {
        return applianceService.listUserAppliances(userId);
    }

    /**
     * POST /api/appliances?userId={userId}
     * Body: { name, wattage, hoursPerDay, daysPerWeek, brand, model, type, location, isHighEfficiency }
     */
    @PostMapping
    public Appliance create(@RequestParam Long userId, @RequestBody Appliance payload) {
        return applianceService.createAppliance(userId, payload);
    }

    /**
     * PUT /api/appliances/{applianceId}?userId={userId}
     * Body: { name, wattage, hoursPerDay, daysPerWeek, brand, model, type, location, isHighEfficiency }
     */
    @PutMapping("/{applianceId}")
    public Appliance update(
            @RequestParam Long userId,
            @PathVariable Long applianceId,
            @RequestBody Appliance payload
    ) {
        return applianceService.updateAppliance(userId, applianceId, payload);
    }

    /**
     * DELETE /api/appliances/{applianceId}?userId={userId}
     */
    @DeleteMapping("/{applianceId}")
    public void delete(@RequestParam Long userId, @PathVariable Long applianceId) {
        applianceService.deleteAppliance(userId, applianceId);
    }
}
