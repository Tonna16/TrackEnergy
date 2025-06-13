package com.energytracker.controller;

import com.energytracker.model.User;
import com.energytracker.repository.UserRepository;
import com.energytracker.service.UserService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.Map;

@RestController
@RequestMapping("/api/profile")
@CrossOrigin(origins = "http://localhost:5173")
public class ProfileController {

    private final UserService userService;
    private final UserRepository userRepo;

    public ProfileController(UserService userService, UserRepository userRepo) {
        this.userService = userService;
        this.userRepo = userRepo;
    }

    /** GET /api/profile — fetch current user’s profile */
    @GetMapping
    public ResponseEntity<?> getProfile(Principal principal) {
        if (principal == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }

        Long userId = userService.getUserIdByEmail(principal.getName());
        User u = userRepo.findById(userId)
                         .orElseThrow(() -> new IllegalArgumentException("User not found"));

        return ResponseEntity.ok(Map.of(
            "username", u.getUsername(),
            "email", u.getEmail(),
            "fullName", u.getFullName()
        ));
    }

    /** PUT /api/profile — update full name and email */
    @PutMapping
    public ResponseEntity<?> updateProfile(Principal principal, @RequestBody Map<String, String> updates) {
        if (principal == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }

        Long userId = userService.getUserIdByEmail(principal.getName());
        User u = userRepo.findById(userId)
                         .orElseThrow(() -> new IllegalArgumentException("User not found"));

        String newFullName = updates.get("fullName");
        String newEmail = updates.get("email");

        if (newFullName != null && !newFullName.isBlank()) {
            u.setFullName(newFullName);
        }

        if (newEmail != null && !newEmail.isBlank()) {
            u.setEmail(newEmail);
        }

        userRepo.save(u);

        return ResponseEntity.ok(Map.of("status", "updated"));
    }
}
