package com.energytracker.controller;

import com.energytracker.dto.EnergyUsageDTO;
import com.energytracker.dto.UsageProjectionDTO;
import com.energytracker.dto.UsageSummaryDTO;
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
        Object principal = SecurityContextHolder.getContext()
                                                .getAuthentication()
                                                .getPrincipal();
        if (!(principal instanceof String email)) {
            logger.error("Invalid authentication principal: {}", principal);
            throw new RuntimeException("User not authenticated");
        }
        logger.info("Authenticated email = {}", email);
        User user = userService.getUserByEmail(email);
        if (user == null) {
            logger.warn("No user found for email: {}", email);
            throw new RuntimeException("User not found");
        }
        return user;
    }

    private ResponseEntity<String> unauthorized() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        logger.warn("Unauthorized access detected. Principal={}", principal);
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
            Long userId = getAuthenticatedUser().getId();
            logger.info("Fetching usage data for userId={} from {} to {}", userId, startDate, endDate);
            List<EnergyUsageDTO> data = usageService.getUsageDataByUser(userId, startDate, endDate);
            return ResponseEntity.ok(data);
        } catch (RuntimeException e) {
            logger.error("Error fetching usage data: {}", e.getMessage());
            return unauthorized();
        }
    }

    @GetMapping("/projections")
    public ResponseEntity<?> getProjections(@RequestParam(defaultValue = "daily") String timeRange) {
        try {
            User user = null;
            try {
                user = getAuthenticatedUser();
            } catch (RuntimeException e) {
                logger.info("No authenticated user for /projections, returning empty projections.");
            }
    
            String range = timeRange.toLowerCase(Locale.ROOT);
            if (!List.of("daily", "weekly", "monthly").contains(range)) {
                logger.warn("Invalid timeRange received: {}", timeRange);
                return ResponseEntity.badRequest()
                                     .body("Invalid timeRange. Allowed: daily, weekly, monthly.");
            }
    
            List<UsageProjectionDTO> projections;
            if (user != null) {
                logger.info("Fetching projections for userId={} with range={}", user.getId(), range);
                projections = usageService.getProjections(user.getId(), range);
            } else {
                // fallback for guests: empty list or default projections
                projections = Collections.emptyList();
                logger.info("Guest user projections for range={} are empty", range);
            }
    
            return ResponseEntity.ok(projections);
    
        } catch (Exception e) {
            logger.error("Error fetching projections: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Error fetching projections");
        }
    }
    

    @GetMapping("/summary")
    public ResponseEntity<?> getUsageSummary(@RequestParam(required = false) Integer days) {
        try {
            User user = null;
            try {
                user = getAuthenticatedUser();
            } catch (RuntimeException e) {
                logger.info("No authenticated user for /summary, returning fallback summary.");
            }
    
            UsageSummaryDTO summary;
            if (user != null) {
                logger.info("Fetching usage summary for userId={}, days={}", user.getId(), days);
                summary = (days != null && days > 0)
                        ? usageService.getUsageSummaryForRange(user.getId(), days)
                        : usageService.getUsageSummary(user.getId());
            } else {
                // fallback for guests, e.g. empty summary or default values
                summary = UsageSummaryDTO.empty();  // <-- updated here
                logger.info("Guest user usage summary returned empty/default.");
            }
    
            return ResponseEntity.ok(summary);
    
        } catch (Exception e) {
            logger.error("Error fetching usage summary: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Error fetching usage summary");
        }
    }
    

    @GetMapping("/annual-cost")
    public ResponseEntity<?> getAnnualCostForecast() {
        try {
            User user = null;
            try {
                user = getAuthenticatedUser();
            } catch (RuntimeException e) {
                logger.info("No authenticated user, using fallback estimate.");
            }
    
            if (user != null) {
                Double forecast = usageService.getAnnualCostForecast(user.getId());
                if (forecast == null) {
                    logger.warn("Annual cost forecast is null for userId={}", user.getId());
                    return ResponseEntity.ok(Map.of("annualCost", null, "message", "Insufficient data to forecast"));
                }
                logger.info("Annual cost forecast for userId={} is {}", user.getId(), forecast);
                return ResponseEntity.ok(Map.of("annualCost", forecast));
            } else {
                Double fallback = usageService.getFallbackEstimate(); // Make sure this method exists in your service
                logger.info("Returning fallback annual cost: {}", fallback);
                return ResponseEntity.ok(Map.of("annualCost", fallback));
            }
    
        } catch (Exception e) {
            logger.error("Error fetching annual cost forecast: {}", e.getMessage(), e);
            return unauthorized();
        }
    }
    
    @GetMapping("/forecasted-daily-cost")
