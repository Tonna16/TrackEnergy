package com.energytracker.controller;

import com.energytracker.model.Notification;
import com.energytracker.model.User;
import com.energytracker.service.NotificationService;
import com.energytracker.service.UserService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
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
        this.userService = userService;
        this.notificationService = notificationService;
    }

    private User authUser(Principal principal) {
        if (principal == null) {
            throw new IllegalStateException("User not authenticated");
        }
        String email = principal.getName();
        User user = userService.getUserByEmail(email);
        if (user == null) {
            throw new IllegalStateException("User not found");
        }
        return user;
    }

    @GetMapping
    public ResponseEntity<?> getNotifications(Principal principal) {
        try {
            User user = authUser(principal);
            List<Notification> notifications = notificationService.getForUser(user.getId());
            return ResponseEntity.ok(notifications);
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(e.getMessage());
        }
    }

    @GetMapping("/unread-count")
    public ResponseEntity<?> getUnreadCount(Principal principal) {
        try {
            User user = authUser(principal);
            long count = notificationService.getUnreadCount(user.getId());
            return ResponseEntity.ok(Map.of("unreadCount", count));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(e.getMessage());
        }
    }

    @PostMapping("/{id}/read")
    public ResponseEntity<?> markRead(@PathVariable Long id, Principal principal) {
        try {
            User user = authUser(principal);
            boolean success = notificationService.markAsReadForUser(id, user.getId());
            if (!success) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Not authorized to mark this notification");
            }
            logger.info("Marked notification {} as read for user {}", id, user.getId());
            return ResponseEntity.ok(Map.of("status", "read"));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(e.getMessage());
        }
    }

    @PostMapping("/weekly-comparison")
    public ResponseEntity<?> createWeeklyComparisonNotification(
            @RequestBody Map<String, Object> body,
            Principal principal) {
        try {
            User user = authUser(principal);

            String weekStartStr = (String) body.get("weekStartDate");
            Double actualUsage = Double.valueOf(body.get("actualUsage").toString());
            Double forecastUsage = Double.valueOf(body.get("forecastUsage").toString());
            LocalDate weekStartDate = LocalDate.parse(weekStartStr);

            Notification notification = notificationService.createForecastComparisonNotification(
                    user, weekStartDate, actualUsage, forecastUsage);

            return ResponseEntity.ok(notification);
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(e.getMessage());
        } catch (DateTimeParseException | NullPointerException | NumberFormatException e) {
            return ResponseEntity.badRequest().body("Invalid request data");
        }
    }

    @PostMapping("/high-usage-appliance")
    public ResponseEntity<?> notifyHighUsageAppliance(
            @RequestBody Map<String, Object> body,
            Principal principal) {
        try {
            User user = authUser(principal);

            String applianceName = (String) body.get("name");
            Double estimatedKWh = Double.valueOf(body.get("estimatedKWh").toString());

            if (applianceName == null || estimatedKWh == null) {
                return ResponseEntity.badRequest().body("Missing appliance name or usage.");
            }

            Notification notification = notificationService.createHighUsageApplianceNotification(user, applianceName, estimatedKWh);
            return ResponseEntity.ok(notification);
        } catch (Exception e) {
            logger.error("Failed to send high-usage appliance notification", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Error sending notification.");
        }
    }

    @PostMapping("/forecast-mode")
    public ResponseEntity<?> notifyForecastMode(
            @RequestBody Map<String, String> body,
            Principal principal) {
        try {
            User user = authUser(principal);
            String mode = body.get("mode");

            if (mode == null) {
                return ResponseEntity.badRequest().body("Forecast mode is required.");
            }

            Notification notification = notificationService.createForecastModeNotification(user, mode);
            return ResponseEntity.ok(notification);
        } catch (Exception e) {
            logger.error("Failed to send forecast mode notification", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Error sending forecast notification.");
        }
    }
    @PostMapping("/exchange-rate")
    public ResponseEntity<?> exchangeRateNotification(
        @RequestBody Map<String, Object> body,
        Principal principal
    ) {
        User user = userService.getUserByEmail(principal.getName());
    
        String newCurrency = (String) body.get("newCurrency");
        double rate = ((Number) body.get("exchangeRate")).doubleValue();
        double electricityRate = ((Number) body.get("electricityRate")).doubleValue();
        LocalDate date = LocalDate.parse((String) body.get("date"));
    
        String title = "Exchange Rate Updated";
        String msg = String.format("💱 %s rate updated. New electricity cost: %.2f/kWh.",
            newCurrency.equals("EUR") ? "EUR/USD" : "USD/EUR", electricityRate);
    
        // ✅ Return the saved notification
        Notification notification = notificationService.createAndPush(user, title, "info", msg, null, date);
        return ResponseEntity.ok(notification);
    }
    


    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id, Principal principal) {
        try {
            User user = authUser(principal);
            boolean success = notificationService.deleteForUser(id, user.getId());
            if (!success) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Not authorized to delete this notification");
            }
            logger.info("Deleted notification {} for user {}", id, user.getId());
            return ResponseEntity.ok(Map.of("status", "deleted"));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(e.getMessage());
        }
    }
}
