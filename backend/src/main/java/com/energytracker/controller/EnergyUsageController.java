package com.energytracker.controller;

import com.energytracker.dto.EnergyUsageDTO;
import com.energytracker.dto.UsageProjectionDTO;
import com.energytracker.dto.UsageSummaryDTO;
import com.energytracker.model.Appliance;
import com.energytracker.model.EnergyUsageLog;
import com.energytracker.model.User;
import com.energytracker.service.EnergyUsageService;
import com.energytracker.service.UserService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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
    private static final Logger logger = LoggerFactory.getLogger(EnergyUsageController.class);

    private final EnergyUsageService usageService;
    private final UserService userService;

    public EnergyUsageController(EnergyUsageService usageService,
                                 UserService userService) {
        this.usageService = usageService;
        this.userService = userService;
    }

    private User getAuthenticatedUser() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) {
            throw new RuntimeException("User not authenticated");
        }
        String email;
        Object principal = auth.getPrincipal();
        if (principal instanceof String) {
            email = (String) principal;
        } else {
            email = ((org.springframework.security.core.userdetails.UserDetails) principal).getUsername();
        }
        User user = userService.getUserByEmail(email);
        if (user == null) throw new RuntimeException("User not found");
        return user;
    }

    private ResponseEntity<String> unauthorized() {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                             .body("Unauthorized: Invalid session or token.");
    }

    // — Fetch raw usage
    @GetMapping
    public ResponseEntity<?> getUsageData(
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate
    ) {
        try {
            Long userId = getAuthenticatedUser().getId();
            logger.info("Fetching usage data for userId={} from {} to {}", userId, startDate, endDate);
            List<EnergyUsageDTO> data = usageService.getUsageDataByUser(userId, startDate, endDate);
            return ResponseEntity.ok(data);
        } catch (Exception e) {
            logger.warn("Unauthorized or error fetching usage data", e);
            return unauthorized();
        }
    }

    // — Projections
    private int getDaysPerRange(String range) {
        return switch (range.toLowerCase()) {
            case "weekly" -> 7;
            case "monthly" -> -1;
            default -> 1;
        };
    }
    private int getCountForRange(String range) {
        return switch (range.toLowerCase()) {
            case "weekly" -> 4;
            case "monthly" -> 6;
            default -> 30;
        };
    }
    // inside EnergyUsageController (add this method)
