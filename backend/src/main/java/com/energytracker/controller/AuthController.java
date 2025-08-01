package com.energytracker.controller;

import com.energytracker.security.JwtUtil;
import com.energytracker.service.AuthService;
import com.energytracker.model.User;
import com.energytracker.dto.RefreshRequest;
import com.energytracker.repository.UserRepository;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "http://localhost:5173")
public class AuthController {

    private static final Logger logger = LoggerFactory.getLogger(AuthController.class);

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
            String email     = body.get("email");
            String fullName  = body.get("fullName");
            String password  = body.get("password");
            String username  = body.get("username");

            if (email==null||fullName==null||password==null||username==null) {
                logger.warn("Signup missing fields: {}", body.keySet());
                return ResponseEntity.badRequest().body(Map.of("error","Missing required fields"));
            }

            User u = authService.register(email, fullName, password, username);
            String accessToken  = jwtUtil.generateAccessToken(u.getEmail());
            String refreshToken = jwtUtil.generateRefreshToken(u.getEmail());

            Map<String,Object> userDto = Map.of(
                "username", u.getUsername(),
                "email",    u.getEmail(),
                "fullName", u.getFullName()
            );

            logger.info("User signed up: {}", email);
            return ResponseEntity.ok(Map.of(
                "accessToken",  accessToken,
                "refreshToken", refreshToken,
                "user",         userDto
            ));
        } catch (IllegalArgumentException ex) {
            logger.error("Signup failed: {}", ex.getMessage());
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, Object> body) {
        try {
            String email    = (String) body.get("email");
            String password = (String) body.get("password");
            boolean remember= Boolean.TRUE.equals(body.get("remember"));

            if (email==null||password==null) {
                logger.warn("Login missing credentials");
                return ResponseEntity.badRequest().body(Map.of("error","Email and password required"));
            }

            User u = authService.login(email, password);
            long expiry = remember
                        ? 1000L*60*60*24*30
                        : 1000L*60*60*24;

            String accessToken  = jwtUtil.generateToken(u.getEmail(), expiry);
            String refreshToken = jwtUtil.generateRefreshToken(u.getEmail());

            Map<String,Object> userDto = Map.of(
                "username", u.getUsername(),
                "email",    u.getEmail(),
                "fullName", u.getFullName()
            );

            logger.info("User logged in: {}", email);
            return ResponseEntity.ok(Map.of(
                "accessToken",  accessToken,
                "refreshToken", refreshToken,
                "user",         userDto
            ));
        } catch (IllegalArgumentException ex) {
            logger.warn("Login failed for {}: {}", body.get("email"), ex.getMessage());
            return ResponseEntity.status(401).body(Map.of("error",ex.getMessage()));
        }
    }

    @PostMapping("/refresh")
    public ResponseEntity<?> refreshToken(@RequestBody RefreshRequest req) {
        String refreshToken = req.getRefreshToken();
        if (!jwtUtil.validateRefreshToken(refreshToken)) {
            logger.warn("Invalid refresh token");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                                 .body(Map.of("error","Invalid refresh token"));
        }
        String email = jwtUtil.extractEmail(refreshToken);
        if (email==null) {
            logger.error("Failed to extract email from refresh token");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                                 .body(Map.of("error","Invalid token"));
        }

        String newAccessToken  = jwtUtil.generateAccessToken(email);
        String newRefreshToken = jwtUtil.generateRefreshToken(email);
        logger.info("Refreshed tokens for {}", email);

        return ResponseEntity.ok(Map.of(
            "accessToken",  newAccessToken,
            "refreshToken", newRefreshToken
        ));
    }
}
