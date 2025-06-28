package com.energytracker.controller;

import com.energytracker.dto.EnergyUsageDTO;
import com.energytracker.dto.UsageProjectionDTO;
import com.energytracker.dto.UsageSummaryDTO;
import com.energytracker.model.EnergyUsageLog;
import com.energytracker.service.EnergyUsageService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.*;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.*;

@RestController
@RequestMapping("/api/energy-usage")
@CrossOrigin(origins = "http://localhost:5173") // ✅ Update for production
public class EnergyUsageController {

    private final EnergyUsageService usageService;

    public EnergyUsageController(EnergyUsageService usageService) {
        this.usageService = usageService;
    }

    private Long getAuthenticatedUserId() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (principal == null) throw new RuntimeException("No authenticated user found");

        try {
            Long userId = Long.parseLong(principal.toString());
            System.out.println("[EnergyUsageController] Authenticated userId = " + userId);
            return userId;
        } catch (Exception e) {
            System.err.println("[EnergyUsageController] Invalid principal: " + principal);
            throw new RuntimeException("Invalid authentication principal");
        }
    }

    private ResponseEntity<String> unauthorized() {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
            .body("Unauthorized: Invalid session or token.");
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
            return unauthorized();
        }
    }

    @GetMapping("/projections")
    public ResponseEntity<?> getProjections(@RequestParam(defaultValue = "daily") String timeRange) {
        try {
            Long userId = getAuthenticatedUserId();
            String range = timeRange.toLowerCase(Locale.ROOT);

            if (!List.of("daily", "weekly", "monthly").contains(range)) {
                return ResponseEntity.badRequest()
                    .body("Invalid timeRange. Allowed: daily, weekly, monthly.");
            }

            List<UsageProjectionDTO> projections = usageService.getProjections(userId, range);
            return ResponseEntity.ok(projections);
        } catch (RuntimeException e) {
            return unauthorized();
        }
    }

    @GetMapping("/summary")
    public ResponseEntity<?> getUsageSummary(@RequestParam(required = false) Integer days) {
        try {
            Long userId = getAuthenticatedUserId();
            UsageSummaryDTO summary = (days != null && days > 0)
                ? usageService.getUsageSummaryForRange(userId, days)
                : usageService.getUsageSummary(userId);
            return ResponseEntity.ok(summary);
        } catch (RuntimeException e) {
            return unauthorized();
        }
    }

    @GetMapping("/annual-cost")
    public ResponseEntity<?> getAnnualCostForecast() {
        try {
            Long userId = getAuthenticatedUserId();
            double forecast = usageService.getAnnualCostForecast(userId);
            return ResponseEntity.ok(Map.of("annualCost", forecast));
        } catch (RuntimeException e) {
            return unauthorized();
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
            return ResponseEntity.badRequest().body("Invalid input: " + ex.getMessage());
        } catch (RuntimeException e) {
            return unauthorized();
        }
    }

    @GetMapping("/daily-usage")
    public ResponseEntity<?> getDailyUsageFor(@RequestParam String day) {
        try {
            Long userId = getAuthenticatedUserId();
            LocalDate date;

            if ("today".equalsIgnoreCase(day)) {
                date = LocalDate.now();
            } else if ("yesterday".equalsIgnoreCase(day)) {
                date = LocalDate.now().minusDays(1);
            } else {
                return ResponseEntity.badRequest().body("Invalid day. Use 'today' or 'yesterday'.");
            }

            double totalKwh = usageService.getTotalKwhForDate(userId, date);
            return ResponseEntity.ok(Map.of("totalKwh", totalKwh));
        } catch (RuntimeException e) {
            return unauthorized();
        }
    }
}
