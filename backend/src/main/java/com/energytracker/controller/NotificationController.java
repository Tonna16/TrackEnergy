package com.energytracker.controller;

import com.energytracker.model.Notification;
import com.energytracker.model.User;
import com.energytracker.service.NotificationService;
import com.energytracker.service.UserService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.*;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/notifications")
@CrossOrigin(origins = "http://localhost:5173")
public class NotificationController {

    private static final Logger logger = LoggerFactory.getLogger(NotificationController.class);

    private final NotificationService notificationService;
    private final UserService userService;

    public NotificationController(NotificationService notificationService, UserService userService) {
        this.notificationService = notificationService;
        this.userService = userService;
    }

    private User getAuthenticatedUser() {
        Object principal = SecurityContextHolder.getContext()
                                                .getAuthentication()
                                                .getPrincipal();
        if (!(principal instanceof String email)) {
            logger.error("No authenticated principal or wrong type: {}", principal);
            throw new IllegalStateException("User not authenticated");
        }
        User user = userService.getUserByEmail(email);
        if (user == null) {
            logger.warn("Authenticated email not found in DB: {}", email);
            throw new IllegalStateException("User not found");
        }
        logger.info("Authenticated user for notifications: {}", email);
        return user;
    }

    @GetMapping
    public ResponseEntity<?> getNotifications() {
        try {
            User user = getAuthenticatedUser();
            List<Notification> list = notificationService.getForUser(user.getId());
            logger.debug("Returning {} notifications for user {}", list.size(), user.getEmail());
            return ResponseEntity.ok(list);
        } catch (IllegalStateException e) {
            logger.error("Failed to fetch notifications: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(e.getMessage());
        }
    }

    @GetMapping("/unread-count")
    public ResponseEntity<?> getUnreadCount() {
        try {
            User user = getAuthenticatedUser();
            long count = notificationService.getUnreadCount(user.getId());
            logger.debug("User {} has {} unread notifications", user.getEmail(), count);
            return ResponseEntity.ok(Map.of("unreadCount", count));
        } catch (IllegalStateException e) {
            logger.error("Failed to fetch unread count: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(e.getMessage());
        }
    }

    @PostMapping("/{id}/read")
    public ResponseEntity<?> markRead(@PathVariable Long id) {
        try {
            User user = getAuthenticatedUser();
            boolean ok = notificationService.markAsReadForUser(id, user.getId());
            if (!ok) {
                logger.warn("User {} not authorized to mark notification {} read", user.getEmail(), id);
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Not authorized");
            }
            logger.info("Notification {} marked read for user {}", id, user.getEmail());
            return ResponseEntity.ok(Map.of("status", "read"));
        } catch (IllegalStateException e) {
            logger.error("markRead failed: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(e.getMessage());
        }
    }

    @PostMapping("/weekly-comparison")
    public ResponseEntity<?> createWeeklyComparisonNotification(@RequestBody Map<String, Object> body) {
        try {
            User user = getAuthenticatedUser();
            LocalDate weekStart = LocalDate.parse((String) body.get("weekStartDate"));
            double actual = Double.parseDouble(body.get("actualUsage").toString());
            double forecast = Double.parseDouble(body.get("forecastUsage").toString());

            Notification notif = notificationService
                .createForecastComparisonNotification(user, weekStart, actual, forecast);
            logger.info("Weekly comparison notification created for user {}", user.getEmail());
            return ResponseEntity.ok(notif);
        } catch (DateTimeParseException|NullPointerException|NumberFormatException e) {
            logger.warn("Bad request payload for weekly-comparison: {}", e.getMessage());
            return ResponseEntity.badRequest().body("Invalid request data");
        } catch (IllegalStateException e) {
            logger.error("Unauthorized weekly-comparison: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(e.getMessage());
        }
    }

    @PostMapping("/high-usage-appliance")
    public ResponseEntity<?> notifyHighUsageAppliance(@RequestBody Map<String, Object> body) {
        try {
            User user = getAuthenticatedUser();
            String name = (String) body.get("name");
            double estKWh = Double.parseDouble(body.get("estimatedKWh").toString());
            Notification notif = notificationService
                .createHighUsageApplianceNotification(user, name, estKWh);
            logger.info("High-usage appliance notification for '{}' to user {}", name, user.getEmail());
            return ResponseEntity.ok(notif);
        } catch (IllegalStateException e) {
            logger.error("Unauthorized high-usage-appliance: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(e.getMessage());
        } catch (Exception e) {
            logger.error("Error notifying high-usage-appliance", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Error sending notification.");
        }
    }

    @PostMapping("/forecast-mode")
    public ResponseEntity<?> notifyForecastMode(@RequestBody Map<String, String> body) {
        try {
            User user = getAuthenticatedUser();
            String mode = body.get("mode");
            if (mode == null) {
                logger.warn("Missing 'mode' in forecast-mode payload");
                return ResponseEntity.badRequest().body("Forecast mode required");
            }
            Notification notif = notificationService.createForecastModeNotification(user, mode);
            logger.info("Forecast mode '{}' notification for user {}", mode, user.getEmail());
            return ResponseEntity.ok(notif);
        } catch (IllegalStateException e) {
            logger.error("Unauthorized forecast-mode: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(e.getMessage());
        } catch (Exception e) {
            logger.error("Error in forecast-mode", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Error sending notification.");
        }
    }

    @PostMapping("/exchange-rate")
    public ResponseEntity<?> exchangeRateNotification(@RequestBody Map<String, Object> body) {
        try {
            User user = getAuthenticatedUser();
            String newCurrency = (String) body.get("newCurrency");
            double rate = ((Number) body.get("exchangeRate")).doubleValue();
            double elecRate = ((Number) body.get("electricityRate")).doubleValue();
            LocalDate date = LocalDate.parse((String) body.get("date"));

            String title = "Exchange Rate Updated";
            String msg = String.format("💱 %s rate updated. New cost: %.2f/kWh",
                                       newCurrency.equals("EUR") ? "EUR/USD" : "USD/EUR",
                                       elecRate);

            Notification notif = notificationService.createAndPush(user, title, "info", msg, null, date);
            logger.info("Exchange rate notification for user {}", user.getEmail());
            return ResponseEntity.ok(notif);
        } catch (IllegalStateException e) {
            logger.error("Unauthorized exchange-rate: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(e.getMessage());
        } catch (Exception e) {
            logger.error("Error in exchange-rate", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Error sending notification.");
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        try {
            User user = getAuthenticatedUser();
            boolean ok = notificationService.deleteForUser(id, user.getId());
            if (!ok) {
                logger.warn("User {} forbidden to delete notif {}", user.getEmail(), id);
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Not authorized");
            }
            logger.info("Deleted notification {} for user {}", id, user.getEmail());
            return ResponseEntity.ok(Map.of("status", "deleted"));
        } catch (IllegalStateException e) {
            logger.error("Unauthorized delete notification: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(e.getMessage());
        }
    }
}
