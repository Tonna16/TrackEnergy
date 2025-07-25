package com.energytracker.controller;

import com.energytracker.dto.EnergyUsageDTO;
import com.energytracker.dto.UsageProjectionDTO;
import com.energytracker.dto.UsageSummaryDTO;
import com.energytracker.model.EnergyUsageLog;
import com.energytracker.model.User;
import com.energytracker.service.EnergyUsageService;
import com.energytracker.service.UserService;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.*;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.*;

@RestController
@RequestMapping("/api/energy-usage")
@CrossOrigin(origins = "http://localhost:5173")
public class EnergyUsageController {

    private final EnergyUsageService usageService;
    private final UserService userService;

    public EnergyUsageController(EnergyUsageService usageService,
                                 UserService userService) {
        this.usageService = usageService;
        this.userService = userService;
    }

    private Long getAuthenticatedUserId() {
        Object principal = SecurityContextHolder.getContext()
                                                .getAuthentication()
                                                .getPrincipal();
        if (!(principal instanceof String email)) {
            System.err.println("[EnergyUsageController] Invalid principal type: "
                               + principal);
            throw new RuntimeException("Invalid authentication principal");
        }
        System.out.println("[EnergyUsageController] Authenticated email = " + email);
        User user = userService.getUserByEmail(email);
        return user.getId();
    }

    private ResponseEntity<String> unauthorized() {
        return ResponseEntity
                .status(HttpStatus.UNAUTHORIZED)
                .body("Unauthorized: Invalid session or token.");
    }

    @GetMapping
    public ResponseEntity<?> getUsageData(
        @RequestParam(required = false)
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
        @RequestParam(required = false)
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate
    ) {
        try {
            Long userId = getAuthenticatedUserId();
            List<EnergyUsageDTO> data =
                usageService.getUsageDataByUser(userId, startDate, endDate);
            return ResponseEntity.ok(data);
        } catch (RuntimeException e) {
            return unauthorized();
        }
    }

    @GetMapping("/projections")
    public ResponseEntity<?> getProjections(
        @RequestParam(defaultValue = "daily") String timeRange
    ) {
        try {
            Long userId = getAuthenticatedUserId();
            String range = timeRange.toLowerCase(Locale.ROOT);
            if (!List.of("daily", "weekly", "monthly").contains(range)) {
                return ResponseEntity
                        .badRequest()
                        .body("Invalid timeRange. Allowed: daily, weekly, monthly.");
            }

            List<UsageProjectionDTO> projections =
                usageService.getProjections(userId, range);

            return ResponseEntity.ok(projections);
        } catch (RuntimeException e) {
            return unauthorized();
        }
    }

    @GetMapping("/summary")
    public ResponseEntity<?> getUsageSummary(
        @RequestParam(required = false) Integer days
    ) {
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
        Double forecast = usageService.getAnnualCostForecast(userId);
        if (forecast == null) {
            return ResponseEntity.ok(Map.of("annualCost", null, "message", "Insufficient data to forecast"));
        }
        return ResponseEntity.ok(Map.of("annualCost", forecast));
    } catch (RuntimeException e) {
        e.printStackTrace();
        return unauthorized();
    }
}


    @GetMapping("/forecasted-daily-cost")
    public ResponseEntity<?> getForecastedDailyCost() {
        try {
            Long userId = getAuthenticatedUserId();
            Double dailyCost = usageService.getForecastedDailyCost(userId);
            return ResponseEntity.ok(Map.of("forecastedDailyCost", dailyCost));
        } catch (RuntimeException e) {
            return unauthorized();
        }
    }

    @PostMapping
    public ResponseEntity<?> logUsage(
        @RequestParam Long applianceId,
        @RequestParam
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
        @RequestParam double kWhUsed
    ) {
        try {
            EnergyUsageLog saved =
                usageService.logUsage(applianceId, date, kWhUsed);
            return ResponseEntity.ok(saved);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity
                   .badRequest()
                   .body("Invalid input: " + ex.getMessage());
        } catch (RuntimeException e) {
            return unauthorized();
        }
    }

    @GetMapping("/daily-usage")
    public ResponseEntity<?> getDailyUsageFor(@RequestParam String day) {
        try {
            Long userId = getAuthenticatedUserId();
            LocalDate date = switch (day.toLowerCase()) {
                case "today"     -> LocalDate.now();
                case "yesterday" -> LocalDate.now().minusDays(1);
                default -> throw new IllegalArgumentException(
                    "Invalid day. Use 'today' or 'yesterday'.");
            };
            double totalKwh = usageService.getTotalKwhForDate(userId, date);
            return ResponseEntity.ok(Map.of("totalKwh", totalKwh));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(ex.getMessage());
        } catch (RuntimeException e) {
            return unauthorized();
        }
    }
}
