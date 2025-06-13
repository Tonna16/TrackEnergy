package com.energytracker.controller;

import com.energytracker.model.Notification;
import com.energytracker.service.NotificationService;
import com.energytracker.service.UserService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

@RestController
@RequestMapping("/api/notifications")
@CrossOrigin(origins = "http://localhost:5173")
public class NotificationController {

    private final NotificationService notificationService;
    private final UserService userService;

    public NotificationController(NotificationService notificationService,
                                  UserService userService) {
        this.notificationService = notificationService;
        this.userService = userService;
    }

    /** GET /api/notifications — list all for current user */
    @GetMapping
    public ResponseEntity<?> getNotifications(Principal principal) {
        if (principal == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("User not authenticated");
        }

        Long userId = userService.getUserIdByEmail(principal.getName());
        List<Notification> notifications = notificationService.getForUser(userId);
        return ResponseEntity.ok(notifications);
    }

    /** POST /api/notifications/{id}/read — mark as read */
    @PostMapping("/{id}/read")
    public ResponseEntity<?> markRead(@PathVariable Long id) {
        notificationService.markAsRead(id);
        return ResponseEntity.ok().build();
    }

    /** DELETE /api/notifications/{id} — delete notification */
    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        notificationService.delete(id);
        return ResponseEntity.ok().build();
    }
}