@GetMapping("/projections")
public ResponseEntity<?> getProjectionsGet(@RequestParam(defaultValue = "daily") String timeRange) {
    String range = timeRange.toLowerCase(Locale.ROOT);
    if (!List.of("daily","weekly","monthly").contains(range)) {
        return ResponseEntity.badRequest()
            .body("Invalid timeRange. Allowed: daily, weekly, monthly.");
    }

    try {
        User user = getAuthenticatedUser();
        logger.info("User {} requesting projections (GET) ({})", user.getId(), range);
        var projections = usageService.getProjections(user.getId(), range);
        return ResponseEntity.ok(projections);
    } catch (RuntimeException authEx) {
        // Return 401 rather than delegating to guest POST
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("User not authenticated for GET projections");
    }
}


    @PostMapping("/projections")
    public ResponseEntity<?> getProjections(
        @RequestParam(defaultValue = "daily") String timeRange,
        @RequestBody(required = false) List<Appliance> appliances
    ) {
        String range = timeRange.toLowerCase(Locale.ROOT);
        if (!List.of("daily","weekly","monthly").contains(range)) {
            return ResponseEntity.badRequest()
                .body("Invalid timeRange. Allowed: daily, weekly, monthly.");
        }

        try {
            User user = getAuthenticatedUser();
            logger.info("User {} requesting projections ({})", user.getId(), range);
            var projections = usageService.getProjections(user.getId(), range);
            return ResponseEntity.ok(projections);

        } catch (RuntimeException authEx) {
            // guest
            if (appliances == null || appliances.isEmpty()) {
                return ResponseEntity.badRequest()
                    .body("Appliance data required for guest forecast.");
            }
            logger.info("Guest projection for {} appliances", appliances.size());
            int daysPer = getDaysPerRange(range);
            int count   = getCountForRange(range);
            // use guest fallback rate = 0.12, no forecast
            List<UsageProjectionDTO> projections = usageService.project(
                appliances,
                0.12,
                daysPer,
                count,
                false,
                range.equals("monthly") ? "MMM yyyy" : "yyyy-MM-dd"
            );
            return ResponseEntity.ok(projections);
        }
    }

    // — Summary
    @GetMapping("/summary")
    public ResponseEntity<?> getUsageSummary(@RequestParam(required = false) Integer days) {
        try {
            User user = getAuthenticatedUser();
            UsageSummaryDTO summary = (days != null && days > 0)
                ? usageService.getUsageSummaryForRange(user.getId(), days)
                : usageService.getUsageSummary(user.getId());
            return ResponseEntity.ok(summary);
        } catch (RuntimeException e) {
            logger.info("Guest summary fallback");
            return ResponseEntity.ok(UsageSummaryDTO.empty());
        }
    }

    // — Annual cost
    @GetMapping("/annual-cost")
    public ResponseEntity<?> getAnnualCostForecast() {
        try {
            User user = getAuthenticatedUser();
            Double forecast = usageService.getAnnualCostForecast(user.getId());
            if (forecast == null) {
                return ResponseEntity.ok(Map.of(
                    "annualCost", null,
                    "message", "Insufficient data to forecast"
                ));
            }
            return ResponseEntity.ok(Map.of("annualCost", forecast));
        } catch (RuntimeException e) {
            logger.info("Guest annual cost fallback");
            return ResponseEntity.ok(Map.of("annualCost",
                usageService.getFallbackEstimate()
            ));
        }
    }

    // — Daily forecast
    @GetMapping("/forecasted-daily-cost")
    public ResponseEntity<?> getForecastedDailyCost() {
        try {
            User user = getAuthenticatedUser();
            double cost = usageService.getForecastedDailyCost(user.getId());
            return ResponseEntity.ok(Map.of("forecastedDailyCost", cost));
        } catch (RuntimeException e) {
            logger.info("Guest daily cost fallback");
            return ResponseEntity.ok(Map.of("forecastedDailyCost",
                usageService.getFallbackDailyCost()
            ));
        }
    }

    // — Log manual usage
    @PostMapping
    public ResponseEntity<?> logUsage(
        @RequestParam Long applianceId,
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
        @RequestParam double kWhUsed
    ) {
        if (applianceId == null) {
            return ResponseEntity.badRequest().body("Appliance ID must be provided.");
        }
        try {
            EnergyUsageLog saved = usageService.logUsage(applianceId, date, kWhUsed);
            return ResponseEntity.ok(saved);
        } catch (IllegalArgumentException bad) {
            return ResponseEntity.badRequest()
                                 .body("Invalid input: " + bad.getMessage());
        } catch (RuntimeException auth) {
            return unauthorized();
        }
    }

    // — Daily‐usage lookup
    @GetMapping("/daily-usage")
    public ResponseEntity<?> getDailyUsageFor(@RequestParam String day) {
        LocalDate date = switch (day.toLowerCase()) {
            case "today"     -> LocalDate.now();
            case "yesterday" -> LocalDate.now().minusDays(1);
            default -> throw new IllegalArgumentException("Invalid day. Use 'today' or 'yesterday'.");
        };
        try {
            User user = getAuthenticatedUser();
            double totalKwh = usageService.getTotalKwhForDate(user.getId(), date);
            return ResponseEntity.ok(Map.of("totalKwh", totalKwh));
        } catch (RuntimeException e) {
            logger.info("Guest daily-usage fallback");
            return ResponseEntity.ok(Map.of("totalKwh", 0.0));
        }
    }
}
