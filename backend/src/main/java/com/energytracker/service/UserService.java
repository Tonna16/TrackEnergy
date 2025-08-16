package com.energytracker.service;

import com.energytracker.model.User;
import com.energytracker.repository.UserRepository;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
public class UserService {

    private final UserRepository userRepo;

    public UserService(UserRepository userRepo) {
        this.userRepo = userRepo;
    }

    public User getUserByEmail(String email) {
        return userRepo.findByEmail(email).orElse(null);
    }

    public Optional<User> findById(Long id) {
        return userRepo.findById(id);
    }

    public User getUserById(Long id) {
        return userRepo.findById(id).orElse(null);
    }

    /**
     * Update just the household size for the given userId (returns the updated user).
     */
    public User updateHouseholdSize(Long userId, Integer householdSize) {
        if (userId == null || householdSize == null) return null;
        User u = userRepo.findById(userId).orElse(null);
        if (u == null) return null;
        u.setHouseholdSize(householdSize);
        return userRepo.save(u);
    }
}
