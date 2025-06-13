// src/main/java/com/energytracker/service/NotificationService.java
package com.energytracker.service;

import com.energytracker.model.Notification;
import com.energytracker.model.User;
import com.energytracker.repository.NotificationRepository;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Service
public class NotificationService {

    private final NotificationRepository repo;
    private final SimpMessagingTemplate messaging;

    public NotificationService(NotificationRepository repo,
                               SimpMessagingTemplate messaging) {
        this.repo = repo;
        this.messaging = messaging;
    }

    /**
     * Persist a new notification and push it over WebSocket.
     */
    @Transactional
    public Notification createAndPush(User user, String title, String type, String message) {
        Notification n = new Notification();
        n.setUser(user);
        n.setTitle(title);
        n.setType(type);
        n.setMessage(message);
        Notification saved = repo.save(n);

        // Push to /topic/notifications/{userId}
        messaging.convertAndSend(
            "/topic/notifications/" + user.getId(),
            saved
        );
        return saved;
    }

    /**
     * Does a spike notification for that date already exist?
     */
    public boolean existsSpikeNotificationForDate(Long userId, LocalDate date) {
        String title = "Energy Spike Detected";
        String dateStr = date.toString();
        return repo.existsByUser_IdAndTitleAndMessageContaining(userId, title, dateStr);
    }

    /**
     * Fetch all notifications for a user.
     */
    public List<Notification> getForUser(Long userId) {
        return repo.findByUser_IdOrderByCreatedAtDesc(userId);
    }

    /**
     * Mark a notification as read.
     */
    @Transactional
    public void markAsRead(Long notificationId) {
        repo.findById(notificationId).ifPresent(n -> {
            n.setRead(true);
            repo.save(n);
        });
    }

    /**
     * Delete a notification.
     */
    @Transactional
    public void delete(Long notificationId) {
        repo.deleteById(notificationId);
    }
}
