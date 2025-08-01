package com.energytracker.service;

import com.energytracker.model.Notification;
import com.energytracker.model.User;
import com.energytracker.repository.NotificationRepository;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.time.LocalDate;
import java.util.List;

@Service
public class NotificationService {

    private final NotificationRepository repo;
    private final SimpMessagingTemplate messaging;
    private static final Logger logger = LoggerFactory.getLogger(NotificationService.class);
    public NotificationService(NotificationRepository repo, SimpMessagingTemplate messaging) {
        this.repo = repo;
        this.messaging = messaging;
    }

    /**
     * Create and push a real-time notification to the user's WebSocket channel.
     */
    @Transactional
    public Notification createAndPush(User user, String title, String type, String message, Long applianceId, LocalDate usageDate) {
        Notification n = new Notification();
        n.setUser(user);
        n.setTitle(title);
        n.setType(type);
        n.setMessage(message);
        n.setApplianceId(applianceId);
        n.setUsageDate(usageDate);
        n.setRead(false);
        n.setDeleted(false);
        Notification saved = repo.save(n);
        messaging.convertAndSend("/topic/notifications/" + user.getId(), saved);
        return saved;
    }

    // ----------------- UNIQUE CHECKS -----------------

    public boolean existsSpikeNotificationForDate(Long userId, LocalDate date) {
        return repo.existsByUser_IdAndTitleAndUsageDateAndDeletedFalse(userId, "Energy Spike Detected", date);
    }

    public boolean existsHighUsageNotification(Long userId, Long applianceId, LocalDate date) {
        return repo.existsByUser_IdAndTitleAndApplianceIdAndUsageDateAndDeletedFalse(userId, "High Power Usage Detected", applianceId, date);
    }

    public boolean existsForecastComparisonNotification(Long userId, LocalDate weekStart) {
        return repo.existsByUser_IdAndTitleAndUsageDateAndDeletedFalse(userId, "Weekly Energy Usage Forecast", weekStart);
    }

    public boolean existsHighUsageApplianceNotificationToday(Long userId) {
        return repo.existsByUser_IdAndTitleAndUsageDateAndDeletedFalse(
            userId, "High Usage Appliance Added", LocalDate.now());
    }

    // ----------------- CREATE NOTIFICATIONS -----------------

    @Transactional
    public Notification createHighUsageApplianceNotification(User user, String applianceName, double estimatedKWh) {
        String title = "High Usage Appliance Added";
        String msg = String.format(
            "⚠️ You added \"%s\" which is estimated to use %.2f kWh/day. Consider more efficient alternatives.",
            applianceName, estimatedKWh
        );
        return createAndPush(user, title, "warning", msg, null, LocalDate.now());
    }

    @Transactional
    public Notification createHighUsageApplianceNotificationIfNotExists(User user, String applianceName, double estimatedKWh) {
        if (existsHighUsageApplianceNotificationToday(user.getId())) {
            return null; // Skip duplicate
        }
        return createHighUsageApplianceNotification(user, applianceName, estimatedKWh);
    }

    @Transactional
    public Notification createForecastModeNotification(User user, String mode) {
        String title = "Forecast Mode Activated";
        String msg = String.format("📊 Forecasting is now based on your recent energy patterns (%s mode).", mode);
        return createAndPush(user, title, "info", msg, null, LocalDate.now());
    }
    @Transactional
public Notification createHighUsageNotificationIfNotExists(User user, Long applianceId, String applianceName, LocalDate date, double kWhUsed) {
    boolean exists = existsHighUsageNotification(user.getId(), applianceId, date);
    if (exists) {
        return null;
    }

    String title = "High Power Usage Detected";
    String msg = String.format(
        "⚡ %s used %.2f kWh on %s, which exceeds typical usage. Consider checking for unusual consumption.",
        applianceName, kWhUsed, date
    );

    return createAndPush(user, title, "warning", msg, applianceId, date);
}

    @Transactional
    public Notification createForecastComparisonNotification(User user, LocalDate weekStartDate, double actualUsage, double forecastUsage) {
        if (existsForecastComparisonNotification(user.getId(), weekStartDate)) {
            return null; // Skip duplicate
        }

        String title = "Weekly Energy Usage Forecast";
        double diff = actualUsage - forecastUsage;
        double absDiff = Math.abs(diff);
        String msg = diff > 0
            ? String.format("⚡ Your actual usage is above forecast by %.2f kWh for week starting %s. Consider energy saving tips.", absDiff, weekStartDate)
            : String.format("👍 Good job! Your actual usage is below forecast by %.2f kWh for week starting %s.", absDiff, weekStartDate);

        return createAndPush(user, title, diff > 0 ? "warning" : "success", msg, null, weekStartDate);
    }

    // ----------------- FETCH NOTIFICATIONS -----------------

    public List<Notification> getForUser(Long userId) {
        return repo.findByUser_IdAndDeletedFalseOrderByCreatedAtDesc(userId);
    }

    public long getUnreadCount(Long userId) {
        return repo.countByUser_IdAndReadFalseAndDeletedFalse(userId);
    }

    // ----------------- UPDATE / DELETE -----------------

    @Transactional
    public boolean markAsReadForUser(Long notificationId, Long userId) {
        logger.debug("markAsRead: notificationId={} for userId={}", notificationId, userId);

        return repo.findById(notificationId)
                   .filter(n -> n.getUser().getId().equals(userId))
                   .filter(n -> !Boolean.TRUE.equals(n.getDeleted()))
                   .map(n -> {
                    logger.debug("  found notification.user.id={}", n.getUser().getId());

                       n.setRead(true);
                       repo.save(n);
                       return true;
                   })
                   .orElse(false);
    }

    @Transactional
    public boolean deleteForUser(Long notificationId, Long userId) {
        return repo.findById(notificationId)
                   .filter(n -> n.getUser().getId().equals(userId))
                   .map(n -> {
                       n.setDeleted(true);
                       repo.save(n);
                       return true;
                   })
                   .orElse(false);
    }
}
