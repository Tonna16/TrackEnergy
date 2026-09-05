package com.energytracker.controller;

import com.energytracker.dto.EnergyUsageDTO;
import com.energytracker.dto.UsageProjectionDTO;
import com.energytracker.dto.UsageSummaryDTO;
import com.energytracker.dto.HistoryForecastDTO;
import com.energytracker.model.Appliance;
import com.energytracker.model.EnergyUsageLog;
import com.energytracker.model.User;
import com.energytracker.service.EnergyReportPdfService;
import com.energytracker.service.EnergyUsageService;
import com.energytracker.service.UserService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.*;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.*;

@RestController
@RequestMapping("/api/energy-usage")
public class EnergyUsageController {
    private static final Logger logger = LoggerFactory.getLogger(EnergyUsageController.class);
    private static final int MAX_GUEST_APPLIANCES = 100;
    private static final int MAX_SUMMARY_DAYS = 366;

    private final EnergyUsageService usageService;
    private final UserService userService;
    private final EnergyReportPdfService energyReportPdfService;

    public EnergyUsageController(EnergyUsageService usageService,
                                 UserService userService,
                                 EnergyReportPdfService energyReportPdfService) {
        this.usageService = usageService;
        this.userService = userService;
        this.energyReportPdfService = energyReportPdfService;
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

    // — the Projections
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

    @GetMapping("/history-forecast")
    public ResponseEntity<?> getHistoryForecast(@RequestParam(defaultValue = "daily") String timeRange) {
        String range = timeRange.toLowerCase(Locale.ROOT);
        if (!List.of("daily", "weekly", "monthly").contains(range)) {
            return ResponseEntity.badRequest().body("Invalid timeRange. Allowed: daily, weekly, monthly.");
        }
        try {
            User user = getAuthenticatedUser();
            HistoryForecastDTO forecast = usageService.getHistoryForecast(user.getId(), range);
            return ResponseEntity.ok(forecast);
        } catch (RuntimeException error) {
            return unauthorized();
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
                    .body("Appliance data required for guest projection.");
            }
            if (appliances.size() > MAX_GUEST_APPLIANCES) {
                return ResponseEntity.badRequest()
                    .body("Too many appliances. Maximum allowed is " + MAX_GUEST_APPLIANCES + ".");
            }
            for (int i = 0; i < appliances.size(); i++) {
                String validationError = validateProjectionAppliance(appliances.get(i), i);
                if (validationError != null) {
                    return ResponseEntity.badRequest().body(validationError);
                }
            }
            logger.info("Guest projection for {} appliances", appliances.size());
            int daysPer = getDaysPerRange(range);
            int count   = getCountForRange(range);
            // Guest formula endpoint uses the shared default rate; no remote service is involved.
            List<UsageProjectionDTO> projections = usageService.project(
                appliances,
                usageService.getDefaultElectricityRate(),
                daysPer,
                count,
                false,
                range.equals("monthly") ? "MMM yyyy" : "yyyy-MM-dd"
            );
            return ResponseEntity.ok(projections);
        }
    }


    @GetMapping("/report")
    public ResponseEntity<?> downloadUsageReport(@RequestParam String period) {
        String normalizedPeriod = period.toLowerCase(Locale.ROOT);
        if (!List.of("weekly", "monthly").contains(normalizedPeriod)) {
            return ResponseEntity.badRequest().body("Invalid period. Allowed: weekly, monthly.");
        }

        try {
            User user = getAuthenticatedUser();
            int days = normalizedPeriod.equals("weekly") ? 7 : 30;
            LocalDate endDate = LocalDate.now();
            LocalDate startDate = endDate.minusDays(days - 1L);

            UsageSummaryDTO summary = usageService.getUsageSummaryForRange(user.getId(), days);
            List<EnergyUsageDTO> usageRows = usageService.getUsageDataByUser(user.getId(), startDate, endDate);

            byte[] pdf = energyReportPdfService.generateReport(
                normalizedPeriod,
                user.getId(),
                startDate,
                endDate,
                summary,
                usageRows
            );

            String filename = "energy-report-" + normalizedPeriod + "-" + LocalDate.now() + ".pdf";
            return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .body(pdf);
        } catch (RuntimeException authEx) {
            return unauthorized();
        } catch (Exception ex) {
            logger.error("Failed to generate {} report", normalizedPeriod, ex);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body("Failed to generate report");
        }
    }

    // — Summary
    @GetMapping("/summary")
    public ResponseEntity<?> getUsageSummary(@RequestParam(required = false) Integer days) {
        if (days != null && (days <= 0 || days > MAX_SUMMARY_DAYS)) {
            return ResponseEntity.badRequest()
                .body("days must be between 1 and " + MAX_SUMMARY_DAYS + ".");
        }
        try {
            User user = getAuthenticatedUser();
            UsageSummaryDTO summary = (days != null && days > 0)
                ? usageService.getUsageSummaryForRange(user.getId(), days)
                : usageService.getUsageSummary(user.getId());
            return ResponseEntity.ok(summary);
        } catch (RuntimeException e) {
            logger.info("Guest summary fallback");
            return ResponseEntity.ok(UsageSummaryDTO.empty(usageService.getDefaultCurrency()));
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
                    "message", "Formula projection unavailable"
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

    // — Legacy daily formula-projection route (name retained for API compatibility)
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
        } catch (AccessDeniedException denied) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                                 .body("Forbidden: " + denied.getMessage());
        } catch (NoSuchElementException notFound) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                                 .body(notFound.getMessage());
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
            List<EnergyUsageDTO> rows = usageService.getUsageDataByUser(user.getId(), date, date);
            double totalKwh = rows.stream().mapToDouble(EnergyUsageDTO::getkWhUsed).sum();
            return ResponseEntity.ok(Map.of(
                "date", date.toString(),
                "totalKwh", totalKwh,
                "hasRecordedUsage", !rows.isEmpty()
            ));
        } catch (RuntimeException e) {
            logger.info("Guest daily-usage fallback");
            return ResponseEntity.ok(Map.of(
                "date", date.toString(),
                "totalKwh", 0.0,
                "hasRecordedUsage", false
            ));
        }
    }

    private String validateProjectionAppliance(Appliance appliance, int index) {
        if (appliance == null) {
            return "Appliance at index " + index + " must not be null.";
        }
        String name = appliance.getName();
        if (name == null || name.isBlank() || name.length() > 100) {
            return "Appliance at index " + index + " must have a non-blank name up to 100 characters.";
        }
        if (!Double.isFinite(appliance.getWattage()) || appliance.getWattage() < 1.0 || appliance.getWattage() > 10000.0) {
            return "Appliance at index " + index + " has invalid wattage.";
        }
        if (!Double.isFinite(appliance.getHoursPerDay()) || appliance.getHoursPerDay() < 0.0 || appliance.getHoursPerDay() > 24.0) {
            return "Appliance at index " + index + " has invalid hoursPerDay.";
        }
        if (appliance.getDaysPerWeek() < 0 || appliance.getDaysPerWeek() > 7) {
            return "Appliance at index " + index + " has invalid daysPerWeek.";
        }
        if (appliance.getEstimatedDailyKWh() != null
            && (!Double.isFinite(appliance.getEstimatedDailyKWh()) || appliance.getEstimatedDailyKWh() < 0.0)) {
            return "Appliance at index " + index + " has invalid estimatedDailyKWh override.";
        }
        return null;
    }
}
