package com.energytracker.controller;

import com.energytracker.model.User;
import com.energytracker.service.UserService;
import com.energytracker.security.JwtUtil;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "http://localhost:5173")
public class ProfileController {

    private final UserService userService;

    public ProfileController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping("/profile")
    public ResponseEntity<?> getProfile(@AuthenticationPrincipal String email) {
        try {
            User user = userService.getUserByEmail(email);
            return ResponseEntity.ok(Map.of(
                "username", user.getUsername(),
                "email", user.getEmail(),
                "fullName", user.getFullName(),
                "createdAt", user.getCreatedAt()
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", "User not found"));
        }
    }
}
