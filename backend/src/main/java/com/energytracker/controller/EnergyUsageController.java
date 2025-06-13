package com.energytracker.controller;

import com.energytracker.dto.EnergyUsageDTO;
import com.energytracker.dto.UsageProjectionDTO;
import com.energytracker.dto.UsageSummaryDTO;
import com.energytracker.model.EnergyUsageLog;
import com.energytracker.service.EnergyUsageService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/energy-usage")
@CrossOrigin(origins = "http://localhost:5173")
public class EnergyUsageController {

    private final EnergyUsageService usageService;

    public EnergyUsageController(EnergyUsageService usageService) {
        this.usageService = usageService;
    }

    private Long getAuthenticatedUserId() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (principal instanceof Long userId) {
            return userId;
        } else {
            throw new RuntimeException("Invalid authentication principal");
        }
    }

    @GetMapping
    public ResponseEntity<?> getUsageData(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate
    ) {
        try {
            Long userId = getAuthenticatedUserId();
            List<EnergyUsageDTO> data = usageService.getUsageDataByUser(userId, startDate, endDate);
            return ResponseEntity.ok(data);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Unauthorized access");
        }
    }

    @GetMapping("/projections")
    public ResponseEntity<?> getProjections(@RequestParam String timeRange) {
        try {
            Long userId = getAuthenticatedUserId();
            List<UsageProjectionDTO> projections = usageService.getProjections(userId, timeRange);
            return ResponseEntity.ok(projections);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Unauthorized access");
        }
    }

    @GetMapping("/summary")
    public ResponseEntity<?> getUsageSummary() {
        try {
            Long userId = getAuthenticatedUserId();
            UsageSummaryDTO summary = usageService.getUsageSummary(userId);
            return ResponseEntity.ok(summary);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Unauthorized access");
        }
    }

    @PostMapping
    public ResponseEntity<?> logUsage(
            @RequestParam Long applianceId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam double kWhUsed
    ) {
        try {
            EnergyUsageLog saved = usageService.logUsage(applianceId, date, kWhUsed);
            return ResponseEntity.ok(saved);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(ex.getMessage());
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Unauthorized access");
        }
    }
}
