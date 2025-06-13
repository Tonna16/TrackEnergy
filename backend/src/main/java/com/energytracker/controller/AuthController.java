// src/main/java/com/energytracker/controller/AuthController.java
package com.energytracker.controller;

import com.energytracker.security.JwtUtil;
import com.energytracker.service.AuthService;
import com.energytracker.model.User;
import com.energytracker.repository.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import jakarta.servlet.http.HttpServletRequest;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "http://localhost:5173")
public class AuthController {
    private final AuthService authService;
    private final JwtUtil jwtUtil;
    private final UserRepository userRepo;

    public AuthController(AuthService authService, JwtUtil jwtUtil, UserRepository userRepo) {
        this.authService = authService;
        this.jwtUtil = jwtUtil;
        this.userRepo = userRepo;
    }

    @PostMapping("/signup")
    public ResponseEntity<?> signup(@RequestBody Map<String, String> body) {
        try {
            User u = authService.register(
                body.get("email"),
                body.get("fullName"),
                body.get("password"),
                body.get("username")
            );
            String token = jwtUtil.generateToken(u.getId());
            Map<String,Object> userDto = Map.of(
              "username", u.getUsername(),
              "email", u.getEmail(),
              "fullName", u.getFullName()
            );
            return ResponseEntity.ok(Map.of("token", token, "user", userDto));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity
                .badRequest()
                .body(Map.of("error", ex.getMessage()));
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> body) {
        try {
            User u = authService.login(body.get("email"), body.get("password"));
            String token = jwtUtil.generateToken(u.getId());
            Map<String,Object> userDto = Map.of(
              "username", u.getUsername(),
              "email", u.getEmail(),
              "fullName", u.getFullName()
            );
            return ResponseEntity.ok(Map.of("token", token, "user", userDto));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity
                .status(401)
                .body(Map.of("error", ex.getMessage()));
        }
    }

    @GetMapping("/me")
    public ResponseEntity<?> me(HttpServletRequest req) {
        String header = req.getHeader("Authorization");
        if (header == null || !header.startsWith("Bearer ")) {
            return ResponseEntity.status(401)
                                 .body(Map.of("error", "Missing or invalid Authorization header"));
        }
        String token = header.substring(7);
        Long userId = jwtUtil.extractUserId(token);
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Invalid or expired token"));
        }
        User u = userRepo.findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("User not found"));
        Map<String,Object> userDto = Map.of(
          "username", u.getUsername(),
          "email", u.getEmail(),
          "fullName", u.getFullName()
        );
        return ResponseEntity.ok(userDto);
    }
}
