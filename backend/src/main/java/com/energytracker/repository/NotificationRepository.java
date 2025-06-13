// src/main/java/com/energytracker/repository/NotificationRepository.java
package com.energytracker.repository;

import com.energytracker.model.Notification;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface NotificationRepository extends JpaRepository<Notification, Long> {
    // Find all notifications for a user, newest first
    List<Notification> findByUser_IdOrderByCreatedAtDesc(Long userId);

    // Check if a "spike" notification containing the date string already exists
    boolean existsByUser_IdAndTitleAndMessageContaining(Long userId, String title, String message);
}
