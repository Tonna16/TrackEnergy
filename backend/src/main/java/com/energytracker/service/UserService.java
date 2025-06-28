// src/main/java/com/energytracker/service/UserService.java
package com.energytracker.service;

import com.energytracker.model.User;
import com.energytracker.repository.UserRepository;
import org.springframework.stereotype.Service;

@Service
public class UserService {

    private final UserRepository userRepo;

    public UserService(UserRepository userRepo) {
        this.userRepo = userRepo;
    }

    /**
     * Given a user's email (from Principal.getName()), return their database ID.
     * Throws IllegalArgumentException if not found.
     */
    public  Long  getUserIdByEmail(String email) {
        User u = userRepo.findByEmail(email)
            .orElseThrow(() -> new IllegalArgumentException("User not found for email: " + email));
        return u.getId();
    }

    /**
     * Fetch the full User object by email.
     */
    public User getUserByEmail(String email) {
        return userRepo.findByEmail(email)
            .orElseThrow(() -> new IllegalArgumentException("User not found for email: " + email));
    }

    /**
     * Fetch the full User object by ID.
     */
    public User getUserById(Long id) {
        return userRepo.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("User not found for id: " + id));
    }
}