public ResponseEntity<?> getForecastedDailyCost() {
    try {
        logger.debug("GET /forecasted-daily-cost triggered");

        User user = null;
        try {
            user = getAuthenticatedUser();
        } catch (RuntimeException e) {
            logger.info("No authenticated user, using fallback daily cost.");
        }

        double cost;
        if (user != null) {
            cost = Optional.ofNullable(usageService.getForecastedDailyCost(user.getId())).orElse(0.0);
            logger.info("Forecasted daily cost for userId={} is {}", user.getId(), cost);
        } else {
            cost = usageService.getFallbackDailyCost(); // Make sure this method is implemented
            logger.info("Returning fallback daily cost: {}", cost);
        }

        return ResponseEntity.ok(Map.of("forecastedDailyCost", cost));

    } catch (Exception e) {
        logger.error("Error fetching forecasted daily cost: {}", e.getMessage(), e);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Error fetching forecasted cost");
    }
}

    

    @PostMapping
public ResponseEntity<?> logUsage(
    @RequestParam Long applianceId,
    @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
    @RequestParam double kWhUsed
) {
    if (applianceId == null) {
        logger.warn("applianceId is null in logUsage request.");
        return ResponseEntity.badRequest().body("Appliance ID must be provided.");
    }
    
    try {
        logger.info("POST /api/energy-usage - Logging usage: applianceId={}, date={}, kWhUsed={}", applianceId, date, kWhUsed);

        EnergyUsageLog saved = usageService.logUsage(applianceId, date, kWhUsed);

        logger.info("Usage successfully logged for applianceId={}, date={}, savedId={}",
                    applianceId, date, saved.getId());

        return ResponseEntity.ok(saved);

    } catch (IllegalArgumentException ex) {
        logger.warn("Invalid usage input: {}", ex.getMessage(), ex);
        return ResponseEntity.badRequest().body("Invalid input: " + ex.getMessage());

    } catch (RuntimeException e) {
        logger.error("Unauthorized usage log attempt or unknown error: {}", e.getMessage(), e);
        return unauthorized();
    }
}


@GetMapping("/daily-usage")
public ResponseEntity<?> getDailyUsageFor(@RequestParam String day) {
    try {
        User user = null;
        try {
            user = getAuthenticatedUser();
        } catch (RuntimeException e) {
            logger.info("No authenticated user for /daily-usage, returning fallback usage.");
        }

        LocalDate date = switch (day.toLowerCase()) {
            case "today" -> LocalDate.now();
            case "yesterday" -> LocalDate.now().minusDays(1);
            default -> throw new IllegalArgumentException("Invalid day. Use 'today' or 'yesterday'.");
        };

        double totalKwh;

        if (user != null) {
            logger.info("Fetching daily usage for userId={} on {}", user.getId(), date);
            totalKwh = usageService.getTotalKwhForDate(user.getId(), date);
        } else {
            // fallback for guests, e.g., 0 or some default value
            totalKwh = 0.0;
            logger.info("Guest user daily usage for {} is assumed to be {}", date, totalKwh);
        }

        return ResponseEntity.ok(Map.of("totalKwh", totalKwh));

    } catch (IllegalArgumentException ex) {
        logger.warn("Bad request for /daily-usage: {}", ex.getMessage());
        return ResponseEntity.badRequest().body(ex.getMessage());
    } catch (Exception e) {
        logger.error("Error in /daily-usage: {}", e.getMessage());
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Error fetching daily usage");
    }
}

}
