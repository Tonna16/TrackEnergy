// src/main/java/com/energytracker/model/Notification.java
package com.energytracker.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "notifications")
public class Notification {

    @Id 
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** The user who will receive this notification */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /** A short title for the notification, e.g. "Energy Spike Detected" */
    @Column(nullable = false)
    private String title;

    /** Category/type, e.g. "alert" or "system" */
    @Column(nullable = false)
    private String type;

    /** Detailed message */
    @Column(nullable = false, columnDefinition = "TEXT")
    private String message;

    /** Timestamp when created */
    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    /** Has the user read/viewed this notification? */
    @Column(name = "is_read", nullable = false)
    private boolean read = false;

    // ── Getters & Setters ──

    public Long getId() { return id; }

    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public boolean isRead() { return read; }
    public void setRead(boolean read) { this.read = read; }
}
