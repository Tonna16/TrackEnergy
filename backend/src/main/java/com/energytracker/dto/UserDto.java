package com.energytracker.dto;
import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.PrePersist;

public class UserDto {
    private String email;
    private String password;
    private String fullName;
    private String username;
    private String location;

     @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }


    // Getters and setters
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }

    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }


    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
    public void setUsername(String username) {
        this.username = username;
    }
    public String getUsername() {
        return username;
    }
public void setLocation(String location) {
        this.location = location;
    }
    public String getLocation() {
        return location;
}
}