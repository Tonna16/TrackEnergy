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
            String email = body.get("email");
            String fullName = body.get("fullName");
            String password = body.get("password");
            String username = body.get("username");

            if (email == null || password == null || username == null || fullName == null) {
                return ResponseEntity.badRequest()
                    .body(Map.of("error", "Missing required fields"));
            }

            User u = authService.register(email, fullName, password, username);
            String token = jwtUtil.generateToken(u.getId());

            Map<String, Object> userDto = Map.of(
                "username", u.getUsername(),
                "email",    u.getEmail(),
                "fullName", u.getFullName()
            );

            return ResponseEntity.ok(Map.of("token", token, "user", userDto));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }

    @PostMapping("/login")
public ResponseEntity<?> login(@RequestBody Map<String, Object> body) {
    try {
        String email = (String) body.get("email");
        String password = (String) body.get("password");
        boolean remember = Boolean.TRUE.equals(body.get("remember"));

        if (email == null || password == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Email and password are required"));
        }

        User u = authService.login(email, password);
        long expiry = remember ? 1000L * 60 * 60 * 24 * 30 : 1000L * 60 * 60 * 24; // 30d vs 1d
        String token = jwtUtil.generateToken(u.getId(), expiry);

        Map<String, Object> userDto = Map.of(
            "username", u.getUsername(),
            "email",    u.getEmail(),
            "fullName", u.getFullName()
        );

        return ResponseEntity.ok(Map.of("token", token, "user", userDto));
    } catch (IllegalArgumentException ex) {
        return ResponseEntity.status(401).body(Map.of("error", ex.getMessage()));
    }
}


    @GetMapping("/profile")
    public ResponseEntity<?> me(HttpServletRequest req) {
        String header = req.getHeader("Authorization");
        if (header == null || !header.startsWith("Bearer ")) {
            return ResponseEntity.status(401)
                .body(Map.of("error", "Missing or invalid Authorization header"));
        }

        String token = header.substring(7);
        Long userId = jwtUtil.extractUserId(token);

        if (userId == null) {
            return ResponseEntity.status(401)
                .body(Map.of("error", "Invalid or expired token"));
        }

        return userRepo.findById(userId)
            .map(u -> ResponseEntity.ok(Map.of(
                "username",  u.getUsername(),
                "email",     u.getEmail(),
                "fullName",  u.getFullName(),
                "createdAt", u.getCreatedAt().toString()
            )))
            .orElseGet(() -> ResponseEntity.status(404).body(Map.of("error", "User not found")));
    }
}
