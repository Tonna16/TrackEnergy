package com.energytracker.repository;

import com.energytracker.model.Notification;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;

public interface NotificationRepository extends JpaRepository<Notification, Long> {

    // Fetch only active (not soft‑deleted) notifications
    List<Notification> findByUser_IdAndDeletedFalseOrderByCreatedAtDesc(Long userId);

    // Notification uniqueness checks (ignore deleted)
    boolean existsByUser_IdAndTitleAndUsageDateAndDeletedFalse(Long userId, String title, LocalDate usageDate);
    boolean existsByUser_IdAndTitleAndApplianceIdAndUsageDateAndDeletedFalse(Long userId, String title, Long applianceId, LocalDate usageDate);

    // Check if a “High Usage Appliance Added” already exists today (or ever)
    boolean existsByUser_IdAndTitleAndDeletedFalse(Long userId, String title);

    // Count only unread and non‑deleted notifications
    long countByUser_IdAndReadFalseAndDeletedFalse(Long userId);
}
